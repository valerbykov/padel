-- Турнир без PIN: open_scoring = true → счёт матчей может вводить любой
-- участник лиги (как в обычных играх). По умолчанию false — прежняя
-- PIN-схема. Выбор — при создании турнира. Применить в SQL editor.

alter table tournaments add column if not exists open_scoring boolean not null default false;
