-- 2026-07-21_push_token_tz.sql
-- Часовой пояс устройства для пуш-напоминаний: чтобы в тексте показывать
-- локальное время старта («сегодня в 19:30»), а не UTC. Хранится на токене
-- (устройство = свой пояс). Заполняется клиентом при регистрации токена;
-- у старых токенов null → send-due-reminders берёт фолбэк Europe/Moscow.
-- Идемпотентно. Запускать в Supabase SQL editor.

alter table public.push_tokens add column if not exists tz text;
