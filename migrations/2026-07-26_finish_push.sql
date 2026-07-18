-- 2026-07-26_finish_push.sql
-- Пуш всем участникам при ЗАВЕРШЕНИИ игры/турнира: «сыграно, хорошего вечера,
-- если скидывались — не забудь про взнос». Кладётся в очередь триггерами БД
-- (игра → status 'played', турнир → status 'finished'), разбирает крон
-- send-due-reminders (≤5 мин; приветствие день/вечер — по tz устройства).
-- Идемпотентно. Запускать в Supabase SQL editor. После — редеплой send-due-reminders.

create table if not exists event_push_queue (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  kind       text not null,              -- 'tour_finished' | 'game_finished'
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index if not exists event_push_queue_unsent_idx on event_push_queue (sent_at) where sent_at is null;
alter table event_push_queue enable row level security; -- политик нет: триггеры + service role

-- Турнир завершён → пуш каждому участнику с аккаунтом.
create or replace function notify_tournament_finished()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'finished' and old.status is distinct from 'finished' then
    insert into event_push_queue (profile_id, kind, payload)
    select tp.profile_id, 'tour_finished', jsonb_build_object('t', new.name)
    from tournament_players tp
    join profiles p on p.id = tp.profile_id
    where tp.tournament_id = new.id and tp.profile_id is not null and p.user_id is not null;
  end if;
  return new;
end; $$;
drop trigger if exists trg_tournament_finished on tournaments;
create trigger trg_tournament_finished after update on tournaments
  for each row execute function notify_tournament_finished();

-- Игра сыграна (внесён счёт) → пуш каждому из четвёрки с аккаунтом.
create or replace function notify_game_finished()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'played' and old.status is distinct from 'played' then
    insert into event_push_queue (profile_id, kind, payload)
    select gs.profile_id, 'game_finished', jsonb_build_object('t', coalesce(new.place, ''))
    from game_slots gs
    join profiles p on p.id = gs.profile_id
    where gs.game_id = new.id and gs.profile_id is not null and p.user_id is not null;
  end if;
  return new;
end; $$;
drop trigger if exists trg_game_finished on games;
create trigger trg_game_finished after update on games
  for each row execute function notify_game_finished();
