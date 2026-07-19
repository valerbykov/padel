-- Взносы у игр (не работали: не было колонок/таблицы/RPC). Зеркало турнирных,
-- ключ оплаты = game_slots.id (как players.key в FeesCard игры).
alter table games add column if not exists fee_per_player integer;
alter table games add column if not exists fee_currency text;
alter table games add column if not exists fee_timing text not null default 'end';

create table if not exists game_fee_payments (
  slot_id uuid primary key references game_slots(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  marked_by uuid,
  created_at timestamptz not null default now()
);
alter table game_fee_payments enable row level security;
-- Доступ только через SECURITY DEFINER RPC ниже (клиентских политик нет).

create or replace function public.set_game_fee(p_game_id uuid, p_per_player integer, p_currency text, p_timing text)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_g games%rowtype;
begin
  select * into v_g from games where id = p_game_id;
  if not found then raise exception 'game_not_found'; end if;
  if not (is_group_admin(v_g.group_id) or v_g.host_id = current_profile_id()) then
    raise exception 'forbidden';
  end if;
  if p_per_player is not null and p_per_player <= 0 then raise exception 'bad_amount'; end if;
  update games set
    fee_per_player = p_per_player,
    fee_currency = nullif(btrim(p_currency), ''),
    fee_timing = coalesce(nullif(btrim(p_timing), ''), 'end')
  where id = p_game_id;
end; $function$;

create or replace function public.get_game_fee_payments(p_game_id uuid)
returns setof uuid language sql stable security definer set search_path to 'public'
as $function$
  select f.slot_id from game_fee_payments f
  join games g on g.id = f.game_id
  where f.game_id = p_game_id and is_group_member(g.group_id);
$function$;

create or replace function public.toggle_game_fee_paid(p_slot_id uuid)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare v_s game_slots%rowtype; v_g games%rowtype; v_me uuid;
begin
  select * into v_s from game_slots where id = p_slot_id;
  if not found then raise exception 'slot_not_found'; end if;
  select * into v_g from games where id = v_s.game_id;
  v_me := current_profile_id();
  if not (
    (v_s.profile_id is not null and v_s.profile_id = v_me)
    or is_group_admin(v_g.group_id)
    or v_g.host_id = v_me
  ) then raise exception 'forbidden'; end if;

  if exists (select 1 from game_fee_payments where slot_id = p_slot_id) then
    delete from game_fee_payments where slot_id = p_slot_id;
    return false;
  else
    insert into game_fee_payments (slot_id, game_id, marked_by)
    values (p_slot_id, v_s.game_id, v_me);
    return true;
  end if;
end; $function$;
