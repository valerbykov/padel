// lib/tournamentApi.js
import { supabase } from "./supabase";
import { buildMatches } from "./americano";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
export const tournamentLink = (code) => `${window.location.origin}/t/${code}`;

const T_SELECT =
  "id, invite_code, name, points_per_game, target_size, status, created_at, " +
  "players:tournament_players(id, profile_id, name, created_at), " +
  "matches:tournament_matches(id, round_number, court, team_a, team_b, score_a, score_b)";

export async function createTournament(groupId, { name, pointsPerGame = 32, targetSize = 8, createdBy } = {}) {
  let t = null;
  for (let i = 0; i < 5; i++) {
    const res = await supabase.from("tournaments").insert({
      group_id: groupId, invite_code: genCode(), name: name?.trim() || null,
      points_per_game: pointsPerGame, target_size: targetSize, created_by: createdBy || null, status: "open",
    }).select().single();
    if (!res.error) { t = res.data; break; }
    if (res.error.code !== "23505") throw res.error;
  }
  if (!t) throw new Error("Не удалось сгенерировать код");
  return t;
}

export async function listTournaments(groupId) {
  // groupId известен — фильтруем по группе (основной кейс).
  // groupId нет — RLS вернёт турниры, где пользователь в tournament_players.profile_id
  // (policy "participant view tournaments").
  let q = supabase.from("tournaments").select(T_SELECT).order("created_at", { ascending: false }).limit(100);
  if (groupId) q = q.eq("group_id", groupId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getTournament(id) {
  const { data, error } = await supabase.from("tournaments").select(T_SELECT).eq("id", id).single();
  if (error) throw error;
  return data;
}

// Хост добавляет игрока из состава группы (или просто по имени).
export async function addTournamentPlayer(tournamentId, { profileId = null, name }) {
  const { error } = await supabase.from("tournament_players")
    .insert({ tournament_id: tournamentId, profile_id: profileId, name: name.trim() });
  if (error) throw error;
}

export async function removeTournamentPlayer(playerId) {
  const { error } = await supabase.from("tournament_players").delete().eq("id", playerId);
  if (error) throw error;
}

// Гость/игрок присоединяется по коду.
// Если залогинен — передаём profile_id, чтобы турнир был виден в разделе Турниры.
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
  if (error) throw error; // tournament_full / tournament_closed / tournament_not_found
}

export async function getTournamentByCode(code) {
  const { data, error } = await supabase.rpc("get_tournament_by_code", { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  return data;
}

// Старт: жеребьёвка + запись матчей + статус active.
export async function startTournament(tournamentId, players) {
  const ids = players.map((p) => p.id);
  if (ids.length < 4 || ids.length % 4 !== 0) throw new Error("Нужно число игроков, кратное 4 (минимум 4)");
  const matches = buildMatches(ids).map((m) => ({ ...m, tournament_id: tournamentId }));
  const { error: mErr } = await supabase.from("tournament_matches").insert(matches);
  if (mErr) throw mErr;
  const { error: tErr } = await supabase.from("tournaments").update({ status: "active" }).eq("id", tournamentId);
  if (tErr) throw tErr;
}

export async function submitMatchScore(matchId, scoreA, scoreB) {
  const { error } = await supabase.from("tournament_matches")
    .update({ score_a: scoreA, score_b: scoreB }).eq("id", matchId);
  if (error) throw error;
}

export async function finishTournament(tournamentId) {
  const { error } = await supabase.from("tournaments").update({ status: "finished" }).eq("id", tournamentId);
  if (error) throw error;
}

export async function deleteTournament(id) {
  const { error } = await supabase.from("tournaments").delete().eq("id", id);
  if (error) throw error;
}
