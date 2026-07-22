-- get_league_details: добавляем g.mascot в ответ (тумблер маскота в «Управлении
-- лигой» — LeagueManager читает det.mascot для начального состояния свитча).
-- Остальное тело без изменений (сверено с прод-определением 2026-07-22).
--
-- ВНИМАНИЕ: применяется контроллером на прод через Supabase MCP (см.
-- migrations/2026-07-22_group_mascot.sql, migrations/2026-07-22_app_bootstrap_mascot.sql —
-- тот же паттерн). Прямое применение из этой сессии было заблокировано
-- classifier'ом автономного режима (изменение прод-БД) — миграция НЕ применена
-- на проде, только зафиксирована в репозитории.
create or replace function public.get_league_details(p_group_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_group groups; v_role text; v_org jsonb; v_orgs jsonb;
begin
  select gm.role into v_role
  from   group_members gm join profiles p on p.id = gm.profile_id
  where  gm.group_id = p_group_id and p.user_id = auth.uid();
  if v_role is null then raise exception 'not_a_member'; end if;

  select * into v_group from groups where id = p_group_id;
  if not found then raise exception 'league_not_found'; end if;

  select jsonb_build_object('name', p.name, 'avatar_url', p.avatar_url) into v_org
  from   profiles p where p.id = v_group.owner_id;

  select jsonb_agg(jsonb_build_object('name', p.name, 'avatar_url', p.avatar_url) order by p.name) into v_orgs
  from   group_members gm join profiles p on p.id = gm.profile_id
  where  gm.group_id = p_group_id and gm.role = 'admin';

  return jsonb_build_object(
    'id',                 v_group.id,
    'name',               v_group.name,
    'invite_code',        v_group.invite_code,
    'logo_url',           v_group.logo_url,
    'telegram_url',       v_group.telegram_url,
    'members_can_add',    coalesce(v_group.members_can_add, false),
    'members_can_create', coalesce(v_group.members_can_create, false),
    'mascot',             coalesce(v_group.mascot, true),
    'role',               v_role,
    'organizer',          coalesce(v_org, '{}'::jsonb),
    'organizers',         coalesce(v_orgs, '[]'::jsonb)
  );
end; $function$;
