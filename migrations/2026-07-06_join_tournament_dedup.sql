-- Дедуп при вступлении в турнир по ссылке (/t/CODE → join_tournament).
-- Проблема: организатор добавил игрока вручную, затем тот же человек вступил по
-- ссылке → две строки в tournament_players. Теперь:
--   (a) если вступающий уже в турнире тем же profile_id → не вставляем;
--   (b) если в турнире есть ГОСТЕВАЯ строка того же человека (совпал email → phone
--       → telegram; для гостя-по-имени — по имени) → привязываем её к аккаунту
--       (проставляем profile_id), нового ряда не создаём;
--   (c) иначе — обычная вставка (с проверкой на переполнение).
-- Привязываем только гостевые строки (profiles.user_id is null / profile_id null),
-- чтобы не «увести» чужой зарегистрированный профиль.

create or replace function public.join_tournament(p_code text, p_name text, p_profile_id uuid default null::uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  v_t     tournaments;
  v_me    profiles;
  v_count int;
begin
  select * into v_t from tournaments where invite_code = upper(p_code);
  if not found then raise exception 'tournament_not_found'; end if;
  if v_t.status <> 'open' then raise exception 'tournament_closed'; end if;

  -- профиль вступающего (для сопоставления по контактам)
  if p_profile_id is not null then
    select * into v_me from profiles where id = p_profile_id;
  end if;

  -- (a) уже участвует тем же профилем → идемпотентно, без нового ряда
  if p_profile_id is not null and exists (
       select 1 from tournament_players
       where tournament_id = v_t.id and profile_id = p_profile_id
     ) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  -- (b) тот же человек уже добавлен ГОСТЕМ → привязываем к аккаунту
  if p_profile_id is not null then
    update tournament_players tp
       set profile_id = p_profile_id,
           name       = coalesce(nullif(btrim(p_name), ''), tp.name)
     where tp.id = (
       select tp2.id
         from tournament_players tp2
         left join profiles pr on pr.id = tp2.profile_id
        where tp2.tournament_id = v_t.id
          and tp2.profile_id is distinct from p_profile_id
          and (pr.id is null or pr.user_id is null)   -- только гостевые строки
          and (
               -- email (колонка или контакты)
               (nullif(btrim(v_me.email), '') is not null and (
                    lower(btrim(pr.email)) = lower(btrim(v_me.email))
                 or lower(btrim(pr.contacts->>'email')) = lower(btrim(v_me.email))
               ))
               -- телефон
            or (nullif(btrim(v_me.phone), '') is not null and (
                    nullif(btrim(pr.phone), '') = nullif(btrim(v_me.phone), '')
                 or nullif(btrim(pr.contacts->>'phone'), '') = nullif(btrim(v_me.phone), '')
               ))
               -- telegram (из контактов)
            or (nullif(btrim(v_me.contacts->>'telegram'), '') is not null
                and lower(nullif(btrim(pr.contacts->>'telegram'), ''))
                  = lower(nullif(btrim(v_me.contacts->>'telegram'), '')))
               -- чистый гость-по-имени (нет профиля) → по имени
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

  -- (c) новый участник — проверка вместимости и вставка
  select count(*) into v_count from tournament_players where tournament_id = v_t.id;
  if v_count >= v_t.target_size then raise exception 'tournament_full'; end if;

  insert into tournament_players (tournament_id, name, profile_id)
  values (v_t.id, p_name, p_profile_id);
  return jsonb_build_object('ok', true);
end; $function$;
