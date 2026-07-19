-- Запись парами: 4-й аргумент p_pair_no. null на парном формате → создать пару
-- (вернуть её номер); N → встать напарником в пару N (атомарность добивает триггер
-- max-2). solo-форматы p_pair_no игнорируют. Профиль строго из auth.uid();
-- привязка гостя — только по верифиц. email/phone/telegram (по имени убрана ранее).
-- ВАЖНО: p_profile_id и p_pair_no БЕЗ default. С default'ами 3-арг вызов легаси-
-- функции становился неоднозначным (function is not unique) и запись падала. Без
-- default'ов: 3-арг вызов → легаси-функция, 4-арг → эта. Клиент всегда шлёт 4 арг.
drop function if exists public.join_tournament(text, text, uuid, integer);
create function public.join_tournament(
  p_code text, p_name text, p_profile_id uuid, p_pair_no integer)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_t    tournaments;
  v_me   profiles;
  v_uid  uuid := auth.uid();
  v_pid  uuid;
  v_count int;
  v_is_pair boolean;
  v_pair_count int;
  v_new_pair int;
begin
  select * into v_t from tournaments where invite_code = upper(p_code);
  if not found then raise exception 'tournament_not_found'; end if;
  if v_t.status <> 'open' then raise exception 'tournament_closed'; end if;

  -- beat_the_box НЕ здесь: его жеребьёвка (buildKotHStart) сама тасует команды,
  -- pair_no игнорирует — значит запись в него идёт как solo (плоская).
  v_is_pair := v_t.format = any(array['king_of_hill','round_robin']);

  if v_uid is not null then
    select * into v_me from profiles where user_id = v_uid;
    v_pid := v_me.id;
  else
    v_pid := null;
  end if;

  -- (a) уже участвует тем же профилем → идемпотентно
  if v_pid is not null and exists (
       select 1 from tournament_players where tournament_id = v_t.id and profile_id = v_pid
     ) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  -- (b) тот же человек уже добавлен ГОСТЕМ → привязка по ВЕРИФИЦ. контакту
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
          )
        limit 1
     );
    if found then
      return jsonb_build_object('ok', true, 'linked', true);
    end if;
  end if;

  -- ёмкость (число игроков)
  select count(*) into v_count from tournament_players where tournament_id = v_t.id;
  if v_count >= v_t.target_size then raise exception 'tournament_full'; end if;

  -- (c) парный формат: создать пару или встать в пару N
  if v_is_pair then
    if p_pair_no is null then
      -- Сериализуем выдачу номера пары по турниру: без этого два одновременных
      -- «создать пару» посчитают одинаковый max+1 и слепятся в одну пару.
      perform pg_advisory_xact_lock(hashtextextended(v_t.id::text, 0));
      select coalesce(max(pair_no), 0) + 1 into v_new_pair
        from tournament_players where tournament_id = v_t.id;
      insert into tournament_players (tournament_id, name, profile_id, pair_no)
      values (v_t.id, p_name, v_pid, v_new_pair);
      return jsonb_build_object('ok', true, 'pair_no', v_new_pair);
    else
      select count(*) into v_pair_count
        from tournament_players where tournament_id = v_t.id and pair_no = p_pair_no;
      if v_pair_count = 0 then raise exception 'pair_not_found'; end if;
      if v_pair_count >= 2 then raise exception 'pair_full'; end if;
      insert into tournament_players (tournament_id, name, profile_id, pair_no)
      values (v_t.id, p_name, v_pid, p_pair_no);
      return jsonb_build_object('ok', true, 'pair_no', p_pair_no);
    end if;
  end if;

  -- (d) solo — плоская вставка
  insert into tournament_players (tournament_id, name, profile_id)
  values (v_t.id, p_name, v_pid);
  return jsonb_build_object('ok', true);
end; $function$;
