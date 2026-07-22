-- Витрина лиги (фаза A): get_public_league дополнена афишей событий.
-- Добавлены ключи:
--   events — ближайшие открытые/идущие турниры и игры (listed=true), до 10;
--   recent — 3 последних завершённых события («Было круто»).
-- Существующие ключи сохранены (обратная совместимость). Экспозиция — только то,
-- что уже публично на /t/ и /j/ (имена, аватары, взнос, места, время записи).
create or replace function get_public_league(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_group   groups;
  v_count   bigint;
  v_games   bigint;
  v_members jsonb;
  v_events  jsonb;
  v_recent  jsonb;
begin
  select * into v_group from groups where invite_code = upper(trim(p_code));
  if not found then raise exception 'league_not_found'; end if;

  select count(*) into v_count from group_members where group_id = v_group.id;
  select count(*) into v_games from matches       where group_id = v_group.id;

  select jsonb_agg(jsonb_build_object(
      'name', p.name, 'avatar_url', p.avatar_url, 'rating', gm.rating,
      'matches', gm.matches_played, 'wins', gm.wins) order by gm.rating desc)
  into v_members
  from group_members gm join profiles p on p.id = gm.profile_id
  where gm.group_id = v_group.id limit 20;

  -- Афиша: открытые/идущие турниры + открытые/идущие игры, listed=true, ближайшие 10.
  select jsonb_agg(sub.e order by sub.sort) into v_events from (
    (select
       coalesce(t.starts_at, 'infinity'::timestamptz) as sort,
       jsonb_build_object(
         'kind','tournament','id',t.id,'invite_code',t.invite_code,'name',t.name,
         'starts_at',t.starts_at,'place',t.place,'status',t.status,'format',t.format,
         'level',t.level,'fee_per_player',t.fee_per_player,'fee_currency',t.fee_currency,
         'target',t.target_size,
         'taken',(select count(*) from tournament_players tp where tp.tournament_id=t.id),
         'going',(select jsonb_agg(jsonb_build_object('name',g5.name,'avatar_url',pr.avatar_url) order by g5.created_at)
                  from (select * from tournament_players where tournament_id=t.id order by created_at limit 5) g5
                  left join profiles pr on pr.id=g5.profile_id),
         'last_join',(select jsonb_build_object('name',tp.name,'at',tp.created_at)
                      from tournament_players tp where tp.tournament_id=t.id order by tp.created_at desc limit 1)
       ) as e
     from tournaments t
     where t.group_id=v_group.id and t.listed and t.status in ('open','active'))
    union all
    (select
       coalesce(g.starts_at, 'infinity'::timestamptz),
       jsonb_build_object(
         'kind','game','id',g.id,'invite_code',g.invite_code,'name',g.title,
         'starts_at',g.starts_at,'place',g.place,'status',g.status,'format',null,
         'level',g.level,'fee_per_player',g.fee_per_player,'fee_currency',g.fee_currency,
         'target',4,
         'taken',(select count(*) from game_slots gs where gs.game_id=g.id and (gs.profile_id is not null or gs.guest_name is not null)),
         'going',(select jsonb_agg(jsonb_build_object('name',coalesce(pr.name,s5.guest_name),'avatar_url',pr.avatar_url) order by s5.taken_at)
                  from (select * from game_slots where game_id=g.id and (profile_id is not null or guest_name is not null) order by taken_at limit 5) s5
                  left join profiles pr on pr.id=s5.profile_id),
         'last_join',(select jsonb_build_object('name',coalesce(pr.name,gs.guest_name),'at',gs.taken_at)
                      from game_slots gs left join profiles pr on pr.id=gs.profile_id
                      where gs.game_id=g.id and (gs.profile_id is not null or gs.guest_name is not null)
                      order by gs.taken_at desc limit 1)
       )
     from games g
     where g.group_id=v_group.id and g.listed and g.status in ('open','live'))
    order by sort
    limit 10
  ) sub;

  -- «Было круто»: 3 последних завершённых.
  select jsonb_agg(sub.r order by sub.rsort desc) into v_recent from (
    (select coalesce(t.ends_at, t.created_at) as rsort,
       jsonb_build_object('kind','tournament','name',t.name,'format',t.format,'at',coalesce(t.ends_at,t.created_at)) as r
     from tournaments t where t.group_id=v_group.id and t.status='finished')
    union all
    (select coalesce(g.ends_at, g.mix_ended_at, g.started_at, g.created_at),
       jsonb_build_object('kind','game','name',g.title,'format',null,'at',coalesce(g.ends_at,g.mix_ended_at,g.started_at,g.created_at))
     from games g where g.group_id=v_group.id and g.status='played')
    order by rsort desc
    limit 3
  ) sub;

  return jsonb_build_object(
    'name',         v_group.name,
    'invite_code',  v_group.invite_code,
    'logo_url',     v_group.logo_url,
    'telegram_url', v_group.telegram_url,
    'member_count', v_count,
    'games_count',  v_games,
    'created_at',   v_group.created_at,
    'members',      coalesce(v_members, '[]'::jsonb),
    'events',       coalesce(v_events,  '[]'::jsonb),
    'recent',       coalesce(v_recent,  '[]'::jsonb)
  );
end; $$;
grant execute on function get_public_league(text) to anon, authenticated;
