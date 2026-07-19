-- Безопасность: убираем привязку гостя к аккаунту по совпадению ОТОБРАЖАЕМОГО ИМЕНИ.
-- Имя профиля пользователь редактирует сам, а ростер турнира виден на публичной
-- странице /t/CODE — значит залогиненный мог переименоваться под непривязанного
-- гостя и, вступив по коду, «забрать» его строку (историю матчей + взносы).
-- Ветки привязки по email/phone/telegram остаются: они завязаны на ВЕРИФИЦИРОВАННЫЕ
-- контакты, подделать их нельзя. Цена: гость, добавленный ТОЛЬКО по имени (без
-- контактов), при регистрации не подшивается автоматически — создаётся отдельная
-- строка (осознанный размен, см. решение пользователя от 2026-07-19).
-- Поверх 2026-07-29_join_tournament_auth.sql (профиль строго из auth.uid()).
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
  --     ТОЛЬКО по верифицированному контакту (email/phone/telegram). Совпадение
  --     имени больше НЕ основание для привязки (спуфится через переименование).
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

  -- (c) новый участник — вместимость + вставка
  select count(*) into v_count from tournament_players where tournament_id = v_t.id;
  if v_count >= v_t.target_size then raise exception 'tournament_full'; end if;

  insert into tournament_players (tournament_id, name, profile_id)
  values (v_t.id, p_name, v_pid);
  return jsonb_build_object('ok', true);
end; $function$;
