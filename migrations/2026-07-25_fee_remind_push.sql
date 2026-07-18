-- 2026-07-25_fee_remind_push.sql
-- «Напомнить должникам» пушем: адресное уведомление на локскрин ТОЛЬКО тем
-- участникам завершённого турнира, кто ещё не отметился в взносах (и у кого
-- есть аккаунт). Очередь разбирает крон send-due-reminders (≤5 мин задержки).
-- Требует применённой 2026-07-24_tournament_fees.sql. Идемпотентно.

create table if not exists fee_reminder_queue (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  requested_by  uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index if not exists fee_reminder_queue_unsent_idx on fee_reminder_queue (sent_at) where sent_at is null;
alter table fee_reminder_queue enable row level security; -- политик нет: RPC + service role

-- Поставить в очередь пуши всем неотметившимся С АККАУНТОМ. Права: админ группы
-- или создатель турнира. Троттлинг: одному человеку по одному турниру — не чаще
-- раза в час (защита от спама повторными тапами). Возвращает, скольким поставлено.
create or replace function remind_fee_debtors(p_tournament_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_t tournaments%rowtype; v_me uuid; v_n integer;
begin
  select * into v_t from tournaments where id = p_tournament_id;
  if not found then raise exception 'tournament_not_found'; end if;
  v_me := current_profile_id();
  if not (is_group_admin(v_t.group_id) or v_t.created_by = v_me) then
    raise exception 'forbidden';
  end if;
  if v_t.fee_per_player is null then raise exception 'fee_not_set'; end if;

  insert into fee_reminder_queue (tournament_id, profile_id, requested_by)
  select tp.tournament_id, tp.profile_id, v_me
  from tournament_players tp
  join profiles p on p.id = tp.profile_id
  where tp.tournament_id = p_tournament_id
    and tp.profile_id is not null
    and p.user_id is not null                                   -- есть аккаунт → есть куда пушить
    and not exists (select 1 from tournament_fee_payments f where f.tp_id = tp.id)  -- ещё не скинулся
    and not exists (                                            -- троттлинг: час
      select 1 from fee_reminder_queue q
      where q.tournament_id = p_tournament_id and q.profile_id = tp.profile_id
        and q.created_at > now() - interval '1 hour');
  get diagnostics v_n = row_count;
  return v_n;
end; $$;

grant execute on function remind_fee_debtors(uuid) to authenticated;
