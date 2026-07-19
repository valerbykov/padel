-- Пары: pair_no на tournament_players (два ряда с одним pair_no = пара;
-- открытая пара = pair_no с одним рядом). Плюс поля приглашения на tournaments.
alter table tournament_players add column if not exists pair_no integer;
create index if not exists tournament_players_pair_idx
  on tournament_players (tournament_id, pair_no) where pair_no is not null;

alter table tournaments add column if not exists description text;
alter table tournaments add column if not exists ends_at timestamptz;
alter table tournaments add column if not exists contact_name text;
alter table tournaments add column if not exists contact_link text;

-- Страховка: не больше 2 игроков на (tournament_id, pair_no). RPC проверяет тоже,
-- но триггер закрывает гонку (двое напарников на одно место одновременно).
create or replace function public.tournament_pair_max2()
returns trigger language plpgsql security invoker set search_path to 'public' as $$
begin
  if NEW.pair_no is not null then
    -- Сериализуем одновременные посадки в одну пару: без этого два напарника,
    -- вставляющиеся параллельно, оба увидят count=1 (READ COMMITTED не блокирует
    -- строки при SELECT) и оба вставятся → 3 в паре. Advisory-lock на (турнир,пара)
    -- держится до конца транзакции — второй ждёт первого и затем видит count=2.
    perform pg_advisory_xact_lock(hashtextextended(NEW.tournament_id::text || ':' || NEW.pair_no::text, 0));
    if (select count(*) from tournament_players
          where tournament_id = NEW.tournament_id and pair_no = NEW.pair_no
            and id <> NEW.id) >= 2 then
      raise exception 'pair_full';
    end if;
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_tournament_pair_max2 on tournament_players;
create trigger trg_tournament_pair_max2
  before insert or update of pair_no, tournament_id on tournament_players
  for each row execute function public.tournament_pair_max2();
