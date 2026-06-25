// lib/tournamentApi.js
import { supabase } from "./supabase";
import { buildMatches, standings } from "./americano";
import { buildFirstRound, buildMexicanoRound, buildKotHStart, buildKotHNextMatch } from "./mexicano";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
export const tournamentLink = (code) => `${window.location.origin}/t/${code}`;

const T_SELECT =
  "id, invite_code, name, format, points_per_game, target_size, status, court_names, created_by, created_at, " +
  "players:tournament_players(id, profile_id, name, created_at), " +
  "matches:tournament_matches(id, round_number, court, team_a, team_b, score_a, score_b)";

// Короткий кэш + дедуп для списка турниров: Доска, вкладка «Турниры» и История
// независимо дёргают listTournaments на каждое переключение вкладок, плодя пачки
// одинаковых запросов и зависания на нестабильной сети. Кэшируем на 4 c и схлопываем
// параллельные вызовы; сбрасываем при создании/удалении (_bustList).
const _listCache = new Map();
const _listInflight = new Map();
function _memoList(key, fn) {
  const c = _listCache.get(key);
  if (c && Date.now() - c.t < 4000) return Promise.resolve(c.v);
  if (_listInflight.has(key)) return _listInflight.get(key);
  const p = Promise.resolve().then(fn).then(
    (v) => { _listCache.set(key, { v, t: Date.now() }); _listInflight.delete(key); return v; },
    (e) => { _listInflight.delete(key); throw e; }
  );
  _listInflight.set(key, p);
  return p;
}
function _bustList() { _listCache.clear(); _listInflight.clear(); }

export async function createTournament(groupId, { name, pointsPerGame = 32, targetSize = 8, createdBy, format = "americano" } = {}) {
  let t = null;
  for (let i = 0; i < 5; i++) {
    const res = await supabase.from("tournaments").insert({
      group_id: groupId, invite_code: genCode(), name: name?.trim() || null,
      points_per_game: pointsPerGame, target_size: targetSize, created_by: createdBy || null,
      status: "open", format,
    }).select().single();
    if (!res.error) { t = res.data; break; }
    if (res.error.code !== "23505") throw res.error;
  }
  if (!t) throw new Error("Не удалось сгенерировать код");
  _bustList();
  return t;
}

// Копия существующего турнира: тот же формат/очки/размер, новый статус "open".
// withPlayers — перенести участников (профили и гостей по имени), без счёта.
export async function copyTournament(srcId, groupId, { name, withPlayers = true, createdBy = null } = {}) {
  const src = await getTournament(srcId);
  const trn = await createTournament(groupId, {
    name: (name && name.trim()) || null,
    pointsPerGame: src.points_per_game,
    targetSize: src.target_size,
    format: src.format,
    createdBy: createdBy || null,
  });
  if (withPlayers) {
    const players = [...(src.players || [])].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    for (const p of players) {
      await addTournamentPlayer(trn.id, { profileId: p.profile_id || null, name: p.name });
    }
  }
  _bustList();
  return trn;
}

