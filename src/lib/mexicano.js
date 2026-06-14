// lib/mexicano.js
// Жеребьёвка Мексикано: первый раунд случайный,
// последующие — по текущей таблице: 1-й+4-й vs 2-й+3-й в каждой четвёрке.

import { shuffle } from "./americano";

/**
 * Первый раунд — случайный.
 * playerIds: string[] — id из tournament_players.
 */
export function buildFirstRound(playerIds) {
  const order = shuffle([...playerIds]);
  const courts = order.length / 4;
  const matches = [];
  for (let c = 0; c < courts; c++) {
    const g = order.slice(c * 4, c * 4 + 4);
    matches.push({
      round_number: 1,
      court: c + 1,
      team_a: [g[0], g[1]],
      team_b: [g[2], g[3]],
    });
  }
  return matches;
}

/**
 * Следующий раунд по текущей таблице.
 * sorted: [{ id, points, ... }] — список из standings(), уже по убыванию очков.
 * nextRound: номер нового раунда.
 *
 * Алгоритм:
 *  - внутри групп с одинаковыми очками — случайный порядок (для честности)
 *  - затем разбивка по 4: позиции 0+3 vs 1+2
 */
export function buildMexicanoRound(sorted, nextRound) {
  // Перемешать внутри tied-групп
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
    matches.push({
      round_number: nextRound,
      court: c + 1,
      team_a: [g[0].id, g[3].id],  // 1-й + 4-й
      team_b: [g[1].id, g[2].id],  // 2-й + 3-й
    });
  }
  return matches;
}
