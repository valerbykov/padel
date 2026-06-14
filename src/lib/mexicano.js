// lib/mexicano.js
// Жеребьёвка Мексикано + форматы King of the Hill / Beat the Box.

import { shuffle } from "./americano";

// ─── МЕКСИКАНО ────────────────────────────────────────────────────────────────

/** Первый раунд — случайный. playerIds: string[] */
export function buildFirstRound(playerIds) {
  const order = shuffle([...playerIds]);
  const courts = order.length / 4;
  const matches = [];
  for (let c = 0; c < courts; c++) {
    const g = order.slice(c * 4, c * 4 + 4);
    matches.push({ round_number: 1, court: c + 1, team_a: [g[0], g[1]], team_b: [g[2], g[3]] });
  }
  return matches;
}

/**
 * Следующий раунд по таблице.
 * sorted: [{ id, points, … }] из standings(), убывание.
 * Алгоритм: внутри tied-групп — случайный порядок; разбивка по 4: pos 0+3 vs 1+2.
 */
export function buildMexicanoRound(sorted, nextRound) {
  const shuffled = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].points === sorted[i].points) j++;
    shuffled.push(...shuffle(sorted.slice(i, j)));
    i = j;
  }
  const courts = shuffled.length / 4;
  const matches = [];
  for (let c = 0; c < courts; c++) {
    const g = shuffled.slice(c * 4, c * 4 + 4);
    matches.push({ round_number: nextRound, court: c + 1, team_a: [g[0].id, g[3].id], team_b: [g[1].id, g[2].id] });
  }
  return matches;
}

// ─── KING OF THE HILL / BEAT THE BOX ─────────────────────────────────────────

/**
 * Извлечь все команды из матчей round_number=0 (команды-определения).
 * Дедупликация по отсортированному ключу.
 */
export function getAllKotHTeams(matches) {
  const teamMap = new Map();
  matches
    .filter((m) => m.round_number === 0)
    .forEach((m) => {
      const keyA = [...m.team_a].sort().join(",");
      const keyB = [...m.team_b].sort().join(",");
      teamMap.set(keyA, m.team_a);
      if (keyB !== keyA) teamMap.set(keyB, m.team_b);
    });
  return [...teamMap.values()];
}

/**
 * Старт KotH/BtB:
 *   - round_number=0 матчи → определения команд (пары игроков), без счёта.
 *   - round_number=1 матч → первая реальная игра (team_a vs team_b).
 * playerIds: чётное число ≥ 4.
 */
export function buildKotHStart(playerIds) {
  const order = shuffle([...playerIds]);
  const teams = [];
  for (let i = 0; i + 1 < order.length; i += 2) {
    teams.push([order[i], order[i + 1]]);
  }

  const result = [];
  // Round 0: store all teams pairwise (duplicates last if odd count of teams)
  for (let i = 0; i < teams.length; i += 2) {
    result.push({
      round_number: 0,
      court: Math.floor(i / 2) + 1,
      team_a: teams[i],
      team_b: teams[i + 1] || teams[i],
    });
  }
  // Round 1: first actual match — teams[0] (defender) vs teams[1] (challenger)
  result.push({ round_number: 1, court: 1, team_a: teams[0], team_b: teams[1] });
  return result;
}

/**
 * Следующий матч KotH/BtB:
 *   - Победитель последнего матча → team_a (Defender / Box).
 *   - Очередь = все команды кроме победителя, сортировка по последнему сыгранному раунду ↑.
 *   - Следующий претендент = front of queue.
 */
export function buildKotHNextMatch(matches) {
  const allTeams = getAllKotHTeams(matches);
  if (allTeams.length < 2) return null;

  const played = matches.filter((m) => m.round_number > 0 && m.score_a != null && m.score_b != null);
  if (!played.length) return null;

  const last = played.reduce((a, b) => (b.round_number > a.round_number ? b : a));
  const winnerIsA = (last.score_a || 0) >= (last.score_b || 0);
  const winnerTeam = winnerIsA ? last.team_a : last.team_b;
  const winnerKey = [...winnerTeam].sort().join(",");

  // Last-played round per team
  const lastPlayed = {};
  allTeams.forEach((t) => { lastPlayed[[...t].sort().join(",")] = 0; });
  matches
    .filter((m) => m.round_number > 0)
    .forEach((m) => {
      const a = [...m.team_a].sort().join(",");
      const b = [...m.team_b].sort().join(",");
      lastPlayed[a] = Math.max(lastPlayed[a] || 0, m.round_number);
      lastPlayed[b] = Math.max(lastPlayed[b] || 0, m.round_number);
    });

  const queue = allTeams
    .filter((t) => [...t].sort().join(",") !== winnerKey)
    .sort((a, b) => (lastPlayed[[...a].sort().join(",")] || 0) - (lastPlayed[[...b].sort().join(",")] || 0));

  if (!queue.length) return null;
  const nextRound = Math.max(...matches.filter((m) => m.round_number > 0).map((m) => m.round_number)) + 1;
  return { round_number: nextRound, court: 1, team_a: winnerTeam, team_b: queue[0] };
}
