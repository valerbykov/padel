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
    .select("rating, matches_played, wins, profile:profiles(id, name, avatar_url, contacts, claim_code, user_id)")
    .eq("group_id", groupId)
    .order("rating", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.profile.id,
    name: r.profile.name,
    avatar_url: r.profile.avatar_url,
    contacts: r.profile.contacts || {},
    claim_code: r.profile.claim_code || null,
    rating: r.rating,
    matches: r.matches_played,
    wins: r.wins,
    user_id: r.profile.user_id || null,
  }));
}

// Серверный счётчик игр/турниров по игрокам (обходит RLS). Требует SQL-функцию
// group_player_counts (supabase/sql/group_player_counts.sql).
export async function getGroupCounts(groupId) {
  if (!groupId) return { games: {}, tours: {} };
  const { data, error } = await supabase.rpc("group_player_counts", { p_group_id: groupId });
  if (error) throw error;
  const games = {}, tours = {};
  (data || []).forEach((r) => { games[r.profile_id] = r.games; tours[r.profile_id] = r.tournaments; });
  return { games, tours };
}

// «Добавить игрока»: создаём профиль-гость + членство в группе.
// contacts: { whatsapp?, telegram?, email?, phone? } — всё опционально.
export async function addMember(groupId, name, contacts = {}) {
  const cleanContacts = Object.fromEntries(
    Object.entries(contacts).filter(([, v]) => v && String(v).trim())
  );
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .insert({ name: name.trim(), contacts: Object.keys(cleanContacts).length ? cleanContacts : null, claim_code: crypto.randomUUID() })
    .select()
    .single();
  if (pErr) throw pErr;

  const { error: mErr } = await supabase
    .from("group_members")
    .insert({ group_id: groupId, profile_id: profile.id, rating: 1000 });
  if (mErr) throw mErr;
  return profile;
}

// Пул для добавления в лигу: зарегистрированные/гостевые игроки из других лиг
// пользователя, которых ещё нет в этой лиге. Требует RPC leagueable_players.
export async function getLeagueablePlayers(groupId) {
  if (!groupId) return [];
  const { data, error } = await supabase.rpc("leagueable_players", { p_group_id: groupId });
  if (error) throw error;
  return data || [];
}

// Добавить уже существующий профиль в лигу (без создания нового).
export async function addExistingMember(groupId, profileId) {
  const { error } = await supabase
    .from("group_members")
    .insert({ group_id: groupId, profile_id: profileId, rating: 1000 });
  if (error) throw error;
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
  "slots:game_slots(id, team, position, profile_id, guest_name, profile:profiles(name, avatar_url))," +
  "matches(id, sets_a, sets_b, score_detail)";

// Создать игру + 4 слота. slots: [A1, A2, B1, B2] — profileId или null (по ссылке).
// Короткий кэш + дедуп для списка игр (тот же приём, что в tournamentApi).
const _gamesCache = new Map();
const _gamesInflight = new Map();
function _memoGames(key, fn) {
  const c = _gamesCache.get(key);
  if (c && Date.now() - c.t < 4000) return Promise.resolve(c.v);
  if (_gamesInflight.has(key)) return _gamesInflight.get(key);
  const p = Promise.resolve().then(fn).then(
    (v) => { _gamesCache.set(key, { v, t: Date.now() }); _gamesInflight.delete(key); return v; },
    (e) => { _gamesInflight.delete(key); throw e; }
  );
  _gamesInflight.set(key, p);
  return p;
}
function _bustGames() { _gamesCache.clear(); _gamesInflight.clear(); }

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
  _bustGames();

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

// Мои игры без лиги (security definer my_games): игры, где я в слоте или организатор.
// Та же форма, что GAME_SELECT. Видны активные и завершённые.
export async function listMyGames() {
  const { data, error } = await supabase.rpc("my_games");
  if (error) throw error;
  return data || [];
}

// Моя история сыгранных матчей без лиги (security definer my_history_matches).
export async function listMyHistoryMatches() {
  const { data, error } = await supabase.rpc("my_history_matches");
  if (error) throw error;
  return data || [];
}

// Игроки, с которыми я играл вместе (для вкладки «Друзья» без лиги).
// Форма совместима с лидербордом: { id, name, avatar_url, rating, matches, wins }.
export async function getPlayedWith() {
  const { data, error } = await supabase.rpc("played_with");
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id, name: r.name, avatar_url: r.avatar_url,
    contacts: {}, claim_code: null,
    rating: r.rating || 0, matches: r.matches || 0, wins: r.wins || 0, user_id: null,
  }));
}

// Список игр группы (для вкладки «Игры»).
async function _listGames(groupId) {
  const { data, error } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export function listGames(groupId) {
  return _memoGames("games:" + (groupId || "_"), () => _listGames(groupId));
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
// scoreDetail: [{a, b}, {a, b}, {a, b}] — счёт внутри каждого сета (опционально).
export async function submitResult(gameId, setsA, setsB, scoreDetail = null) {
  const { data, error } = await supabase.functions.invoke("submit-result", {
    body: { gameId, setsA, setsB, scoreDetail },
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

export async function deleteGame(gameId) {
  const { error } = await supabase.from("games").delete().eq("id", gameId);
  if (error) throw error;
  _bustGames();
}

export async function removeMember(groupId, profileId) {
  const { error } = await supabase.from("group_members")
    .delete().eq("group_id", groupId).eq("profile_id", profileId);
  if (error) throw error;
}

// Профили участников группы по id (для раздела «Играли вместе», обход RLS).
export async function getGroupProfiles(groupId, ids) {
  if (!groupId || !ids || ids.length === 0) return [];
  const { data, error } = await supabase.rpc("group_profiles", { p_group_id: groupId, p_ids: ids });
  if (error) throw error;
  return data || [];
}

export async function getProfileByClaimCode(code) {
  const { data, error } = await supabase.rpc("get_profile_by_claim_code", { p_code: code });
  if (error) throw error;
  return data; // { id, name } or null
}

export async function claimProfile(code) {
  const { data, error } = await supabase.rpc("claim_profile", { p_code: code });
  if (error) throw error;
  return data; // { ok: true, name }
}

/* =====================================================================
   ЛИГИ
   ===================================================================== */

// Создать новую лигу. Возвращает { id, name, invite_code, role }.
export async function createLeague(name) {
  const { data, error } = await supabase.rpc("create_league", { p_name: name.trim() });
  if (error) throw error;
  return data;
}

// Вступить в лигу по 6-символьному коду. Возвращает { id, name, role }.
export async function joinLeague(code) {
  const { data, error } = await supabase.rpc("join_league", { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  return data;
}

// Все лиги, в которых состоит профиль. Возвращает массив { id, name, invite_code, role }.
export async function getMyLeagues(profileId) {
  const { data, error } = await supabase
    .from("group_members")
    .select("role, group:groups(id, name, invite_code)")
    .eq("profile_id", profileId);
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.group.id,
    name: r.group.name,
    invite_code: r.group.invite_code,
    role: r.role,
  }));
}

// Публичный профиль лиги — без авторизации (используется на /l/CODE).
export async function getPublicLeague(code) {
  const { data, error } = await supabase.rpc("get_public_league", { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  return data;
}
