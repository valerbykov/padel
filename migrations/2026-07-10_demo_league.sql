-- Демо-лига («Демо-стая»): персональная песочница новичка. RPC создаёт лигу
-- с 8 гостевыми профилями-собаками (имена на языке пользователя) и ~60 матчами
-- за последние 9 недель (по четвергам и субботам — живой «пульс» и «дни стаи»),
-- затем пересчитывает рейтинги существующей recompute_group_ratings.
-- Пользователь — владелец своей демо-лиги: может сам создать игру с собаками,
-- внести счёт и увидеть, как двигается таблица. Идемпотентно: одна демо-лига
-- на пользователя. Применить в Supabase → SQL editor.
-- (Будущие игры и демо-турнир — вторым шагом, после сверки схем games/tournaments.)

alter table groups add column if not exists is_demo boolean not null default false;

create or replace function public.create_demo_league(p_lang text default 'ru')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := current_profile_id();
  gid uuid;
  code text;
  names text[];
  lg_name text;
  dogs uuid[] := '{}';
  d uuid;
  i int; w int; j int;
  a1 int; a2 int; b1 int; b2 int;
  s int[] := array[86, 74, 65, 58, 52, 47, 40, 33]; -- «сила» собак: у лиги есть вожак и щенок
  diff int; sa int; sb int;
  ts timestamptz;
