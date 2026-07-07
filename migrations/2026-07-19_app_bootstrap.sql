-- 2026-07-19_app_bootstrap.sql
-- Быстрый холодный старт: ОДИН RPC вместо каскада из 3-4 последовательных
-- запросов (profiles → group_members/лиги → лидерборд → счётчики). На медленной
-- сети каждая ступень — сотни мс; бутстрап убирает «разогрев» до списка друзей.
--
-- Возвращает jsonb:
--   profile        — строка profiles текущего пользователя (или null — профиля нет);
--   leagues        — массив лиг с ролью (форма как в getMyLeagues);
--   board_group_id — какая лига выбрана для борда: запрошенная p_group_id,
--                    если членство подтверждено, иначе первая из лиг;
--   board          — лидерборд этой лиги (форма как в getLeaderboard);
--   counts         — {games:{profile_id:n}, tours:{profile_id:n}} из group_player_counts.
-- Идемпотентно. Запускать в Supabase SQL Editor.

create or replace function app_bootstrap(p_group_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_profile profiles;
  v_gid uuid;
begin
  select * into v_profile from profiles where user_id = auth.uid() limit 1;
  if v_profile.id is null then
    return jsonb_build_object('profile', null);
  end if;

  -- Активная лига: сохранённая клиентом (если членство есть), иначе первая.
  select coalesce(
    (select gm.group_id from group_members gm
      where gm.profile_id = v_profile.id and gm.group_id = p_group_id limit 1),
    (select gm.group_id from group_members gm
      where gm.profile_id = v_profile.id limit 1)
  ) into v_gid;

  return jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'leagues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'invite_code', g.invite_code,
        'logo_url', g.logo_url, 'telegram_url', g.telegram_url,
        'members_can_add', g.members_can_add, 'members_can_create', g.members_can_create,
        'role', gm.role))
      from group_members gm join groups g on g.id = gm.group_id
      where gm.profile_id = v_profile.id), '[]'::jsonb),
    'board_group_id', v_gid,
    'board', case when v_gid is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'rating', gm.rating, 'matches_played', gm.matches_played, 'wins', gm.wins, 'role', gm.role,
        'profile', jsonb_build_object(
          'id', p.id, 'name', p.name, 'avatar_url', p.avatar_url,
          'contacts', p.contacts, 'user_id', p.user_id))
        order by gm.rating desc)
      from group_members gm join profiles p on p.id = gm.profile_id
      where gm.group_id = v_gid), '[]'::jsonb) end,
    'counts', case when v_gid is null then null else (
      select jsonb_build_object(
        'games', coalesce(jsonb_object_agg(c.profile_id::text, c.games), '{}'::jsonb),
        'tours', coalesce(jsonb_object_agg(c.profile_id::text, c.tournaments), '{}'::jsonb))
      from group_player_counts(v_gid) c) end
  );
end; $$;

grant execute on function app_bootstrap(uuid) to authenticated;
