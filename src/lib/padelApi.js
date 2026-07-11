// lib/padelApi.js
// Слой данных: каждая функция соответствует операции в прототипе.
// Названия таблиц/колонок совпадают со schema.sql.
import { supabase } from "./supabase";
import { swr, bustCache, bustKey, cacheSet } from "./cache";
import { WEB_BASE } from "./platform";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genCode = () =>
  Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

// Ссылка-приглашение на текущем домене PWA: /j/:code
export const linkFor = (code) => `${WEB_BASE}/j/${code}`;

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

// Холодный старт одним RPC (app_bootstrap): профиль + лиги + лидерборд активной
// лиги + счётчики. Схлопывает каскад profiles → group_members → leaderboard →
// counts (3-4 последовательных RTT → 1). Прогревает SWR-кэш, чтобы PadelLeague
// получил список друзей мгновенно из памяти, без похода в сеть.
// Возвращает null, если RPC ещё не задеплоен или профиля нет — вызывающий
// откатывается на старый каскад.
export async function bootstrapApp(savedGroupId = null) {
  const { data, error } = await supabase.rpc("app_bootstrap", { p_group_id: savedGroupId || null });
  if (error || !data || !data.profile) return null;
  const leagues = (data.leagues || []).map((r) => ({
    id: r.id, name: r.name, invite_code: r.invite_code, logo_url: r.logo_url,
    telegram_url: r.telegram_url,
    members_can_add: !!r.members_can_add, members_can_create: !!r.members_can_create,
    is_demo: !!r.is_demo, // app_bootstrap может не отдавать поле — тогда сработает localStorage-фолбэк
    role: r.role,
  }));
  const gid = data.board_group_id || null;
  if (gid) {
    // Форма — точно как у _getLeaderboard/_getGroupCounts: swr отдаст из кэша.
    cacheSet("lb:" + gid, (data.board || []).map((r) => ({
      id: r.profile.id, name: r.profile.name, avatar_url: r.profile.avatar_url,
      contacts: r.profile.contacts || {},
      rating: r.rating, matches: r.matches_played, wins: r.wins,
      user_id: r.profile.user_id || null, role: r.role,
    })));
    if (data.counts) cacheSet("counts:" + gid, { games: data.counts.games || {}, tours: data.counts.tours || {} });
    // Стрики и «не-участники» — Board пропустит тяжёлые listTournaments/getBoardMatches.
    // at — метка свежести: Board доверяет прайму 10 минут, дальше — обычный путь.
    if (data.board_stats) cacheSet("bstats:" + gid, {
      at: Date.now(),
      streaks: data.board_stats.streaks || {},
      extra: data.board_stats.extra || [],
    });
  }
  return { profile: data.profile, leagues, activeGroupId: gid };
}

/* =====================================================================
   ЭКРАН «РЕЙТИНГ» (Board)
   ===================================================================== */

// Таблица лидеров группы. Заменяет loadState() для players.
async function _getLeaderboard(groupId) {
  // claim_code НЕ запрашиваем в общий список — это токен «забрать профиль»
  // (account-takeover). Он выдаётся точечно админу через ensure_claim_code RPC.
  const { data, error } = await supabase
    .from("group_members")
    .select("rating, matches_played, wins, role, profile:profiles(id, name, avatar_url, contacts, user_id)")
    .eq("group_id", groupId)
    .order("rating", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.profile.id,
    name: r.profile.name,
    avatar_url: r.profile.avatar_url,
    contacts: r.profile.contacts || {},
    rating: r.rating,
    matches: r.matches_played,
    wins: r.wins,
    user_id: r.profile.user_id || null,
    role: r.role,
  }));
}
export function getLeaderboard(groupId) {
  return swr("lb:" + (groupId || "_"), () => _getLeaderboard(groupId));
}

// Серверный счётчик игр/турниров по игрокам (обходит RLS). Требует SQL-функцию
// group_player_counts (supabase/sql/group_player_counts.sql).
async function _getGroupCounts(groupId) {
  if (!groupId) return { games: {}, tours: {} };
  const { data, error } = await supabase.rpc("group_player_counts", { p_group_id: groupId });
  if (error) throw error;
  const games = {}, tours = {};
  (data || []).forEach((r) => { games[r.profile_id] = r.games; tours[r.profile_id] = r.tournaments; });
  return { games, tours };
}
export function getGroupCounts(groupId) {
  return swr("counts:" + (groupId || "_"), () => _getGroupCounts(groupId));
}

