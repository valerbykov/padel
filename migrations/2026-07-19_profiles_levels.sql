-- Самозаявленные уровни игрока: массив {sys, val, lbl?} (Playtomic/буквы/другое).
alter table profiles add column if not exists levels jsonb not null default '[]'::jsonb;
