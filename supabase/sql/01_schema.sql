-- =====================================================================
--  PADEL · ЛИГА ДРУЗЕЙ — схема Supabase (PostgreSQL)
--  Покрывает: профили, группы, открытые игры с приглашением по ссылке,
--  сыгранные матчи и историю изменения рейтинга (ELO).
--  Запускать в Supabase → SQL Editor.
-- =====================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- 1. ПРОФИЛИ
--    Привязаны к auth.users. Гость (зашедший по ссылке без аккаунта)
--    создаётся как профиль без user_id, и потом может «привязаться».
-- ---------------------------------------------------------------------
create table profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users (id) on delete set null,  -- null = гость
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. ГРУППЫ (компании друзей) и участники.
--    Рейтинг считается ВНУТРИ группы (ключевое отличие от Playtomic).
-- ---------------------------------------------------------------------
create table groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table group_members (
  group_id    uuid references groups (id) on delete cascade,
  profile_id  uuid references profiles (id) on delete cascade,
  -- рейтинг живёт на связке игрок+группа
  rating          integer not null default 1000,
  matches_played  integer not null default 0,
  wins            integer not null default 0,
  role        text not null default 'member',     -- 'owner' | 'admin' | 'member'
  joined_at   timestamptz not null default now(),
  primary key (group_id, profile_id)
);

-- ---------------------------------------------------------------------
-- 3. ИГРЫ (приглашение по ссылке).
--    invite_code — короткий неугадываемый токен в ссылке /j/:code.
--    status: open → played → cancelled.
-- ---------------------------------------------------------------------
create table games (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid references groups (id) on delete cascade,
  invite_code  text not null unique,             -- напр. 'K7P2'
  title        text,
  starts_at    timestamptz,                      -- дата/время игры
  place        text,                             -- корт / клуб
  host_id      uuid references profiles (id) on delete set null,
  status       text not null default 'open',
  created_at   timestamptz not null default now()
);
create index games_invite_code_idx on games (invite_code);
create index games_group_idx       on games (group_id);

-- слоты игры: 4 штуки. team 'A'/'B', position 1/2.
create table game_slots (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games (id) on delete cascade,
  team        text not null check (team in ('A','B')),
  position    smallint not null check (position in (1,2)),
  profile_id  uuid references profiles (id) on delete set null,  -- null = свободно
  guest_name  text,                              -- если зашёл без аккаунта
  unique (game_id, team, position)
);

-- ---------------------------------------------------------------------
-- 4. МАТЧИ (результат сыгранной игры) и изменения рейтинга.
-- ---------------------------------------------------------------------
create table matches (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid references games (id) on delete set null,
  group_id    uuid not null references groups (id) on delete cascade,
  team_a      uuid[] not null,                   -- [profile_id, profile_id]
  team_b      uuid[] not null,
  sets_a      smallint not null,
  sets_b      smallint not null,
  played_at   timestamptz not null default now()
);
create index matches_group_idx on matches (group_id, played_at desc);

create table rating_changes (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references matches (id) on delete cascade,
  group_id      uuid not null references groups (id) on delete cascade,
  profile_id    uuid not null references profiles (id) on delete cascade,
  delta         integer not null,
  rating_after  integer not null,
  created_at    timestamptz not null default now()
);
-- индекс для графика истории рейтинга игрока
create index rating_changes_player_idx on rating_changes (group_id, profile_id, created_at);

-- ---------------------------------------------------------------------
-- 5. ELO (расчёт на стороне БД). Вызывается из Edge Function при вводе счёта.
--    Парный матч: рейтинг команды = среднее; результат с учётом разгрома.
-- ---------------------------------------------------------------------
create or replace function elo_delta(
  rating_for int, rating_against int, score numeric, matches_played int
) returns int language plpgsql immutable as $$
declare
  expected numeric;
  k int;
begin
  expected := 1.0 / (1.0 + power(10.0, (rating_against - rating_for) / 400.0));
  k := case when matches_played < 5 then 60
            when matches_played < 15 then 40
            else 24 end;
  return round(k * (score - expected));
end; $$;

-- ---------------------------------------------------------------------
-- 6. RLS (Row Level Security) — каркас. Включить и доработать политики.
--    Идея: читать/писать может только участник группы;
--    открытую игру по invite_code может прочитать любой (для приглашения).
-- ---------------------------------------------------------------------
alter table profiles       enable row level security;
alter table groups         enable row level security;
alter table group_members  enable row level security;
alter table games          enable row level security;
alter table game_slots     enable row level security;
alter table matches        enable row level security;
alter table rating_changes enable row level security;

-- участник группы видит свою группу
create policy "members read group" on groups for select
  using (exists (select 1 from group_members gm
                 join profiles p on p.id = gm.profile_id
                 where gm.group_id = groups.id and p.user_id = auth.uid()));

-- любой может прочитать открытую игру по коду (резолв приглашения)
-- (в продакшене резолв лучше делать через защищённую RPC/Edge Function,
--  чтобы не отдавать всю таблицу — см. ниже get_game_by_code)
create policy "read open game" on games for select
  using (status = 'open');

-- ---------------------------------------------------------------------
-- 7. RPC для безопасного резолва приглашения (отдаёт одну игру по коду).
-- ---------------------------------------------------------------------
create or replace function get_game_by_code(p_code text)
returns table (id uuid, title text, starts_at timestamptz, place text, status text)
language sql security definer as $$
  select id, title, starts_at, place, status
  from games where invite_code = p_code limit 1;
$$;

-- =====================================================================
--  Edge Function (псевдо, TypeScript) — ввод счёта и пересчёт рейтинга.
--  Положить в supabase/functions/submit-result/index.ts
-- =====================================================================
-- import { createClient } from "jsr:@supabase/supabase-js@2";
--
-- Deno.serve(async (req) => {
--   const { gameId, setsA, setsB } = await req.json();
--   const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
--
--   // 1. достать игру, слоты, текущие rating/matches игроков из group_members
--   // 2. teamA = [slot A1, A2], teamB = [slot B1, B2]
--   // 3. ratA = (rA1+rA2)/2 ; ratB = (rB1+rB2)/2
--   // 4. scoreA = setsA/(setsA+setsB) ; scoreB = 1-scoreA
--   // 5. для каждого игрока: delta = elo_delta(командный_рейтинг_за, против, score, matches)
--   //    (вызвать SQL-функцию elo_delta через rpc или посчитать в TS)
--   // 6. в транзакции:
--   //      insert into matches(...)
--   //      update group_members set rating=rating+delta, matches_played+1, wins+...
--   //      insert into rating_changes(delta, rating_after) -- для графика
--   //      update games set status='played'
--   //   вернуть дельты клиенту
-- });
