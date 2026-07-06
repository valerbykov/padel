-- 2026-07-18_bell_features.sql
-- Батч 17: объявления лиги, «тебя поставили в состав», пуш по событиям, realtime.
-- Идемпотентно. Запускать в Supabase SQL Editor.
-- После этого задеплоить обновлённую edge-функцию send-due-reminders
-- (supabase functions deploy send-due-reminders).

-- ── 1) Объявления лиги ────────────────────────────────────────────────────────
-- Пишет владелец/организатор, читают участники. Показываются в колокольчике
-- и в «Управлении лигой». author_id проставляется сам (default).
create table if not exists league_posts (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups (id) on delete cascade,
  author_id  uuid references profiles (id) on delete set null default current_profile_id(),
  text       text not null check (length(trim(text)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists league_posts_group_idx on league_posts (group_id, created_at desc);

alter table league_posts enable row level security;
drop policy if exists "members read league_posts" on league_posts;
create policy "members read league_posts" on league_posts
  for select using (is_group_member(group_id));
drop policy if exists "admin create league_posts" on league_posts;
create policy "admin create league_posts" on league_posts
  for insert to authenticated with check (is_group_admin(group_id));
drop policy if exists "admin delete league_posts" on league_posts;
create policy "admin delete league_posts" on league_posts
  for delete to authenticated using (is_group_admin(group_id));

-- ── 2) «Тебя поставили в состав» ─────────────────────────────────────────────
-- game_slots не имел таймстампа занятия слота. Добавляем taken_at/taken_by,
-- триггер фиксирует момент и АВТОРА действия (current_profile_id() = кто сделал
-- insert/update). В колокольчике фильтруем taken_by <> me — самозапись не событие.
alter table game_slots add column if not exists taken_at timestamptz;
alter table game_slots add column if not exists taken_by uuid;

create or replace function set_slot_taken() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is not null
     and (tg_op = 'INSERT' or new.profile_id is distinct from old.profile_id) then
    new.taken_at := now();
    new.taken_by := current_profile_id();
  end if;
  return new;
end; $$;

drop trigger if exists trg_slot_taken on game_slots;
create trigger trg_slot_taken before insert or update on game_slots
  for each row execute function set_slot_taken();

-- Кто добавил игрока в турнир (self-join через join_tournament → сам себя).
alter table tournament_players add column if not exists added_by uuid default current_profile_id();

-- ── 3) Пуш по событиям колокольчика ──────────────────────────────────────────
-- Личный тумблер (по умолчанию вкл; работает только при общем enabled).
alter table notification_prefs add column if not exists notify_events boolean not null default true;

-- «Созревшие» событийные пуши: новые игры/турниры/объявления за lookback-окно,
-- адресаты — участники лиги с включёнными пушами, кроме автора события.
-- Дедуп — reminder_log с offset_min = 0 (PK совпадает).
create or replace function due_event_pushes(lookback_min int default 15)
returns table (user_id uuid, event_type text, event_id uuid, title text, place text, league text)
language sql stable security definer set search_path = public as $$
  with members as (
    select gm.group_id, p.user_id, p.id as profile_id
    from group_members gm
    join profiles p on p.id = gm.profile_id
    where p.user_id is not null
  ),
  ev as (
    -- title отдаём «сырым» (без coalesce на place) — иначе в тексте пуша
    -- место дублируется («Club X · Club X»); фолбэк «Игра» есть на стороне функции.
    -- Микс-раунды («Сыграть ещё», mix_group_id) — внутренние пере-жеребьёвки,
    -- НЕ новость для лиги: без фильтра одна микс-сессия заспамила бы всех участников.
    select 'new_game'::text as event_type, g.id as event_id, g.group_id,
           g.title, g.place, g.host_id as author, g.created_at
    from games g where g.created_at > now() - make_interval(mins => lookback_min)
      and g.mix_group_id is null
    union all
    select 'new_tournament', t.id, t.group_id,
           t.name, t.place, t.created_by, t.created_at
    from tournaments t where t.created_at > now() - make_interval(mins => lookback_min)
    union all
    select 'league_post', lp.id, lp.group_id,
           left(lp.text, 160), null, lp.author_id, lp.created_at
    from league_posts lp where lp.created_at > now() - make_interval(mins => lookback_min)
  )
  select m.user_id, ev.event_type, ev.event_id, ev.title, ev.place, gr.name as league
  from ev
  join members m on m.group_id = ev.group_id
  join groups gr on gr.id = ev.group_id
  join notification_prefs np on np.user_id = m.user_id
    and np.enabled and np.notify_events
  where (ev.author is null or ev.author <> m.profile_id)
    and not exists (
      select 1 from reminder_log rl
      where rl.user_id = m.user_id and rl.event_type = ev.event_type
        and rl.event_id = ev.event_id and rl.offset_min = 0
    );
$$;
-- Только сервер (service_role); клиентам не нужна.
revoke execute on function due_event_pushes(int) from public, anon, authenticated;

-- ── 4) Realtime для мгновенного бейджа ───────────────────────────────────────
-- Колокольчик подписывается на insert в games/tournaments/league_posts.
-- Добавляем таблицы в публикацию, если их там ещё нет.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'games') then
      alter publication supabase_realtime add table games;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tournaments') then
      alter publication supabase_realtime add table tournaments;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'league_posts') then
      alter publication supabase_realtime add table league_posts;
    end if;
  end if;
end $$;
