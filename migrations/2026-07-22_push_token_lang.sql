-- 2026-07-22_push_token_lang.sql
-- Язык интерфейса пользователя для локализации текста пуш-уведомлений
-- (ru/en/es). Хранится на токене устройства (как tz). Пишется клиентом при
-- регистрации токена и обновляется при смене языка в приложении. У старых
-- токенов null → send-due-reminders берёт фолбэк 'ru'.
-- Идемпотентно. Запускать в Supabase SQL editor.

alter table public.push_tokens add column if not exists lang text;
