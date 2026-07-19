# Round Robin (пары) — формат E — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Новый ПАРНЫЙ формат «Round Robin»: фиксированные пары, круговая система — каждая пара играет с каждой ровно раз; все раунды генерятся на старте; победитель — по очкам (парная таблица уже есть). Первым в списке парных при создании.

**Architecture:** Круговой алгоритм пар `buildRoundRobinPairs(pairs)` в `mexicano.js` (метод «фиксированный + ротация», как `circleSchedule`, но матчап = пара-vs-пара). Формат `round_robin` добавляется в `FORMAT_META`+`getFormats` (category `pair`, `multiOf:4` → та же create-форма, что у KotH). `startTournament` получает ветку round_robin. Запись парами, лобби пар, старт-гейт `allPaired`, `pairStandings`, чемпион-пара, RPC (`v_is_pair` уже включает `round_robin`) — ВСЁ уже готово (D/B2). Всё апфронт как у americano — генерации раундов не нужно.

**Tech Stack:** Vite + React 18 (plain JS); i18n ru/en/es.

## Global Constraints

- Node heap: префикс `NODE_OPTIONS=--max-old-space-size=512`.
- Plain JS, no TS. Комментарии по-русски. **Только `tr()` в JSX** (ESLint-гейт).
- Тест-фреймворка НЕТ: гейт — `npm run build` `✓ built` + node-смоук.
- `round_robin` — parity: чётные пары (players multiOf 4), круговой без bye. НЕ деплоить (батч). Коммитить только файлы таска.

---

### Task 1: `buildRoundRobinPairs` в `mexicano.js`

**Files:**
- Modify: `src/lib/mexicano.js` (добавить экспорт)
- Test: `scratchpad/smoke-rr.mjs` (временный)

**Interfaces:**
- Produces: `buildRoundRobinPairs(pairs)` где `pairs = [[idA,idB], …]` → массив матчей `{round_number, court, team_a:[..], team_b:[..]}`, круговая: каждая пара с каждой раз, `N-1` раундов, `floor(N/2)` кортов/раунд.

- [ ] **Step 1: Смоук (упадёт)** — `scratchpad/smoke-rr.mjs`:
```js
import assert from "node:assert/strict";
import { buildRoundRobinPairs } from "/root/padel-app/src/lib/mexicano.js";

const pairs = [["a","b"], ["c","d"], ["e","f"], ["g","h"]]; // 4 пары
const m = buildRoundRobinPairs(pairs);
assert.equal(m.length, 6, "4 пары → 6 матчей (N(N-1)/2), got " + m.length);
assert.equal(Math.max(...m.map((x) => x.round_number)), 3, "3 раунда (N-1)");
// каждая пара сыграла 3 раза
const cnt = {};
for (const x of m) for (const t of [x.team_a, x.team_b]) { const k = t.join(","); cnt[k] = (cnt[k] || 0) + 1; }
assert.ok(Object.values(cnt).every((c) => c === 3), "каждая пара 3 матча");
// нет повторного матчапа
const seen = new Set();
for (const x of m) { const k = [x.team_a.join(","), x.team_b.join(",")].sort().join("|"); assert.ok(!seen.has(k), "нет повтора матчапа"); seen.add(k); }
// N=2 → 1 матч
assert.equal(buildRoundRobinPairs([["a","b"], ["c","d"]]).length, 1, "2 пары → 1 матч");
assert.equal(buildRoundRobinPairs([["a","b"]]).length, 0, "1 пара → 0 матчей");
console.log("OK smoke-rr");
```

- [ ] **Step 2: Run — упадёт** — `NODE_OPTIONS=--max-old-space-size=512 node /tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-rr.mjs` → FAIL (нет экспорта).

- [ ] **Step 3: Реализовать** — добавить в `src/lib/mexicano.js` (после `buildKotHLadderStart`/`pairsFromPlayers`):
```js
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
```

- [ ] **Step 4: Run — пройдёт** — та же команда → `OK smoke-rr`. Затем `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`. Удалить: `rm -f /tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-rr.mjs`.

- [ ] **Step 5: Commit**
```bash
git add src/lib/mexicano.js
git commit -m "mexicano: buildRoundRobinPairs — круговой алгоритм пар (каждая с каждой)"
```

---

### Task 2: i18n — имя/описание формата Round Robin

**Files:**
- Modify: `src/lib/i18n.js` (fmt-ключи ru/en/es)

**Interfaces:**
- Produces: `fmt_rr_name`, `fmt_rr_tagline`, `fmt_rr_desc`, `fmt_rr_t1`, `fmt_rr_t2`, `fmt_rr_t3` во всех локалях.