async function _listTournaments(groupId) {
  let q = supabase.from("tournaments").select(T_SELECT).order("created_at", { ascending: false }).limit(100);
  if (groupId) q = q.eq("group_id", groupId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export function listTournaments(groupId) {
  return _memoList("tours:" + (groupId || "_"), () => _listTournaments(groupId));
}

// Мои турниры без лиги (security definer my_tournaments): где я в составе.
// Та же форма, что T_SELECT. Видны активные и завершённые.
export async function listMyTournaments() {
  const { data, error } = await supabase.rpc("my_tournaments");
  if (error) throw error;
  return data || [];
}

export async function getTournament(id) {
  const { data, error } = await supabase.from("tournaments").select(T_SELECT).eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function addTournamentPlayer(tournamentId, { profileId = null, name }) {
  const { error } = await supabase.from("tournament_players")
    .insert({ tournament_id: tournamentId, profile_id: profileId, name: name.trim() });
  if (error) throw error;
}

export async function removeTournamentPlayer(playerId) {
  const { error } = await supabase.from("tournament_players").delete().eq("id", playerId);
  if (error) throw error;
}

export async function joinTournamentByCode(code, name) {
  let profileId = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    profileId = data?.id || null;
  }
  const { error } = await supabase.rpc("join_tournament", {
    p_code: code, p_name: name.trim(), p_profile_id: profileId,
  });
  if (error) throw error;
}

export async function getTournamentByCode(code) {
  const { data, error } = await supabase.rpc("get_tournament_by_code", { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  if (!data) return data;

  const hasScores = (data.matches || []).some((m) => m.score_a != null || m.score_b != null);
  const noMatches = !data.matches || data.matches.length === 0;
  if ((noMatches || !hasScores) && data.id) {
    const { data: matches } = await supabase
      .from("tournament_matches")
      .select("id, round_number, court, team_a, team_b, score_a, score_b")
      .eq("tournament_id", data.id);
    if (matches && matches.length > 0) return { ...data, matches };
  }
  return data;
}

/**
 * Старт турнира: жеребьёвка + запись матчей + статус active.
 * americano:    все раунды сразу.
 * mexicano:     только первый раунд.
 * king_of_hill / beat_the_box: round_0 команды + round_1 первый матч.
 */
export async function startTournament(tournamentId, players, format = "americano") {
  const ids = players.map((p) => p.id);
  const isKothBtB = format === "king_of_hill" || format === "beat_the_box";

  if (isKothBtB) {
    if (ids.length < 4 || ids.length % 2 !== 0)
      throw new Error("Нужно чётное число игроков (минимум 4)");
  } else {
    if (ids.length < 4 || ids.length % 4 !== 0)
      throw new Error("Нужно число игроков, кратное 4 (минимум 4)");
  }

  let rawMatches;
  if (isKothBtB) rawMatches = buildKotHStart(ids);
  else if (format === "mexicano") rawMatches = buildFirstRound(ids);
  else rawMatches = buildMatches(ids);

  const matches = rawMatches.map((m) => ({ ...m, tournament_id: tournamentId }));
  const { error: mErr } = await supabase.from("tournament_matches").insert(matches);
  if (mErr) throw mErr;
  const { error: tErr } = await supabase.from("tournaments").update({ status: "active" }).eq("id", tournamentId);
  if (tErr) throw tErr;
}

/** Мексикано: следующий раунд по текущим очкам. */
export async function generateMexicanoRound(tournamentId, players, matches) {
  const sorted = standings(players.map((p) => ({ id: p.id, name: p.name })), matches);
  const nextRound = Math.max(...matches.map((m) => m.round_number), 0) + 1;
  const newMatches = buildMexicanoRound(sorted, nextRound)
    .map((m) => ({ ...m, tournament_id: tournamentId }));
  const { error } = await supabase.from("tournament_matches").insert(newMatches);
  if (error) throw error;
}

/** KotH/BtB: следующий матч — победитель vs. следующий из очереди. */
export async function generateKotHRound(tournamentId, matches) {
  const nextMatch = buildKotHNextMatch(matches);
  if (!nextMatch) throw new Error("Нет завершённых матчей для генерации следующего");
  const { error } = await supabase.from("tournament_matches")
    .insert({ ...nextMatch, tournament_id: tournamentId });
  if (error) throw error;
}

export async function submitMatchScore(matchId, scoreA, scoreB, pin = null) {
  const { error } = await supabase.rpc("submit_tournament_score", {
    p_match_id: matchId, p_score_a: scoreA, p_score_b: scoreB, p_pin: pin || "",
  });
  if (error) throw error;
}

// PIN доступа к вводу счёта (см. supabase/sql/score_pin.sql).
export async function setScorePin(tournamentId, pin) {
  const { error } = await supabase.rpc("set_score_pin", { p_tournament_id: tournamentId, p_pin: pin || "" });
  if (error) throw error;
}
export async function checkScorePin(tournamentId, pin) {
  const { data, error } = await supabase.rpc("check_score_pin", { p_tournament_id: tournamentId, p_pin: pin || "" });
  if (error) throw error;
  return !!data;
}

export async function finishTournament(tournamentId) {
  // Завершает турнир И начисляет рейтинг за его матчи (server-side, finish_tournament).
  const { error } = await supabase.rpc("finish_tournament", { p_tournament_id: tournamentId });
  if (error) throw error;
}

export async function deleteTournament(id) {
  const { error } = await supabase.from("tournaments").delete().eq("id", id);
  if (error) throw error;
  _bustList();
}

// Переименовать корт в турнире (jsonb court_names). name="" — сбросить к «Корт N».
export async function setCourtName(tournamentId, court, name) {
  const { error } = await supabase.rpc("set_court_name", {
    p_tournament_id: tournamentId, p_court: court, p_name: name || "",
  });
  if (error) throw error;
}
