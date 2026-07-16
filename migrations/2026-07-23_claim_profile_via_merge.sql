-- 2026-07-23_claim_profile_via_merge.sql
-- Клейм гостевого профиля через единый merge_profiles (см. 2026-07-21_merge_profiles.sql —
-- он должен быть применён РАНЬШЕ). Зачем: старый claim_profile сливал вручную и имел
-- две мины: (1) `where id = v_gm.id` — в group_members составной PK (group_id, profile_id),
-- колонки id может не быть → падение на любом клейме; (2) не обрабатывал конфликт
-- уникальности tournament_players (гость и юзер в одном турнире). merge_profiles
-- обе ситуации умеет (переклейка сетки турнира, пересчёт рейтингов из матчей).
-- Идемпотентно. Запускать в Supabase SQL editor ПОСЛЕ 2026-07-21_merge_profiles.sql.

create or replace function public.claim_profile(p_code uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_guest profiles%rowtype;
  v_me    profiles%rowtype;
begin
  -- Гостевой профиль по коду (только не привязанный к аккаунту).
  select * into v_guest from profiles where claim_code = p_code and user_id is null;
  if not found then raise exception 'claim_not_found'; end if;

  -- Профиль текущего пользователя (создаётся триггером при регистрации).
  select * into v_me from profiles where user_id = auth.uid();
  if not found then raise exception 'not_authenticated'; end if;

  -- Единый путь слияния: игры, матчи, рейтинг-история, членства (с дедупом),
  -- турниры (с конфликтами), owner/host, удаление гостя, пересчёт рейтингов.
  perform merge_profiles(v_guest.id, v_me.id);

  return jsonb_build_object('ok', true, 'name', v_guest.name);
end;
$$;
