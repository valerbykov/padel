-- Гостевая страница игры /j/CODE: реальные аватары и имя лиги.
-- Раньше get_game_by_code_full не отдавал avatar_url — клиент рисовал всем
-- собак-заглушек. Замена функции целиком. Применить в SQL editor.

create or replace function get_game_by_code_full(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(g) - 'group_id' - 'host_id' || jsonb_build_object(
    'league_name', (select gr.name from groups gr where gr.id = g.group_id),
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team', s.team,
        'position', s.position,
        'name', coalesce(p.name, s.guest_name),
        'avatar_url', p.avatar_url,
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

grant execute on function get_game_by_code_full(text) to anon, authenticated;
