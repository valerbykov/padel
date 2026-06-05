// lib/americano.js
// Жеребьёвка Американо: за (n-1) раундов каждый игрок напарничает с каждым
// ровно один раз. Игроки случайно перемешиваются на старте — отсюда «рандом».
// Поддерживается число игроков, кратное 4 (4, 8, 12 …); 8 игроков = 2 корта.

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Схема индексов (0..n-1). Возвращает раунды с кортами.
export function americanoSchedule(n) {
  if (n % 4 !== 0) throw new Error("Число игроков должно быть кратно 4");
  const fixed = n - 1;
  let rot = [...Array(n - 1).keys()];
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [[fixed, rot[0]]];
    for (let i = 1; i <= (n - 2) / 2; i++) pairs.push([rot[i], rot[n - 1 - i]]);
    const courts = [];
    for (let c = 0; c < pairs.length / 2; c++)
      courts.push({ court: c + 1, teamA: pairs[2 * c], teamB: pairs[2 * c + 1] });
    rounds.push({ round: r + 1, courts });
    rot = [rot[rot.length - 1], ...rot.slice(0, rot.length - 1)];
  }
  return rounds;
}

// Строит матчи из id участников: перемешивает их и раскладывает по схеме.
export function buildMatches(playerIds) {
  const order = shuffle(playerIds);
  const sched = americanoSchedule(order.length);
  const matches = [];
  for (const rnd of sched)
    for (const c of rnd.courts)
      matches.push({
        round_number: rnd.round,
        court: c.court,
        team_a: [order[c.teamA[0]], order[c.teamA[1]]],
        team_b: [order[c.teamB[0]], order[c.teamB[1]]],
      });
  return matches;
}

// Турнирная таблица: суммарные очки игрока по всем сыгранным матчам.
export function standings(players, matches) {
  const pts = {}, played = {};
  players.forEach((p) => { pts[p.id] = 0; played[p.id] = 0; });
  for (const m of matches) {
    if (m.score_a == null || m.score_b == null) continue;
    for (const id of (m.team_a || [])) { pts[id] = (pts[id] || 0) + m.score_a; played[id] = (played[id] || 0) + 1; }
    for (const id of (m.team_b || [])) { pts[id] = (pts[id] || 0) + m.score_b; played[id] = (played[id] || 0) + 1; }
  }
  return players
    .map((p) => ({ ...p, points: pts[p.id] || 0, played: played[p.id] || 0 }))
    .sort((a, b) => b.points - a.points);
}

export const allMatchesPlayed = (matches) =>
  matches.length > 0 && matches.every((m) => m.score_a != null && m.score_b != null);

// Расширенная таблица: победы/ничьи/поражения, очки за/против, дельта.
export function detailedStandings(players, matches) {
  const init = () => ({ points: 0, against: 0, wins: 0, draws: 0, losses: 0, played: 0 });
  const acc = {};
  players.forEach((p) => { acc[p.id] = init(); });
  for (const m of matches) {
    if (m.score_a == null || m.score_b == null) continue;
    const aWin = m.score_a > m.score_b, draw = m.score_a === m.score_b;
    for (const id of (m.team_a || [])) {
      const s = acc[id]; if (!s) continue;
      s.points += m.score_a; s.against += m.score_b; s.played++;
      if (draw) s.draws++; else if (aWin) s.wins++; else s.losses++;
    }
    for (const id of (m.team_b || [])) {
      const s = acc[id]; if (!s) continue;
      s.points += m.score_b; s.against += m.score_a; s.played++;
      if (draw) s.draws++; else if (!aWin) s.wins++; else s.losses++;
    }
  }
  return players
    .map((p) => ({ ...p, ...acc[p.id], delta: acc[p.id].points - acc[p.id].against }))
    .sort((a, b) => b.points - a.points || b.delta - a.delta);
}
