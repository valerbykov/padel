// supabase/functions/submit-result/index.ts
//
// Ввод счёта сыгранной игры: считает ELO (парный матч), пишет матч,
// обновляет рейтинги и историю, закрывает игру. ELO считается на сервере,
// чтобы клиент не мог его подделать.
//
// Деплой:  supabase functions deploy submit-result

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

const START = 1000;
const expected = (a: number, b: number) => 1 / (1 + Math.pow(10, (b - a) / 400));
const kFactor = (m: number) => (m < 5 ? 60 : m < 15 ? 40 : 24);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // 1. Кто вызывает.
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { gameId, setsA, setsB, scoreDetail } = await req.json();

    // Валидация счёта: целые, неотрицательные, в разумных пределах
    // (клиент не должен мочь прислать setsA: 1000000 и накрутить рейтинг).
    const validSet = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 7;
    if (!validSet(setsA) || !validSet(setsB)) return json({ error: "invalid_score" }, 400);

    const admin = createClient(url, service);

    // 2. Игра + слоты.
    const { data: game, error: gErr } = await admin
      .from("games")
      .select("id, group_id, status, started_at, slots:game_slots(team, position, profile_id, guest_name)")
      .eq("id", gameId).single();
    if (gErr || !game) return json({ error: "game_not_found" }, 404);
    if (game.status === "played") return json({ error: "already_played" }, 400);

    // 3. Проверяем, что вызывающий — участник этой группы.
    const { data: me } = await admin.from("profiles").select("id").eq("user_id", user.id).single();
    const { data: membership } = await admin.from("group_members")
      .select("profile_id").eq("group_id", game.group_id).eq("profile_id", me?.id).maybeSingle();
    if (!membership) return json({ error: "forbidden" }, 403);

    // 4. Раскладываем слоты в порядок [A1, A2, B1, B2] и резолвим игроков.
    const order = ["A1", "A2", "B1", "B2"];
    const sorted = order.map((key) =>
      game.slots.find((s: any) => s.team + s.position === key)
    );
    if (sorted.some((s) => !s)) return json({ error: "slots_incomplete" }, 400);

    // Находим/создаём профиль и членство (для гостей по имени).
    async function resolvePlayer(slot: any) {
      let profileId = slot.profile_id;
      if (!profileId) {
        const name = (slot.guest_name || "Гость").trim();
        const { data: existing } = await admin.from("profiles").select("id").ilike("name", name).maybeSingle();
        if (existing) profileId = existing.id;
        else {
          const { data: created } = await admin.from("profiles").insert({ name }).select("id").single();
          profileId = created!.id;
        }
      }
      // Членство в лиге НЕ создаём: участие в игре не добавляет игрока в лигу
      // (в лигу — только 3 явными путями: «Добавить игрока», «Играли вместе →
      // Добавить в лигу», код/ссылка). Если игрок уже член — берём его рейтинг и
      // обновим ниже; если нет — считаем ELO по дефолту, но рейтинг/строку членства
      // ему НЕ пишем (иначе удалённые из лиги возвращались бы при вводе счёта).
      const { data: gm } = await admin.from("group_members")
        .select("rating, matches_played, wins")
        .eq("group_id", game.group_id).eq("profile_id", profileId).maybeSingle();
      return {
        profileId,
        isMember: !!gm,
        rating: gm?.rating ?? START,
        matches_played: gm?.matches_played ?? 0,
        wins: gm?.wins ?? 0,
      };
    }

    // Один и тот же ВЫБРАННЫЙ игрок (по profile_id) не может занимать два слота —
    // иначе две дельты на один профиль и гонка рейтинга. Проверяем по явному
    // profile_id ДО резолва, чтобы не зарубить легитимную игру с двумя гостями-тёзками.
    const chosen = sorted.map((s: any) => s.profile_id).filter(Boolean);
    if (new Set(chosen).size !== chosen.length) return json({ error: "duplicate_player" }, 400);

    const players = await Promise.all(sorted.map(resolvePlayer));
    const [a1, a2, b1, b2] = players;

    // 5. Считаем ELO.
    const ratA = (a1.rating + a2.rating) / 2;
    const ratB = (b1.rating + b2.rating) / 2;
    const eA = expected(ratA, ratB);
    const total = setsA + setsB;
    const sA = total === 0 ? 0.5 : setsA / total;
    const winnerA = setsA > setsB;

    const deltas: Record<string, number> = {};
    const after: Record<string, number> = {};
    for (const p of [a1, a2]) {
      const d = Math.round(kFactor(p.matches_played) * (sA - eA));
      deltas[p.profileId] = d; after[p.profileId] = p.rating + d;
    }
    for (const p of [b1, b2]) {
      const d = Math.round(kFactor(p.matches_played) * ((1 - sA) - (1 - eA)));
      deltas[p.profileId] = d; after[p.profileId] = p.rating + d;
    }

    // 6. Пишем матч.
    const { data: match } = await admin.from("matches").insert({
      game_id: game.id, group_id: game.group_id,
      team_a: [a1.profileId, a2.profileId], team_b: [b1.profileId, b2.profileId],
      sets_a: setsA, sets_b: setsB,
      score_detail: scoreDetail || null,
      // Фактическое время игры: если жали «Начать игру» — момент старта,
      // иначе (счёт задним числом) остаётся default now().
      ...(game.started_at ? { played_at: game.started_at } : {}),
    }).select("id").single();

    // 7. Обновляем рейтинги + история + закрываем игру.
    await Promise.all(players.map((p) => {
      // Не-член лиги: матч записан выше (история сохранена), но рейтинг и историю
      // рейтинга в этой лиге ему не ведём — участие не делает игрока членом лиги.
      if (!p.isMember) return Promise.resolve();
      const isDraw = setsA === setsB;
      const won = !isDraw && ((winnerA && (p === a1 || p === a2)) || (!winnerA && (p === b1 || p === b2)));
      return Promise.all([
        admin.from("group_members").update({
          rating: after[p.profileId],
          matches_played: p.matches_played + 1,
          wins: p.wins + (won ? 1 : 0),
        }).eq("group_id", game.group_id).eq("profile_id", p.profileId),
        admin.from("rating_changes").insert({
          match_id: match!.id, group_id: game.group_id, profile_id: p.profileId,
          delta: deltas[p.profileId], rating_after: after[p.profileId],
        }),
      ]);
    }));
    await admin.from("games").update({ status: "played" }).eq("id", game.id);

    return json({ ok: true, deltas });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
