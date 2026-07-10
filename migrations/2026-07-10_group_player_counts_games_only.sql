-- Возврат семантики счётчиков в списке друзей: ⚔ «игры» = только простые игры
-- (то, что живёт во вкладке «Игры»), турнирные матчи сюда НЕ входят — им
-- соответствует счётчик 🏆 «турниры». Отменяет изменение
-- 2026-07-06_group_player_counts_incl_tournaments.sql, из-за которого ⚔ на
-- плитке игрока считал и игры внутри турниров.
-- Применить в Supabase → SQL editor.
create or replace function public.group_player_counts(p_group_id uuid)
returns table(profile_id uuid, games integer, tournaments integer)
language sql
security definer
set search_path to 'public'
as $function$
  select gm.profile_id,
    (select count(*) from matches m
       where m.group_id = p_group_id
         and (gm.profile_id = any(m.team_a) or gm.profile_id = any(m.team_b)))::int as games,
    (select count(distinct t.id) from tournaments t
       join tournament_players tp on tp.tournament_id = t.id
       where t.group_id = p_group_id and t.status in ('active', 'finished')
         and tp.profile_id = gm.profile_id
    )::int as tournaments
  from group_members gm
  where gm.group_id = p_group_id;
$function$;
