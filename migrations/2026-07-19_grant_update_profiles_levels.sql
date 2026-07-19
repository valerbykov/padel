-- Фикс «permission denied for table profiles» при сохранении уровня игрока.
-- У роли authenticated UPDATE на profiles — ПОКОЛОНОЧНЫЙ (модель безопасности:
-- юзер меняет только «свои» поля). Столбец levels (E3) добавили позже без гранта,
-- поэтому любой апдейт профиля с levels в SET падал. RLS по-прежнему ограничивает строкой.
grant update (levels) on public.profiles to authenticated;
