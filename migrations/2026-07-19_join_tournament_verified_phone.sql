-- Безопасность: привязка гостя в join_tournament только по проверяемым
-- признакам. Ранее ветка (b) матчила гостя по v_me.phone/contacts->>'telegram' —
-- это редактируемые клиентом поля профиля, что позволяло подставить чужой
-- телефон/telegram и «забрать» гостевую строку турнира.
-- Фикс: телефон матчим по ВЕРИФИЦ. auth.users.phone (OTP), telegram убран.
-- Email оставлен — он не редактируется клиентом.
-- create or replace той же 4-арг сигнатуры (без риска неоднозначности перегрузок).

create or replace function public.join_tournament(
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
  v_auth_phone text;
begin
  select * into v_t from tournaments where invite_code = upper(p_code);
  if not found then raise exception 'tournament_not_found'; end if;
  if v_t.status <> 'open' then raise exception 'tournament_closed'; end if;

  v_is_pair := v_t.format = any(array['king_of_hill','round_robin']);

  if v_uid is not null then
    select * into v_me from profiles where user_id = v_uid;
    v_pid := v_me.id;
    v_auth_phone := (select phone from auth.users where id = v_uid); -- ВЕРИФИЦ. телефон (OTP)
  else
    v_pid := null;
  end if;

  if v_pid is not null and exists (
       select 1 from tournament_players where tournament_id = v_t.id and profile_id = v_pid
     ) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  -- (b) привязка гостя ТОЛЬКО по проверяемым признакам: email (не редактируется
  --     клиентом) и ВЕРИФИЦ. телефон из auth.users. Telegram убран (contacts
  --     редактируется свободно → подделываем матч).
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
            or (nullif(btrim(v_auth_phone), '') is not null and (
                    nullif(btrim(pr.phone), '') = nullif(btrim(v_auth_phone), '')
                 or nullif(btrim(pr.contacts->>'phone'), '') = nullif(btrim(v_auth_phone), '')
               ))
          )
        limit 1
     );
    if found then
      return jsonb_build_object('ok', true, 'linked', true);
    end if;
  end if;

  select count(*) into v_count from tournament_players where tournament_id = v_t.id;
  if v_count >= v_t.target_size then raise exception 'tournament_full'; end if;

  if v_is_pair then
    if p_pair_no is null then
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

  insert into tournament_players (tournament_id, name, profile_id)
  values (v_t.id, p_name, v_pid);
  return jsonb_build_object('ok', true);
end; $function$;
