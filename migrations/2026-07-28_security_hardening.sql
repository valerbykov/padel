-- 2026-07-28_security_hardening.sql
-- Закрытие ЧЕТЫРЁХ дыр, ПОДТВЕРЖДЁННЫХ на живой БД (ревью 2026-07-18).
-- Все фиксы проверены на безопасность против реального использования:
--   • клиент rate_tournament / group_analytics_mode напрямую НЕ вызывает —
--     их дёргают только SECURITY DEFINER finish_tournament / group_analytics
--     (как definer, revoke на anon/authenticated их не затрагивает);
--   • join_league / create_league — SECURITY DEFINER и сами вставляют в
--     group_members в обход RLS, поэтому удаление self-clause из INSERT-политики
--     легитимное вступление не ломает.
-- Идемпотентно. Запускать в Supabase SQL editor.

-- (1) КРИТИЧНО — self-escalation в глобального админа.
-- Политика "update own profile" на profiles без WITH CHECK + табличный GRANT UPDATE
-- позволяли ЛЮБОМУ залогиненному: update profiles set is_admin=true where user_id=auth.uid()
-- → полный админ (чтение любых PII, правка любых лиг/рейтингов, admin-create-user).
-- ВАЖНО: колоночный revoke НЕ работает, пока есть табличный UPDATE-грант — он перекрывает.
-- Поэтому: отзываем табличный UPDATE и выдаём обратно ПОКОЛОНОЧНО, кроме is_admin.
revoke update on public.profiles from anon, authenticated;
grant update (name, created_at, first_name, last_name, phone, email, avatar_url, contacts, claim_code, last_seen, notifications_seen_at)
  on public.profiles to authenticated;

-- (2) КРИТИЧНО — вступление в ЛЮБУЮ лигу владельцем с любым рейтингом.
-- INSERT-политика "add members" содержала clause (profile_id = current_profile_id()),
-- истинный для любого group_id → любой authenticated мог вписать себя в чужую лигу
-- как role='owner', rating=999999. Легитимный self-join идёт через SECURITY DEFINER
-- join_league, поэтому self-clause убираем.
alter policy "add members" on public.group_members
  with check (
    is_group_member(group_id)
    or exists (select 1 from groups g where g.id = group_members.group_id and g.owner_id = current_profile_id())
  );

-- (3) HIGH — rate_tournament был EXECUTE=PUBLIC и БЕЗ проверки прав.
-- Любой (даже anon по 4-символьному коду турнира) мог форсить/искажать рейтинг чужого
-- турнира и навсегда флипать rated=true. finish_tournament (definer) зовёт его внутри.
revoke execute on function public.rate_tournament(uuid) from anon, authenticated;

-- (4) HIGH — group_analytics_mode отдан authenticated БЕЗ проверки членства.
-- Утечка статистики и имён игроков любой лиги по её group_id. Обёртка group_analytics
-- (с is_group_member) остаётся доступной и делает проверку.
revoke execute on function public.group_analytics_mode(uuid, text[], text) from anon, authenticated;
