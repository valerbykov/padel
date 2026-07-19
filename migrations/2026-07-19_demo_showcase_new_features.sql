-- Демо-лига: витрина НОВЫХ фич (парные форматы, взносы+валюта, уровни, афиша).
-- Самодостаточный хелпер, вызывается из create_demo_league ПЕРЕД recompute (чтобы
-- рейтинговые парные матчи учлись). Идемпотентность обеспечивает сам create_demo_league
-- (ранний return, если демо уже есть) — здесь ничего не проверяем.
create or replace function public._demo_showcase(gid uuid, dogs uuid[], names text[], s int[], p_lang text)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  owner uuid := (select owner_id from groups where id = gid);
  tid uuid; tcode text;
  tp uuid[];            -- tournament_players.id по индексу собаки 1..8
  d uuid; i int;
  P1 uuid[]; P2 uuid[]; P3 uuid[]; P4 uuid[];
begin
  -- ── Уровни игроков (E3): несколько собак получают бейджи ──────────────────
  update profiles set levels = '[{"sys":"pt","val":"4.0"}]'::jsonb where id = dogs[1];
  update profiles set levels = '[{"sys":"pt","val":"3.5"}]'::jsonb where id = dogs[2];
  update profiles set levels = '[{"sys":"ltr","val":"C"}]'::jsonb where id = dogs[3];
  update profiles set levels = '[{"sys":"oth","val":"5","lbl":"AJPP"}]'::jsonb where id = dogs[5];

  -- ── Завершённый King of the Court (пары) + взнос + оплаты (D + E4) ────────
  loop tcode := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
       exit when not exists (select 1 from tournaments where invite_code = tcode); end loop;
  insert into tournaments (group_id, invite_code, name, format, points_per_game, target_size,
                           status, created_by, rated, starts_at, koth_champion_rule,
                           fee_per_player, fee_currency, fee_timing)
    values (gid, tcode,
      case when p_lang='en' then 'Demo King of the Court' when p_lang='es' then 'King of the Court demo' else 'Демо Кинг оф зе Корт' end,
      'king_of_hill', 24, 8, 'finished', owner, true,
      date_trunc('day', now()) - interval '8 days' + interval '18 hours', 'court_1',
      1500, 'RUB', 'end')
    returning id into tid;
  tp := '{}';
  for i in 1..8 loop
    insert into tournament_players (tournament_id, profile_id, name, pair_no, added_by)
      values (tid, dogs[i], names[i], ((i - 1) / 2) + 1, owner)  -- пары: 1,1,2,2,3,3,4,4
      returning id into d;
    tp := tp || d;
  end loop;
  P1 := array[tp[1], tp[2]]; P2 := array[tp[3], tp[4]]; P3 := array[tp[5], tp[6]]; P4 := array[tp[7], tp[8]];
  -- 3 раунда × 2 корта, лесенка; P1 держит корт 1 → чемпион по правилу court_1.
  insert into tournament_matches (tournament_id, round_number, court, team_a, team_b, score_a, score_b) values
    (tid, 1, 1, P1, P2, 24, 18), (tid, 1, 2, P3, P4, 24, 20),
    (tid, 2, 1, P1, P3, 24, 19), (tid, 2, 2, P2, P4, 24, 21),
    (tid, 3, 1, P1, P2, 24, 17), (tid, 3, 2, P3, P4, 22, 24);
  -- Взнос: часть пары-чемпионы и половина остальных «скинулись».
  insert into tournament_fee_payments (tp_id, tournament_id, marked_by)
    values (tp[1], tid, owner), (tp[2], tid, owner), (tp[3], tid, owner), (tp[5], tid, owner);

  -- ── Завершённый Round Robin (пары) (E) ───────────────────────────────────
  loop tcode := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
       exit when not exists (select 1 from tournaments where invite_code = tcode); end loop;
  insert into tournaments (group_id, invite_code, name, format, points_per_game, target_size,
                           status, created_by, rated, starts_at)
    values (gid, tcode,
      case when p_lang='en' then 'Demo Round Robin' when p_lang='es' then 'Round Robin demo' else 'Демо Круговой' end,
      'round_robin', 24, 8, 'finished', owner, true,
      date_trunc('day', now()) - interval '6 days' + interval '18 hours')
    returning id into tid;
  tp := '{}';
  for i in 1..8 loop
    insert into tournament_players (tournament_id, profile_id, name, pair_no, added_by)
      values (tid, dogs[i], names[i], ((i - 1) / 2) + 1, owner)
      returning id into d;
    tp := tp || d;
  end loop;
  P1 := array[tp[1], tp[2]]; P2 := array[tp[3], tp[4]]; P3 := array[tp[5], tp[6]]; P4 := array[tp[7], tp[8]];
  -- Каждая пара с каждой (3 раунда × 2 корта = 6 матчей). P1 — лидер таблицы.
  insert into tournament_matches (tournament_id, round_number, court, team_a, team_b, score_a, score_b) values
    (tid, 1, 1, P1, P2, 24, 18), (tid, 1, 2, P3, P4, 22, 24),
    (tid, 2, 1, P1, P3, 24, 20), (tid, 2, 2, P2, P4, 24, 19),
    (tid, 3, 1, P1, P4, 24, 16), (tid, 3, 2, P2, P3, 21, 24);

  -- ── Открытый парный турнир (KotH) + афиша + открытая пара (D + E1/E2/E4) ──
  loop tcode := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
       exit when not exists (select 1 from tournaments where invite_code = tcode); end loop;
  insert into tournaments (group_id, invite_code, name, format, points_per_game, target_size,
                           status, created_by, rated, starts_at, ends_at, koth_champion_rule, open_scoring,
                           description, contact_name, contact_link, fee_per_player, fee_currency, fee_timing)
    values (gid, tcode,
      case when p_lang='en' then 'Weekend King of the Court' when p_lang='es' then 'King of the Court del finde' else 'Кинг оф зе Корт на выходных' end,
      'king_of_hill', 24, 8, 'open', owner, true,
      date_trunc('day', now()) + interval '4 days 18 hours',
      date_trunc('day', now()) + interval '4 days 20 hours', 'court_1', true,
      case when p_lang='en' then 'Sunset on the courts 🌅 Fixed pairs — grab a partner or wait for one by link. Water & fruit included 😎'
           when p_lang='es' then 'Atardecer en las pistas 🌅 Parejas fijas — trae compañero o espera por enlace. Agua y fruta incluidas 😎'
           else 'Закат на кортах 🌅 Пары фиксированные — бери напарника или жди по ссылке. Вода и фрукты включены 😎' end,
      case when p_lang='en' then 'Baron' when p_lang='es' then 'Barón' else 'Барон' end,
      '@padel_demo', 1200, 'RUB', 'start')
    returning id into tid;
  -- 3 полные пары (1,1,2,2,3,3) + одна ОТКРЫТАЯ (пара 4, один игрок «ищет напарника»).
  for i in 1..6 loop
    insert into tournament_players (tournament_id, profile_id, name, pair_no, added_by)
      values (tid, dogs[i], names[i], ((i - 1) / 2) + 1, owner);
  end loop;
  insert into tournament_players (tournament_id, profile_id, name, pair_no, added_by)
    values (tid, dogs[7], names[7], 4, owner);  -- открытая пара: 1 из 2
end; $function$;
