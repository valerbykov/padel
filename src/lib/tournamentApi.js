// lib/tournamentApi.js
import { supabase } from "./supabase";
import { buildMatches, standings } from "./americano";
import { buildFirstRound, buildMexicanoRound, buildKotHStart, buildKotHNextMatch, buildKotHLadderStart, buildKotHLadderRound, pairsFromPlayers, buildRoundRobinPairs } from "./mexicano";
import { swr, bustCache } from "./cache";
import { WEB_BASE } from "./platform";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// 6 символов (≈1 млрд) — см. padelApi.genCode. Старые 4-символьные коды валидны.
const genCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
export const tournamentLink = (code) => `${WEB_BASE}/t/${code}`;

const T_SELECT =
  "id, invite_code, name, format, points_per_game, target_size, status, court_names, koth_champion_rule, created_by, created_at, starts_at, ends_at, place, description, contact_name, contact_link, open_scoring, fee_per_player, fee_currency, fee_timing, level, " +
  "players:tournament_players(id, profile_id, name, pair_no, created_at, profile:profiles(name, avatar_url)), " +
  "matches:tournament_matches(id, round_number, court, team_a, team_b, score_a, score_b)";

export async function createTournament(groupId, { name, pointsPerGame = 32, targetSize = 8, createdBy, format = "americano", startsAt, endsAt, place, description, contactName, contactLink, kotHChampionRule, openScoring = false, level } = {}) {
  let t = null;
  for (let i = 0; i < 5; i++) {
    const res = await supabase.from("tournaments").insert({
      group_id: groupId, invite_code: genCode(), name: name?.trim() || null,
      points_per_game: pointsPerGame, target_size: targetSize, created_by: createdBy || null,
      status: "open", format,
      koth_champion_rule: format === "king_of_hill" ? (kotHChampionRule || "court_1") : null,
      starts_at: startsAt || null, ends_at: endsAt || null, place: place?.trim() || null,
      description: description?.trim() || null,
      contact_name: contactName?.trim() || null, contact_link: contactLink?.trim() || null,
      open_scoring: !!openScoring, level: level || null,
    }).select().single();
    if (!res.error) { t = res.data; break; }
    if (res.error.code !== "23505") throw res.error;
  }
  if (!t) throw new Error("Не удалось сгенерировать код");
  bustCache();
  return t;
}

// Копия существующего турнира: тот же формат/очки/размер, новый статус "open".
// withPlayers — перенести участников (профили и гостей по имени), без счёта.
export async function copyTournament(srcId, groupId, { name, withPlayers = true, createdBy = null, startsAt = null, place = null } = {}) {
  const src = await getTournament(srcId);
  const trn = await createTournament(groupId, {
    name: (name && name.trim()) || null,
    pointsPerGame: src.points_per_game,
    targetSize: src.target_size,
    format: src.format,
    kotHChampionRule: src.koth_champion_rule || undefined,
    createdBy: createdBy || null,
    startsAt: startsAt || null,
    place: place || null,
    openScoring: !!src.open_scoring,
  });
  if (withPlayers) {
    const players = [...(src.players || [])].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    for (const p of players) {
      await addTournamentPlayer(trn.id, { profileId: p.profile_id || null, name: p.name, pairNo: p.pair_no ?? null });
    }
  }
  bustCache();
  return trn;
}

// У зарегистрированных игроков имя в tournament_players.name — снимок на момент
// вступления. Показываем актуальное имя из профиля (для гостей — сохранённое).
function withLiveNames(t) {
  if (t && Array.isArray(t.players)) {
    t.players = t.players.map((p) => (p.profile?.name ? { ...p, name: p.profile.name } : p));
  }
  return t;
}

