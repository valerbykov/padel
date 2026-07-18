// supabase/functions/send-sms-hook/index.ts
//
// Send SMS Hook для Supabase Auth. Supabase сам генерирует OTP и вызывает этот
// хук — а мы решаем, через кого слать SMS. Маршрутизация по стране:
//   • +7 9xx xxx-xx-xx (мобильные РФ)  → SMSC.ru  (работает с физлицом)
//   • все остальные номера              → Twilio   (подключим позже)
//
// Twilio из РФ сейчас недоступен (санкции + оплата), поэтому мир пока не
// настроен: для зарубежных номеров хук вернёт ошибку, пока не заданы секреты
// TWILIO_*. В самом приложении зарубежным пользователям есть Google/Telegram/
// email, так что вход не блокируется.
//
// Тестовые номера (Supabase → Auth → Phone → Test OTP, напр. +79000000000)
// СЮДА НЕ ДОХОДЯТ: GoTrue отдаёт заданный код до вызова хука. Поэтому вход
// для ревью Google работает даже без единого настроенного провайдера.
//
// Деплой (хук зовётся сервер-к-серверу, без пользовательского JWT):
//   supabase functions deploy send-sms-hook --no-verify-jwt
//
// Секреты (supabase secrets set ...):
//   SEND_SMS_HOOK_SECRET = v1,whsec_...   (из настроек хука в дашборде)
//   SMSC_LOGIN           = <логин личного кабинета smsc.ru>
//   SMSC_PASSWORD        = <пароль или API-пароль smsc.ru>
//   TWILIO_ACCOUNT_SID   = ACxxxx   (позже, для мира)
//   TWILIO_AUTH_TOKEN    = ...      (позже)
//   TWILIO_FROM          = +1xxxx   (позже)

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const hookError = (code: number, message: string) =>
  new Response(JSON.stringify({ error: { http_code: code, message } }),
    { status: code, headers: { "content-type": "application/json" } });

const ok = () =>
  new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });

// --- Российский шлюз: SMSC.ru ---
async function sendViaSmsc(phones: string, otp: string) {
  const login = Deno.env.get("SMSC_LOGIN") ?? "";
  const psw = Deno.env.get("SMSC_PASSWORD") ?? "";
  if (!login || !psw) throw new Error("SMSC_LOGIN/SMSC_PASSWORD не заданы");
  const u = new URL("https://smsc.ru/sys/send.php");
  u.searchParams.set("login", login);
  u.searchParams.set("psw", psw);
  u.searchParams.set("phones", phones);            // 79001234567
  u.searchParams.set("mes", `PadelPack: код ${otp}`);
  u.searchParams.set("charset", "utf-8");
  u.searchParams.set("fmt", "3");                  // ответ в JSON
  const res = await fetch(u.toString());
  const data = await res.json().catch(() => ({}));
  if (data?.error) throw new Error(`SMSC.ru: ${data.error} (code ${data.error_code})`);
}

// --- Мировой шлюз: Twilio (подключим позже) ---
async function sendViaTwilio(e164: string, otp: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
  const token = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  const from = Deno.env.get("TWILIO_FROM") ?? "";
  if (!sid || !token || !from) throw new Error("Мировой SMS-провайдер ещё не настроен");
  const body = new URLSearchParams({ To: e164, From: from, Body: `PadelPack code: ${otp}` });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "authorization": "Basic " + btoa(`${sid}:${token}`),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Twilio: ${data?.message || res.status}`);
  }
}

Deno.serve(async (req) => {
  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    // 1. Проверяем подпись — что запрос действительно от Supabase. Без секрета
    // Webhook("") принял бы что угодно (fail-open) — поэтому явно закрываемся.
    const rawSecret = Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "";
    if (!rawSecret) return hookError(500, "SEND_SMS_HOOK_SECRET не задан");
    const secret = rawSecret.replace("v1,whsec_", "");
    const wh = new Webhook(secret);
    const { user, sms } = wh.verify(payload, headers) as {
      user: { phone: string };
      sms: { otp: string };
    };

    // 2. Нормализуем номер: цифры для роутинга/SMSC, E.164 для Twilio.
    const digits = (user.phone || "").replace(/\D/g, "");   // 79001234567
    if (digits.length < 8) return hookError(400, "Некорректный номер телефона");
    const e164 = "+" + digits;

    const isRfMobile = digits.startsWith("79") && digits.length === 11;

    // 3. Отправляем через нужный шлюз.
    if (isRfMobile) await sendViaSmsc(digits, sms.otp);
    else await sendViaTwilio(e164, sms.otp);

    return ok();
  } catch (e) {
    return hookError(400, String(e instanceof Error ? e.message : e));
  }
});
