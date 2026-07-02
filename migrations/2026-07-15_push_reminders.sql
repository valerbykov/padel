-- Push-напоминания о сборе на игру/турнир.
-- Токены устройств (FCM), личные офсеты напоминаний, лог отправленного.
-- Применить один раз в Supabase → SQL editor.

-- 1) Токены устройств. Один пользователь — много устройств. token — PK (уникален у FCM).
create table if not exists public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text,                                  -- 'android' | 'ios' | 'web'
  updated_at  timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2) Личные настройки напоминаний. offsets — минуты до старта (мультивыбор пользователя).
--    По умолчанию: за день (1440) и за 2 часа (120).
create table if not exists public.notification_prefs (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  enabled     boolean not null default true,
  offsets     int[]   not null default '{1440,120}',
  updated_at  timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
drop policy if exists notif_prefs_own on public.notification_prefs;
create policy notif_prefs_own on public.notification_prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3) Лог отправленных — защита от повторной отправки одного и того же напоминания.
--    Пишется только сервером (service_role), клиенту доступ не нужен → RLS без политик (deny all).
create table if not exists public.reminder_log (
  user_id    uuid not null references auth.users(id) on delete cascade,
  event_type text not null,                          -- 'game' | 'tournament'
  event_id   uuid not null,
  offset_min int  not null,
  sent_at    timestamptz not null default now(),
  primary key (user_id, event_type, event_id, offset_min)
);
alter table public.reminder_log enable row level security;

-- 4) «Созревшие» напоминания: события в будущем, где юзер — участник, у него включены
--    уведомления, момент (starts_at - offset) уже наступил, но ещё в пределах look-back окна,
--    и это напоминание ещё не отправлено. Возвращает всё нужное для пуша.
--    security definer: вызывается сервером (edge-функция) для рассылки.
create or replace function public.due_reminders(lookback_min int default 15)
returns table (
  user_id     uuid,
  event_type  text,
  event_id    uuid,
  offset_min  int,
  title       text,
  starts_at   timestamptz,
  place       text
)
language sql
security definer
set search_path = public
as $$
  with parts as (
    -- участники игр
    select p.user_id, 'game'::text as event_type, g.id as event_id,
           g.title, g.starts_at, g.place
    from public.games g
    join public.game_slots s on s.game_id = g.id
    join public.profiles p on p.id = s.profile_id
    where g.starts_at is not null and p.user_id is not null
    union
    -- участники турниров
    select p.user_id, 'tournament'::text, t.id,
           t.title, t.starts_at, t.place
    from public.tournaments t
    join public.tournament_players tp on tp.tournament_id = t.id
    join public.profiles p on p.id = tp.profile_id
    where t.starts_at is not null and p.user_id is not null
  )
  select parts.user_id, parts.event_type, parts.event_id, o.offset_min,
         parts.title, parts.starts_at, parts.place
  from parts
  join public.notification_prefs np on np.user_id = parts.user_id and np.enabled
  cross join lateral unnest(np.offsets) as o(offset_min)
  where parts.starts_at - make_interval(mins => o.offset_min)
          between now() - make_interval(mins => lookback_min) and now()
    and not exists (
      select 1 from public.reminder_log rl
      where rl.user_id = parts.user_id
        and rl.event_type = parts.event_type
        and rl.event_id = parts.event_id
        and rl.offset_min = o.offset_min
    );
$$;

revoke all on function public.due_reminders(int) from anon, authenticated;
