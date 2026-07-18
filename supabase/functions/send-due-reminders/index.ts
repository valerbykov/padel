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

// Язык текста берём из push_tokens.lang (пишется клиентом, обновляется при смене
// языка). Фолбэк — 'ru' (основной рынок). Шаблоны на офсет несут «через сколько»,
// тон усиливается к старту; тело — конкретное локальное время старта.
type Lang = "ru" | "en" | "es";
const langOf = (l: string | null | undefined): Lang => (l === "en" || l === "es" ? l : "ru");
const bucket = (off: number): "day" | "h5" | "h2" | "h1" =>
  off >= 1440 ? "day" : off >= 300 ? "h5" : off >= 120 ? "h2" : "h1";

const TPL: Record<Lang, any> = {
  ru: {
    game: "Игра", tour: "Турнир", today: "сегодня", tomorrow: "завтра", at: "в", locale: "ru-RU",
    tGame: {
      day: ["🎾 Завтра игра", "🎾 Готовь ракетку — завтра", "🎾 Завтра собираемся на корт"],
      h5: ["🎾 Сегодня игра — через 5 часов", "🎾 Игра уже сегодня", "🎾 Готовься: игра через 5 часов"],
      h2: ["🔥 Игра через 2 часа", "🎾 Через 2 часа на корт", "🎾 Игра скоро: через 2 часа"],
      h1: ["🎾 Пора на корт — уже через час!", "🔥 Через час на корт!", "🎾 Час до игры — разминайся"],
    },
    tTour: {
      day: ["🏆 Завтра турнир", "🏆 Турнир завтра — готовься", "🎾 Готовь ракетку: завтра турнир"],
      h5: ["🏆 Сегодня турнир — через 5 часов", "🏆 Турнир уже сегодня", "🎾 Готовься: турнир через 5 часов"],
      h2: ["🔥 Турнир через 2 часа", "🏆 Через 2 часа — старт турнира", "🎾 Турнир скоро: через 2 часа"],
      h1: ["🎾 Турнир уже через час!", "🔥 Через час — на корт!", "🏆 Час до турнира — разминайся"],
    },
    tailsNear: ["Погнали! 💪", "Разомнись и покажи класс!", "Возьми воду и ракетку 🎾", "Время побеждать 🔥"],
    tailsFar: ["Не пропусти 💪", "Отметь в календаре 📅", "Собери своих 🎾", "Готовься к бою!"],
    evGame: "🎾 Новая игра", evTour: "🏆 Новый турнир", evPost: "📣 Объявление",
    feeTitle: "💸 Взнос за турнир", feeBody: "«{t}» — {n} ₽. Не забудь скинуться 🙏",
    doneTourT: "🏁 Турнир завершён", doneTourB: "«{t}» — отличная игра! {greet} 🎾 Если скидывались на корты — не забудь про взнос 🙏",
    doneGameT: "🏁 Игра сыграна", doneGameB: "Счёт записан — {greet} 🎾 Если скидывались за корт — не забудь про взнос 🙏",
    greetDay: "Хорошего дня", greetEve: "Хорошего вечера",
    ctaGame: ["записывайся в состав 💪", "занимай слот 🎾", "врывайся в игру 🔥"],
    ctaTour: ["заявляйся, пока есть места 🎾", "регистрируйся и покажи класс 🏆", "лови слот в сетке 🔥"],
  },
  en: {
    game: "Game", tour: "Tournament", today: "today", tomorrow: "tomorrow", at: "at", locale: "en-US",
    tGame: {
      day: ["🎾 Game tomorrow", "🎾 Grab your racket — tomorrow", "🎾 We hit the court tomorrow"],
      h5: ["🎾 Game today — in 5 hours", "🎾 Game is today", "🎾 Get ready: game in 5 hours"],
      h2: ["🔥 Game in 2 hours", "🎾 On court in 2 hours", "🎾 Game soon: in 2 hours"],
      h1: ["🎾 Time to hit the court — in an hour!", "🔥 On court in an hour!", "🎾 An hour to the game — warm up"],
    },
    tTour: {
      day: ["🏆 Tournament tomorrow", "🏆 Tournament tomorrow — get ready", "🎾 Grab your racket: tournament tomorrow"],
      h5: ["🏆 Tournament today — in 5 hours", "🏆 Tournament is today", "🎾 Get ready: tournament in 5 hours"],
      h2: ["🔥 Tournament in 2 hours", "🏆 In 2 hours — tournament starts", "🎾 Tournament soon: in 2 hours"],
      h1: ["🎾 Tournament in an hour!", "🔥 In an hour — on court!", "🏆 An hour to the tournament — warm up"],
    },
    tailsNear: ["Let's go! 💪", "Warm up and show your best!", "Grab water and your racket 🎾", "Time to win 🔥"],
    tailsFar: ["Don't miss it 💪", "Add it to your calendar 📅", "Round up your crew 🎾", "Get ready to battle!"],
    evGame: "🎾 New game", evTour: "🏆 New tournament", evPost: "📣 Announcement",
    feeTitle: "💸 Tournament chip-in", feeBody: "\u201c{t}\u201d — {n} ₽. Don't forget to chip in 🙏",
    doneTourT: "🏁 Tournament finished", doneTourB: "\u201c{t}\u201d — great game! {greet} 🎾 If you were splitting court costs — don't forget to chip in 🙏",
    doneGameT: "🏁 Game played", doneGameB: "Score saved — {greet} 🎾 If you were splitting court costs — don't forget to chip in 🙏",
    greetDay: "have a great day", greetEve: "have a great evening",
    ctaGame: ["grab a spot 💪", "take a slot 🎾", "jump into the game 🔥"],
    ctaTour: ["sign up while there's room 🎾", "register and show your best 🏆", "grab a slot in the draw 🔥"],
  },
  es: {
    game: "Partido", tour: "Torneo", today: "hoy", tomorrow: "mañana", at: "a las", locale: "es-ES",
    tGame: {
      day: ["🎾 Partido mañana", "🎾 Prepara la pala — mañana", "🎾 Mañana a la pista"],
      h5: ["🎾 Partido hoy — en 5 horas", "🎾 El partido es hoy", "🎾 Prepárate: partido en 5 horas"],
      h2: ["🔥 Partido en 2 horas", "🎾 A la pista en 2 horas", "🎾 Partido pronto: en 2 horas"],
      h1: ["🎾 ¡A la pista — en una hora!", "🔥 ¡A la pista en una hora!", "🎾 Una hora para el partido — calienta"],
    },
    tTour: {
      day: ["🏆 Torneo mañana", "🏆 Torneo mañana — prepárate", "🎾 Prepara la pala: torneo mañana"],
      h5: ["🏆 Torneo hoy — en 5 horas", "🏆 El torneo es hoy", "🎾 Prepárate: torneo en 5 horas"],
      h2: ["🔥 Torneo en 2 horas", "🏆 En 2 horas — empieza el torneo", "🎾 Torneo pronto: en 2 horas"],
      h1: ["🎾 ¡Torneo en una hora!", "🔥 ¡En una hora — a la pista!", "🏆 Una hora para el torneo — calienta"],
    },
    tailsNear: ["¡Vamos! 💪", "¡Calienta y da lo mejor!", "Lleva agua y la pala 🎾", "Hora de ganar 🔥"],
    tailsFar: ["No te lo pierdas 💪", "Anótalo en el calendario 📅", "Reúne a los tuyos 🎾", "¡Prepárate para la batalla!"],
    evGame: "🎾 Nuevo partido", evTour: "🏆 Nuevo torneo", evPost: "📣 Anuncio",
    feeTitle: "💸 Aporte del torneo", feeBody: "«{t}» — {n} ₽. No olvides aportar 🙏",
    doneTourT: "🏁 Torneo terminado", doneTourB: "«{t}» — ¡gran partido! {greet} 🎾 Si dividían las pistas — no olvides tu aporte 🙏",
    doneGameT: "🏁 Partido jugado", doneGameB: "Resultado guardado — {greet} 🎾 Si dividían la pista — no olvides tu aporte 🙏",
    greetDay: "buen día", greetEve: "buena tarde",
    ctaGame: ["apúntate al equipo 💪", "coge un hueco 🎾", "métete en el partido 🔥"],
    ctaTour: ["inscríbete mientras haya plazas 🎾", "regístrate y da lo mejor 🏆", "coge plaza en el cuadro 🔥"],
  },
};

