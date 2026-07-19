-- Взносы: валюта + когда собираем (start/end). display-only, без реальных платежей.
alter table tournaments add column if not exists fee_currency text;
alter table tournaments add column if not exists fee_timing text not null default 'end';

-- 4-арг оверлоад set_tournament_fee (валюта+тайминг). БЕЗ default'ов — иначе 2-арг
-- вызов задеплоенного клиента станет неоднозначным. 2-арг НЕ дропаем (чистим после батча).
create function public.set_tournament_fee(p_tournament_id uuid, p_per_player integer, p_currency text, p_timing text)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_t tournaments%rowtype;
begin
  select * into v_t from tournaments where id = p_tournament_id;
  if not found then raise exception 'tournament_not_found'; end if;
  if not (is_group_admin(v_t.group_id) or v_t.created_by = current_profile_id()) then
    raise exception 'forbidden';
  end if;
  if p_per_player is not null and p_per_player <= 0 then raise exception 'bad_amount'; end if;
  update tournaments set
    fee_per_player = p_per_player,
    fee_currency = nullif(btrim(p_currency), ''),
    fee_timing = coalesce(nullif(btrim(p_timing), ''), 'end')
  where id = p_tournament_id;
end; $function$;
