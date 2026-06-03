// supabase/functions/send-sms-hook/index.ts
//
// Send SMS Hook для Supabase Auth. Когда пользователь запрашивает вход по
// телефону, Supabase сам генерирует код и зовёт этот хук — а мы отправляем
// SMS через своего (российского) провайдера. Пример на smsc.ru; легко
// заменить на SMS Aero и т.п.
//
// ВАЖНО при деплое: хук вызывает Supabase сервер-к-серверу, без JWT:
//   supabase functions deploy send-sms-hook --no-verify-jwt
//
// Секреты:
//   supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_..."   (из настроек хука)
//   supabase secrets set SMSC_LOGIN=... SMSC_PASSWORD=...

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const hookError = (code: number, message: string) =>
  new Response(JSON.stringify({ error: { http_code: code, message } }),
    { status: code, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    // 1. Проверяем подпись запроса (что это действительно Supabase, а не подделка).
    const secret = (Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "").replace("v1,whsec_", "");
    const wh = new Webhook(secret);
    const { user, sms } = wh.verify(payload, headers) as {
      user: { phone: string };
      sms: { otp: string };
    };

    const phone = user.phone;            // в формате E.164, напр. +79001234567
    const text = `Код для входа в Падел-лигу: ${sms.otp}`;

    // 2. Отправляем через smsc.ru.
    const u = new URL("https://smsc.ru/sys/send.php");
    u.searchParams.set("login", Deno.env.get("SMSC_LOGIN") ?? "");
    u.searchParams.set("psw", Deno.env.get("SMSC_PASSWORD") ?? "");
    u.searchParams.set("phones", phone);
    u.searchParams.set("mes", text);
    u.searchParams.set("charset", "utf-8");
    u.searchParams.set("fmt", "3"); // ответ в JSON

    const res = await fetch(u.toString());
    const data = await res.json();
    if (data.error) return hookError(400, `SMS provider: ${data.error}`);

    // 3. Успех — пустой объект, статус 200.
    return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e) {
    return hookError(500, String(e));
  }
});
