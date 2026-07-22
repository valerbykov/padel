-- Тумблер маскота на лиге (вариант B): mascot=false → автозаглушка аватара становится
-- инициалами вместо собаки + нейтральный словарь. Дефолт — с маскотом.
alter table public.groups add column if not exists mascot boolean not null default true;
