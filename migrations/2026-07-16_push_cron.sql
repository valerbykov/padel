-- Планировщик push-напоминаний: каждые 5 минут дёргаем edge-функцию send-due-reminders.
-- Требует расширений pg_cron и pg_net (Supabase → Database → Extensions — включить оба).
-- ПЕРЕД запуском заменить <CRON_SECRET> на то же значение, что задано в секрете
-- CRON_SECRET у edge-функции. URL проекта уже подставлен (ref ofewhhcwswjxvlqsygxu).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('send-due-reminders')
where exists (select 1 from cron.job where jobname = 'send-due-reminders');

select cron.schedule(
  'send-due-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://ofewhhcwswjxvlqsygxu.supabase.co/functions/v1/send-due-reminders',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', 'SsBb'
    ),
    body    := '{}'::jsonb
  );
  $$
);
