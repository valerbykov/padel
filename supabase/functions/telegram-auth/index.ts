// supabase/functions/telegram-auth/index.ts
//
// Вход через Telegram. Telegram Login Widget на клиенте отдаёт данные
// пользователя с подписью (hash). Здесь мы:
//   1) проверяем подпись по токену бота (HMAC-SHA256),
//   2) создаём/находим пользователя Supabase,
//   3) возвращаем одноразовый token_hash — клиент меняет его на сессию.
//
// Секрет бота задать один раз:
//   supabase secrets set TELEGRAM_BOT_TOKEN=123456:ABC...
// Деплой:
//   supabase functions deploy telegram-auth

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

// Проверка подписи Telegram Login Widget.
async function verifyTelegram(data: Record<string, string>, botToken: string) {
  const { hash, ...fields } = data;
  const checkString = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const enc = new TextEncoder();
  // secret_key = SHA256(bot_token)
  const secret = await crypto.subtle.digest("SHA-256", enc.encode(botToken));
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(checkString));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === hash;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) return json({ error: "bot_token_not_set" }, 500);

    const tg = await req.json(); // {id, first_name, last_name?, username?, photo_url?, auth_date, hash}

    // 1. Подпись и свежесть (не старше суток).
    if (!(await verifyTelegram(tg, botToken))) return json({ error: "bad_signature" }, 401);
    if (Date.now() / 1000 - Number(tg.auth_date) > 86400) return json({ error: "expired" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    // 2. Синтетический email на основе telegram id (Telegram email не даёт).
    const email = `tg${tg.id}@telegram.local`;
    const meta = {
      provider: "telegram",
      telegram_id: String(tg.id),
      username: tg.username ?? null,
      photo_url: tg.photo_url ?? null,
      first_name: tg.first_name ?? null,
      last_name: tg.last_name ?? null,
      name: [tg.first_name, tg.last_name].filter(Boolean).join(" "),
    };

    // Создаём, если новый (ошибку «уже существует» игнорируем).
    await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta }).catch(() => {});

    // 3. Одноразовая ссылка → берём из неё token_hash и id.
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;

    // Освежаем метаданные (аватар/username могли поменяться).
    if (link.user?.id) await admin.auth.admin.updateUserById(link.user.id, { user_metadata: meta });

    // Аватар из Telegram → в profiles.avatar_url (приложение читает его оттуда,
    // а не из user_metadata — без этого показывалась собака-заглушка). Ставим
    // только если своё фото ещё не задано, чтобы не перетереть загруженное.
    // Некритично: ошибку глотаем, вход не рушим.
    if (tg.photo_url && link.user?.id) {
      try {
        await admin.from("profiles")
          .update({ avatar_url: tg.photo_url })
          .eq("user_id", link.user.id)
          .is("avatar_url", null);
      } catch (_) { /* аватар — украшение */ }
    }

    // @ник — сразу в контакты профиля (если пользователь не задал свой):
    // чип Telegram в статистике игрока виден лиге без визита в личный кабинет.
    if (tg.username && link.user?.id) {
      const { data: prof } = await admin.from("profiles")
        .select("id, contacts").eq("user_id", link.user.id).maybeSingle();
      if (prof && !(prof.contacts && prof.contacts.telegram)) {
        await admin.from("profiles")
          .update({ contacts: { ...(prof.contacts ?? {}), telegram: "@" + tg.username } })
          .eq("id", prof.id);
      }
    }

    // Отдаём клиенту email и одноразовый код — он меняет их на сессию.
    return json({
      email,
      token: link.properties.email_otp,
      token_hash: link.properties.hashed_token,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
