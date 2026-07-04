// supabase/functions/delete-account/index.ts
//
// Удаление собственного аккаунта пользователем (Google Play / GDPR требование).
// Вызывается из приложения: supabase.functions.invoke("delete-account").
// Удалить можно ТОЛЬКО себя — личность берём из JWT вызывающего.
//
// Что делает:
//   1) обезличивает профиль (имя/фамилия/телефон/email/аватар/контакты) —
//      строку профиля НЕ удаляем, чтобы не рушить историю матчей в лигах
//      других игроков; игрок становится «Удалённый игрок»;
//   2) удаляет файлы аватара из storage (bucket avatars, папка <uid>/);
//   3) удаляет auth-пользователя — push-токены, настройки уведомлений и
//      reminder_log уедут каскадом (они ссылаются на auth.users on delete cascade).
//
// Секреты не нужны — SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
// Supabase инъектит в функции автоматически.
// Деплой:  supabase functions deploy delete-account

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Кто вызывает — по JWT из заголовка Authorization.
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await asUser.auth.getUser();
    if (uErr || !user) return json({ error: "Not authenticated" }, 401);
    const uid = user.id;

    // Админ-клиент (service_role) — обходит RLS, может удалять пользователей.
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    // 2. Обезличиваем профиль (не удаляем строку — сохраняем целостность матчей).
    await admin.from("profiles").update({
      name: "Удалённый игрок",
      first_name: null, last_name: null,
      phone: null, email: null,
      avatar_url: null, contacts: {},
    }).eq("user_id", uid);

    // 3. Удаляем файлы аватара из storage (avatars/<uid>/...).
    try {
      const { data: files } = await admin.storage.from("avatars").list(uid);
      if (files && files.length) {
        await admin.storage.from("avatars").remove(files.map((f) => `${uid}/${f.name}`));
      }
    } catch (_) { /* аватара могло не быть — не критично */ }

    // 4. Удаляем auth-пользователя (каскадом уедут push-токены/настройки/лог).
    const { error: dErr } = await admin.auth.admin.deleteUser(uid);
    if (dErr) return json({ error: dErr.message }, 400);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
