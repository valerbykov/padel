-- «Игры» игрока в лиге недосчитывались: group_player_counts.games считала только
-- лиговые matches и игнорировала турнирные. В турнирной лиге реальные игры — это
-- сыгранные tournament_matches (team_a/team_b хранят tournament_players.id, поэтому
-- join идёт через tournament_players). Теперь games = лиговые + сыгранные турнирные.
create or replace function public.group_player_counts(p_group_id uuid)
returns table(profile_id uuid, games integer, tournaments integer)
language sql
security definer
set search_path to 'public'
as $function$
  select gm.profile_id,
    (
      (select count(*) from matches m
         where m.group_id = p_group_id
           and (gm.profile_id = any(m.team_a) or gm.profile_id = any(m.team_b)))
      +
      (select count(*) from tournament_matches tm
         join tournaments t on t.id = tm.tournament_id
         join tournament_players tp on tp.id = any(tm.team_a || tm.team_b)
         where t.group_id = p_group_id
           and tp.profile_id = gm.profile_id
           and tm.score_a is not null and tm.score_b is not null)
    )::int as games,
    (select count(distinct t.id) from tournaments t
       join tournament_players tp on tp.tournament_id = t.id
       where t.group_id = p_group_id and t.status in ('active', 'finished')
         and tp.profile_id = gm.profile_id
    )::int as tournaments
  from group_members gm
  where gm.group_id = p_group_id;
$function$;
