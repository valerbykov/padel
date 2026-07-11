-- «Покинуть лигу» / «Удалить лигу» + чистка брошенных демо-лиг.
-- Применить в Supabase → SQL editor. Требует pg_cron (уже включён для пушей).

-- Осиротевшие гостевые профили (user_id is null), оставшиеся без единой лиги
-- и без следов в истории, — подчищаем после удаления лиги. Профили с аккаунтом
-- не трогаем никогда.
create or replace function public.prune_orphan_guests(p_ids uuid[])
returns void
language sql security definer set search_path = public as $$
  delete from profiles p
   where p.id = any(p_ids)
     and p.user_id is null
     and not exists (select 1 from group_members gm where gm.profile_id = p.id)
     and not exists (select 1 from matches m where p.id = any(m.team_a) or p.id = any(m.team_b))
     and not exists (select 1 from tournament_players tp where tp.profile_id = p.id)
     and not exists (select 1 from game_slots gs where gs.profile_id = p.id);
$$;
revoke execute on function prune_orphan_guests(uuid[]) from public, anon, authenticated;

-- Выход из лиги: удаляем только своё членство; история матчей и турниров
-- остаётся (матчи хранят profile_id в массивах команд). Владелец выйти не
-- может — сначала удалить лигу (или передать её, когда появится такая ручка).
create or replace function public.leave_league(p_group_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := current_profile_id();
begin
  if me is null then raise exception 'profile_required'; end if;
  if exists (select 1 from groups where id = p_group_id and owner_id = me) then
    raise exception 'owner_cannot_leave';
  end if;
  delete from group_members where group_id = p_group_id and profile_id = me;
end; $$;
grant execute on function leave_league(uuid) to authenticated;

-- Удаление лиги (только владелец): каскад сносит членства, игры, матчи,
-- турниры и историю рейтингов; затем подчищаем осиротевших гостей (в т.ч.
-- собак демо-лиги). Логотип в Storage не трогаем — бакет публичный, мусор
-- безвреден и не обязателен к чистке отсюда.
create or replace function public.delete_league(p_group_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := current_profile_id();
  mem uuid[];
begin
  if me is null then raise exception 'profile_required'; end if;
  if not exists (select 1 from groups where id = p_group_id and owner_id = me) then
    raise exception 'owner_only';
  end if;
  select array_agg(profile_id) into mem from group_members where group_id = p_group_id;
  delete from groups where id = p_group_id;
  if mem is not null then perform prune_orphan_guests(mem); end if;
end; $$;
grant execute on function delete_league(uuid) to authenticated;

-- Чистка брошенных демо-лиг: демо старше 30 дней, где 30+ дней не было ни
-- матчей, ни новых игр (создание игры = признак жизни, даже без счёта).
create or replace function public.cleanup_demo_leagues()
returns int
language plpgsql security definer set search_path = public as $$
declare
  g record;
  mem uuid[];
  n int := 0;
begin
  for g in
    select id from groups gr
     where gr.is_demo
       and gr.created_at < now() - interval '30 days'
       and not exists (select 1 from matches m
                        where m.group_id = gr.id and m.played_at > now() - interval '30 days')
       and not exists (select 1 from games gm
                        where gm.group_id = gr.id and gm.created_at > now() - interval '30 days')
  loop
    select array_agg(profile_id) into mem from group_members where group_id = g.id;
    delete from groups where id = g.id;
    if mem is not null then perform prune_orphan_guests(mem); end if;
    n := n + 1;
  end loop;
  return n;
end; $$;
revoke execute on function cleanup_demo_leagues() from public, anon, authenticated;

-- Раз в сутки, ночью (pg_cron уже включён миграцией push_cron).
select cron.unschedule('cleanup-demo-leagues')
where exists (select 1 from cron.job where jobname = 'cleanup-demo-leagues');

select cron.schedule(
  'cleanup-demo-leagues',
  '30 3 * * *',
  $$select public.cleanup_demo_leagues();$$
);
