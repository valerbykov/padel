-- 2026-07-27_game_fees.sql
-- Взносы для ИГР (как у турниров): сумма с игрока, отметки «скинулся»,
-- пуш-напоминание должникам. Плюс очередь напоминаний обобщается на игры.
-- Требует применённых 2026-07-24 и 2026-07-25. Идемпотентно.
-- После — редеплой send-due-reminders.

alter table games add column if not exists fee_per_player integer;

create table if not exists game_fee_payments (
  slot_id   uuid primary key references game_slots(id) on delete cascade,
  game_id   uuid not null references games(id) on delete cascade,
  marked_by uuid references profiles(id) on delete set null,
  marked_at timestamptz not null default now()
);
create index if not exists game_fee_payments_g_idx on game_fee_payments(game_id);
alter table game_fee_payments enable row level security; -- доступ только через RPC

-- Очередь напоминаний: поддержка игр (было только турниры).
alter table fee_reminder_queue alter column tournament_id drop not null;
alter table fee_reminder_queue add column if not exists game_id uuid references games(id) on delete cascade;

-- Сумма с игрока для игры. Права: админ группы или хост игры.
create or replace function set_game_fee(p_game_id uuid, p_per_player integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_g games%rowtype;
begin
  select * into v_g from games where id = p_game_id;
  if not found then raise exception 'game_not_found'; end if;
  if not ((v_g.group_id is not null and is_group_admin(v_g.group_id)) or v_g.host_id = current_profile_id()) then
    raise exception 'forbidden';
  end if;
  if p_per_player is not null and p_per_player <= 0 then raise exception 'bad_amount'; end if;
  update games set fee_per_player = p_per_player where id = p_game_id;
end; $$;

-- Переключить «скинулся» у слота. Сам за себя / админ / хост.
create or replace function toggle_game_fee_paid(p_slot_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_s game_slots%rowtype; v_g games%rowtype; v_me uuid;
begin
  select * into v_s from game_slots where id = p_slot_id;
  if not found then raise exception 'slot_not_found'; end if;
  select * into v_g from games where id = v_s.game_id;
  v_me := current_profile_id();
  if not (
    (v_s.profile_id is not null and v_s.profile_id = v_me)
    or (v_g.group_id is not null and is_group_admin(v_g.group_id))
    or v_g.host_id = v_me
  ) then raise exception 'forbidden'; end if;

  if exists (select 1 from game_fee_payments where slot_id = p_slot_id) then
    delete from game_fee_payments where slot_id = p_slot_id;
    return false;
  else
    insert into game_fee_payments (slot_id, game_id, marked_by) values (p_slot_id, v_s.game_id, v_me);
    return true;
  end if;
end; $$;

-- Кто скинулся (slot_id). Участники группы игры или участники самой игры.
create or replace function get_game_fee_payments(p_game_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select f.slot_id from game_fee_payments f
  join games g on g.id = f.game_id
  where f.game_id = p_game_id
    and (
      (g.group_id is not null and is_group_member(g.group_id))
      or exists (select 1 from game_slots s where s.game_id = g.id and s.profile_id = current_profile_id())
    );
$$;

-- Пуш-напоминание должникам игры (в общую очередь; троттлинг час).
create or replace function remind_game_fee_debtors(p_game_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_g games%rowtype; v_me uuid; v_n integer;
begin
  select * into v_g from games where id = p_game_id;
  if not found then raise exception 'game_not_found'; end if;
  v_me := current_profile_id();
  if not ((v_g.group_id is not null and is_group_admin(v_g.group_id)) or v_g.host_id = v_me) then
    raise exception 'forbidden';
  end if;
  if v_g.fee_per_player is null then raise exception 'fee_not_set'; end if;

  insert into fee_reminder_queue (game_id, profile_id, requested_by)
  select v_g.id, s.profile_id, v_me
  from game_slots s
  join profiles p on p.id = s.profile_id
  where s.game_id = p_game_id
    and s.profile_id is not null
    and p.user_id is not null
    and not exists (select 1 from game_fee_payments f where f.slot_id = s.id)
    and not exists (
      select 1 from fee_reminder_queue q
      where q.game_id = p_game_id and q.profile_id = s.profile_id
        and q.created_at > now() - interval '1 hour');
  get diagnostics v_n = row_count;
  return v_n;
end; $$;

grant execute on function set_game_fee(uuid, integer) to authenticated;
grant execute on function toggle_game_fee_paid(uuid) to authenticated;
grant execute on function get_game_fee_payments(uuid) to authenticated;
grant execute on function remind_game_fee_debtors(uuid) to authenticated;
