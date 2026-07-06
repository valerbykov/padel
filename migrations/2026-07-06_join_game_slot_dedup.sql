-- Дедуп при вступлении в игру по ссылке (/j/CODE → join_game_slot).
-- Проблема: организатор поставил игрока в слот, тот же человек вступил по ссылке и
-- занял другой слот → он в игре дважды. Теперь:
--   (a) если вступающий уже стоит в этой игре тем же profile_id → возвращаем его слот
--       (флаг already), новый не занимаем;
--   (b) если тот же человек уже стоит ГОСТЕМ (слот с гостевым профилем — совпал
--       email → phone → telegram; либо guest_name с тем же именем) → привязываем ТОТ
--       слот к аккаунту (флаг linked), новый не занимаем;
--   (c) иначе — обычное занятие свободного слота (как раньше).
-- Привязываем только гостевые слоты (profiles.user_id is null / profile_id null),
-- чтобы не «увести» чужой зарегистрированный профиль.

create or replace function public.join_game_slot(p_code text, p_team text, p_position integer, p_guest_name text)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  v_game     games;
  v_slot     game_slots;
  v_existing game_slots;
  v_profile  uuid;
  v_me       profiles;
begin
  select * into v_game from games where invite_code = upper(p_code);
  if not found then raise exception 'game_not_found'; end if;
  if v_game.status <> 'open' then raise exception 'game_closed'; end if;

  -- если вызывающий авторизован — берём его профиль
  select id into v_profile from profiles where user_id = auth.uid();

  if v_profile is not null then
    select * into v_me from profiles where id = v_profile;

    -- (a) уже в этой игре тем же профилем → возвращаем существующий слот
    select * into v_existing from game_slots
      where game_id = v_game.id and profile_id = v_profile
      limit 1;
    if found then
      return to_jsonb(v_existing) || jsonb_build_object('already', true);
    end if;

    -- (b) тот же человек уже стоит гостем → привязываем тот слот к аккаунту
    update game_slots gs
       set profile_id = v_profile, guest_name = null
     where gs.id = (
       select gs2.id
         from game_slots gs2
         left join profiles pr on pr.id = gs2.profile_id
        where gs2.game_id = v_game.id
          and gs2.profile_id is distinct from v_profile
          and (pr.id is null or pr.user_id is null)         -- только гостевые слоты
          and (
               (nullif(btrim(v_me.email), '') is not null and (
                    lower(btrim(pr.email)) = lower(btrim(v_me.email))
                 or lower(btrim(pr.contacts->>'email')) = lower(btrim(v_me.email))))
            or (nullif(btrim(v_me.phone), '') is not null and (
                    nullif(btrim(pr.phone), '') = nullif(btrim(v_me.phone), '')
                 or nullif(btrim(pr.contacts->>'phone'), '') = nullif(btrim(v_me.phone), '')))
            or (nullif(btrim(v_me.contacts->>'telegram'), '') is not null
                and lower(nullif(btrim(pr.contacts->>'telegram'), ''))
                  = lower(nullif(btrim(v_me.contacts->>'telegram'), '')))
               -- гость-по-имени (guest_name без профиля) → по имени
            or (gs2.profile_id is null and nullif(btrim(gs2.guest_name), '') is not null
                and lower(btrim(gs2.guest_name)) = lower(btrim(coalesce(v_me.name, ''))))
          )
        limit 1
     )
    returning * into v_existing;
    if found then
      return to_jsonb(v_existing) || jsonb_build_object('linked', true);
    end if;
  end if;

  -- (c) обычное занятие свободного слота
  update game_slots
     set profile_id = v_profile,
         guest_name = case when v_profile is null then p_guest_name else null end
   where game_id = v_game.id and team = p_team and position = p_position
     and profile_id is null and guest_name is null
  returning * into v_slot;
  if not found then raise exception 'slot_taken'; end if;
  return to_jsonb(v_slot);
end; $function$;
