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

// ─── KING OF THE COURT (лесенка кортов) ──────────────────────────────────────
// Корты = игроков/4; на каждом корте 2 ФИКСИРОВАННЫЕ пары (партнёры не меняются
// весь турнир). Каждый раунд играют ВСЕ корты одновременно. Затем «лесенка»:
// победитель поднимается на корт выше (на корте 1 остаётся), проигравший
// опускается на корт ниже (на последнем корте остаётся). Раунды генерятся, пока
// организатор не завершит турнир.

/**
 * Собрать пары из ростера по pair_no. players: [{id, pair_no}].
 * Возвращает [[idA,idB], …] в порядке возрастания pair_no. Бросает, если у кого-то
 * нет pair_no или пара неполна (полноту гарантирует старт-гейт в UI).
 */
export function pairsFromPlayers(players) {
  const groups = new Map();
  for (const p of players) {
    if (p.pair_no == null) throw new Error("У игрока нет пары");
    const g = groups.get(p.pair_no) || [];
    g.push(p.id);
    groups.set(p.pair_no, g);
  }
  const pairs = [];
  for (const pn of [...groups.keys()].sort((a, b) => a - b)) {
    const ids = groups.get(pn);
    if (ids.length !== 2) throw new Error("Пара неполна");
    pairs.push(ids);
  }
  return pairs;
}

/** Старт KotH: раунд 1 — все корты, по 2 ФИКС-пары на корт. Пары приходят готовыми
 *  (из pair_no), НЕ перемешиваем. pairs: [[idA,idB], …]. */
export function buildKotHLadderStart(pairs) {
  if (pairs.length % 2 !== 0) throw new Error("Нужно чётное число пар");
  const courts = Math.floor(pairs.length / 2);
  const matches = [];
  for (let c = 0; c < courts; c++) {
    matches.push({ round_number: 1, court: c + 1, team_a: pairs[2 * c], team_b: pairs[2 * c + 1] });
  }
  return matches;
}

/** Следующий раунд KotH: по последнему сыгранному раунду строим лесенку. */
export function buildKotHLadderRound(matches) {
  const played = matches.filter((m) => m.round_number > 0);
  if (!played.length) return [];
  const lastRound = Math.max(...played.map((m) => m.round_number));
  const cur = played.filter((m) => m.round_number === lastRound).sort((a, b) => a.court - b.court);
  const C = cur.length;
  const byCourt = {};
  cur.forEach((m) => {
    const aWin = (m.score_a || 0) >= (m.score_b || 0);
    byCourt[m.court] = { winner: aWin ? m.team_a : m.team_b, loser: aWin ? m.team_b : m.team_a };
  });
  const next = [];
  for (let c = 1; c <= C; c++) {
    let teamA, teamB;
    if (c === 1) {              // корт 1: победитель остаётся + поднявшийся победитель со 2-го
      teamA = byCourt[1].winner;
      teamB = C >= 2 ? byCourt[2].winner : byCourt[1].loser;
    } else if (c === C) {       // последний корт: спустившийся проигравший сверху + проигравший остаётся
      teamA = byCourt[c - 1].loser;
      teamB = byCourt[C].loser;
    } else {                    // середина: проигравший сверху + победитель снизу
      teamA = byCourt[c - 1].loser;
      teamB = byCourt[c + 1].winner;
    }
    next.push({ round_number: lastRound + 1, court: c, team_a: teamA, team_b: teamB });
  }
  return next;
}

// ─── ROUND ROBIN (круговой, пары) ────────────────────────────────────────────
// Фиксированные пары; каждая пара играет с каждой ровно раз. Круговой метод
// (фиксируем последнюю, крутим остальные): N пар → N-1 раундов, floor(N/2) кортов
// на раунд. Матчап [x,y] = пара pairs[x] vs pairs[y]. Всё генерится на старте.
export function buildRoundRobinPairs(pairs) {
  const N = pairs.length;
  if (N < 2) return [];
  const fixed = N - 1;
  let rot = [...Array(N - 1).keys()]; // крутящиеся индексы 0..N-2
  const matches = [];
  for (let r = 0; r < N - 1; r++) {
    const round = [[fixed, rot[0]]];
    for (let i = 1; i <= (N - 2) / 2; i++) round.push([rot[i], rot[N - 1 - i]]);
    round.forEach(([a, b], c) => {
      matches.push({ round_number: r + 1, court: c + 1, team_a: pairs[a], team_b: pairs[b] });
    });
    rot = [rot[rot.length - 1], ...rot.slice(0, rot.length - 1)]; // ротация
  }
  return matches;
}

// ─── BEAT THE BOX ─────────────────────────────────────────────────────────────
// (King of the Hill в старой модели «одного корта с очередью» — оставлено для BtB.)

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
