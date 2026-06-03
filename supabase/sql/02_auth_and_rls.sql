-- =====================================================================
--  PADEL · авторизация + RLS (боевой режим)
--  Запускать ПОСЛЕ schema.sql. Включает:
--   - авто-создание профиля при регистрации
--   - helper-функции для политик
--   - полноценные RLS-политики (доступ только участникам группы)
--   - публичные RPC для приглашения по ссылке (без логина)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Авто-создание профиля при регистрации пользователя.
--    Связывает auth.users → profiles.
-- ---------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- 2. Helper-функции (security definer — чтобы не было рекурсии в политиках).
-- ---------------------------------------------------------------------
create or replace function current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from profiles where user_id = auth.uid() limit 1;
$$;

create or replace function is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members gm
    join profiles p on p.id = gm.profile_id
    where gm.group_id = gid and p.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Убираем черновые политики из schema.sql, ставим боевые.
-- ---------------------------------------------------------------------
drop policy if exists "members read group" on groups;
drop policy if exists "read open game"    on games;

-- profiles -------------------------------------------------------------
create policy "read self and co-members" on profiles for select using (
  user_id = auth.uid()
  or exists (select 1 from group_members gm where gm.profile_id = profiles.id and is_group_member(gm.group_id))
);
create policy "insert profile (authenticated)" on profiles for insert to authenticated with check (true);
create policy "update own profile" on profiles for update using (user_id = auth.uid());

-- groups ---------------------------------------------------------------
create policy "members read group" on groups for select using (is_group_member(id));
create policy "create group" on groups for insert to authenticated with check (true);
create policy "owner updates group" on groups for update using (owner_id = current_profile_id());

-- group_members --------------------------------------------------------
create policy "members read members" on group_members for select using (is_group_member(group_id));
create policy "add members" on group_members for insert to authenticated with check (
  is_group_member(group_id)
  or profile_id = current_profile_id()
  or exists (select 1 from groups g where g.id = group_id and g.owner_id = current_profile_id())
);

-- games ----------------------------------------------------------------
create policy "members read games" on games for select using (is_group_member(group_id));
create policy "members create game" on games for insert to authenticated with check (is_group_member(group_id));
create policy "members update game" on games for update using (is_group_member(group_id));

-- game_slots -----------------------------------------------------------
create policy "members read slots" on game_slots for select using (
  exists (select 1 from games g where g.id = game_slots.game_id and is_group_member(g.group_id))
);
create policy "members write slots" on game_slots for all to authenticated using (
  exists (select 1 from games g where g.id = game_slots.game_id and is_group_member(g.group_id))
) with check (
  exists (select 1 from games g where g.id = game_slots.game_id and is_group_member(g.group_id))
);

-- matches / rating_changes: читают участники; пишет только сервер (Edge Function
-- работает под service_role и обходит RLS).
create policy "members read matches" on matches for select using (is_group_member(group_id));
create policy "members read rating_changes" on rating_changes for select using (is_group_member(group_id));

-- ---------------------------------------------------------------------
-- 4. ПУБЛИЧНЫЕ RPC для приглашения по ссылке (работают БЕЗ логина).
--    Так таблицы остаются закрытыми, а гость всё равно может зайти по коду.
-- ---------------------------------------------------------------------

-- Резолв игры по коду: отдаёт игру + слоты с именами.
create or replace function get_game_by_code_full(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(g) - 'group_id' - 'host_id' || jsonb_build_object(
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team', s.team,
        'position', s.position,
        'name', coalesce(p.name, s.guest_name),
        'taken', (s.profile_id is not null or s.guest_name is not null)
      ) order by s.team, s.position)
      from game_slots s
      left join profiles p on p.id = s.profile_id
      where s.game_id = g.id
    ), '[]'::jsonb)
  )
  from games g
  where g.invite_code = upper(p_code)
  limit 1;
$$;

-- Занять свободный слот (гость — по имени). Валидирует, что игра открыта и слот свободен.
create or replace function join_game_slot(p_code text, p_team text, p_position int, p_guest_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_game games; v_slot game_slots;
begin
  select * into v_game from games where invite_code = upper(p_code);
  if not found then raise exception 'game_not_found'; end if;
  if v_game.status <> 'open' then raise exception 'game_closed'; end if;

  update game_slots
     set guest_name = p_guest_name
   where game_id = v_game.id and team = p_team and position = p_position
     and profile_id is null and guest_name is null
  returning * into v_slot;

  if not found then raise exception 'slot_taken'; end if;
  return to_jsonb(v_slot);
end; $$;

-- Дать доступ к RPC гостям (anon) и залогиненным.
grant execute on function get_game_by_code_full(text)            to anon, authenticated;
grant execute on function join_game_slot(text, text, int, text)  to anon, authenticated;