async function _listTournaments(groupId) {
  let q = supabase.from("tournaments").select(T_SELECT).order("created_at", { ascending: false }).limit(100);
  if (groupId) q = q.eq("group_id", groupId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(withLiveNames);
}
export function listTournaments(groupId) {
  return swr("tours:" + (groupId || "_"), () => _listTournaments(groupId));
}

// Мои турниры без лиги (security definer my_tournaments): где я в составе.
// Та же форма, что T_SELECT. Видны активные и завершённые.
async function _listMyTournaments() {
  const { data, error } = await supabase.rpc("my_tournaments");
  if (error) throw error;
  return data || [];
}
export function listMyTournaments() { return swr("my_tours", _listMyTournaments); }

export async function getTournament(id) {
  const { data, error } = await supabase.from("tournaments").select(T_SELECT).eq("id", id).single();
  if (error) throw error;
  return withLiveNames(data);
}

export async function addTournamentPlayer(tournamentId, { profileId = null, name, pairNo = null }) {
  // Идемпотентность для зарегистрированных: двойной тап «Занять» не должен
  // добавлять игрока дважды (дубль ломает жеребьёвку).
  if (profileId) {
    const { data: dup, error: dupErr } = await supabase.from("tournament_players")
      .select("id").eq("tournament_id", tournamentId).eq("profile_id", profileId).limit(1);
    // Не глотаем ошибку проверки: при сбое SELECT dup=null и раньше мы «падали в
    // открытую» — вставляли второй ряд и ломали жеребьёвку. Лучше пробросить.
    if (dupErr) throw dupErr;
    if (dup && dup.length > 0) return;
  }
  const row = { tournament_id: tournamentId, profile_id: profileId, name: name.trim() };
  if (pairNo != null) row.pair_no = pairNo;
  const { error } = await supabase.from("tournament_players").insert(row);
  if (error) throw error;
  bustCache();
}

export async function removeTournamentPlayer(playerId) {
  const { error } = await supabase.from("tournament_players").delete().eq("id", playerId);
  if (error) throw error;
  bustCache();
}

export async function joinTournamentByCode(code, name, pairNo = null) {
  let profileId = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    profileId = data?.id || null;
  }
  const { data, error } = await supabase.rpc("join_tournament", {
    p_code: code, p_name: name.trim(), p_profile_id: profileId, p_pair_no: pairNo,
  });
  if (error) throw error;
  bustCache();
  return data; // { ok, already?, linked?, pair_no? }
}

export async function getTournamentByCode(code) {
  // get_tournament_by_code (SECURITY DEFINER) уже возвращает полные матчи со
  // счётом, поэтому прямой anon-фолбэк на tournament_matches убран — там
  // закрыли анонимное чтение всей таблицы (батч безопасности).
  const { data, error } = await supabase.rpc("get_tournament_by_code", { p_code: code.trim().toUpperCase() });
  if (error) throw error;
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
  const isBtb = format === "beat_the_box";      // «коробки» — старая модель одного корта с очередью
  const isKoth = format === "king_of_hill";     // «король корта» — лесенка кортов (игроков/4)

  if (isBtb) {
    if (ids.length < 4 || ids.length % 2 !== 0)
      throw new Error("Нужно чётное число игроков (минимум 4)");
  } else {
    if (ids.length < 4 || ids.length % 4 !== 0)
      throw new Error("Нужно число игроков, кратное 4 (минимум 4)");
  }

  // Защита от двойного старта: атомарно переводим open→active. Если турнир уже
  // не "open" (двойной тап / повторный вызов уже стартовал) — выходим, не плодя
  // дублирующее расписание (иначе каждый раунд задваивается).
  const { data: claimed, error: cErr } = await supabase
    .from("tournaments").update({ status: "active" })
    .eq("id", tournamentId).eq("status", "open").select("id");
  if (cErr) throw cErr;
  if (!claimed || claimed.length === 0) return; // уже запущен — ничего не вставляем

  let rawMatches;
  try {
    if (isBtb) rawMatches = buildKotHStart(ids);
    else if (isKoth) rawMatches = buildKotHLadderStart(pairsFromPlayers(players));
    else if (format === "round_robin") rawMatches = buildRoundRobinPairs(pairsFromPlayers(players));
    else if (format === "mexicano") rawMatches = buildFirstRound(ids);
    else rawMatches = buildMatches(ids);
  } catch (e) {
    // Жеребьёвка бросила (напр. неполные пары) уже ПОСЛЕ claim open→active —
    // откатываем статус, иначе турнир застрянет active без матчей.
    await supabase.from("tournaments").update({ status: "open" }).eq("id", tournamentId);
    throw e;
  }

  const matches = rawMatches.map((m) => ({ ...m, tournament_id: tournamentId }));
  const { error: mErr } = await supabase.from("tournament_matches").insert(matches);
  if (mErr) {
    // откат статуса, чтобы можно было повторить старт
    await supabase.from("tournaments").update({ status: "open" }).eq("id", tournamentId);
    throw mErr;
  }
  bustCache();
}

