// supabase/functions/notify-telegram/index.ts
//
// MVP Telegram-уведомлений. Пока шлёт ЛИЧНО владельцу (в чат TELEGRAM_OWNER_CHAT_ID),
// каналов лиг ещё нет — позже получателя заменим на привязанный канал/группу лиги.
//
// Событие: game_created — «создана новая игра, займи слот: <ссылка>».
// Вызывается клиентом после createGame (fire-and-forget, не блокирует создание игры).
//
// Секреты:
//   TELEGRAM_BOT_TOKEN      — токен бота (тот же, что у telegram-auth)
//   TELEGRAM_OWNER_CHAT_ID  — chat_id получателя (твой Telegram id; напиши боту и
//                             посмотри через @userinfobot)
//   APP_URL                 — базовый URL приложения (по умолчанию https://padelpack.app)
//
// Деплой:  supabase functions deploy notify-telegram

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

async function tgSend(token: string, chatId: string, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
  });
  return r.ok;
}

const fmtWhen = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow",
    });
  } catch { return ""; }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_OWNER_CHAT_ID");
    const appUrl = Deno.env.get("APP_URL") || "https://padelpack.app";

    // Не настроено — тихо выходим (уведомления опциональны, не должны ломать UX).
    if (!token || !chatId) return json({ ok: false, skipped: "not_configured" });

    // 1. Кто вызывает (по JWT).
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { type = "game_created", gameId } = await req.json();
    if (!gameId) return json({ error: "no_game" }, 400);

    const admin = createClient(url, service);

    // 2. Игра + лига + слоты с именами.
    const { data: game } = await admin
      .from("games")
      .select("id, group_id, title, starts_at, place, invite_code, group:groups(name), slots:game_slots(profile_id, guest_name, profile:profiles(name))")
      .eq("id", gameId).single();
    if (!game) return json({ error: "game_not_found" }, 404);

    // 3. Вызывающий должен быть участником лиги этой игры.
    const { data: me } = await admin.from("profiles").select("id").eq("user_id", user.id).single();
    const { data: membership } = await admin.from("group_members")
      .select("profile_id").eq("group_id", game.group_id).eq("profile_id", me?.id).maybeSingle();
    if (!membership) return json({ error: "forbidden" }, 403);

    // 4. Собираем сообщение.
    const slots = (game.slots || []) as any[];
    const filled = slots.filter((s) => s.profile_id || s.guest_name).length;
    const need = Math.max(0, 4 - filled);
    const names = slots.map((s) => s.profile?.name || s.guest_name).filter(Boolean);
    const when = fmtWhen(game.starts_at);
    const link = `${appUrl}/j/${game.invite_code}`;

    const lines = [
      `🎾 Новая игра${game.group?.name ? " · " + game.group.name : ""}`,
    ];
    if (game.title) lines.push(game.title);
    const meta = [when, game.place].filter(Boolean).join(" · ");
    if (meta) lines.push(meta);
    lines.push(need > 0 ? `👥 ${filled}/4 — нужно ещё ${need}` : `👥 ${filled}/4 — состав собран`);
    if (names.length) lines.push(names.join(", "));
    lines.push(`Занять место: ${link}`);

    const sent = await tgSend(token, chatId, lines.join("\n"));
    return json({ ok: sent, type });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
