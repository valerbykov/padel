-- =====================================================================
-- merge_profiles(p_src, p_dst): слить ДВА профиля одного человека в один.
-- Типовой случай: гость играл под гостевым профилем, потом зарегистрировался
-- и создался ВТОРОЙ профиль. Переносим всю историю с гостя (p_src) на
-- зарегистрированного (p_dst) и удаляем гостя.
--
-- ВАЖНО, прочитать перед запуском:
--   • Операция НЕОБРАТИМА. Сделай бэкап (Dashboard → Database → Backups) до неё.
--   • p_src — КОГО удаляем (обычно гость, user_id IS NULL).
--   • p_dst — КОГО оставляем (обычно зарегистрированный, user_id IS NOT NULL).
--   • Функция транзакционна (падает целиком при ошибке — частичного слияния не будет).
--   • Таблицы турниров/скрытых партнёров созданы прямо в БД (не в репозитории),
--     поэтому они обрабатываются ЧЕРЕЗ to_regclass — если их нет/схема иная,
--     блок молча пропускается, ядро (игры/матчи/рейтинги) отрабатывает всегда.
--
-- Как найти два id (пример для «Даниил Захаров»):
--   select id, user_id, name, created_at from profiles
--   where name ilike '%захаров%' order by created_at;
--   -- гость = строка с user_id IS NULL; зарегистрированный = с user_id.
--
-- Запуск (SQL editor):
--   select merge_profiles('ГОСТЬ-UUID'::uuid, 'РЕГ-UUID'::uuid);
-- =====================================================================
create or replace function merge_profiles(p_src uuid, p_dst uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src profiles;
  v_dst profiles;
  v_groups uuid[];
  g uuid;
  n_slots int; n_matches int; n_rc int; n_tp int := 0;
begin
  if p_src = p_dst then
    raise exception 'src и dst совпадают';
  end if;
  select * into v_src from profiles where id = p_src;
  if not found then raise exception 'исходный профиль % не найден', p_src; end if;
  select * into v_dst from profiles where id = p_dst;
  if not found then raise exception 'целевой профиль % не найден', p_dst; end if;

  -- Группы, которых коснётся слияние (для пересчёта рейтингов в конце).
  select coalesce(array_agg(distinct group_id), '{}')
    into v_groups
    from group_members where profile_id in (p_src, p_dst);

  -- 1. Слоты игр: гость → цель.
  update game_slots set profile_id = p_dst where profile_id = p_src;
  get diagnostics n_slots = row_count;

  -- 2. Матчи: команды — это массивы profile_id. Меняем гостя на цель.
  update matches
     set team_a = array_replace(team_a, p_src, p_dst),
         team_b = array_replace(team_b, p_src, p_dst)
   where p_src = any(team_a) or p_src = any(team_b);
  get diagnostics n_matches = row_count;

  -- 3. История изменений рейтинга.
  update rating_changes set profile_id = p_dst where profile_id = p_src;
  get diagnostics n_rc = row_count;

  -- 4. Владелец группы / хост игры — если был гость.
  update groups set owner_id = p_dst where owner_id = p_src;
  update games  set host_id  = p_dst where host_id  = p_src;

  -- 5. Членство в группах. Где цель уже участник — просто убираем строку гостя
  --    (статы всё равно пересчитает recompute_group_ratings ниже). Где нет —
  --    переносим строку гостя на цель.
  delete from group_members gm_src
   where gm_src.profile_id = p_src
     and exists (select 1 from group_members gm_dst
                  where gm_dst.group_id = gm_src.group_id and gm_dst.profile_id = p_dst);
  update group_members set profile_id = p_dst where profile_id = p_src;

  -- 6. Турниры (таблицы созданы в БД, не в репо — работаем защищённо).
  if to_regclass('public.tournament_players') is not null then
    -- 6a. Где цель ещё НЕ заявлена в турнире — просто переименовываем гостя в цель.
    execute $sql$
      update tournament_players tp set profile_id = $2
       where tp.profile_id = $1
         and not exists (select 1 from tournament_players d
                          where d.tournament_id = tp.tournament_id and d.profile_id = $2)
    $sql$ using p_src, p_dst;
    get diagnostics n_tp = row_count;
    -- 6b. Где цель УЖЕ заявлена (конфликт unique) — сначала переклеиваем ссылки в
    --     сетке матчей с tp гостя на tp цели (матчи ссылаются на tournament_players.id),
    --     потом удаляем tp гостя. Делается только если есть таблица матчей.
    if to_regclass('public.tournament_matches') is not null then
      execute $sql$
        update tournament_matches m set
          team_a = (select array_agg(coalesce(map.dst, x)) from unnest(m.team_a) x
                    left join (
                      select s.id as src, d.id as dst
                        from tournament_players s
                        join tournament_players d
                          on d.tournament_id = s.tournament_id and d.profile_id = $2
                       where s.profile_id = $1
                    ) map on map.src = x),
          team_b = (select array_agg(coalesce(map.dst, x)) from unnest(m.team_b) x
                    left join (
                      select s.id as src, d.id as dst
                        from tournament_players s
                        join tournament_players d
                          on d.tournament_id = s.tournament_id and d.profile_id = $2
                       where s.profile_id = $1
                    ) map on map.src = x)
        where exists (
          select 1 from tournament_players s
          where s.profile_id = $1 and (s.id = any(m.team_a) or s.id = any(m.team_b))
        )
      $sql$ using p_src, p_dst;
    end if;
    -- удаляем оставшиеся tp-строки гостя (конфликтные — их матчи уже переклеены).
    execute 'delete from tournament_players where profile_id = $1' using p_src;
  end if;

  -- 7. Скрытые партнёры (hide_partner) не трогаем: их таблица/схема живёт только в
  --    БД. Если на неё есть FK на profiles с RESTRICT — удаление профиля ниже
  --    упадёт с понятной ошибкой (вся транзакция откатится, данные целы), и тогда
  --    достаточно дочистить эту строку вручную. Обычно FK стоит ON DELETE CASCADE.

  -- 8. Удаляем гостевой профиль.
  delete from profiles where id = p_src;

  -- 9. Пересчёт рейтингов затронутых групп из матчей.
  foreach g in array v_groups loop
    perform recompute_group_ratings(g);
  end loop;

  return format('OK: слотов %s, матчей %s, rating_changes %s, tournament_players %s; групп пересчитано %s',
                n_slots, n_matches, n_rc, n_tp, coalesce(array_length(v_groups,1),0));
end;
$$;

-- Только для ручного запуска админом из SQL editor (не через клиент).
revoke execute on function merge_profiles(uuid, uuid) from public, anon, authenticated;