// Локальное «когда»: «сегодня в 19:30» / «today at 7:30 PM» / «hoy a las 19:30».
// tz — часовой пояс устройства (push_tokens.tz); фолбэк — Москва.
function ymd(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function whenLocal(startsAtIso: string, tz: string, lang: Lang): string {
  const t = tz || "Europe/Moscow";
  const p = TPL[lang];
  const start = new Date(startsAtIso);
  const now = new Date();
  const time = new Intl.DateTimeFormat(p.locale, { timeZone: t, hour: "2-digit", minute: "2-digit" }).format(start);
  const dStart = ymd(start, t);
  let day: string;
  if (dStart === ymd(now, t)) day = p.today;
  else if (dStart === ymd(new Date(now.getTime() + 86400000), t)) day = p.tomorrow;
  else day = new Intl.DateTimeFormat(p.locale, { timeZone: t, day: "numeric", month: "long" }).format(start);
  return `${day} ${p.at} ${time}`;
}

// Заголовок и тело зависят от языка (per-token) и tz. Выбор шаблона по хешу
// (event_id+offset) — тот же индекс во всех языках, поэтому «фраза» стабильна.
function compose(d: { event_type: string; title: string | null; place: string | null; event_id: string; offset_min: number; starts_at: string }) {
  const isTour = d.event_type === "tournament";
  const seed = `${d.event_id}:${d.offset_min}`;
  const b = bucket(d.offset_min);
  return {
    build: (tz: string, lang: Lang) => {
      const p = TPL[lang];
      const title = pickBy(seed, (isTour ? p.tTour : p.tGame)[b]);
      const tail = pickBy(seed + "·t", d.offset_min <= 120 ? p.tailsNear : p.tailsFar);
      const name = d.title || (isTour ? p.tour : p.game);
      const lead = `${name}${d.place ? ` · ${d.place}` : ""}`;
      return { title, body: `${lead} — ${whenLocal(d.starts_at, tz, lang)}. ${tail}` };
    },
  };
}

// Событийный пуш (новая игра/турнир/объявление) — тоже локализуется на токен.
function composeEvent(d: { event_type: string; title: string | null; place: string | null; league: string | null; event_id: string }) {
  const lg = d.league ? ` · ${d.league}` : "";
  return {
    build: (_tz: string, lang: Lang) => {
      const p = TPL[lang];
      if (d.event_type === "new_game")
        return { title: `${p.evGame}${lg}`, body: `${d.title || p.game}${d.place ? ` · ${d.place}` : ""} — ${pickBy(d.event_id, p.ctaGame)}` };
      if (d.event_type === "new_tournament")
        return { title: `${p.evTour}${lg}`, body: `${d.title || p.tour} — ${pickBy(d.event_id, p.ctaTour)}` };
      return { title: `${p.evPost}${lg}`, body: d.title || "" }; // league_post: текст автора не трогаем
    },
  };
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

    // 1б) очередь «напомнить должникам» (взносы за турнир). Таблицы может не быть
    // до миграции 2026-07-25 — тогда просто пропускаем. Помечаем sent_at СРАЗУ по
    // выборке (даже если у адресата нет токенов) — иначе бесконечный ретрай.
    let feeRows: any[] = [];
    try {
      const fq = await admin.from("fee_reminder_queue")
        .select("id, profile_id, tournament:tournaments(name, fee_per_player), profile:profiles(user_id)")
        .is("sent_at", null).limit(200);
      if (!fq.error && fq.data?.length) {
        feeRows = fq.data.filter((r: any) => r.profile?.user_id && r.tournament);
        await admin.from("fee_reminder_queue").update({ sent_at: new Date().toISOString() })
          .in("id", fq.data.map((r: any) => r.id));
      }
    } catch (_) { /* миграции нет — тихо пропускаем */ }

    // 1в) очередь «завершение игры/турнира» (триггеры БД). Толерантно к отсутствию
    // таблицы (миграция 2026-07-26). Помечаем sent_at сразу по выборке.
    let doneRows: any[] = [];
    try {
      const dq = await admin.from("event_push_queue")
        .select("id, profile_id, kind, payload, profile:profiles(user_id)")
        .is("sent_at", null).limit(300);
      if (!dq.error && dq.data?.length) {
        doneRows = dq.data.filter((r: any) => r.profile?.user_id);
        await admin.from("event_push_queue").update({ sent_at: new Date().toISOString() })
          .in("id", dq.data.map((r: any) => r.id));
      }
    } catch (_) { /* миграции нет */ }

    if ((!due || due.length === 0) && events.length === 0 && feeRows.length === 0 && doneRows.length === 0) {
      return json({ due: 0, events: 0, fees: 0, done: 0, sent: 0 });
    }

    // 2) токены участников (объединяем всех адресатов)
    const userIds = [...new Set([
      ...(due || []).map((d: any) => d.user_id),
      ...events.map((d: any) => d.user_id),
      ...feeRows.map((r: any) => r.profile.user_id),
      ...doneRows.map((r: any) => r.profile.user_id),
    ])];
    const { data: tokRows } = await admin.from("push_tokens").select("user_id, token, platform, tz, lang").in("user_id", userIds);
    const byUser: Record<string, Array<{ token: string; platform: string; tz: string; lang: Lang }>> = {};
    for (const r of tokRows || []) (byUser[r.user_id] ||= []).push({ token: r.token, platform: r.platform || "android", tz: r.tz || "", lang: langOf(r.lang) });

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

    // Единый отправитель: и напоминания, и события идут одним циклом. Текст (заголовок
    // и тело) собирается НА ТОКЕН — под язык (push_tokens.lang) и пояс устройства.
    const outbox: Array<{ user_id: string; event_type: string; event_id: string; offset_min: number; build: (tz: string, lang: Lang) => { title: string; body: string } }> = [];
    for (const d of (due || []) as any[]) {
      outbox.push({ user_id: d.user_id, event_type: d.event_type, event_id: d.event_id, offset_min: d.offset_min, build: compose(d).build });
    }
    for (const d of events as any[]) {
      outbox.push({ user_id: d.user_id, event_type: d.event_type, event_id: d.event_id, offset_min: 0, build: composeEvent(d).build });
    }
    // Взносы: адресный пуш должнику — «💸 Взнос за турнир / «Название» — N ₽».
    for (const r of feeRows) {
      outbox.push({
        user_id: r.profile.user_id, event_type: "fee", event_id: r.id, offset_min: 0,
        build: (_tz: string, lang: Lang) => {
          const p = TPL[lang];
          return {
            title: p.feeTitle,
            body: p.feeBody.replace("{t}", r.tournament.name || "").replace("{n}", String(r.tournament.fee_per_player || "")),
          };
        },
      });
    }
    // Завершение игры/турнира: всем участникам, приветствие по ЛОКАЛЬНОМУ часу
    // устройства (до 17:00 — «хорошего дня», после — «хорошего вечера»).
    const localHour = (tz: string): number => {
      try { return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz || "Europe/Moscow", hour: "2-digit", hourCycle: "h23" }).format(new Date())); }
      catch (_) { return 12; }
    };
    for (const r of doneRows) {
      outbox.push({
        user_id: r.profile.user_id, event_type: r.kind, event_id: r.id, offset_min: 0,
        build: (tz: string, lang: Lang) => {
          const p = TPL[lang];
          const greet = localHour(tz) >= 17 ? p.greetEve : p.greetDay;
          if (r.kind === "tour_finished") {
            return { title: p.doneTourT, body: p.doneTourB.replace("{t}", r.payload?.t || "").replace("{greet}", greet) };
          }
          return { title: p.doneGameT, body: p.doneGameB.replace("{greet}", greet) };
        },
      });
    }

    for (const d of outbox) {
      const tokens = byUser[d.user_id] || [];
      // логируем факт обработки в любом случае — иначе будет ретраиться каждые 5 мин
      log.push({ user_id: d.user_id, event_type: d.event_type, event_id: d.event_id, offset_min: d.offset_min });
      if (tokens.length === 0) { if (log.length >= 20) await flushLog(); continue; }
      for (const tk of tokens) {
        // заголовок+тело под язык и пояс конкретного токена
        const { title, body } = d.build(tk.tz, tk.lang);
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

    return json({ due: (due || []).length, events: events.length, fees: feeRows.length, done: doneRows.length, events_error: evRes.error ? String(evRes.error.message || evRes.error) : null, sent, pruned: bad.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
