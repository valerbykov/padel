-- 2026-07-24_tournament_fees.sql
-- «Взносы за турнир»: организатор задаёт сумму С КАЖДОГО (или делит общую в UI),
-- участники сами отмечают «я скинулся», организатор/админ может править любого.
-- Платежи ключуются по tournament_players.id — работает и для гостей без аккаунта
-- (их отмечает организатор). Доступ — только через RPC (security definer),
-- прямых прав на таблицу нет.
-- Идемпотентно. Запускать в Supabase SQL editor.

alter table tournaments add column if not exists fee_per_player integer;

create table if not exists tournament_fee_payments (
  tp_id         uuid primary key references tournament_players(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  marked_by     uuid references profiles(id) on delete set null,
  marked_at     timestamptz not null default now()
);
create index if not exists tournament_fee_payments_t_idx on tournament_fee_payments(tournament_id);
alter table tournament_fee_payments enable row level security; -- политик нет: доступ только через RPC

-- Задать/изменить сумму с игрока (null = убрать). Только админ группы или создатель.
create or replace function set_tournament_fee(p_tournament_id uuid, p_per_player integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_t tournaments%rowtype;
begin
  select * into v_t from tournaments where id = p_tournament_id;
  if not found then raise exception 'tournament_not_found'; end if;
  if not (is_group_admin(v_t.group_id) or v_t.created_by = current_profile_id()) then
    raise exception 'forbidden';
  end if;
  if p_per_player is not null and p_per_player <= 0 then raise exception 'bad_amount'; end if;
  update tournaments set fee_per_player = p_per_player where id = p_tournament_id;
end; $$;

-- Переключить отметку «скинулся» у участника. Сам участник — только свою строку;
-- админ группы / создатель турнира — любую. Возвращает новое состояние (true=скинулся).
create or replace function toggle_fee_paid(p_tp_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_tp tournament_players%rowtype; v_t tournaments%rowtype; v_me uuid;
begin
  select * into v_tp from tournament_players where id = p_tp_id;
  if not found then raise exception 'player_not_found'; end if;
  select * into v_t from tournaments where id = v_tp.tournament_id;
  v_me := current_profile_id();
  if not (
    (v_tp.profile_id is not null and v_tp.profile_id = v_me)      -- сам за себя
    or is_group_admin(v_t.group_id)                               -- админ группы
    or v_t.created_by = v_me                                      -- создатель турнира
  ) then raise exception 'forbidden'; end if;

  if exists (select 1 from tournament_fee_payments where tp_id = p_tp_id) then
    delete from tournament_fee_payments where tp_id = p_tp_id;
    return false;
  else
    insert into tournament_fee_payments (tp_id, tournament_id, marked_by)
    values (p_tp_id, v_tp.tournament_id, v_me);
    return true;
  end if;
end; $$;

-- Кто уже скинулся (список tp_id). Читают участники группы турнира.
create or replace function get_fee_payments(p_tournament_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select f.tp_id from tournament_fee_payments f
  join tournaments t on t.id = f.tournament_id
  where f.tournament_id = p_tournament_id and is_group_member(t.group_id);
$$;

grant execute on function set_tournament_fee(uuid, integer) to authenticated;
grant execute on function toggle_fee_paid(uuid) to authenticated;
grant execute on function get_fee_payments(uuid) to authenticated;