/** Мексикано: следующий раунд по текущим очкам. */
export async function generateMexicanoRound(tournamentId, players, matches) {
  const sorted = standings(players.map((p) => ({ id: p.id, name: p.name })), matches);
  const nextRound = Math.max(...matches.map((m) => m.round_number), 0) + 1;
  const newMatches = buildMexicanoRound(sorted, nextRound)
    .map((m) => ({ ...m, tournament_id: tournamentId }));
  const { error } = await supabase.from("tournament_matches").insert(newMatches);
  if (error) throw error;
  bustCache();
}

/** Beat the Box: следующий матч — победитель vs. следующий из очереди (одна коробка). */
export async function generateKotHRound(tournamentId, matches) {
  const nextMatch = buildKotHNextMatch(matches);
  if (!nextMatch) throw new Error("Нет завершённых матчей для генерации следующего");
  const { error } = await supabase.from("tournament_matches")
    .insert({ ...nextMatch, tournament_id: tournamentId });
  if (error) throw error;
  bustCache();
}

/** King of the Court: следующий раунд по «лесенке» (все корты сразу). */
export async function generateKotHLadderRound(tournamentId, matches) {
  const newMatches = buildKotHLadderRound(matches).map((m) => ({ ...m, tournament_id: tournamentId }));
  if (!newMatches.length) throw new Error("Нет завершённых матчей для генерации следующего раунда");
  const { error } = await supabase.from("tournament_matches").insert(newMatches);
  if (error) throw error;
  bustCache();
}

export async function submitMatchScore(matchId, scoreA, scoreB, pin = null) {
  const { error } = await supabase.rpc("submit_tournament_score", {
    p_match_id: matchId, p_score_a: scoreA, p_score_b: scoreB, p_pin: pin || "",
  });
  if (error) throw error;
  bustCache();
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
  bustCache();
}

export async function deleteTournament(id) {
  const { error } = await supabase.from("tournaments").delete().eq("id", id);
  if (error) throw error;
  bustCache();
}

// Переименовать корт в турнире (jsonb court_names). name="" — сбросить к «Корт N».
export async function setCourtName(tournamentId, court, name) {
  const { error } = await supabase.rpc("set_court_name", {
    p_tournament_id: tournamentId, p_court: court, p_name: name || "",
  });
  if (error) throw error;
}

/* ---------- Взносы за турнир (кто скинулся за организацию) ---------------- */
// Отдельные толерантные запросы (НЕ в T_SELECT): если миграция tournament_fees
// ещё не применена, вкладка турниров не должна ломаться — карточка просто molча
// не покажет данные.

// Сумма с игрока (null = не задана / миграции нет).
export async function getTournamentFee(id) {
  try {
    const { data, error } = await supabase.from("tournaments").select("fee_per_player").eq("id", id).single();
    if (error) return null;
    return data?.fee_per_player ?? null;
  } catch (e) { return null; }
}

// Кто уже скинулся — Set из tournament_players.id.
export async function getFeePayments(tournamentId) {
  try {
    const { data, error } = await supabase.rpc("get_fee_payments", { p_tournament_id: tournamentId });
    if (error) return new Set();
    return new Set((data || []).map((r) => (typeof r === "string" ? r : r?.get_fee_payments || r?.tp_id)).filter(Boolean));
  } catch (e) { return new Set(); }
}

// Задать сумму с игрока (админ/создатель). null — убрать взносы.
export async function setTournamentFee(tournamentId, perPlayer, currency = null, timing = "end") {
  const { error } = await supabase.rpc("set_tournament_fee", { p_tournament_id: tournamentId, p_per_player: perPlayer, p_currency: currency || "", p_timing: timing || "end" });
  if (error) throw error;
}

// Переключить «скинулся» (сам за себя / админ за любого). Возвращает новое состояние.
export async function toggleFeePaid(tpId) {
  const { data, error } = await supabase.rpc("toggle_fee_paid", { p_tp_id: tpId });
  if (error) throw error;
  return !!data;
}

// «Напомнить должникам» пушем: ставит в очередь адресные уведомления всем
// неотметившимся участникам с аккаунтом (крон разошлёт в течение ~5 мин).
// Возвращает, скольким поставлено (0 = все скинулись или напоминали < часа назад).
export async function remindFeeDebtors(tournamentId) {
  const { data, error } = await supabase.rpc("remind_fee_debtors", { p_tournament_id: tournamentId });
  if (error) throw error;
  return data ?? 0;
}
