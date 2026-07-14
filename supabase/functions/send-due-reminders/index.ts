// supabase/functions/send-due-reminders/index.ts
//
// Рассылка push-напоминаний о сборе на игру/турнир (FCM HTTP v1) + событийных
// пушей («новая игра/турнир в лиге», «объявление лиги» — due_event_pushes()).
// Вызывается по расписанию (pg_cron каждые 5 мин). Логика:
//   1) due_reminders() в БД возвращает «созревшие» пары (участник × событие × офсет),
//      которые ещё не отправлены (по reminder_log); due_event_pushes() — свежие
//      события лиг для участников с включённым notify_events;
//   2) берём push-токены этих участников;
//   3) чеканим OAuth-токен FCM из service-account (JWT RS256, Web Crypto);
//   4) шлём каждому токену уведомление; мёртвые токены (UNREGISTERED) удаляем;
//   5) пишем reminder_log — защита от повторной отправки (события — offset_min=0).
//
// Секреты (Supabase → Edge Functions → Secrets):
//   FCM_SERVICE_ACCOUNT = <весь JSON сервисного аккаунта Firebase, одной строкой>
//   CRON_SECRET         = <произвольная строка; должна совпадать с заголовком x-cron-secret>
// Деплой:  supabase functions deploy send-due-reminders  (или через UI)

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

// --- OAuth access token из service-account (для FCM v1) ---
function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function getFcmAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("oauth_failed: " + JSON.stringify(data));
  return data.access_token as string;
}

// --- APNs auth token (ES256 JWT из .p8, EC-ключ P-256). Кэшируется в вызове. ---
async function getApnsAuthToken(p8Pem: string, keyId: string, teamId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const claim = { iss: teamId, iat: now };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToDer(p8Pem),
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned)),
  );
  return `${unsigned}.${b64url(sig)}`;
}

// --- текст уведомления ---
// Спортивные, мотивирующие и РАЗНЫЕ тексты. Выбор шаблона детерминирован хешом
// (event_id+offset): один и тот же пуш всегда звучит одинаково (на ретраях не
// «прыгает»), но разные события и разные офсеты одного события звучат по-разному.
// Тон усиливается по мере приближения старта.
function pickBy<T>(seed: string, arr: T[]): T {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return arr[(h >>> 0) % arr.length];
}

// Заголовок под КАЖДЫЙ офсет: несёт «через сколько» (завтра / через 5 ч / 2 ч / час),
// тон усиливается к старту. Тело несёт «когда» — конкретное локальное время.
function titlePool(isTour: boolean, off: number): string[] {
  if (off >= 1440) return isTour
    ? ["🏆 Завтра турнир", "🏆 Турнир завтра — готовься", "🎾 Готовь ракетку: завтра турнир"]
    : ["🎾 Завтра игра", "🎾 Готовь ракетку — завтра", "🎾 Завтра собираемся на корт"];
  if (off >= 300) return isTour
    ? ["🏆 Сегодня турнир — через 5 часов", "🏆 Турнир уже сегодня", "🎾 Готовься: турнир через 5 часов"]
    : ["🎾 Сегодня игра — через 5 часов", "🎾 Игра уже сегодня", "🎾 Готовься: игра через 5 часов"];
  if (off >= 120) return isTour
    ? ["🔥 Турнир через 2 часа", "🏆 Через 2 часа — старт турнира", "🎾 Турнир скоро: через 2 часа"]
    : ["🔥 Игра через 2 часа", "🎾 Через 2 часа на корт", "🎾 Игра скоро: через 2 часа"];
  return isTour // <= 60 мин — хайп
    ? ["🎾 Турнир уже через час!", "🔥 Через час — на корт!", "🏆 Час до турнира — разминайся"]
    : ["🎾 Пора на корт — уже через час!", "🔥 Через час на корт!", "🎾 Час до игры — разминайся"];
}
const TAILS_NEAR = ["Погнали! 💪", "Разомнись и покажи класс!", "Возьми воду и ракетку 🎾", "Время побеждать 🔥"];
const TAILS_FAR = ["Не пропусти 💪", "Отметь в календаре 📅", "Собери своих 🎾", "Готовься к бою!"];

