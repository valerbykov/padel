-- registered_among(ids): из переданного списка профилей возвращает те, что
-- ЗАРЕГИСТРИРОВАНЫ (у профиля есть user_id, т.е. это не гость).
--
-- Зачем отдельная функция, а не поле в played_with: список «Играли вместе»
-- межгрупповой, а RLS на profiles пускает читать только со-участников по группе —
-- прямой клиентский select ненадёжен. Эта функция SECURITY DEFINER обходит RLS,
-- но НЕ раскрывает ничего лишнего: только факт «зарегистрирован» по id, которые
-- клиент и так уже видит в played_with. Аддитивно — played_with не трогаем.
create or replace function registered_among(ids uuid[])
returns setof uuid
language sql stable security definer set search_path = public as $$
  select p.id from profiles p
  where p.id = any(ids) and p.user_id is not null;
$$;

grant execute on function registered_among(uuid[]) to anon, authenticated;
