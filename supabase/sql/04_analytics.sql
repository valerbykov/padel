-- =====================================================================
--  PADEL · аналитика и статистика игрока
--  Запускать ПОСЛЕ schema.sql / auth_and_rls.sql.
--  Все функции проверяют, что вызывающий — участник группы.
-- =====================================================================

-- 1. Карточка игрока: рейтинг, место, игры, победы, винрейт ------------
create or replace function player_stats(p_group_id uuid, p_profile_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_group_member(p_group_id) then return null; end if;
  return (
    with ranked as (
      select profile_id, rating, matches_played, wins,
             rank() over (order by rating desc) as rnk,
             count(*) over () as total_players
      from group_members where group_id = p_group_id
    )
    select jsonb_build_object(
      'name', p.name,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'rating', r.rating,
      'rank', r.rnk,
      'total_players', r.total_players,
      'matches', r.matches_played,
      'wins', r.wins,
      'losses', r.matches_played - r.wins,
      'win_rate', case when r.matches_played > 0
                       then round(100.0 * r.wins / r.matches_played)::int else 0 end
    )
    from ranked r join profiles p on p.id = r.profile_id
    where r.profile_id = p_profile_id
  );
end; $$;

-- 2. Последние матчи игрока -------------------------------------------
create or replace function player_recent_matches(p_group_id uuid, p_profile_id uuid, p_limit int default 10)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_group_member(p_group_id) then return null; end if;
  return (
    select coalesce(jsonb_agg(row order by (row->>'played_at') desc), '[]'::jsonb) from (
      select jsonb_build_object(
        'id', m.id,
        'played_at', m.played_at,
        'sets_a', m.sets_a,
        'sets_b', m.sets_b,
        'team_a', (select jsonb_agg(pr.name) from profiles pr where pr.id = any(m.team_a)),
        'team_b', (select jsonb_agg(pr.name) from profiles pr where pr.id = any(m.team_b)),
        'on_team_a', (p_profile_id = any(m.team_a)),
        'won', (case when p_profile_id = any(m.team_a) then m.sets_a > m.sets_b else m.sets_b > m.sets_a end),
        'delta', (select rc.delta from rating_changes rc where rc.match_id = m.id and rc.profile_id = p_profile_id)
      ) as row
      from matches m
      where m.group_id = p_group_id
        and (p_profile_id = any(m.team_a) or p_profile_id = any(m.team_b))
      order by m.played_at desc
      limit p_limit
    ) t
  );
end; $$;

-- 3. Аналитика группы: всего матчей, игроков, активные, динамика, топ ---
create or replace function group_analytics(p_group_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_group_member(p_group_id) then return null; end if;
  return jsonb_build_object(
    'total_matches', (select count(*) from matches where group_id = p_group_id),
    'total_players', (select count(*) from group_members where group_id = p_group_id),
    'active_30d', (
      select count(distinct pid) from (
        select unnest(team_a || team_b) as pid from matches
        where group_id = p_group_id and played_at > now() - interval '30 days'
      ) s
    ),
    'matches_per_week', (
      select coalesce(jsonb_agg(jsonb_build_object('week', wk, 'count', c) order by wk), '[]'::jsonb)
      from (
        select to_char(date_trunc('week', played_at), 'DD.MM') as wk, count(*) as c
        from matches
        where group_id = p_group_id and played_at > now() - interval '12 weeks'
        group by date_trunc('week', played_at)
        order by date_trunc('week', played_at)
      ) w
    ),
    'top_active', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'matches', mp) order by mp desc), '[]'::jsonb)
      from (
        select p.name, gm.matches_played as mp
        from group_members gm join profiles p on p.id = gm.profile_id
        where gm.group_id = p_group_id and gm.matches_played > 0
        order by gm.matches_played desc limit 5
      ) a
    )
  );
end; $$;

grant execute on function player_stats(uuid, uuid)               to authenticated;
grant execute on function player_recent_matches(uuid, uuid, int) to authenticated;
grant execute on function group_analytics(uuid)                  to authenticated;
