-- Длительность игр (games.ends_at) + необязательный «уровень события» на играх и
-- турнирах. level jsonb = {sys, val, val2?} (val2 задан → диапазон «от–до»),
-- та же модель систем, что у profiles.levels (pt/ltr/oth). NULL = уровень не указан.
-- Применено на прод через Supabase MCP (migration events_duration_and_level).
alter table games add column if not exists ends_at timestamptz;
alter table games add column if not exists level jsonb;
alter table tournaments add column if not exists level jsonb;
