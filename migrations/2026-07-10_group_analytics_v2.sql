-- Аналитика лиги v2: к прежней форме (режимы all/games/tours с total_matches,
-- matches_per_day, busiest_day, top_active) добавляются:
--   • total_players / active_30d — «здоровье лиги» для KPI-плитки;
--   • members[{id,name,last_played}] — для блока «Спящие» (30+ дней без игр);
--   • top_active теперь за 30 дней (раньше — за всё время).
-- Даты — в таймзоне клиента (p_tz). Дата турнирного матча = starts_at/created_at
-- турнира (как в recompute_group_ratings: своего таймстампа у tm нет).
-- Применить в Supabase → SQL editor.

-- Внутренний помощник: метрики одного режима. kinds ⊆ {games,tours}.
create or replace function public.group_analytics_mode(p_group_id uuid, p_kinds text[], p_tz text)
returns jsonb
language sql stable security definer set search_path = public as $$
  with allm as (
    select 'games'::text as kind, (m.played_at at time zone p_tz)::date as d,
           m.team_a || m.team_b as pids
    from matches m
    where m.group_id = p_group_id and m.played_at is not null
    union all
    select 'tours', (coalesce(t.starts_at, t.created_at) at time zone p_tz)::date,
           (select coalesce(array_agg(tp.profile_id), '{}') from tournament_players tp
             where tp.id = any(tm.team_a || tm.team_b) and tp.profile_id is not null)
    from tournament_matches tm
    join tournaments t on t.id = tm.tournament_id
    where t.group_id = p_group_id
      and tm.score_a is not null and tm.score_b is not null
      and coalesce(tm.round_number, 1) > 0
  ), mode as (
    select * from allm where kind = any(p_kinds)
  )
  select jsonb_build_object(
    'total_matches', (select count(*) from mode),
    'matches_per_day', coalesce((
      select jsonb_agg(jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'count', c) order by d)
      from (select d, count(*) as c from mode group by d) q), '[]'::jsonb),
    'busiest_day', (
      select jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'count', c)
      from (select d, count(*) as c from mode group by d order by c desc, d desc limit 1) qb),
    'top_active', coalesce((
      select jsonb_agg(jsonb_build_object('id', pid, 'name', nm, 'matches', c) order by c desc)
      from (
        select u.pid, p.name as nm, count(*) as c
        from (select unnest(pids) as pid, d from mode) u
        join group_members gm on gm.profile_id = u.pid and gm.group_id = p_group_id
        join profiles p on p.id = u.pid
        where u.d >= (now() at time zone p_tz)::date - 30
        group by u.pid, p.name
        order by count(*) desc limit 5) qt), '[]'::jsonb)
  );
$$;

create or replace function public.group_analytics(p_group_id uuid, p_tz text default 'UTC')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_group_member(p_group_id) then return null; end if;
  select jsonb_build_object(
    'total_players', (select count(*) from group_members where group_id = p_group_id),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', gm.profile_id, 'name', p.name,
        'last_played', to_char(lp.d, 'YYYY-MM-DD'))), '[]'::jsonb)
      from group_members gm
      join profiles p on p.id = gm.profile_id
      left join lateral (
        select max(x.d) as d from (
          select (m.played_at at time zone p_tz)::date as d
          from matches m
          where m.group_id = p_group_id
            and (gm.profile_id = any(m.team_a) or gm.profile_id = any(m.team_b))
          union all
          select (coalesce(t.starts_at, t.created_at) at time zone p_tz)::date
          from tournament_matches tm
          join tournaments t on t.id = tm.tournament_id
          join tournament_players tp on tp.tournament_id = t.id and tp.profile_id = gm.profile_id
          where t.group_id = p_group_id
            and tm.score_a is not null and tm.score_b is not null
            and coalesce(tm.round_number, 1) > 0
            and (tp.id = any(tm.team_a) or tp.id = any(tm.team_b))
        ) x
      ) lp on true
      where gm.group_id = p_group_id
    ),
    'all',   group_analytics_mode(p_group_id, array['games','tours'], p_tz),
    'games', group_analytics_mode(p_group_id, array['games'], p_tz),
    'tours', group_analytics_mode(p_group_id, array['tours'], p_tz)
  ) into v;
  v := v || jsonb_build_object('active_30d', (
    select count(*) from jsonb_array_elements(v->'members') e
    where (e->>'last_played') is not null
      and (e->>'last_played')::date >= (now() at time zone p_tz)::date - 30
  ));
  return v;
end; $$;

grant execute on function group_analytics_mode(uuid, text[], text) to authenticated;
grant execute on function group_analytics(uuid, text) to authenticated;
