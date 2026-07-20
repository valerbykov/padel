-- 2026-07-20 · Явное завершение микс-сессии.
-- Применено к прод-базе через Supabase MCP (apply_migration) 2026-07-20.
--
-- Микс-сессия = группа под-игр с общим mix_group_id (anchor id == mix_group_id).
-- Раньше сыгранная под-игра сразу уходила в «Историю», а сессия рвалась.
-- Теперь сессия висит активной во вкладке «Игры», пока её явно не завершат
-- кнопкой «Завершить сессию» (finishMixSession → ставит mix_ended_at на все
-- под-игры группы). NULL = активна; установлено = ушла в Историю.

alter table games add column if not exists mix_ended_at timestamptz;

-- Бэкофилл: все существующие микс-сессии (группы >= 2 игр) помечаем
-- завершёнными, иначе они «оживут» и всплывут во вкладке «Игры».
with keys as (
  select coalesce(mix_group_id, id) as k
  from games group by coalesce(mix_group_id, id) having count(*) >= 2
)
update games g set mix_ended_at = now()
where coalesce(g.mix_group_id, g.id) in (select k from keys)
  and g.mix_ended_at is null;
