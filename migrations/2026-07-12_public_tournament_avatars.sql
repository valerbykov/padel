-- Гостевые страницы: аватары в турнире (/t/CODE) и «пульс» лиги (/l/CODE).
-- 1) get_tournament_by_code: players дополнены avatar_url (left join profiles) —
--    без него гостевая страница рисовала всем собак-заглушек.
-- 2) get_public_league: + games_count и created_at для строки
--    «N игроков · M игр · с <месяц год>» в шапке.
-- Тексты основаны на действующих определениях из Dashboard. Применить в SQL editor.

create or replace function get_tournament_by_code(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(t) - 'group_id' - 'created_by' || jsonb_build_object(
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tp.id, 'profile_id', tp.profile_id, 'name', tp.name,
        'created_at', tp.created_at,
        'avatar_url', p.avatar_url
      ) order by tp.created_at)
      from tournament_players tp
      left join profiles p on p.id = tp.profile_id
      where tp.tournament_id = t.id
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'round_number', m.round_number, 'court', m.court,
        'team_a', m.team_a, 'team_b', m.team_b, 'score_a', m.score_a, 'score_b', m.score_b
      ) order by m.round_number, m.court)
      from tournament_matches m where m.tournament_id = t.id
    ), '[]'::jsonb)
  )
  from tournaments t where t.invite_code = upper(p_code) limit 1;
$$;
grant execute on function get_tournament_by_code(text) to anon, authenticated;

create or replace function get_public_league(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_group   groups;
  v_count   bigint;
  v_games   bigint;
  v_members jsonb;
begin
  select * into v_group
  from   groups
  where  invite_code = upper(trim(p_code));
  if not found then raise exception 'league_not_found'; end if;

  select count(*) into v_count
  from   group_members
  where  group_id = v_group.id;

  select count(*) into v_games
  from   matches
  where  group_id = v_group.id;

  select jsonb_agg(
    jsonb_build_object(
      'name',       p.name,
      'avatar_url', p.avatar_url,
      'rating',     gm.rating,
      'matches',    gm.matches_played,
      'wins',       gm.wins
    ) order by gm.rating desc
  )
  into v_members
  from group_members gm
  join profiles p on p.id = gm.profile_id
  where gm.group_id = v_group.id
  limit 20;

  return jsonb_build_object(
    'name',         v_group.name,
    'invite_code',  v_group.invite_code,
    'logo_url',     v_group.logo_url,
    'telegram_url', v_group.telegram_url,
    'member_count', v_count,
    'games_count',  v_games,
    'created_at',   v_group.created_at,
    'members',      coalesce(v_members, '[]'::jsonb)
  );
end; $$;
grant execute on function get_public_league(text) to anon, authenticated;
