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
const OFFSET_LABEL: Record<number, string> = {
  1440: "за день", 300: "за 5 часов", 120: "за 2 часа", 60: "за час",
};
function compose(d: { event_type: string; title: string | null; place: string | null; offset_min: number }) {
  const kind = d.event_type === "tournament" ? "турнир" : "игра";
  const name = d.title || (d.event_type === "tournament" ? "Турнир" : "Игра");
  const when = OFFSET_LABEL[d.offset_min] || `через ${Math.round(d.offset_min / 60)} ч`;
  const title = `Напоминание: ${kind}`;
  const body = `${name} — сбор ${when}${d.place ? ` · ${d.place}` : ""}`;
  return { title, body };
}

// Текст событийного пуша (новая игра/турнир/объявление в лиге).
function composeEvent(d: { event_type: string; title: string | null; place: string | null; league: string | null }) {
  const lg = d.league ? ` · ${d.league}` : "";
  if (d.event_type === "new_game")
    return { title: `Новая игра${lg}`, body: `${d.title || "Игра"}${d.place ? ` · ${d.place}` : ""}` };
  if (d.event_type === "new_tournament")
    return { title: `Новый турнир${lg}`, body: d.title || "Турнир" };
  return { title: `Объявление${lg}`, body: d.title || "" }; // league_post: title = фрагмент текста
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
    const { data: tokRows } = await admin.from("push_tokens").select("user_id, token, platform").in("user_id", userIds);
    const byUser: Record<string, Array<{ token: string; platform: string }>> = {};
    for (const r of tokRows || []) (byUser[r.user_id] ||= []).push({ token: r.token, platform: r.platform || "android" });

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

    // Единый отправитель: и напоминания, и события идут одним циклом.
    const outbox: Array<{ user_id: string; event_type: string; event_id: string; offset_min: number; msg: { title: string; body: string } }> = [];
    for (const d of (due || []) as any[]) {
      outbox.push({ user_id: d.user_id, event_type: d.event_type, event_id: d.event_id, offset_min: d.offset_min, msg: compose(d) });
    }
    for (const d of events as any[]) {
      outbox.push({ user_id: d.user_id, event_type: d.event_type, event_id: d.event_id, offset_min: 0, msg: composeEvent(d) });
    }

    for (const d of outbox) {
      const tokens = byUser[d.user_id] || [];
      // логируем факт обработки в любом случае — иначе будет ретраиться каждые 5 мин
      log.push({ user_id: d.user_id, event_type: d.event_type, event_id: d.event_id, offset_min: d.offset_min });
      if (tokens.length === 0) { if (log.length >= 20) await flushLog(); continue; }
      const { title, body } = d.msg;
      for (const tk of tokens) {
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
