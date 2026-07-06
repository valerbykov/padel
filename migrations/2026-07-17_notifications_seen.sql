-- 2026-07-17_notifications_seen.sql
-- Колокольчик уведомлений: отметка «когда пользователь последний раз открывал
-- панель уведомлений». Отдельная от last_seen (та обновляется при КАЖДОМ заходе
-- и потому не годится как граница непрочитанного). Хранится в profiles —
-- синхронизируется между устройствами.
-- Идемпотентно. Запускать в Supabase SQL Editor.

alter table profiles add column if not exists notifications_seen_at timestamptz;

-- security definer: обновляет ТОЛЬКО свою строку (where user_id = auth.uid()).
create or replace function touch_notifications_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set notifications_seen_at = now() where user_id = auth.uid();
$$;

grant execute on function touch_notifications_seen() to authenticated;
