-- Дубль участника турнира: двойной тап «Занять» вставлял игрока дважды
-- (у tournament_players не было ограничения уникальности по профилю).
-- 1) чистим существующие дубли зарегистрированных игроков, не задетые матчами;
-- 2) уникальный частичный индекс — страховка на уровне базы.

delete from tournament_players tp
 using tournament_players keep
 where tp.tournament_id = keep.tournament_id
   and tp.profile_id = keep.profile_id
   and tp.profile_id is not null
   and tp.id > keep.id
   and not exists (
     select 1 from tournament_matches m
      where m.tournament_id = tp.tournament_id
        and (tp.id = any(m.team_a) or tp.id = any(m.team_b))
   );

create unique index if not exists tournament_players_uniq_profile
  on tournament_players (tournament_id, profile_id)
  where profile_id is not null;
