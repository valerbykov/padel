-- Push-напоминание взносов: очередь адресных пушей должникам. Отправитель (edge
-- send-due-reminders) УЖЕ читает эту таблицу (tournament_id/game_id), шлёт пуш и
-- авто-постит в TG-чат лиги — но самой таблицы и RPC постановки в очередь не было,
-- поэтому кнопка «🔔 Напомнить пушем» падала. Здесь: таблица + два RPC (турнир/игра).
create table if not exists fee_reminder_queue (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  tournament_id uuid references tournaments(id) on delete cascade,
  game_id uuid references games(id) on delete cascade,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists fee_reminder_queue_unsent_idx on fee_reminder_queue (sent_at) where sent_at is null;
create index if not exists fee_reminder_queue_dedup_idx on fee_reminder_queue (profile_id, tournament_id, game_id, created_at);
alter table fee_reminder_queue enable row level security;
-- Доступ только через SECURITY DEFINER RPC (постановка) и service-role edge (чтение/отметка).

-- Поставить в очередь напоминания неоплатившим ЗАРЕГИСТРИРОВАННЫМ участникам турнира.
-- Возвращает, скольким поставлено (0 = все скинулись или напоминали < часа назад).
create or replace function public.remind_fee_debtors(p_tournament_id uuid)
returns integer language plpgsql security definer set search_path to 'public'
as $function$
declare v_t tournaments%rowtype; v_n int;
begin
  select * into v_t from tournaments where id = p_tournament_id;
  if not found then raise exception 'tournament_not_found'; end if;
  if not (is_group_admin(v_t.group_id) or v_t.created_by = current_profile_id()) then
    raise exception 'forbidden';
  end if;
  if coalesce(v_t.fee_per_player, 0) <= 0 then return 0; end if;

  insert into fee_reminder_queue (profile_id, tournament_id)
  select tp.profile_id, p_tournament_id
    from tournament_players tp
    join profiles pr on pr.id = tp.profile_id
   where tp.tournament_id = p_tournament_id
     and tp.profile_id is not null and pr.user_id is not null
     and not exists (select 1 from tournament_fee_payments f where f.tp_id = tp.id)
     and not exists (select 1 from fee_reminder_queue q
                      where q.profile_id = tp.profile_id and q.tournament_id = p_tournament_id
                        and q.created_at > now() - interval '1 hour');
  get diagnostics v_n = row_count;
  return v_n;
end; $function$;

-- То же для ИГРЫ (должник = слот без оплаты; ключ платежа — game_slots.id).
create or replace function public.remind_game_fee_debtors(p_game_id uuid)
returns integer language plpgsql security definer set search_path to 'public'
as $function$
declare v_g games%rowtype; v_n int;
begin
  select * into v_g from games where id = p_game_id;
  if not found then raise exception 'game_not_found'; end if;
  if not (is_group_admin(v_g.group_id) or v_g.host_id = current_profile_id()) then
    raise exception 'forbidden';
  end if;
  if coalesce(v_g.fee_per_player, 0) <= 0 then return 0; end if;

  insert into fee_reminder_queue (profile_id, game_id)
  select gs.profile_id, p_game_id
    from game_slots gs
    join profiles pr on pr.id = gs.profile_id
   where gs.game_id = p_game_id
     and gs.profile_id is not null and pr.user_id is not null
     and not exists (select 1 from game_fee_payments f where f.slot_id = gs.id)
     and not exists (select 1 from fee_reminder_queue q
                      where q.profile_id = gs.profile_id and q.game_id = p_game_id
                        and q.created_at > now() - interval '1 hour');
  get diagnostics v_n = row_count;
  return v_n;
end; $function$;
