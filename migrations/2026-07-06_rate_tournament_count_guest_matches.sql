-- Вариант A: матчи с гостями-без-профиля тоже рейтингуют зарегистрированных.
-- Убрана строка, пропускавшая весь матч, если хоть один из 4 игроков — гость без
-- profile_id. Теперь такой слот трактуется как соперник с рейтингом 1000 (как и
-- прочие не-члены), а члены лиги получают ELO-изменение и +1 к matches_played.
-- Форвард-онли: уже отрейтингованные турниры не пересчитываются (guard v_t.rated).
create or replace function public.rate_tournament(p_tournament_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  v_t  tournaments;
  m    record;
  p    uuid[];
  rt   int[];
  mp   int[];
  wn   int[];
  ri int; mi int; wi int;
  ratA numeric; ratB numeric; eA numeric; sA numeric;
  tot int; d int; i int;
  winnerA boolean; isDraw boolean; im boolean[];
begin
  select * into v_t from tournaments where id = p_tournament_id;
  if not found then return; end if;
  if v_t.rated then return; end if;

  for m in
    select tm.id, tm.score_a, tm.score_b, tm.team_a, tm.team_b
    from tournament_matches tm
    where tm.tournament_id = p_tournament_id
      and tm.round_number > 0
      and tm.score_a is not null and tm.score_b is not null
      and array_length(tm.team_a, 1) = 2 and array_length(tm.team_b, 1) = 2
    order by tm.round_number, tm.court
  loop
    select array[
      (select profile_id from tournament_players where id = m.team_a[1]),
      (select profile_id from tournament_players where id = m.team_a[2]),
      (select profile_id from tournament_players where id = m.team_b[1]),
      (select profile_id from tournament_players where id = m.team_b[2])
    ] into p;
    -- (гард на null-профиль убран: матчи с гостями рейтингуют зарегистрированных;
    --  гость трактуется как соперник 1000, сам рейтинг/историю не получает)

    rt := array[1000,1000,1000,1000]; mp := array[0,0,0,0]; wn := array[0,0,0,0];
    im := array[false,false,false,false];
    for i in 1..4 loop
      select rating, matches_played, wins into ri, mi, wi
      from group_members where group_id = v_t.group_id and profile_id = p[i];
      if found then im[i] := true; rt[i] := ri; mp[i] := mi; wn[i] := wi; end if;
    end loop;

    ratA := (rt[1] + rt[2]) / 2.0;
    ratB := (rt[3] + rt[4]) / 2.0;
    eA := 1.0 / (1.0 + power(10, (ratB - ratA) / 400.0));
    tot := m.score_a + m.score_b;
    sA := case when tot = 0 then 0.5 else m.score_a::numeric / tot end;
    winnerA := m.score_a > m.score_b;
    isDraw  := m.score_a = m.score_b;

    for i in 1..4 loop
      if not im[i] then continue; end if;
      if i <= 2 then
        d := round((case when mp[i] < 5 then 60 when mp[i] < 15 then 40 else 24 end) * (sA - eA));
      else
        d := round((case when mp[i] < 5 then 60 when mp[i] < 15 then 40 else 24 end) * ((1 - sA) - (1 - eA)));
      end if;
      update group_members
        set rating = rt[i] + d,
            matches_played = mp[i] + 1,
            wins = wn[i] + case
              when isDraw then 0
              when (i <= 2 and winnerA) or (i > 2 and not winnerA) then 1
              else 0 end
        where group_id = v_t.group_id and profile_id = p[i];
      insert into rating_changes (tournament_match_id, group_id, profile_id, delta, rating_after)
      values (m.id, v_t.group_id, p[i], d, rt[i] + d);
    end loop;
  end loop;

  update tournaments set rated = true where id = p_tournament_id;
end;
$function$;
