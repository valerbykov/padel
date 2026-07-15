-- Сводка для ежедневного письма + списки: присоединились за сутки / заходили за сутки.
-- SECURITY DEFINER: читает auth.users/profiles; вызывается только service_role (edge-функция).
create or replace function public.test_digest_stats()
returns json
language sql
security definer
set search_path = public, auth
as $$
  select json_build_object(
    'total',      (select count(*) from auth.users),
    'new_1d',     (select count(*) from auth.users where created_at      >= now() - interval '24 hours'),
    'new_14d',    (select count(*) from auth.users where created_at      >= now() - interval '14 days'),
    'active_24h', (select count(*) from auth.users where last_sign_in_at >= now() - interval '24 hours'),
    'active_7d',  (select count(*) from auth.users where last_sign_in_at >= now() - interval '7 days'),
    'active_14d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '14 days'),
    'new_1d_list', (
      select coalesce(json_agg(json_build_object(
        'email',      u.email,
        'name',       coalesce(p.name, u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name'),
        'provider',   coalesce(u.raw_app_meta_data->>'provider', 'email'),
        'created_at', u.created_at
      ) order by u.created_at desc), '[]'::json)
      from auth.users u
      left join public.profiles p on p.user_id = u.id
      where u.created_at >= now() - interval '24 hours'
    ),
    'active_1d_list', (
      select coalesce(json_agg(json_build_object(
        'email',        u.email,
        'name',         coalesce(p.name, u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name'),
        'provider',     coalesce(u.raw_app_meta_data->>'provider', 'email'),
        'last_sign_in', u.last_sign_in_at
      ) order by u.last_sign_in_at desc), '[]'::json)
      from auth.users u
      left join public.profiles p on p.user_id = u.id
      where u.last_sign_in_at >= now() - interval '24 hours'
    )
  );
$$;

revoke all on function public.test_digest_stats() from anon, authenticated;
