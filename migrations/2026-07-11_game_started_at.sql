-- Момент начала игры. Кнопка «Начать игру» на экране игры пишет started_at и
-- переводит status open → live; submit-result использует started_at как
-- played_at матча (история перестаёт зависеть от того, когда внесли счёт).
-- Статусы games: open → live → played (cancelled как был).
-- Применить в Supabase → SQL editor; затем redeploy submit-result.
alter table games add column if not exists started_at timestamptz;