// Локальное «когда»: «сегодня в 19:30» / «завтра в 10:00» / «14 июля в 09:00».
// tz — часовой пояс устройства (push_tokens.tz); фолбэк — Москва (осн. рынок РФ).
function ymd(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function whenLocal(startsAtIso: string, tz: string): string {
  const t = tz || "Europe/Moscow";
  const start = new Date(startsAtIso);
  const now = new Date();
  const time = new Intl.DateTimeFormat("ru-RU", { timeZone: t, hour: "2-digit", minute: "2-digit" }).format(start);
  const dStart = ymd(start, t);
  let day: string;
  if (dStart === ymd(now, t)) day = "сегодня";
  else if (dStart === ymd(new Date(now.getTime() + 86400000), t)) day = "завтра";
  else day = new Intl.DateTimeFormat("ru-RU", { timeZone: t, day: "numeric", month: "long" }).format(start);
  return `${day} в ${time}`;
}

// Заголовок и хвост от tz не зависят — считаем один раз; время подставляем на токен.
function compose(d: { event_type: string; title: string | null; place: string | null; event_id: string; offset_min: number; starts_at: string }) {
  const isTour = d.event_type === "tournament";
  const name = d.title || (isTour ? "Турнир" : "Игра");
  const lead = `${name}${d.place ? ` · ${d.place}` : ""}`;
  const seed = `${d.event_id}:${d.offset_min}`;
  const title = pickBy(seed, titlePool(isTour, d.offset_min));
  const tail = pickBy(seed + "·t", d.offset_min <= 120 ? TAILS_NEAR : TAILS_FAR);
  // build(tz): тело с конкретным локальным временем старта под пояс устройства.
  return { title, build: (tz: string) => `${lead} — ${whenLocal(d.starts_at, tz)}. ${tail}` };
}

// Текст событийного пуша (новая игра/турнир/объявление в лиге) — тоже с задором.
const CTA_GAME = ["записывайся в состав 💪", "занимай слот 🎾", "врывайся в игру 🔥"];
const CTA_TOUR = ["заявляйся, пока есть места 🎾", "регистрируйся и покажи класс 🏆", "лови слот в сетке 🔥"];
function composeEvent(d: { event_type: string; title: string | null; place: string | null; league: string | null; event_id: string }) {
  const lg = d.league ? ` · ${d.league}` : "";
  if (d.event_type === "new_game")
    return { title: `🎾 Новая игра${lg}`, body: `${d.title || "Игра"}${d.place ? ` · ${d.place}` : ""} — ${pickBy(d.event_id, CTA_GAME)}` };
  if (d.event_type === "new_tournament")
    return { title: `🏆 Новый турнир${lg}`, body: `${d.title || "Турнир"} — ${pickBy(d.event_id, CTA_TOUR)}` };
  return { title: `📣 Объявление${lg}`, body: d.title || "" }; // league_post: текст автора не трогаем
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
      return json({ error: "unauthorized" }, 401);
    }
    const saRaw = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!saRaw) return json({ error: "fcm_not_configured" }, 500);
    const sa = JSON.parse(saRaw);
    const projectId = sa.project_id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) созревшие напоминания + событийные пуши
    const { data: due, error } = await admin.rpc("due_reminders", { lookback_min: 15 });
    if (error) throw error;
    // Функция может отсутствовать до прогона миграции 2026-07-18 — не роняем напоминания,
    // но ошибку ЛОГИРУЕМ и отдаём в ответе: иначе отказ событийных пушей невидим.
    const evRes = await admin.rpc("due_event_pushes", { lookback_min: 15 });
    if (evRes.error) console.error("due_event_pushes:", evRes.error);
    const events = evRes.error ? [] : (evRes.data || []);
    if ((!due || due.length === 0) && events.length === 0) return json({ due: 0, events: 0, sent: 0 });

    // 2) токены участников (объединяем адресатов напоминаний и событий)
    const userIds = [...new Set([...(due || []), ...events].map((d: any) => d.user_id))];
    const { data: tokRows } = await admin.from("push_tokens").select("user_id, token, platform, tz").in("user_id", userIds);
    const byUser: Record<string, Array<{ token: string; platform: string; tz: string }>> = {};
    for (const r of tokRows || []) (byUser[r.user_id] ||= []).push({ token: r.token, platform: r.platform || "android", tz: r.tz || "" });

    // 3) FCM access token (Android) + конфиг APNs (iOS напрямую)
    const accessToken = await getFcmAccessToken(sa);
    const apnsKey = Deno.env.get("APNS_KEY");
    const apnsKeyId = Deno.env.get("APNS_KEY_ID");
    const apnsTeamId = Deno.env.get("APNS_TEAM_ID");
    const apnsTopic = Deno.env.get("APNS_TOPIC") || "app.padelpack";
    const apnsPrimary = (Deno.env.get("APNS_ENV") || "production") === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
    const apnsFallback = apnsPrimary === "api.push.apple.com" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
    const apnsConfigured = !!(apnsKey && apnsKeyId && apnsTeamId);
    let apnsAuth: string | null = null;

    let sent = 0;
    const bad: string[] = [];
    let log: any[] = [];
    // Порционная запись лога: при падении/таймауте посреди длинной рассылки уже
    // отправленные пуши остаются залогированными и НЕ ретраятся следующим кроном.
    const flushLog = async () => {
      if (!log.length) return;
      const chunk = log; log = [];
      await admin.from("reminder_log").upsert(chunk, {
        onConflict: "user_id,event_type,event_id,offset_min", ignoreDuplicates: true,
      });
    };

    // Единый отправитель: и напоминания, и события идут одним циклом. У напоминаний
    // тело зависит от пояса устройства (локальное время старта) → build(tz) на токен;
    // у событий тело фиксированное.
    const outbox: Array<{ user_id: string; event_type: string; event_id: string; offset_min: number; title: string; body?: string; build?: (tz: string) => string }> = [];
    for (const d of (due || []) as any[]) {
      const m = compose(d);
      outbox.push({ user_id: d.user_id, event_type: d.event_type, event_id: d.event_id, offset_min: d.offset_min, title: m.title, build: m.build });
    }
    for (const d of events as any[]) {
      const m = composeEvent(d);
      outbox.push({ user_id: d.user_id, event_type: d.event_type, event_id: d.event_id, offset_min: 0, title: m.title, body: m.body });
    }

    for (const d of outbox) {
      const tokens = byUser[d.user_id] || [];
      // логируем факт обработки в любом случае — иначе будет ретраиться каждые 5 мин
      log.push({ user_id: d.user_id, event_type: d.event_type, event_id: d.event_id, offset_min: d.offset_min });
      if (tokens.length === 0) { if (log.length >= 20) await flushLog(); continue; }
      const title = d.title;
      for (const tk of tokens) {
        // тело: у события фиксированное, у напоминания — с локальным временем пояса токена
        const body = d.body != null ? d.body : d.build!(tk.tz);
        // Сетевой сбой одного fetch не должен ронять всю рассылку (и терять лог).
        try {
          if (tk.platform === "ios") {
            // iOS — напрямую в APNs (Firebase не нужен). JWT ES256 из .p8, кэшируем на вызов.
            if (!apnsConfigured) continue;
            if (!apnsAuth) { try { apnsAuth = await getApnsAuthToken(apnsKey!, apnsKeyId!, apnsTeamId!); } catch (e) { console.error("apns jwt:", e); } }
            if (!apnsAuth) continue;
            const hdrs = { authorization: `bearer ${apnsAuth}`, "apns-topic": apnsTopic, "apns-push-type": "alert", "apns-priority": "10" };
            const payload = JSON.stringify({ aps: { alert: { title, body }, sound: "default", badge: 1 }, event_type: String(d.event_type), event_id: String(d.event_id) });
            let r = await fetch(`https://${apnsPrimary}/3/device/${tk.token}`, { method: "POST", headers: hdrs, body: payload });
            if (r.status === 400) {
              const e = await r.json().catch(() => ({} as any));
              // токен может быть из другого окружения (sandbox↔prod) — пробуем второй хост
              if (e?.reason === "BadDeviceToken") r = await fetch(`https://${apnsFallback}/3/device/${tk.token}`, { method: "POST", headers: hdrs, body: payload });
            }
            if (r.ok) { sent++; continue; }
            const e2 = await r.json().catch(() => ({} as any));
            if (r.status === 410 || e2?.reason === "Unregistered" || e2?.reason === "BadDeviceToken") {
              bad.push(tk.token);
              console.log("apns prune:", r.status, e2?.reason, tk.token.slice(0, 12));
            }
            else console.error("apns:", r.status, e2?.reason);
            continue;
          }
          // Android / прочее — FCM HTTP v1.
          const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
            body: JSON.stringify({
              message: {
                token: tk.token,
                notification: { title, body },
                data: { event_type: String(d.event_type), event_id: String(d.event_id) },
                android: { priority: "high" },
              },
            }),
          });
          if (r.ok) { sent++; continue; }
          const e = await r.json().catch(() => ({} as any));
          const code = e?.error?.details?.[0]?.errorCode || e?.error?.status;
          if (r.status === 404 || code === "UNREGISTERED" || code === "INVALID_ARGUMENT") {
            bad.push(tk.token);
            console.log("fcm prune:", r.status, code, tk.token.slice(0, 12));
          }
        } catch (e) { console.error("push fetch:", e); }
      }
      if (log.length >= 20) await flushLog();
    }

    await flushLog();
    if (bad.length) await admin.from("push_tokens").delete().in("token", bad);

    return json({ due: (due || []).length, events: events.length, events_error: evRes.error ? String(evRes.error.message || evRes.error) : null, sent, pruned: bad.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
