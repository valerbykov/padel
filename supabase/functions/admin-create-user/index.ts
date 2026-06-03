// supabase/functions/admin-create-user/index.ts
//
// Создание пользователя администратором. Безопасно: service_role-ключ
// живёт только на сервере. Функция проверяет, что вызывающий — админ,
// затем приглашает нового пользователя (он задаст пароль по ссылке из письма).
//
// Деплой:  supabase functions deploy admin-create-user
// Переменные SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
// Supabase подставляет в Edge Functions автоматически.

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // 1. Кто вызывает (по его access-токену).
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: "unauthorized" }, 401);

    // 2. Проверяем, что вызывающий — администратор.
    const admin = createClient(url, service);
    const { data: prof } = await admin
      .from("profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
    if (!prof?.is_admin) return json({ error: "forbidden" }, 403);

    // 3. Данные нового пользователя.
    const { firstName, lastName, phone, email, groupId } = await req.json();
    if (!email) return json({ error: "email_required" }, 400);

    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    // 4. Приглашаем пользователя (создаёт аккаунт + письмо со ссылкой на задание пароля).
    //    Имя/фамилия/телефон уходят в метаданные → триггер запишет их в profiles.
    const { data: invited, error: iErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { first_name: firstName, last_name: lastName, phone, name: fullName },
    });
    if (iErr) return json({ error: iErr.message }, 400);

    const newUserId = invited.user.id;

    // 5. Подстраховка: дописываем поля в профиль (на случай гонки с триггером).
    await admin.from("profiles").update({
      first_name: firstName ?? null,
      last_name: lastName ?? null,
      phone: phone ?? null,
      email,
    }).eq("user_id", newUserId);

    // 6. Опционально — сразу добавить в группу со стартовым рейтингом.
    if (groupId) {
      const { data: p } = await admin.from("profiles").select("id").eq("user_id", newUserId).single();
      if (p) {
        await admin.from("group_members")
          .insert({ group_id: groupId, profile_id: p.id, rating: 1000 });
      }
    }

    return json({ ok: true, userId: newUserId, email });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
