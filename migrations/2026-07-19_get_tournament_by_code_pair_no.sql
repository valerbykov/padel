-- Добавляем pair_no в агрегат players (иначе аноним на /t/CODE не видит пары).
create or replace function public.get_tournament_by_code(p_code text)
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select to_jsonb(t) - 'group_id' - 'created_by' || jsonb_build_object(
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tp.id, 'profile_id', tp.profile_id, 'name', tp.name,
        'pair_no', tp.pair_no,
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
$function$;