- [ ] **Step 1: RU** — рядом с `fmt_koth_*` ключами добавить:
```js
    fmt_rr_name: 'Круговой', fmt_rr_tagline: 'Каждая пара с каждой', fmt_rr_desc: 'Фиксированные пары, круговая система: каждая пара играет с каждой по разу. Победитель — по очкам.', fmt_rr_t1: 'Фикс-пары', fmt_rr_t2: 'Каждая с каждой', fmt_rr_t3: 'По очкам',
```
- [ ] **Step 2: EN**:
```js
    fmt_rr_name: 'Round Robin', fmt_rr_tagline: 'Every pair plays every pair', fmt_rr_desc: 'Fixed pairs, round-robin: every pair plays every other once. Winner by points.', fmt_rr_t1: 'Fixed pairs', fmt_rr_t2: 'All-play-all', fmt_rr_t3: 'By points',
```
- [ ] **Step 3: ES**:
```js
    fmt_rr_name: 'Round Robin', fmt_rr_tagline: 'Cada pareja contra todas', fmt_rr_desc: 'Parejas fijas, todos contra todos: cada pareja juega una vez con cada una. Gana por puntos.', fmt_rr_t1: 'Parejas fijas', fmt_rr_t2: 'Todos contra todos', fmt_rr_t3: 'Por puntos',
```
- [ ] **Step 4: Verify** — `grep -c "fmt_rr_name\|fmt_rr_desc\|fmt_rr_t3" src/lib/i18n.js` → `9`; `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 5: Commit**
```bash
git add src/lib/i18n.js
git commit -m "i18n: имя/описание формата Round Robin (ru/en/es)"
```

---

### Task 3: Каталог форматов — добавить Round Robin (первым в парных)

**Files:**
- Modify: `src/components/Tournaments.jsx` (`FORMAT_META` ~91-96; `getFormats` ~99-114)

**Interfaces:**
- Consumes: ключи Task 2.
- Produces: `round_robin` в каталоге — category `pair`, ПЕРВЫМ в парной секции (перед `king_of_hill`), `multiOf:4`.

- [ ] **Step 1: FORMAT_META** — в объект `FORMAT_META` добавить (после `mexicano`, перед `king_of_hill`):
```jsx
  round_robin:  { emoji: "🔁", color: "#4db8e8", multiOf: 4 },
```

- [ ] **Step 2: getFormats** — в массиве `getFormats()` вставить запись `round_robin` СРАЗУ ПЕРЕД записью `king_of_hill` (чтобы в парной секции она шла первой):
```jsx
    { id: "round_robin",  ...FORMAT_META.round_robin, category: "pair",
      name: tr("fmt_rr_name"), tagline: tr("fmt_rr_tagline"), desc: tr("fmt_rr_desc"),
      tags: [tr("fmt_rr_t1"), tr("fmt_rr_t2"), tr("fmt_rr_t3")] },
```

- [ ] **Step 3: Сборка** — `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 4: Commit**
```bash
git add src/components/Tournaments.jsx
git commit -m "турниры: формат Round Robin в каталоге (первым в парных)"
```

---

### Task 4: `startTournament` — жеребьёвка Round Robin

**Files:**
- Modify: `src/lib/tournamentApi.js` (импорт `buildRoundRobinPairs`; `startTournament` ветка выбора `rawMatches` ~172-176)

**Interfaces:**
- Consumes: `buildRoundRobinPairs`, `pairsFromPlayers` (mexicano.js).
- Produces: старт `round_robin` собирает круговое расписание из `pair_no`-пар (все раунды сразу).

- [ ] **Step 1: Импорт** — добавить `buildRoundRobinPairs` в импорт из `./mexicano`:
```js
import { buildFirstRound, buildMexicanoRound, buildKotHStart, buildKotHNextMatch, buildKotHLadderStart, buildKotHLadderRound, pairsFromPlayers, buildRoundRobinPairs } from "./mexicano";
```

- [ ] **Step 2: Ветка round_robin** — в `startTournament`, в блоке выбора `rawMatches`, добавить ветку round_robin ПЕРЕД `else` (americano). Заменить:
```js
  let rawMatches;
  if (isBtb) rawMatches = buildKotHStart(ids);
  else if (isKoth) rawMatches = buildKotHLadderStart(pairsFromPlayers(players));
  else if (format === "mexicano") rawMatches = buildFirstRound(ids);
  else rawMatches = buildMatches(ids);
```
на:
```js
  let rawMatches;
  if (isBtb) rawMatches = buildKotHStart(ids);
  else if (isKoth) rawMatches = buildKotHLadderStart(pairsFromPlayers(players));
  else if (format === "round_robin") rawMatches = buildRoundRobinPairs(pairsFromPlayers(players));
  else if (format === "mexicano") rawMatches = buildFirstRound(ids);
  else rawMatches = buildMatches(ids);
```
(Валидация числа игроков: `round_robin` — non-btb → уже требует кратности 4, как KotH. `pairsFromPlayers` гарантирует полные пары — старт-гейт лобби до этого доводит.)

- [ ] **Step 3: Сборка** — `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 4: Commit**
```bash
git add src/lib/tournamentApi.js
git commit -m "startTournament: жеребьёвка Round Robin (круговой из pair_no-пар)"
```

---

## Замечания
- Запись парами, лобби пар (`fmt.category==="pair"`), старт-гейт `allPaired`, `pairStandings`, чемпион-пара (для не-KotH пар = лидер таблицы), RPC `v_is_pair` (включает `round_robin`) — уже готовы (D/B2), новых правок не требуют.
- Все матчи round_robin создаются на старте (как americano) — «сгенерировать раунд» не нужно; UI-навигация по раундам работает как у americano.
- `koth_champion_rule` для round_robin = null (createTournament ставит его только для `king_of_hill`).

## Self-review
- **Покрытие:** алгоритм (T1); i18n имени (T2); каталог (T3); старт (T4). Остальная парная инфраструктура переиспользуется.
- **Плейсхолдеров нет:** весь JS/ключи целиком.
- **Согласованность:** `buildRoundRobinPairs(pairs)` потребляет тот же `pairs=[[id,id]]` из `pairsFromPlayers`, что и KotH; `round_robin` — `category:"pair"`, `multiOf:4`; чемпион не-KotH пар берётся как `table[0]` (уже в B2b).
- **ESLint-гейт:** имена формата через `tr()`.
