-- 2026-07-20_demo_levels_all.sql
-- Демо: раздаём уровни ВСЕМ 8 собакам (было 4), микс Playtomic/Lunda — чтобы на
-- вкладке Друзья у каждого был уровень с иконкой. dogs[4] с двумя системами —
-- показать мультибейдж. Остальное тело _demo_showcase без изменений (v3).
-- Существующие демо-лиги контент НЕ получат (create_demo_league идемпотентен) —
-- пересоздать демо-лигу.

CREATE OR REPLACE FUNCTION public._demo_showcase(gid uuid, dogs uuid[], names text[], s integer[], p_lang text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  owner uuid := (select owner_id from groups where id = gid);
  tid uuid; tcode text;
  tp uuid[];
  d uuid; i int;
  P1 uuid[]; P2 uuid[]; P3 uuid[]; P4 uuid[];
begin
  -- ── Уровни игроков (E3): ВСЕ 8 собак — микс Playtomic/Lunda (иконки), по силе ──
  update profiles set levels = '[{"sys":"pt","val":"4.5"}]'::jsonb                         where id = dogs[1];
  update profiles set levels = '[{"sys":"ltr","val":"B"}]'::jsonb                          where id = dogs[2];
  update profiles set levels = '[{"sys":"pt","val":"4.0"}]'::jsonb                         where id = dogs[3];
  update profiles set levels = '[{"sys":"pt","val":"3.5"},{"sys":"ltr","val":"C+"}]'::jsonb where id = dogs[4];
  update profiles set levels = '[{"sys":"ltr","val":"C"}]'::jsonb                          where id = dogs[5];
  update profiles set levels = '[{"sys":"pt","val":"3.0"}]'::jsonb                         where id = dogs[6];
  update profiles set levels = '[{"sys":"ltr","val":"D+"}]'::jsonb                         where id = dogs[7];
  update profiles set levels = '[{"sys":"pt","val":"2.5"}]'::jsonb                         where id = dogs[8];

  -- ── ЗАВЕРШЁННЫЙ King of the Court (пары) + взнос + оплаты + уровень ────────
  loop tcode := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
       exit when not exists (select 1 from tournaments where invite_code = tcode); end loop;
  insert into tournaments (group_id, invite_code, name, format, points_per_game, target_size,
                           status, created_by, rated, starts_at, koth_champion_rule,
                           fee_per_player, fee_currency, fee_timing, level)
    values (gid, tcode,
      case when p_lang='en' then 'Demo King of the Court' when p_lang='es' then 'King of the Court demo' else 'Демо Король корта' end,
      'king_of_hill', 24, 8, 'finished', owner, true,
      date_trunc('day', now()) - interval '8 days' + interval '18 hours', 'court_1',
      1500, 'RUB', 'end', '{"sys":"ltr","vals":["C"]}'::jsonb)
    returning id into tid;
  tp := '{}';
  for i in 1..8 loop
    insert into tournament_players (tournament_id, profile_id, name, pair_no, added_by)
      values (tid, dogs[i], names[i], ((i - 1) / 2) + 1, owner)
      returning id into d;
    tp := tp || d;
  end loop;
  P1 := array[tp[1], tp[2]]; P2 := array[tp[3], tp[4]]; P3 := array[tp[5], tp[6]]; P4 := array[tp[7], tp[8]];
  insert into tournament_matches (tournament_id, round_number, court, team_a, team_b, score_a, score_b) values
    (tid, 1, 1, P1, P2, 24, 18), (tid, 1, 2, P3, P4, 24, 20),
    (tid, 2, 1, P1, P3, 24, 19), (tid, 2, 2, P2, P4, 24, 21),
    (tid, 3, 1, P1, P2, 24, 17), (tid, 3, 2, P3, P4, 22, 24);
  insert into tournament_fee_payments (tp_id, tournament_id, marked_by)
    values (tp[1], tid, owner), (tp[2], tid, owner), (tp[3], tid, owner), (tp[5], tid, owner);

  -- ── ИДЁТ: Round Robin (пары) — сыграны 2 из 3 раундов ─────────────────────
  loop tcode := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
       exit when not exists (select 1 from tournaments where invite_code = tcode); end loop;
  insert into tournaments (group_id, invite_code, name, format, points_per_game, target_size,
                           status, created_by, rated, starts_at, level)
    values (gid, tcode,
      case when p_lang='en' then 'Demo Round Robin' when p_lang='es' then 'Round Robin demo' else 'Демо Круговой' end,
      'round_robin', 24, 8, 'active', owner, true,
      now() - interval '90 minutes', '{"sys":"pt","vals":["3.5"]}'::jsonb)
    returning id into tid;
  tp := '{}';
  for i in 1..8 loop
    insert into tournament_players (tournament_id, profile_id, name, pair_no, added_by)
      values (tid, dogs[i], names[i], ((i - 1) / 2) + 1, owner)
      returning id into d;
    tp := tp || d;
  end loop;
  P1 := array[tp[1], tp[2]]; P2 := array[tp[3], tp[4]]; P3 := array[tp[5], tp[6]]; P4 := array[tp[7], tp[8]];
  insert into tournament_matches (tournament_id, round_number, court, team_a, team_b, score_a, score_b) values
    (tid, 1, 1, P1, P2, 24, 18), (tid, 1, 2, P3, P4, 22, 24),
    (tid, 2, 1, P1, P3, 24, 20), (tid, 2, 2, P2, P4, 24, 19),
    (tid, 3, 1, P1, P4, 0, 0), (tid, 3, 2, P2, P3, 0, 0);

  -- ── СОБИРАЕТ игроков: открытый KotH + афиша + открытая пара + уровень-диапазон ─
  loop tcode := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
       exit when not exists (select 1 from tournaments where invite_code = tcode); end loop;
  insert into tournaments (group_id, invite_code, name, format, points_per_game, target_size,
                           status, created_by, rated, starts_at, ends_at, koth_champion_rule, open_scoring,
                           description, contact_name, contact_link, fee_per_player, fee_currency, fee_timing, level)
    values (gid, tcode,
      case when p_lang='en' then 'Weekend King of the Court' when p_lang='es' then 'King of the Court del finde' else 'Король корта на выходных' end,
      'king_of_hill', 24, 8, 'open', owner, true,
      date_trunc('day', now()) + interval '4 days 18 hours',
      date_trunc('day', now()) + interval '4 days 20 hours', 'court_1', true,
      case when p_lang='en' then 'Sunset on the courts 🌅 Fixed pairs — grab a partner or wait for one by link. Water & fruit included 😎'
           when p_lang='es' then 'Atardecer en las pistas 🌅 Parejas fijas — trae compañero o espera por enlace. Agua y fruta incluidas 😎'
           else 'Закат на кортах 🌅 Пары фиксированные — бери напарника или жди по ссылке. Вода и фрукты включены 😎' end,
      case when p_lang='en' then 'Baron' when p_lang='es' then 'Barón' else 'Барон' end,
      '@padel_demo', 1200, 'RUB', 'start', '{"sys":"pt","vals":["3.0","3.5","4.0"]}'::jsonb)
    returning id into tid;
  for i in 1..6 loop
    insert into tournament_players (tournament_id, profile_id, name, pair_no, added_by)
      values (tid, dogs[i], names[i], ((i - 1) / 2) + 1, owner);
  end loop;
  insert into tournament_players (tournament_id, profile_id, name, pair_no, added_by)
    values (tid, dogs[7], names[7], 4, owner);
end; $function$;

-- Бэкфилл для УЖЕ созданных демо-лиг (create_demo_league идемпотентен — не
-- перезапустится). Обновляем уровни собак по индексу аватара (dog-0N ↔ сила).
-- Скоуп: фейковые профили (user_id null) в is_demo-группах. Идемпотентно.
update profiles p set levels = v.levels
from (values
  ('/avatars/dog-01.webp', '[{"sys":"pt","val":"4.5"}]'::jsonb),
  ('/avatars/dog-02.webp', '[{"sys":"ltr","val":"B"}]'::jsonb),
  ('/avatars/dog-03.webp', '[{"sys":"pt","val":"4.0"}]'::jsonb),
  ('/avatars/dog-04.webp', '[{"sys":"pt","val":"3.5"},{"sys":"ltr","val":"C+"}]'::jsonb),
  ('/avatars/dog-05.webp', '[{"sys":"ltr","val":"C"}]'::jsonb),
  ('/avatars/dog-06.webp', '[{"sys":"pt","val":"3.0"}]'::jsonb),
  ('/avatars/dog-07.webp', '[{"sys":"ltr","val":"D+"}]'::jsonb),
  ('/avatars/dog-08.webp', '[{"sys":"pt","val":"2.5"}]'::jsonb)
) as v(avatar, levels)
where p.avatar_url = v.avatar and p.user_id is null
  and exists (select 1 from group_members gm join groups g on g.id=gm.group_id
              where gm.profile_id=p.id and g.is_demo=true);