// Матчи группы (кэшируются — раньше эти запросы шли инлайном из компонентов и
// плодили десятки дублей при переключении вкладок).
async function _matchesBoard(groupId) {
  const { data, error } = await supabase.from("matches")
    .select("team_a, team_b, sets_a, sets_b, played_at")
    .eq("group_id", groupId).order("played_at", { ascending: true }).limit(500);
  if (error) throw error;
  return data || [];
}
export function getBoardMatches(groupId) {
  return swr("mb:" + (groupId || "_"), () => _matchesBoard(groupId));
}
async function _matchesStat(groupId) {
  const { data, error } = await supabase.from("matches")
    .select("id, team_a, team_b, sets_a, sets_b, score_detail, played_at")
    .eq("group_id", groupId).order("played_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}
export function getStatMatches(groupId) {
  return swr("ms:" + (groupId || "_"), () => _matchesStat(groupId));
}
async function _matchesHistory(groupId) {
  const { data, error } = await supabase.from("matches")
    .select("id, team_a, team_b, sets_a, sets_b, score_detail, played_at")
    .eq("group_id", groupId).order("played_at", { ascending: false }).limit(30);
  if (error) throw error;
  return data || [];
}
export function getHistoryMatches(groupId) {
  return swr("mh:" + (groupId || "_"), () => _matchesHistory(groupId));
}

// «Добавить игрока»: создаём профиль-гость + членство в группе.
// contacts: { whatsapp?, telegram?, email?, phone? } — всё опционально.
export async function addMember(groupId, name, contacts = {}) {
  const clean = Object.fromEntries(
    Object.entries(contacts).filter(([, v]) => v && String(v).trim())
  );
  // #1: гейт-RPC проверяет право (владелец/организатор ЛИБО members_can_add).
  const { data, error } = await supabase.rpc("add_member_gated", {
    p_group_id: groupId,
    p_name: name.trim(),
    p_contacts: Object.keys(clean).length ? clean : null,
  });
  if (error) throw error;
  bustCache(); // #4: сбросить кэш, чтобы список друзей перестроился сразу, без ручного обновления
  return data;
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
  const { error } = await supabase.rpc("add_existing_member_gated", { p_group_id: groupId, p_profile_id: profileId });
  if (error) throw error;
  bustCache(); // #4: список друзей перестраивается сразу
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
  "id, invite_code, title, starts_at, started_at, place, status, host_id, created_at, mix_group_id, court_name, " +
  "slots:game_slots(id, team, position, profile_id, guest_name, profile:profiles(name, avatar_url))," +
  "matches(id, sets_a, sets_b, score_detail)";

// Переименовать корт игры (court_name). name="" — сброс к «Корт N».
export async function updateGameCourtName(gameId, name) {
  const { error } = await supabase.from("games").update({ court_name: name?.trim() || null }).eq("id", gameId);
  if (error) throw error;
  bustCache();
}

// Создать игру + 4 слота. slots: [A1, A2, B1, B2] — profileId или null (по ссылке).
// mixGroupId — для «Сыграть ещё (микс)»: связывает под-игры одного выхода.
export async function createGame(groupId, { title, startsAt, place, slots = [], hostId, mixGroupId } = {}) {
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
        mix_group_id: mixGroupId || null,
        status: "open",
      })
      .select()
      .single();
    if (!res.error) { game = res.data; break; }
    if (res.error.code !== "23505") throw res.error; // не коллизия кода → реальная ошибка
  }
  if (!game) throw new Error("Не удалось сгенерировать уникальный код");
  bustCache();

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

// Telegram-уведомление о новой игре (MVP: шлётся владельцу через notify-telegram).
// Fire-and-forget: никогда не ждём и не роняем создание игры.
export function notifyGameCreated(gameId) {
  if (!gameId) return;
  try {
    supabase.functions.invoke("notify-telegram", { body: { type: "game_created", gameId } }).catch(() => {});
  } catch (_) {}
}

// Мои игры без лиги (security definer my_games): игры, где я в слоте или организатор.
// Та же форма, что GAME_SELECT. Видны активные и завершённые.
async function _listMyGames() {
  const { data, error } = await supabase.rpc("my_games");
  if (error) throw error;
  return data || [];
}
export function listMyGames() { return swr("my_games", _listMyGames); }

// Моя история сыгранных матчей без лиги (security definer my_history_matches).
async function _listMyHistoryMatches() {
  const { data, error } = await supabase.rpc("my_history_matches");
  if (error) throw error;
  return data || [];
}
export function listMyHistoryMatches() { return swr("my_history", _listMyHistoryMatches); }

// Игроки, с которыми я играл вместе (для вкладки «Друзья» без лиги).
// Форма совместима с лидербордом: { id, name, avatar_url, rating, matches, wins }.
async function _getPlayedWith() {
  const { data, error } = await supabase.rpc("played_with");
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id, name: r.name, avatar_url: r.avatar_url,
    contacts: {}, claim_code: null,
    rating: r.rating || 0, matches: r.matches || 0, wins: r.wins || 0, user_id: null,
  }));
}
export function getPlayedWith() { return swr("played_with", _getPlayedWith); }

