-- Демо-игры генерировали invite_code в НИЖНЕМ регистре (lower(...for 8)), тогда
-- как лиги/турниры и клиентский genCode — в ВЕРХНЕМ. Роутер /j/ аплайсит код в
-- верхний регистр, а lookup ищет по верхнему → демо-игру по ссылке «не найти».
-- Приводим генерацию кодов демо-игр к верхнему регистру (как везде).
-- DB сам переписывает свою функцию: replace() по её же определению → нулевой
-- риск транскрипции; при синтаксической ошибке миграция откатится целиком.
-- Затрагивает только НОВЫЕ демо-лиги; существующие демо-игры остаются как есть
-- (эфемерны, пересоздаются). Применено на прод 2026-07-18.
do $$
declare newdef text;
begin
  select replace(
           pg_get_functiondef(oid),
           'lower(substring(md5(gen_random_uuid()::text) from 1 for 8))',
           'upper(substring(md5(gen_random_uuid()::text) from 1 for 8))'
         )
    into newdef
    from pg_proc where proname = 'create_demo_league' limit 1;
  if newdef is null then raise exception 'create_demo_league not found'; end if;
  execute newdef;
end $$;
