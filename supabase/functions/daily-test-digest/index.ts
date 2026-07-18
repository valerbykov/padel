// supabase/functions/daily-test-digest/index.ts
//
// Ежедневное письмо о прогрессе тестирования: сводка из public.test_digest_stats()
// + списки «присоединились за сутки» и «заходили за сутки». Шлётся через Resend API.
//
// Секреты: RESEND_API_KEY, CRON_SECRET, опц. DIGEST_TO / DIGEST_FROM.
// Деплой:  supabase functions deploy daily-test-digest --no-verify-jwt

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

const esc = (x: unknown) =>
  String(x == null ? "" : x).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
const fmtDt = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
  } catch { return iso; }
};

// Таблица людей: заголовок, список, имя поля с датой, подпись последнего столбца, текст если пусто.
const peopleTable = (title: string, list: any[], tsField: string, lastCol: string, emptyMsg: string) =>
  list.length
    ? `<h3 style="font-size:15px;margin:22px 0 8px">${title} (${list.length})</h3>
       <table style="border-collapse:collapse;width:100%;font-size:13px">
         <thead><tr>
           <th style="text-align:left;padding:6px 10px;color:#777;border-bottom:1px solid #eee">Имя</th>
           <th style="text-align:left;padding:6px 10px;color:#777;border-bottom:1px solid #eee">Email</th>
           <th style="text-align:left;padding:6px 10px;color:#777;border-bottom:1px solid #eee">Вход</th>
           <th style="text-align:left;padding:6px 10px;color:#777;border-bottom:1px solid #eee">${lastCol}</th>
         </tr></thead>
         <tbody>${list.map((u) => `<tr>
           <td style="padding:6px 10px;border-bottom:1px solid #f2f2f2">${esc(u.name || "—")}</td>
           <td style="padding:6px 10px;border-bottom:1px solid #f2f2f2">${esc(u.email || "—")}</td>
           <td style="padding:6px 10px;border-bottom:1px solid #f2f2f2">${esc(u.provider || "—")}</td>
           <td style="padding:6px 10px;border-bottom:1px solid #f2f2f2;white-space:nowrap">${fmtDt(u[tsField])}</td>
         </tr>`).join("")}</tbody>
       </table>`
    : `<div style="color:#999;font-size:13px;margin-top:18px">${emptyMsg}</div>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // Без CRON_SECRET эндпоинт (задеплоен --no-verify-jwt) был бы публичным —
    // любой мог бы спамить админскую рассылку. Нет секрета → закрыто.
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!cronSecret) return json({ error: "cron_secret_not_set" }, 500);
    if (req.headers.get("x-cron-secret") !== cronSecret) {
      return json({ error: "unauthorized" }, 401);
    }
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "resend_not_configured" }, 500);
    const to = Deno.env.get("DIGEST_TO") || "valerbykov@gmail.com";
    const from = Deno.env.get("DIGEST_FROM") || "PadelPack <noreply@send.padelpack.app>";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await admin.rpc("test_digest_stats");
    if (error) throw error;
    const s = data as Record<string, any>;

    const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    const need = 12;
    const ok14 = Number(s.new_14d) >= need;
    const subject = `PadelPack · тест: ${s.new_14d}/${need} за 14 дней, +${s.new_1d} за сутки`;

    const rowf = (label: string, val: number, hint = "") =>
      `<tr><td style="padding:6px 12px;color:#555">${label}</td>` +
      `<td style="padding:6px 12px;font-weight:600;font-size:18px">${val}</td>` +
      `<td style="padding:6px 12px;color:#999;font-size:12px">${hint}</td></tr>`;

    const joined: any[] = Array.isArray(s.new_1d_list) ? s.new_1d_list : [];
    const active: any[] = Array.isArray(s.active_1d_list) ? s.active_1d_list : [];

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <h2 style="margin:0 0 4px">PadelPack — прогресс тестирования</h2>
        <div style="color:#777;font-size:13px;margin-bottom:16px">${today}</div>
        <div style="background:${ok14 ? "#eef3e6" : "#faf0e6"};border:1px solid ${ok14 ? "#c0dd97" : "#f0c98a"};border-radius:10px;padding:10px 14px;font-size:14px;margin-bottom:16px">
          Требование Google: <b>12</b> участников за 14 дней. Сейчас по регистрациям: <b>${s.new_14d}</b> из 12${ok14 ? " ✓" : ""}.
        </div>
        <table style="border-collapse:collapse;width:100%">
          ${rowf("Всего пользователей", s.total)}
          ${rowf("Новых за сутки", s.new_1d, "регистрации")}
          ${rowf("Новых за 14 дней", s.new_14d, "регистрации")}
          ${rowf("Активны за сутки", s.active_24h, "заходили")}
          ${rowf("Активны за 7 дней", s.active_7d, "заходили")}
          ${rowf("Активны за 14 дней", s.active_14d, "заходили")}
        </table>
        ${peopleTable("Присоединились за сутки", joined, "created_at", "Когда", "За последние сутки новых участников нет.")}
        ${peopleTable("Заходили за сутки", active, "last_sign_in", "Последний вход", "За последние сутки никто не заходил.")}
        <div style="color:#999;font-size:12px;margin-top:18px">По auth.users (web/Android/iOS). Точный opted-in по Android — в Play Console.</div>
      </div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: "resend_failed", detail: body }, 502);
    return json({ ok: true, joined: joined.length, active: active.length, email_id: (body as any).id ?? null });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