// #4: совсем скрыть игрока из «Играли вместе» (хранится в аккаунте). Обратимо.
export async function hidePartner(profileId) {
  const { error } = await supabase.rpc("hide_partner", { p_profile_id: profileId });
  if (error) throw error;
  bustKey("played_with");
}
export async function unhidePartner(profileId) {
  const { error } = await supabase.rpc("unhide_partner", { p_profile_id: profileId });
  if (error) throw error;
  bustKey("played_with");
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
  return swr("games:" + (groupId || "_"), () => _listGames(groupId));
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
  bustCache();
  return data;
}


export async function deleteGame(gameId) {
  // RPC delete_game: удаляет матч+игру и ПОЛНОСТЬЮ откатывает рейтинг
  // (пересчёт rating/rating_after/matches_played из оставшихся дельт,
  // откат wins за эту игру). Сохраняет вклад турниров. См.
  // migrations/2026-07-02_delete_game_rollback.sql.
  const { error } = await supabase.rpc("delete_game", { p_game_id: gameId });
  if (error) throw error;
  bustCache();
}

export async function removeMember(groupId, profileId) {
  const { error } = await supabase.from("group_members")
    .delete().eq("group_id", groupId).eq("profile_id", profileId);
  if (error) throw error;
  bustCache(); // #4: список друзей перестраивается сразу
}

// Назначить/снять организатора. Только владелец (проверяется в RPC set_member_role).
// role: 'admin' (организатор) | 'member' (обычный участник). Владельца не трогает.
export async function setMemberRole(groupId, profileId, role) {
  const { error } = await supabase.rpc("set_member_role", { p_group_id: groupId, p_profile_id: profileId, p_role: role });
  if (error) throw error;
  bustCache();
}

// Профили участников группы по id (для раздела «Играли вместе», обход RLS).
// Имена профилей по id (для резолва в истории). Кэшируем — имена почти не меняются,
// и на нестабильной сети РФ этот запрос иначе висит и тормозит экран.
async function _getProfileNames(ids) {
  const { data, error } = await supabase.from("profiles").select("id, name").in("id", ids);
  if (error) throw error;
  return data || [];
}
export function getProfileNames(ids) {
  const list = [...ids].filter(Boolean).sort();
  if (!list.length) return Promise.resolve([]);
  return swr("pnames:" + list.join(","), () => _getProfileNames(list));
}

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
  bustCache();
  return data;
}

// Демо-лига («Демо-стая»): персональная песочница с собаками и наигранной
// историей. Сервер идемпотентен (одна на пользователя). id запоминаем локально —
// по нему Board показывает демо-плашку даже там, где is_demo не доехал из кэша.
export async function createDemoLeague(lang = "ru") {
  const { data, error } = await supabase.rpc("create_demo_league", { p_lang: lang });
  if (error) throw error;
  try { localStorage.setItem("pp_demo_gid", data.id); } catch (e) { /* приват-режим */ }
  bustCache();
  return data;
}

// «Начать игру»: фиксируем момент старта (started_at) и статус live.
// Жать может любой из состава — кто первым вышел на корт.
export async function startGame(gameId) {
  const { error } = await supabase.from("games")
    .update({ status: "live", started_at: new Date().toISOString() })
    .eq("id", gameId).eq("status", "open");
  if (error) throw error;
  bustCache();
}

// Освободить слот игры (хост убирает игрока / игрок убирает себя).
export async function clearGameSlot(slotId) {
  const { error } = await supabase.from("game_slots")
    .update({ profile_id: null, guest_name: null })
    .eq("id", slotId);
  if (error) throw error;
  bustCache();
}

// Занять свободный слот игры собой — с экрана игры внутри приложения.
// Тот же RPC, что у гостевой страницы /j/CODE: сервер линкует профиль по сессии.
export async function joinGameSlot(code, team, position, guestName) {
  const { data, error } = await supabase.rpc("join_game_slot", {
    p_code: code, p_team: team, p_position: position, p_guest_name: guestName || "",
  });
  if (error) throw error;
  bustCache();
  return data;
}

