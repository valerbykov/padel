-- Тумблер «показывать событие в афише лиги» (дефолт — показываем).
-- Используется витриной /l/CODE (фаза A): get_public_league отдаёт только listed=true.
alter table public.tournaments add column if not exists listed boolean not null default true;
alter table public.games       add column if not exists listed boolean not null default true;
