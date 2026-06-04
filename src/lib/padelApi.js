// lib/padelApi.js
// Слой данных: каждая функция соответствует операции в прототипе.
// Названия таблиц/колонок совпадают со schema.sql.
import { supabase } from "./supabase";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genCode = () =>
  Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

// Ссылка-приглашение на текущем домене PWA: /j/:code
export const linkFor = (code) => `${window.location.origin}/j/${code}`;

/* =====================================================================
   ПРОФИЛИ / АВТОРИЗАЦИЯ
   ===================================================================== */

// Профиль текущего пользователя (или создаём для залогиненного).
export async function ensureMyProfile(name) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // гость — профиль создаётся при входе в игру по имени
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, name }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* =====================================================================
   ЭКРАН «РЕЙТИНГ» (Board)
   ===================================================================== */

// Таблица лидеров группы. Заменяет loadState() для players.
export async function getLeaderboard(groupId) {
  const { data, error } = await supabase
    .from("group_members")
    .select("rating, matches_played, wins, profile:profiles(id, name)")
    .eq("group_id", groupId)
    .order("rating", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.profile.id,
    name: r.profile.name,
    rating: r.rating,
    matches: r.matches_played,
    wins: r.wins,
  }));
}

// «Добавить игрока»: создаём профиль-гость + членство в группе.
export async function addMember(groupId, name) {
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .insert({ name: name.trim() })
    .select()
    .single();
  if (pErr) throw pErr;

  const { error: mErr } = await supabase
    .from("group_members")
    .insert({ group_id: groupId, profile_id: profile.id, rating: 1000 });
  if (mErr) throw mErr;
  return profile;
}

/* =====================================================================
   ГРАФИК РЕЙТИНГА (PlayerDetail)
   ===================================================================== */

// Возвращает массив значений рейтинга во времени (для LineChart).
// Префиксуем стартом 1000, дальше — rating_after после каждого матча.
export async function getRatingHistory(groupId, profileId) {
  const { data, error } = await supabase
    .from("rating_changes")
    .select("rating_after, created_at")
    .eq("group_id", groupId)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return [1000, ...data.map((d) => d.rating_after)];
}

/* =====================================================================
   ЭКРАН «ИГРЫ» (Games / CreateGame / GameCard)
   ===================================================================== */

const GAME_SELECT =
  "id, invite_code, title, starts_at, place, status, host_id, created_at, " +
  "slots:game_slots(id, team, position, profile_id, guest_name, profile:profiles(name))";

// Создать игру + 4 слота. slots: [A1, A2, B1, B2] — profileId или null (по ссылке).
export async function createGame(groupId, { title, startsAt, place, slots = [], hostId } = {}) {
  let game = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await supabase
      .from("games")
      .insert({
        group_id: groupId,
        invite_code: genCode(),
        title: title?.trim() || null,
        starts_at: startsAt || null,
        place: place?.trim() || null,
        host_id: hostId || null,
        status: "open",
      })
      .select()
      .single();
    if (!res.error) { game = res.data; break; }
    if (res.error.code !== "23505") throw res.error; // не коллизия кода → реальная ошибка
  }
  if (!game) throw new Error("Не удалось сгенерировать уникальный код");

  const layout = [
    { team: "A", position: 1 }, { team: "A", position: 2 },
    { team: "B", position: 1 }, { team: "B", position: 2 },
  ];
  const slotRows = layout.map((s, i) => {
    const v = slots[i];
    let profile_id = null, guest_name = null;
    if (typeof v === "string" && v) profile_id = v;           // обратная совместимость
    else if (v && v.profileId) profile_id = v.profileId;
    else if (v && v.guestName) guest_name = v.guestName;
    return { game_id: game.id, team: s.team, position: s.position, profile_id, guest_name };
  });
  const { error } = await supabase.from("game_slots").insert(slotRows);
  if (error) throw error;
  return game; // содержит invite_code → linkFor(game.invite_code)
}

// Список игр группы (для вкладки «Игры»).
export async function listGames(groupId) {
  const { data, error } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Резолв приглашения по коду (экран «По коду»). null, если не найдено.
export async function getGameByCode(code) {
  const { data, error } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .eq("invite_code", code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Перечитать одну игру (заменяет кнопку «Обновить»; либо см. realtime ниже).
export async function getGame(gameId) {
  const { data, error } = await supabase.from("games").select(GAME_SELECT).eq("id", gameId).single();
  if (error) throw error;
  return data;
}

// Занять свободный слот. Гость — по имени, залогиненный — по profileId.
// .is(...) гарантирует, что слот действительно свободен (защита от гонки).
export async function joinSlot(gameId, { team, position }, { profileId, name } = {}) {
  const patch = profileId ? { profile_id: profileId } : { guest_name: name.trim() };
  const { data, error } = await supabase
    .from("game_slots")
    .update(patch)
    .eq("game_id", gameId)
    .eq("team", team)
    .eq("position", position)
    .is("profile_id", null)
    .is("guest_name", null)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Слот уже занят");
  return data[0];
}

/* =====================================================================
   ВВОД СЧЁТА (EnterScore) — через Edge Function, чтобы ELO считался на сервере
   ===================================================================== */

// Возвращает { deltas: { [profileId]: number } } для анимации изменений.
export async function submitResult(gameId, setsA, setsB) {
  const { data, error } = await supabase.functions.invoke("submit-result", {
    body: { gameId, setsA, setsB },
  });
  if (error) throw error;
  return data;
}

/* =====================================================================
   REALTIME — живое обновление слотов (вместо ручного «Обновить»)
   ===================================================================== */

// Подписка на изменения слотов игры. Возвращает функцию отписки.
export function subscribeToGame(gameId, onChange) {
  const channel = supabase
    .channel(`game:${gameId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "game_slots", filter: `game_id=eq.${gameId}` },
      onChange
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
