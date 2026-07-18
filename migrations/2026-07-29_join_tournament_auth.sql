-- join_tournament доверял клиентскому p_profile_id → любой мог записать в турнир
-- ЧУЖОЙ профиль или перехватить гостевую строку жертвы (привязать её к себе).
-- Теперь профиль вступающего берём строго из auth.uid(); p_profile_id оставлен в
-- сигнатуре ради обратной совместимости клиента, но полностью игнорируется.
-- Аноним (auth.uid() = null) → гость по имени, как и раньше.
create or replace function public.join_tournament(p_code text, p_name text, p_profile_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_t    tournaments;
  v_me   profiles;
  v_uid  uuid := auth.uid();
  v_pid  uuid;
  v_count int;
begin
  select * into v_t from tournaments where invite_code = upper(p_code);
  if not found then raise exception 'tournament_not_found'; end if;
  if v_t.status <> 'open' then raise exception 'tournament_closed'; end if;

  -- Профиль вступающего — ТОЛЬКО из auth.uid() (не доверяем клиентскому p_profile_id).
  if v_uid is not null then
    select * into v_me from profiles where user_id = v_uid;
    v_pid := v_me.id;
  else
    v_pid := null;  -- аноним → гость по имени
  end if;

  -- (a) уже участвует тем же профилем → идемпотентно
  if v_pid is not null and exists (
       select 1 from tournament_players where tournament_id = v_t.id and profile_id = v_pid
     ) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  -- (b) тот же человек уже добавлен ГОСТЕМ → привязываем к аккаунту
  if v_pid is not null then
    update tournament_players tp
       set profile_id = v_pid,
           name       = coalesce(nullif(btrim(p_name), ''), tp.name)
     where tp.id = (
       select tp2.id
         from tournament_players tp2
         left join profiles pr on pr.id = tp2.profile_id
        where tp2.tournament_id = v_t.id
          and tp2.profile_id is distinct from v_pid
          and (pr.id is null or pr.user_id is null)
          and (
               (nullif(btrim(v_me.email), '') is not null and (
                    lower(btrim(pr.email)) = lower(btrim(v_me.email))
                 or lower(btrim(pr.contacts->>'email')) = lower(btrim(v_me.email))
               ))
            or (nullif(btrim(v_me.phone), '') is not null and (
                    nullif(btrim(pr.phone), '') = nullif(btrim(v_me.phone), '')
                 or nullif(btrim(pr.contacts->>'phone'), '') = nullif(btrim(v_me.phone), '')
               ))
            or (nullif(btrim(v_me.contacts->>'telegram'), '') is not null
                and lower(nullif(btrim(pr.contacts->>'telegram'), ''))
                  = lower(nullif(btrim(v_me.contacts->>'telegram'), '')))
            or (tp2.profile_id is null
                and nullif(btrim(tp2.name), '') is not null
                and lower(btrim(tp2.name)) = lower(btrim(coalesce(v_me.name, ''))))
          )
        limit 1
     );
    if found then
      return jsonb_build_object('ok', true, 'linked', true);
    end if;
  end if;

  -- (c) новый участник — вместимость + вставка
  select count(*) into v_count from tournament_players where tournament_id = v_t.id;
  if v_count >= v_t.target_size then raise exception 'tournament_full'; end if;

  insert into tournament_players (tournament_id, name, profile_id)
  values (v_t.id, p_name, v_pid);
  return jsonb_build_object('ok', true);
end; $function$;