begin
  if me is null then
    raise exception 'profile_required';
  end if;

  -- Идемпотентно: если демо уже есть — возвращаем его.
  select g.id, g.invite_code, g.name into gid, code, lg_name
    from groups g
    join group_members gm on gm.group_id = g.id
    where g.is_demo and gm.profile_id = me
    limit 1;
  if gid is not null then
    return jsonb_build_object('id', gid, 'name', lg_name, 'invite_code', code,
      'role', 'owner', 'members_can_add', false, 'members_can_create', false,
      'is_demo', true, 'existing', true);
  end if;

  if p_lang = 'en' then
    names := array['Baron','Rex','Buddy','Daisy','Luna','Max','Bella','Toby'];
    lg_name := 'Demo pack 🐕';
  elsif p_lang = 'es' then
    names := array['Barón','Rex','Toby','Luna','Nala','Coco','Kira','Simba'];
    lg_name := 'Manada demo 🐕';
  else
    names := array['Барон','Шарик','Жуля','Кнопка','Багира','Рекс','Белка','Тузик'];
    lg_name := 'Демо-стая 🐕';
  end if;

  -- Уникальный код приглашения (формат как у обычных лиг).
  loop
    code := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
    exit when not exists (select 1 from groups where invite_code = code);
  end loop;

  insert into groups (name, owner_id, invite_code, members_can_add, members_can_create, is_demo)
    values (lg_name, me, code, false, false, true)
    returning id into gid;
  insert into group_members (group_id, profile_id, role) values (gid, me, 'owner');

  -- Собаки-гости с аватарами стаи.
  for i in 1..8 loop
    insert into profiles (name, avatar_url)
      values (names[i], '/avatars/dog-' || lpad(i::text, 2, '0') || '.webp')
      returning id into d;
    dogs := dogs || d;
    insert into group_members (group_id, profile_id, role) values (gid, d, 'member');
  end loop;

  -- История: 9 недель × 7 матчей (4 в четверг, 3 в субботу). Пары — детерминированная
  -- ротация, счёт — от «силы» пары с шумом; редкие ничьи. Будущие даты пропускаем.
  for w in reverse 0..8 loop
    for j in 1..7 loop
      i := w * 7 + j;
      ts := date_trunc('week', now()) - make_interval(weeks => w)
            + make_interval(days => case when j <= 4 then 3 else 5 end)  -- чт / сб
            + interval '18 hours' + make_interval(mins => 35 * (j - 1));
      continue when ts > now();
      a1 := 1 + (i % 8); a2 := 1 + ((i + 3) % 8);
      b1 := 1 + ((i + 5) % 8); b2 := 1 + ((i + 6) % 8);
      diff := (s[a1] + s[a2]) - (s[b1] + s[b2]) + ((i * 17) % 21) - 10;
      if diff = 0 then
        sa := 5; sb := 5;                                  -- ничья
      elsif diff > 0 then
        sa := 6; sb := 2 + (i % 3);
      else
        sa := 2 + (i % 3); sb := 6;
      end if;
      insert into matches (group_id, team_a, team_b, sets_a, sets_b, played_at)
        values (gid, array[dogs[a1], dogs[a2]], array[dogs[b1], dogs[b2]], sa, sb, ts);
    end loop;
  end loop;

  -- Завершённый американо ~10 дней назад: 8 собак, 5 раундов × 2 корта,
  -- rated → recompute учтёт турнирные матчи в рейтингах и истории.
  declare
    tid uuid;
    tps uuid[] := '{}';
    tcode text;
    rounds int[] := array[
      1,2,3,4,  5,6,7,8,
      1,3,5,7,  2,4,6,8,
      1,4,6,7,  2,3,5,8,
      1,5,2,6,  3,7,4,8,
      1,6,4,5,  2,7,3,8
    ]; -- 5 раундов × 2 корта × (a1,a2,b1,b2)
    r int; c int; base int;
    ta uuid[]; tb uuid[];
    pa int; pb int;
    t_start timestamptz := date_trunc('day', now()) - interval '10 days' + interval '18 hours';
    gcode text; gid2 uuid;
  begin
    loop
      tcode := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
      exit when not exists (select 1 from tournaments where invite_code = tcode);
    end loop;
    insert into tournaments (group_id, invite_code, name, format, points_per_game, target_size, status, created_by, rated, starts_at)
      values (gid, tcode,
        case when p_lang = 'en' then 'Demo Americano' when p_lang = 'es' then 'Americano demo' else 'Демо-американо' end,
        'americano', 32, 8, 'finished', me, true, t_start)
      returning id into tid;
    for i in 1..8 loop
      insert into tournament_players (tournament_id, profile_id, name, seat, added_by)
        values (tid, dogs[i], names[i], i, me)
        returning id into d;
      tps := tps || d;
    end loop;
    for r in 1..5 loop
      for c in 1..2 loop
        base := (r - 1) * 8 + (c - 1) * 4;
        ta := array[tps[rounds[base + 1]], tps[rounds[base + 2]]];
        tb := array[tps[rounds[base + 3]], tps[rounds[base + 4]]];
        -- счёт из «силы» пары: сумма очков всегда 32
        pa := 16 + least(9, greatest(-9, ((s[rounds[base + 1]] + s[rounds[base + 2]]) - (s[rounds[base + 3]] + s[rounds[base + 4]])) / 6 + ((r * 5 + c * 3) % 5) - 2));
        pb := 32 - pa;
        insert into tournament_matches (tournament_id, round_number, court, team_a, team_b, score_a, score_b, played_at)
          values (tid, r, c, ta, tb, pa, pb, t_start + make_interval(mins => r * 25));
      end loop;
    end loop;

    -- Две предстоящие игры: завтра (3 собаки + свободный слот — новичку есть куда
    -- вписаться) и послезавтра (полный состав).
    loop
      gcode := lower(substring(md5(gen_random_uuid()::text) from 1 for 8));
      exit when not exists (select 1 from games where invite_code = gcode);
    end loop;
    insert into games (group_id, invite_code, starts_at, place, host_id, status)
      values (gid, gcode, date_trunc('day', now()) + interval '1 day 19 hours',
        case when p_lang = 'en' then 'Central Padel Club' when p_lang = 'es' then 'Club de Pádel Central' else 'Падел-клуб «Центральный»' end,
        me, 'open')
      returning id into gid2;
    insert into game_slots (game_id, team, position, profile_id) values
      (gid2, 'A', 1, dogs[1]), (gid2, 'A', 2, dogs[4]), (gid2, 'B', 1, dogs[6]), (gid2, 'B', 2, null);
    loop
      gcode := lower(substring(md5(gen_random_uuid()::text) from 1 for 8));
      exit when not exists (select 1 from games where invite_code = gcode);
    end loop;
    insert into games (group_id, invite_code, starts_at, place, host_id, status)
      values (gid, gcode, date_trunc('day', now()) + interval '3 days 19 hours',
        case when p_lang = 'en' then 'Sunset Courts' when p_lang = 'es' then 'Pistas del Sol' else 'Корты в парке' end,
        me, 'open')
      returning id into gid2;
    insert into game_slots (game_id, team, position, profile_id) values
      (gid2, 'A', 1, dogs[2]), (gid2, 'A', 2, dogs[7]), (gid2, 'B', 1, dogs[3]), (gid2, 'B', 2, dogs[8]);
  end;

  -- Рейтинги, matches_played, wins и история rating_changes — штатным пересчётом
  -- (включая турнирные матчи: t.rated = true).
  perform recompute_group_ratings(gid);

  return jsonb_build_object('id', gid, 'name', lg_name, 'invite_code', code,
    'role', 'owner', 'members_can_add', false, 'members_can_create', false,
    'is_demo', true, 'existing', false);
end; $$;

grant execute on function create_demo_league(text) to authenticated;
