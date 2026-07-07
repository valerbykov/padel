-- 2026-07-20_bootstrap_stats.sql
-- app_bootstrap v2: + board_stats для активной лиги — серии побед (стрики 🔥)
-- и «играли в лиге, но не участники». Раньше клиент ради этого тянул до 500
-- матчей + все турниры и считал в браузере (заметный «доскок» бейджей после
-- отрисовки списка). Теперь считается на сервере в том же единственном RPC.
--   board_stats: {
--     streaks: {profile_id: n}  — текущая серия побед (ничья/поражение рвут), n>=2;
--     extra:   [{id,name,avatar_url,user_id}] — играли в лиге, но не участники.
--   }
-- Идемпотентно (create or replace). Запускать в Supabase SQL Editor.

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
      from group_player_counts(v_gid) c) end,
    'board_stats', case when v_gid is null then null else jsonb_build_object(
      -- Серия побед: идём от свежайшего матча игрока; ничья или поражение рвут.
      -- brk = число «не-побед» среди более новых матчей включая текущий;
      -- строки серии — победы с brk = 0. Порог >= 2 — как в клиенте.
      'streaks', coalesce((
        with pm as (
          select gm.profile_id as pid, m.played_at, m.id,
                 case when m.sets_a = m.sets_b then null
                      when gm.profile_id = any(m.team_a) then (m.sets_a > m.sets_b)
                      else (m.sets_b > m.sets_a) end as won
          from group_members gm
          join matches m on m.group_id = v_gid
            and (gm.profile_id = any(m.team_a) or gm.profile_id = any(m.team_b))
          where gm.group_id = v_gid
        ),
        r as (
          select pid, won,
                 count(*) filter (where won is distinct from true)
                   over (partition by pid order by played_at desc, id desc) as brk
          from pm
        )
        select jsonb_object_agg(pid::text, n) from (
          select pid, count(*)::int as n from r where won and brk = 0
          group by pid having count(*) >= 2
        ) s), '{}'::jsonb),
      -- Играли в лиге (матчи или турниры), но не участники.
      'extra', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'name', p.name, 'avatar_url', p.avatar_url, 'user_id', p.user_id)
          order by p.name)
        from profiles p
        where p.id in (
          select distinct unnest(m.team_a || m.team_b) from matches m where m.group_id = v_gid
          union
          select tp.profile_id from tournament_players tp
            join tournaments t on t.id = tp.tournament_id
            where t.group_id = v_gid and tp.profile_id is not null
        )
        and not exists (select 1 from group_members gm where gm.group_id = v_gid and gm.profile_id = p.id)
      ), '[]'::jsonb)
    ) end
  );
end; $$;

grant execute on function app_bootstrap(uuid) to authenticated;
