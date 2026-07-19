// lib/pairs.js
// Группировка турнирного ростера по парам (pair_no) для отображения и старт-гейта.
// players: [{ id, name, pair_no, ... }]. Отдельно от pairsFromPlayers (mexicano.js):
// тот БРОСАЕТ на неполных парах (для жеребьёвки), а здесь — толерантно для UI.

export function groupPairs(players) {
  const map = new Map();
  const pool = [];
  for (const p of players || []) {
    if (p.pair_no == null) { pool.push(p); continue; }
    const g = map.get(p.pair_no) || [];
    g.push(p);
    map.set(p.pair_no, g);
  }
  const pairs = [...map.keys()].sort((a, b) => a - b).map((pn) => ({ pair_no: pn, members: map.get(pn) }));
  return { pairs, pool };
}

export function nextPairNo(players) {
  let max = 0;
  for (const p of players || []) if (p.pair_no != null && p.pair_no > max) max = p.pair_no;
  return max + 1;
}

export function openPairs(players) {
  return groupPairs(players).pairs.filter((pr) => pr.members.length < 2);
}

export function allPaired(players) {
  const { pairs, pool } = groupPairs(players);
  return pool.length === 0 && pairs.length > 0 && pairs.every((pr) => pr.members.length === 2);
}
