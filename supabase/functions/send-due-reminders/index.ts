// supabase/functions/send-due-reminders/index.ts
//
// Рассылка push-напоминаний о сборе на игру/турнир (FCM HTTP v1).
// Вызывается по расписанию (pg_cron каждые 5 мин). Логика:
//   1) due_reminders() в БД возвращает «созревшие» пары (участник × событие × офсет),
//      которые ещё не отправлены (по reminder_log);
//   2) берём push-токены этих участников;
//   3) чеканим OAuth-токен FCM из service-account (JWT RS256, Web Crypto);
//   4) шлём каждому токену уведомление; мёртвые токены (UNREGISTERED) удаляем;
//   5) пишем reminder_log — защита от повторной отправки.
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

    // 1) созревшие напоминания
    const { data: due, error } = await admin.rpc("due_reminders", { lookback_min: 15 });
    if (error) throw error;
    if (!due || due.length === 0) return json({ due: 0, sent: 0 });

    // 2) токены участников
    const userIds = [...new Set(due.map((d: any) => d.user_id))];
    const { data: tokRows } = await admin.from("push_tokens").select("user_id, token").in("user_id", userIds);
    const byUser: Record<string, string[]> = {};
    for (const r of tokRows || []) (byUser[r.user_id] ||= []).push(r.token);

    // 3) FCM access token
    const accessToken = await getFcmAccessToken(sa);

    let sent = 0;
    const bad: string[] = [];
    const log: any[] = [];

    for (const d of due as any[]) {
      const tokens = byUser[d.user_id] || [];
      // логируем факт обработки в любом случае — иначе будет ретраиться каждые 5 мин
      log.push({ user_id: d.user_id, event_type: d.event_type, event_id: d.event_id, offset_min: d.offset_min });
      if (tokens.length === 0) continue;
      const { title, body } = compose(d);
      for (const token of tokens) {
        const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { event_type: String(d.event_type), event_id: String(d.event_id) },
              android: { priority: "high" },
            },
          }),
        });
        if (r.ok) { sent++; continue; }
        const e = await r.json().catch(() => ({} as any));
        const code = e?.error?.details?.[0]?.errorCode || e?.error?.status;
        if (r.status === 404 || code === "UNREGISTERED" || code === "INVALID_ARGUMENT") bad.push(token);
      }
    }

    if (log.length) {
      await admin.from("reminder_log").upsert(log, {
        onConflict: "user_id,event_type,event_id,offset_min", ignoreDuplicates: true,
      });
    }
    if (bad.length) await admin.from("push_tokens").delete().in("token", bad);

    return json({ due: due.length, sent, pruned: bad.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
