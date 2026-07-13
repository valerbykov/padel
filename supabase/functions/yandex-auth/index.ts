// supabase/functions/yandex-auth/index.ts
//
// Вход через Яндекс (Yandex ID). Клиент проходит OAuth (code flow) и присылает code.
// Здесь:
//   1) меняем code на access_token через client_secret (доказывает, что это наше приложение),
//   2) получаем профиль из login.yandex.ru/info,
//   3) создаём/находим пользователя Supabase,
//   4) возвращаем одноразовый token_hash — клиент меняет его на сессию (как telegram-auth).
//
// Секреты задать один раз:
//   supabase secrets set YANDEX_CLIENT_ID=...  YANDEX_CLIENT_SECRET=...
// Деплой:
//   supabase functions deploy yandex-auth

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const clientId = Deno.env.get("YANDEX_CLIENT_ID");
    const clientSecret = Deno.env.get("YANDEX_CLIENT_SECRET");
    if (!clientId || !clientSecret) return json({ error: "yandex_not_configured" }, 500);

    const { code, redirect_uri } = await req.json();
    if (!code) return json({ error: "no_code" }, 400);

    // 1. code -> access_token. Удачный обмен доказывает, что code выдан нашему приложению.
    const tokenRes = await fetch("https://oauth.yandex.ru/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        ...(redirect_uri ? { redirect_uri } : {}),
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return json({ error: "bad_code", detail: tokenData }, 401);

    // 2. Профиль пользователя Яндекса.
    const infoRes = await fetch("https://login.yandex.ru/info?format=json", {
      headers: { Authorization: `OAuth ${tokenData.access_token}` },
    });
    const info = await infoRes.json();
    if (!info.id) return json({ error: "no_userinfo" }, 401);

    const email = info.default_email || `ya${info.id}@yandex.local`;
    const avatar = info.is_avatar_empty
      ? null
      : `https://avatars.yandex.net/get-yapic/${info.default_avatar_id}/islands-200`;
    const meta = {
      provider: "yandex",
      yandex_id: String(info.id),
      name: info.real_name || info.display_name || info.login || null,
      first_name: info.first_name || null,
      last_name: info.last_name || null,
      avatar_url: avatar,
    };

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    // Создаём, если новый (ошибку «уже существует» игнорируем).
    await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta }).catch(() => {});

    // Одноразовая ссылка → token_hash + email_otp.
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    if (link.user?.id) await admin.auth.admin.updateUserById(link.user.id, { user_metadata: meta });

    // Аватар из Яндекса → СКАЧИВАЕМ в наш Storage (как в telegram-auth): внешняя
    // ссылка грузится медленнее и не кешируется service worker'ом. Ставим только
    // если своё фото ещё не задано. Некритично: ошибку глотаем, вход не рушим.
    if (avatar && link.user?.id) {
      try {
        const { data: prof0 } = await admin.from("profiles").select("id, avatar_url").eq("user_id", link.user.id).maybeSingle();
        if (prof0 && !prof0.avatar_url) {
          const img = await fetch(avatar);
          if (img.ok) {
            const bytes = new Uint8Array(await img.arrayBuffer());
            const ct = img.headers.get("content-type") || "image/jpeg";
            const ext = ct.includes("png") ? "png" : "jpg";
            const path = `ya/${link.user.id}.${ext}`;
            const up = await admin.storage.from("avatars").upload(path, bytes, { contentType: ct, upsert: true });
            const publicUrl = !up.error
              ? `${admin.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
              : avatar;
            await admin.from("profiles").update({ avatar_url: publicUrl }).eq("id", prof0.id).is("avatar_url", null);
          }
        }
      } catch (_) { /* аватар — украшение, вход не рушим */ }
    }

    // Имя/фамилия из Яндекса → в profiles (ЛК читает first/last_name, а не name).
    // Только если пусто — правки пользователя не перетираем. Некритично.
    if (link.user?.id && (info.first_name || info.last_name)) {
      try {
        await admin.from("profiles")
          .update({ first_name: info.first_name || null, last_name: info.last_name || null })
          .eq("user_id", link.user.id)
          .is("first_name", null)
          .is("last_name", null);
      } catch (_) { /* вход не рушим */ }
    }

    return json({
      email,
      token: link.properties.email_otp,
      token_hash: link.properties.hashed_token,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