// Вступить в лигу по 6-символьному коду. Возвращает { id, name, role }.
export async function joinLeague(code) {
  const { data, error } = await supabase.rpc("join_league", { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  bustCache();
  return data;
}

// Все лиги, в которых состоит профиль. Возвращает массив
// { id, name, invite_code, logo_url, telegram_url, role }.
async function _getMyLeagues(profileId) {
  const { data, error } = await supabase
    .from("group_members")
    .select("role, group:groups(id, name, invite_code, logo_url, telegram_url, members_can_add, members_can_create, is_demo)")
    .eq("profile_id", profileId);
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.group.id,
    name: r.group.name,
    invite_code: r.group.invite_code,
    logo_url: r.group.logo_url,
    telegram_url: r.group.telegram_url,
    members_can_add: !!r.group.members_can_add,
    members_can_create: !!r.group.members_can_create,
    is_demo: !!r.group.is_demo,
    role: r.role,
  }));
}
// swr: мгновенно из кэша (localStorage) + ревалидация в фоне. Ключ на профиль.
export function getMyLeagues(profileId) {
  if (!profileId) return Promise.resolve([]);
  return swr("myleagues:" + profileId, () => _getMyLeagues(profileId));
}

// Детали лиги для окна управления: + организатор (владелец) и роль вызывающего.
export async function getLeagueDetails(groupId) {
  const { data, error } = await supabase.rpc("get_league_details", { p_group_id: groupId });
  if (error) throw error;
  return data;
}

// ── Объявления лиги (league_posts) ────────────────────────────────────────────
// Публикация: владелец/организатор (RLS is_group_admin); author_id проставляется
// в БД сам (default current_profile_id()). Показываются в колокольчике у всех.
export async function postLeagueAnnouncement(groupId, text) {
  const clean = (text || "").trim();
  if (!clean) throw new Error("empty");
  const { data, error } = await supabase.from("league_posts")
    .insert({ group_id: groupId, text: clean })
    .select("id, text, created_at, author_id").single();
  if (error) throw error;
  return data;
}

// Последние объявления лиги + имена авторов (двумя запросами — без завязки на FK-имя).
export async function listLeaguePosts(groupId, limit = 3) {
  const { data, error } = await supabase.from("league_posts")
    .select("id, text, created_at, author_id")
    .eq("group_id", groupId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const posts = data || [];
  const ids = [...new Set(posts.map((p) => p.author_id).filter(Boolean))];
  const names = {};
  if (ids.length) {
    const { data: ps } = await supabase.from("profiles").select("id, name").in("id", ids);
    (ps || []).forEach((p) => { names[p.id] = p.name; });
  }
  return posts.map((p) => ({ ...p, author_name: p.author_id ? names[p.author_id] || null : null }));
}

export async function deleteLeaguePost(postId) {
  const { error } = await supabase.from("league_posts").delete().eq("id", postId);
  if (error) throw error;
}

// Сохранить поля лиги (имя/логотип/телеграм). Доступно владельцу/админу (RLS).
export async function updateLeague(groupId, fields) {
  const patch = {};
  if (fields.name !== undefined) patch.name = fields.name?.trim() || null;
  if (fields.logo_url !== undefined) patch.logo_url = fields.logo_url || null;
  if (fields.telegram_url !== undefined) patch.telegram_url = fields.telegram_url?.trim() || null;
  if (fields.members_can_add !== undefined) patch.members_can_add = !!fields.members_can_add;
  if (fields.members_can_create !== undefined) patch.members_can_create = !!fields.members_can_create;
  const { data, error } = await supabase
    .from("groups")
    .update(patch)
    .eq("id", groupId)
    .select("id, name, invite_code, logo_url, telegram_url, members_can_add, members_can_create")
    .single();
  if (error) throw error;
  return data;
}

// Загрузить логотип лиги в бакет league-logos. Путь "<groupId>/logo_<ts>.<ext>"
// (первый сегмент = id лиги — на нём держится storage-политика). Возвращает URL.
export async function uploadLeagueLogo(groupId, file) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${groupId}/logo_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("league-logos").upload(path, file, { upsert: true, cacheControl: "31536000" });
  if (error) throw error;
  const { data } = supabase.storage.from("league-logos").getPublicUrl(path);
  return data.publicUrl;
}

// Публичный профиль лиги — без авторизации (используется на /l/CODE).
export async function getPublicLeague(code) {
  const { data, error } = await supabase.rpc("get_public_league", { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  return data;
}
