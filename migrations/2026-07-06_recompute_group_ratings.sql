-- Разовый аккуратный пересчёт рейтингов группы «с нуля» под новую логику
-- (матчи с гостями теперь считаются). Идемпотентен по результату: сбрасывает
-- рейтинг/matches_played/wins, удаляет rating_changes группы и заново проигрывает
-- ВСЕ рейтинговые матчи в хронологическом порядке.
--   • лиговые: matches (счёт по сетам), порядок по played_at;
--   • турнирные: tournament_matches из уже отрейтингованных турниров (t.rated),
--     счёт по очкам, порядок по времени турнира и номеру раунда.
-- Формула ELO идентична submit-result и rate_tournament (K=60/40/24).
-- rated-флаг турниров НЕ трогаем — будущие турниры рейтингуются как обычно.
-- ПЕРЕД запуском сделать бэкап (см. отдельные команды в чате).
create or replace function public.recompute_group_ratings(p_group_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  u record;
  p uuid[]; rt int[]; mp int[]; wn int[]; im boolean[];
  ri int; mi int; wi int;
  ratA numeric; ratB numeric; eA numeric; sA numeric;
  tot int; d int; i int; k int;
  winnerA boolean; isDraw boolean;
begin
  update group_members set rating = 1000, matches_played = 0, wins = 0 where group_id = p_group_id;
  delete from rating_changes where group_id = p_group_id;

  for u in
    select m.played_at as ts, 0 as ord2, 'league'::text as kind, m.id as ref_id,
           m.team_a[1] as a1, m.team_a[2] as a2, m.team_b[1] as b1, m.team_b[2] as b2,
           m.sets_a as sa, m.sets_b as sb
    from matches m
    where m.group_id = p_group_id
      and array_length(m.team_a, 1) = 2 and array_length(m.team_b, 1) = 2
    union all
    select coalesce(t.starts_at, t.created_at) as ts, tm.round_number as ord2, 'tour'::text as kind, tm.id as ref_id,
           (select profile_id from tournament_players where id = tm.team_a[1]) as a1,
           (select profile_id from tournament_players where id = tm.team_a[2]) as a2,
           (select profile_id from tournament_players where id = tm.team_b[1]) as b1,
           (select profile_id from tournament_players where id = tm.team_b[2]) as b2,
           tm.score_a as sa, tm.score_b as sb
    from tournament_matches tm
    join tournaments t on t.id = tm.tournament_id
    where t.group_id = p_group_id and t.rated
      and tm.round_number > 0
      and tm.score_a is not null and tm.score_b is not null
      and array_length(tm.team_a, 1) = 2 and array_length(tm.team_b, 1) = 2
    order by ts, ord2, ref_id
  loop
    p := array[u.a1, u.a2, u.b1, u.b2];
    rt := array[1000,1000,1000,1000]; mp := array[0,0,0,0]; wn := array[0,0,0,0]; im := array[false,false,false,false];
    for i in 1..4 loop
      select rating, matches_played, wins into ri, mi, wi
      from group_members where group_id = p_group_id and profile_id = p[i];
      if found then im[i] := true; rt[i] := ri; mp[i] := mi; wn[i] := wi; end if;
    end loop;

    ratA := (rt[1] + rt[2]) / 2.0;
    ratB := (rt[3] + rt[4]) / 2.0;
    eA := 1.0 / (1.0 + power(10, (ratB - ratA) / 400.0));
    tot := u.sa + u.sb;
    sA := case when tot = 0 then 0.5 else u.sa::numeric / tot end;
    winnerA := u.sa > u.sb;
    isDraw  := u.sa = u.sb;

    for i in 1..4 loop
      if not im[i] then continue; end if;
      k := case when mp[i] < 5 then 60 when mp[i] < 15 then 40 else 24 end;
      if i <= 2 then d := round(k * (sA - eA)); else d := round(k * ((1 - sA) - (1 - eA))); end if;
      update group_members
        set rating = rt[i] + d,
            matches_played = mp[i] + 1,
            wins = wn[i] + case
              when isDraw then 0
              when (i <= 2 and winnerA) or (i > 2 and not winnerA) then 1
              else 0 end
        where group_id = p_group_id and profile_id = p[i];
      if u.kind = 'league' then
        insert into rating_changes (match_id, group_id, profile_id, delta, rating_after, created_at)
        values (u.ref_id, p_group_id, p[i], d, rt[i] + d, u.ts + make_interval(secs => u.ord2));
      else
        insert into rating_changes (tournament_match_id, group_id, profile_id, delta, rating_after, created_at)
        values (u.ref_id, p_group_id, p[i], d, rt[i] + d, u.ts + make_interval(secs => u.ord2));
      end if;
    end loop;
  end loop;
end;
$function$;

revoke execute on function public.recompute_group_ratings(uuid) from public, anon, authenticated;
