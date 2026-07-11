-- Страховка cron-чистки демо-лиг: если в демо каким-то образом вступил второй
-- реальный пользователь (код лиги технически существует), лигу не удаляем —
-- иначе через 30 дней тишины пропала бы и его история. Применить в SQL editor
-- ПОСЛЕ 2026-07-11_leave_delete_league.sql (заменяет cleanup_demo_leagues).

create or replace function public.cleanup_demo_leagues()
returns int
language plpgsql security definer set search_path = public as $$
declare
  g record;
  mem uuid[];
  n int := 0;
begin
  for g in
    select id from groups gr
     where gr.is_demo
       and gr.created_at < now() - interval '30 days'
       and not exists (select 1 from matches m
                        where m.group_id = gr.id and m.played_at > now() - interval '30 days')
       and not exists (select 1 from games gm
                        where gm.group_id = gr.id and gm.created_at > now() - interval '30 days')
       and (select count(*) from group_members gm
             join profiles p on p.id = gm.profile_id
            where gm.group_id = gr.id and p.user_id is not null) <= 1
  loop
    select array_agg(profile_id) into mem from group_members where group_id = g.id;
    delete from groups where id = g.id;
    if mem is not null then perform prune_orphan_guests(mem); end if;
    n := n + 1;
  end loop;
  return n;
end; $$;
revoke execute on function cleanup_demo_leagues() from public, anon, authenticated;
