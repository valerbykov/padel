# Широкоэкранная версия (вариант B + ТВ-режим) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На ширине ≥900px — трёхколоночная раскладка (рейл 72px → список 320px → деталь), пустые состояния из кэша, инспектор-шасси за флагом, полноэкранное ТВ-табло турнира (кнопка + публичный `/tv/CODE`). Телефон (<900px) не меняется.

**Architecture:** Хук `useIsWide` (matchMedia 900px) + презентационные модули в `src/components/wide/` (рейл, сплит, пустые состояния). Каждая вкладка сохраняет свою машину состояний; меняется только МЕСТО рендера детали: на wide деталь монтируется во вторую колонку `WideSplit` вместо замещения списка. ТВ-табло — отдельный lazy-чанк, переиспользующий публичный RPC `get_tournament_by_code` с поллингом.

**Tech Stack:** React 18 (без роутера), inline-стили + CSS-переменные темы, lucide-react, существующие `tournamentApi`/`americano.js`. Тестов в репо нет — верификация: `npm run build`, `npx eslint`, Playwright MCP (порты preview).

## Global Constraints (из спеки, дословно)

- `<900px` — существующая телефонная раскладка, ни одного изменения поведения.
- Деталь-компоненты (`GameCard`, `TournamentView`, `PlayerDetail`) переиспользуются как есть; внутри детали остаются колонкой `max-width: 520px`; их вёрстку не менять.
- Все новые части — отдельные файлы/lazy-чанки: `src/components/wide/*`, `TvBoard.jsx`.
- Никаких новых запросов данных для пустых состояний — только уже загруженные пропсы/кэш.
- Роутинг-регексы `/j/ /t/ /l/ /r/` в App.jsx не менять (только ДОБАВИТЬ `/tv/`).
- Обе темы (dark/light) работают в обеих раскладках.
- Сборка: `NODE_OPTIONS=--max-old-space-size=512 npm run build` (heap-кап пользователя).
- Комментарии в коде — по-русски, в стиле репо.

**Верификация Playwright (все задачи):** preview `npm run preview -- --port 4173`; перед проверкой чистить SW/кэши (unregister + caches.delete), иначе отдаётся старый бандл. Телефонный эталон — viewport 390×844; wide — 1024×768 и 1366×900. Логин в демо: уже залогинен как review (если нет — see memory: review@padelpack.app/424242).

---

### Task 1: Wide-инфраструктура — хук, рейл, интеграция в оболочку

**Files:**
- Create: `src/components/wide/wide.js`
- Create: `src/components/wide/WideRail.jsx`
- Modify: `src/PadelLeague.jsx` (оболочка: ~строки 319–345 — контейнер, нижний nav)

**Interfaces:**
- Produces: `useIsWide(): boolean` (true при ≥900px, реагирует на resize); `WideRail({ tab, goTab, session, activeLeague, expanded, onToggleExpand })` — рейл-навигация. `expanded/onToggleExpand` в Task 1 не используются (передавать не нужно) — появятся в Task 8.

- [ ] **Step 1: создать `src/components/wide/wide.js`**

```js
// wide.js — инфраструктура широкоэкранной раскладки (≥900px).
// Телефонная версия (<900px) не знает об этих модулях вовсе.
import { useEffect, useState } from "react";

const WIDE_QUERY = "(min-width: 900px)";

export function useIsWide() {
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIDE_QUERY).matches : false);
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const on = (e) => setWide(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}
```

- [ ] **Step 2: создать `src/components/wide/WideRail.jsx`**

```jsx
// WideRail — вертикальная навигация слева на ≥900px (заменяет нижние табы).
// Task 1: только иконки (72px). Морфинг в сайдбар с подписями — Task 8.
import React from "react";
import { Users, Swords, Trophy, History } from "lucide-react";
import { t } from "../../lib/i18n";

export default function WideRail({ tab, goTab, session, activeLeague }) {
  const items = [
    session && { id: "board", icon: Users, label: t("tab_friends") },
    { id: "games", icon: Swords, label: t("tab_games") },
    { id: "tournaments", icon: Trophy, label: t("tab_tournaments") },
    session && { id: "history", icon: History, label: t("tab_history") },
  ].filter(Boolean);
  return (
    <div style={{ width: 72, flexShrink: 0, borderRight: "1px solid var(--line)", position: "sticky", top: 0,
      height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      padding: "14px 0 16px", background: "color-mix(in srgb, var(--surface) 60%, var(--bg))" }}>
      {items.map(({ id, icon: Icon, label }) => (
        <button key={id} onClick={() => goTab(id)} title={label} aria-label={label}
          style={{ width: 46, height: 46, borderRadius: 12, border: "none", cursor: "pointer",
            display: "grid", placeItems: "center",
            background: tab === id ? "color-mix(in srgb, var(--lime) 14%, transparent)" : "none",
            color: tab === id ? "var(--lime)" : "var(--mut)" }}>
          <Icon size={21} strokeWidth={tab === id ? 2.6 : 2} />
        </button>
      ))}
      <div style={{ flex: 1 }} />
      {activeLeague && (
        <div title={activeLeague.name} style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--lime)",
          color: "var(--lime-fg)", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 13 }}>
          {(activeLeague.name || "?").trim().charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: интеграция в оболочку PadelLeague**

В `src/PadelLeague.jsx`: импорт вверху (рядом с прочими импортами компонентов):
```js
import { useIsWide } from "./components/wide/wide";
import WideRail from "./components/wide/WideRail";
```
В теле `PadelLeague` (рядом с `const [tab, setTab]`): `const isWide = useIsWide();`

Заменить оболочку (якорь — строка `<div style={{ maxWidth: 460, margin: "0 auto", padding: "10px 16px calc(88px + env(safe-area-inset-bottom))" }}>`):

```jsx
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {isWide && <WideRail tab={tab} goTab={goTab} session={session} activeLeague={activeLeague} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={isWide
            ? { maxWidth: 1200, margin: "0 auto", padding: "14px 20px 40px" }
            : { maxWidth: 460, margin: "0 auto", padding: "10px 16px calc(88px + env(safe-area-inset-bottom))" }}>
```
(закрыть добавленные два `</div>` после контейнера вкладок, ПЕРЕД `<nav`). Нижний nav обернуть: `{!isWide && (<nav …существующий…</nav>)}`.

- [ ] **Step 4: build + eslint**

Run: `cd /root/padel-app && NODE_OPTIONS=--max-old-space-size=512 npm run build && NODE_OPTIONS=--max-old-space-size=512 npx eslint src/PadelLeague.jsx src/components/wide/ 2>&1 | grep -E "error" || echo OK`
Expected: сборка ок, `OK` (0 errors).

- [ ] **Step 5: Playwright-проверка**

390×844: нижний nav есть, рейла нет, вкладки работают (эталон не изменился). 1024×768: рейл слева (4 иконки при сессии), нижнего nav нет, переключение вкладок по иконкам работает, контент центрирован шире 460.

- [ ] **Step 6: commit** — `git add -A && git commit -m "wide: инфраструктура — useIsWide, WideRail, оболочка PadelLeague"`

---

### Task 2: WideSplit + EmptyDetail + вкладка Игры

**Files:**
- Create: `src/components/wide/WideSplit.jsx`
- Create: `src/components/wide/EmptyDetail.jsx`
- Modify: `src/PadelLeague.jsx` — компонент `Games` (якорь: `if (mode === "view") {` ~строка 2208) и рендер вкладки (передать `wide`).

**Interfaces:**
- Produces: `WideSplit({ list, detail, empty })`; `EmptyDetail({ icon, title, sub, children })` — базовая заглушка-сводка.
- Consumes: `useIsWide` из Task 1.

- [ ] **Step 1: создать `src/components/wide/WideSplit.jsx`**

```jsx
// WideSplit — две колонки на wide: список 340px + деталь. Деталь-компоненты
// телефона рендерятся как есть, колонкой ≤560px (Global Constraint).
import React from "react";

export default function WideSplit({ list, detail, empty }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
      <div style={{ minWidth: 0 }}>{list}</div>
      <div style={{ minWidth: 0, position: "sticky", top: 12 }}>
        <div style={{ maxWidth: 560 }}>{detail || empty || null}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: создать `src/components/wide/EmptyDetail.jsx`**

```jsx
// EmptyDetail — пустое состояние правой колонки. ТОЛЬКО из уже загруженных
// данных (Global Constraint: без новых запросов) — данные передаются пропсами.
import React from "react";

export default function EmptyDetail({ icon = "👈", title, sub, children }) {
  return (
    <div style={{ border: "1.5px dashed var(--line)", borderRadius: 18, padding: "28px 22px",
      textAlign: "center", color: "var(--mut)" }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>{icon}</div>
      {title && <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)", marginBottom: 4 }}>{title}</div>}
      {sub && <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{sub}</div>}
      {children}
    </div>
  );
}
```

- [ ] **Step 3: вкладка Игры — wide-режим**

В `PadelLeague.jsx` компонент `Games`: добавить `const isWide = useIsWide();` в начало. Якорь (существующий код):
```js
  if (mode === "view") {
    const g = games.find((x) => x.id === selId);
    if (!g) { setMode("list"); return null; }
    return <GameCard key={g.id} game={g} ... />;
  }
```
Заменить на паттерн «деталь-как-значение» (телефонный путь не меняется — ранний return при `!isWide`):
```js
  const detailEl = (() => {
    if (mode !== "view") return null;
    const g = games.find((x) => x.id === selId);
    if (!g) return null;
    return <GameCard key={g.id} game={g} groupId={groupId} profileId={profileId} isAdmin={isAdmin}
      back={backToList} reloadGames={loadGames} reloadLeaderboard={reloadLeaderboard}
      bumpArchive={bumpArchive} players={players} />;
  })();
  if (mode === "view" && !detailEl) { setMode("list"); return null; }
  if (mode === "view" && !isWide) return detailEl;
```
Существующий финальный `return (списочный JSX)` обернуть: присвоить в `const listEl = (…как было…)`, затем:
```js
  if (isWide) return <WideSplit list={listEl} detail={detailEl}
    empty={<EmptyDetail icon="⚔️" title={t("tab_games")} sub={t("wide_pick_game")} />} />;
  return listEl;
```
Импорты `WideSplit`, `EmptyDetail` — вверху файла. i18n-ключи (ru/en/es, в `src/lib/locales/*` рядом с mix_*): `wide_pick_game: 'Выбери игру слева — афиша и счёт откроются здесь' / 'Pick a game on the left — its page opens here' / 'Elige una partida a la izquierda — se abrirá aquí'`, и сразу добавить будущие: `wide_pick_tour`, `wide_pick_player`, `wide_pick_event` (аналогичные тексты про турнир/игрока/событие).

- [ ] **Step 4: build + eslint** (как Task 1 Step 4). Expected: чисто.

- [ ] **Step 5: Playwright**

390: открыть игру — деталь замещает список (эталон), «назад» работает. 1024: тап по игре в списке — деталь справа, список остался; «К списку» в детали очищает выбор → EmptyDetail; счёт вводится в правой колонке.

- [ ] **Step 6: commit** — `"wide: WideSplit/EmptyDetail + двухколонник вкладки Игры"`

---

### Task 3: вкладка Турниры — wide-режим

**Files:**
- Modify: `src/components/Tournaments.jsx` — главный компонент (якорь: `if (mode === "view") return <TournamentView id={activeId} …` строка ~187).

**Interfaces:** Consumes `useIsWide`, `WideSplit`, `EmptyDetail` (импорт из `./wide/…` относительно components).

- [ ] **Step 1: применить тот же паттерн, что в Task 2**

`const isWide = useIsWide();` в начале компонента `Tournaments`. Деталь-как-значение:
```js
  const detailEl = mode === "view"
    ? <TournamentView id={activeId} players={players} back={() => setMode("list")} isGroupMember={!!groupId}
        currentProfileId={profileId} onArchiveChange={bumpArchive} isAdmin={isAdmin}
        membersCanCreate={membersCanCreate} onOpenPlayer={onOpenPlayer} />
    : null;
  if (mode === "view" && !isWide) return detailEl;
```
Список — в `const listEl`, финал:
```js
  if (isWide) return <WideSplit list={listEl} detail={detailEl}
    empty={<EmptyDetail icon="🏆" title={tr("tab_tournaments")} sub={tr("wide_pick_tour")} />} />;
  return listEl;
```
ВНИМАНИЕ: `mode === "create"`-ветка (мастер создания) остаётся ранним return БЕЗ обёртки — мастер и на wide занимает всю ширину контента (осознанно, форма длинная).

- [ ] **Step 2: build + eslint.** Expected: чисто.
- [ ] **Step 3: Playwright** — 390 эталон; 1024: выбор турнира → деталь справа (афиша+корты+таблица в колонке ≤560), список виден; создание турнира открывается во всю ширину.
- [ ] **Step 4: commit** — `"wide: двухколонник вкладки Турниры"`

---

### Task 4: вкладка Друзья (Board) — wide-режим

**Files:**
- Modify: `src/PadelLeague.jsx` — компонент `Board` (якорь выбора: `<PlayerDetail key={selected.id}` ~строка 631; найти окружающий `if (selected) return …`).

- [ ] **Step 1: паттерн деталь-как-значение для Board**

`const isWide = useIsWide();`. Существующий ранний return `if (selected) return <PlayerDetail …/>` переписать:
```js
  const detailEl = selected
    ? <PlayerDetail key={selected.id} groupId={groupId} player={selected} players={players}
        close={() => setSelected(null)} onOpenPlayer={setSelected} /* + остальные существующие пропсы этого вызова БЕЗ изменений */ />
    : null;
  if (selected && !isWide) return detailEl;
```
(скопировать ВЕСЬ существующий набор пропсов вызова PlayerDetail — там есть onDelete/isAdmin/onAddToLeague и др.; менять только форму, не состав).
Список Board — в `const listEl = (…существующий return…)`; финал:
```js
  if (isWide) return <WideSplit list={listEl} detail={detailEl}
    empty={<EmptyDetail icon="👥" title={t("tab_friends")} sub={t("wide_pick_player")} />} />;
  return listEl;
```

- [ ] **Step 2: build + eslint.** - [ ] **Step 3: Playwright** — 390 эталон (профиль замещает); 1024: тап по игроку → профиль справа, таблица остаётся; закрытие → EmptyDetail. - [ ] **Step 4: commit** — `"wide: двухколонник вкладки Друзья"`

---

### Task 5: вкладка История — wide-режим

**Files:**
- Modify: `src/PadelLeague.jsx` — `HistoryView` (якоря: строки ~3093–3094 `if (sel?.type === "tour") return …; if (sel?.type === "game") return …`).

- [ ] **Step 1: тот же паттерн**

```js
  const isWide = useIsWide();
  const detailEl = sel?.type === "tour"
    ? <TournamentView id={sel.data.id} players={players} back={backFromSel} isGroupMember={isGroupMember}
        currentProfileId={profileId} onArchiveChange={bumpArchive} onOpenPlayer={onOpenPlayer} />
    : sel?.type === "game"
      ? <GameCard key={sel.data.id} game={sel.data} groupId={groupId} profileId={profileId} isAdmin={isAdmin}
          back={backFromSel} reloadGames={load} reloadLeaderboard={() => {}} bumpArchive={bumpArchive} players={players} />
      : null;
  if (sel && !isWide) return detailEl;
```
Лента — `listEl`; финал `if (isWide) return <WideSplit … empty={<EmptyDetail icon="🕘" title={t("tab_history")} sub={t("wide_pick_event")} />} />`.
Учесть существующий `useEffect(() => { if (!sel) load(); …})` — поведение не менять.

- [ ] **Step 2: build + eslint.** - [ ] **Step 3: Playwright** — 390 эталон; 1024: событие → деталь справа. - [ ] **Step 4: commit** — `"wide: двухколонник вкладки История"`

---

### Task 6: ТВ-табло — компонент + кнопка в афише турнира

**Files:**
- Create: `src/components/TvBoard.jsx`
- Modify: `src/components/Tournaments.jsx` — afisha `.trp-actions` (кнопка «📺» рядом с «Ссылка», якорь строка ~965) + состояние `tvOpen`.

**Interfaces:**
- Produces: `TvBoard({ code = null, initial = null, onClose = null })` — если `initial` (trnData) задан, рендерит его и НЕ поллит (реалтайм родителя обновит через prop); если задан только `code` — сам поллит `getTournamentByCode(code)` каждые 12с.
- Consumes: `getTournamentByCode` (`../lib/tournamentApi`), `detailedStandings`, `pairStandings` (`../lib/americano`), `fmtById` (`./Tournaments`).

- [ ] **Step 1: создать `src/components/TvBoard.jsx`**

```jsx
// TvBoard — полноэкранное табло турнира (ТВ клуба / планшет на стойке).
// Два режима: initial (ин-апп, данные от родителя) и code (публичный /tv/CODE,
// поллинг публичного RPC — реалтайм анониму не гарантирован).
import React, { useEffect, useMemo, useState } from "react";
import { getTournamentByCode } from "../lib/tournamentApi";
import { detailedStandings, pairStandings } from "../lib/americano";
import { fmtById } from "./Tournaments";
import { t as tr } from "../lib/i18n";

export default function TvBoard({ code = null, initial = null, onClose = null }) {
  const [t, setT] = useState(initial);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  useEffect(() => { if (initial) setT(initial); }, [initial]);
  useEffect(() => {
    if (!code || initial) return;
    let alive = true;
    const load = () => getTournamentByCode(code)
      .then((d) => { if (alive && d) { setT(d); setFetchedAt(Date.now()); } }).catch(() => {});
    load();
    const id = setInterval(load, 12000);
    return () => { alive = false; clearInterval(id); };
  }, [code, initial]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fmt = t ? fmtById(t.format) : null;
  const isPairFmt = !!fmt && fmt.category === "pair" && t.format !== "beat_the_box";
  const table = useMemo(() => {
    if (!t) return [];
    return isPairFmt ? pairStandings(t.players || [], t.matches || [])
                     : detailedStandings(t.players || [], t.matches || []);
  }, [t, isPairFmt]);
  const round = useMemo(() => (t?.matches || []).reduce((m, x) => Math.max(m, x.round_number || 0), 0), [t]);
  const courts = useMemo(() => (t?.matches || []).filter((m) => (m.round_number || 0) === round), [t, round]);
  const nameOf = (id) => (t?.players || []).find((p) => p.id === id)?.name || "—";
  const staleMin = Math.floor((Date.now() - fetchedAt) / 60000);

  if (!t) return <div style={S.root}><div style={{ color: "var(--mut)" }}>{tr("loading")}</div></div>;
  return (
    <div style={S.root}>
      <div style={S.top}>
        <span style={S.eyebrow}>🏆 {t.name || fmt.name} · {tr("trn_hero_round").replace("{a}", String(round)).replace("{b}", "")} </span>
        {code && staleMin > 1 && <span style={{ color: "var(--mut)", fontSize: "1.4vmin" }}>обновлено {staleMin} мин назад</span>}
        {onClose && <button onClick={onClose} style={S.close}>✕</button>}
      </div>
      <div style={S.body}>
        <div style={S.courts}>
          {courts.map((m) => (
            <div key={m.id} style={S.court}>
              <div style={S.courtLabel}>{t.court_names?.[String(m.court)] || `${tr("court_label")} ${m.court}`}</div>
              <div style={S.teams}>{nameOf(m.team_a?.[0])} & {nameOf(m.team_a?.[1])} — {nameOf(m.team_b?.[0])} & {nameOf(m.team_b?.[1])}</div>
              <div style={S.score}>{m.score_a ?? 0}<span style={{ color: "#8fa3c8" }}> : </span>{m.score_b ?? 0}</div>
            </div>
          ))}
        </div>
        <div style={S.tablePane}>
          <div style={S.th}>{tr("trn_pairs")} / {tr("rating")}</div>
          {table.slice(0, 10).map((r, i) => (
            <div key={r.id || i} style={{ ...S.trow, background: i === 0 ? "color-mix(in srgb, var(--lime) 10%, transparent)" : "none" }}>
              <span style={{ width: "3vmin", color: i === 0 ? "var(--lime)" : "var(--mut)", fontWeight: 800 }}>{i + 1}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || (r.names || []).join(" & ")}</span>
              <span style={{ fontWeight: 900, color: i === 0 ? "var(--lime)" : "var(--ink)" }}>{r.points}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={S.foot}>padelpack.app/t/{t.invite_code}</div>
    </div>
  );
}

const S = {
  root: { position: "fixed", inset: 0, zIndex: 500, display: "flex", flexDirection: "column",
    background: "linear-gradient(160deg,#12american2a20 0%, #0a1612 70%)", color: "var(--ink)",
    fontFamily: "'Outfit',sans-serif", padding: "3vmin 4vmin" },
  top: { display: "flex", alignItems: "center", gap: "2vmin" },
  eyebrow: { color: "var(--lime)", fontWeight: 900, fontSize: "2.6vmin", letterSpacing: ".2vmin", textTransform: "uppercase", flex: 1 },
  close: { background: "rgba(255,255,255,.08)", border: "1px solid var(--line)", color: "var(--ink)",
    borderRadius: "1.2vmin", fontSize: "2.2vmin", padding: ".6vmin 1.4vmin", cursor: "pointer" },
  body: { flex: 1, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "3vmin", marginTop: "2.5vmin", minHeight: 0 },
  courts: { display: "flex", flexDirection: "column", gap: "2.5vmin", minHeight: 0 },
  court: { flex: 1, borderRadius: "2vmin", background: "linear-gradient(180deg,#2e5cb8,#274e9e)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1vmin",
    boxShadow: "inset 0 0 0 .3vmin rgba(255,255,255,.2)", position: "relative" },
  courtLabel: { position: "absolute", top: "1.2vmin", fontSize: "1.6vmin", fontWeight: 800, letterSpacing: ".25vmin",
    background: "rgba(0,0,0,.4)", borderRadius: "3vmin", padding: ".4vmin 1.6vmin" },
  teams: { fontSize: "1.9vmin", fontWeight: 700, color: "#e6ecff", padding: "0 2vmin", textAlign: "center" },
  score: { background: "#0c1524", borderRadius: "1.6vmin", padding: "1vmin 3vmin", fontWeight: 900, fontSize: "6vmin",
    fontVariantNumeric: "tabular-nums" },
  tablePane: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "2vmin",
    padding: "2vmin", overflow: "hidden", display: "flex", flexDirection: "column", gap: ".6vmin" },
  th: { fontSize: "1.5vmin", fontWeight: 800, letterSpacing: ".25vmin", textTransform: "uppercase", color: "var(--mut)", marginBottom: ".8vmin" },
  trow: { display: "flex", alignItems: "center", gap: "1.4vmin", fontSize: "2.4vmin", fontWeight: 600,
    borderRadius: "1vmin", padding: ".7vmin 1vmin" },
  foot: { textAlign: "center", color: "var(--mut)", fontSize: "1.6vmin", fontWeight: 700, letterSpacing: ".15vmin", marginTop: "1.5vmin" },
};
```
ВНИМАНИЕ: строка `background: "linear-gradient(160deg,#12american2a20 …` — опечатка-ловушка, писать `#122a20`. Проверить `fmt.category === "pair"` — точное условие взять как в Tournaments.jsx строка ~799 (`fmt.category === "pair" && !isBtb`).

- [ ] **Step 2: кнопка «📺 Табло» в афише турнира**

`Tournaments.jsx`: `const [tvOpen, setTvOpen] = useState(false);` в TournamentView; в `.trp-actions` (перед кнопкой «Ссылка»):
```jsx
{trnData.status === "active" && (
  <button className="trp-act" onClick={() => setTvOpen(true)} aria-label="TV">📺</button>
)}
```
и в конце JSX TournamentView: `{tvOpen && <TvBoard initial={trnData} onClose={() => setTvOpen(false)} />}` (лениво: `const TvBoard = lazy(() => import("./TvBoard"))` + `<Suspense fallback={null}>`).

- [ ] **Step 3: build + eslint.** - [ ] **Step 4: Playwright** — активный турнир → кнопка 📺 → полноэкранное табло (корты + таблица), Esc/✕ закрывает; счёт из realtime родителя обновляет табло. - [ ] **Step 5: commit** — `"тв-табло: компонент TvBoard + кнопка в афише турнира"`

---

### Task 7: публичный маршрут `/tv/CODE`

**Files:**
- Modify: `src/App.jsx` — добавить парсер и ранний return (рядом с `getTournamentCode`, строки ~73–76 и ранними return'ами ~594).

- [ ] **Step 1: парсер + маршрут**

Рядом с существующими парсерами (НЕ меняя их):
```js
const getTvCode = () => {
  const m = window.location.pathname.match(/^\/tv\/([A-Za-z0-9]{4,12})$/i);
  return m ? m[1] : null;
};
```
`const TvBoard = lazy(() => import("./components/TvBoard"));` (рядом с прочими lazy).
В теле App: `const tvCode = getTvCode();` и ранний return ПЕРЕД блоком `/l/CODE` (строка ~582):
```jsx
  if (tvCode) return (
    <Suspense fallback={routeSpinner}>
      <TvBoard code={tvCode} />
    </Suspense>
  );
```
(`routeSpinner` уже определён выше по файлу — return вставить ПОСЛЕ его объявления.)

- [ ] **Step 2: build + eslint.** - [ ] **Step 3: Playwright** — открыть `/tv/CODE` активного демо-турнира БЕЗ логина (почистить localStorage): табло рендерится, через ≤15с подтягивает изменение счёта (поменять счёт из другой вкладки под логином). Существующие `/t/ /j/ /l/ /r/` работают как раньше. - [ ] **Step 4: commit** — `"тв-табло: публичный маршрут /tv/CODE (поллинг публичного RPC)"`

---

### Task 8: морфинг рейла ≥1280 + инспектор-шасси за флагом + финальный смок

**Files:**
- Modify: `src/components/wide/wide.js` (+`useRailExpanded`), `src/components/wide/WideRail.jsx` (режим expanded), `src/PadelLeague.jsx` (прокинуть), Create: `src/components/wide/InspectorPanel.jsx`. Modify: `RELEASES.md`.

- [ ] **Step 1: `useRailExpanded` в wide.js**

```js
export function useRailExpanded() {
  const [exp, setExp] = useState(() => {
    try { return localStorage.getItem("pp_rail_exp") === "1"; } catch (e) { return false; }
  });
  const toggle = () => setExp((v) => { const n = !v; try { localStorage.setItem("pp_rail_exp", n ? "1" : "0"); } catch (e) {} return n; });
  const [canExpand, setCanExpand] = useState(() => window.matchMedia("(min-width: 1280px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const on = (e) => setCanExpand(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return { expanded: exp && canExpand, canExpand, toggle };
}
```

- [ ] **Step 2: WideRail expanded-режим**

Пропсы `expanded, canExpand, onToggleExpand`. При `expanded`: ширина 244, кнопки — строкой `[иконка][подпись]` (тот же массив items, подпись `label` рядом), лига внизу — кружок+имя. Кнопка-гамбургер `≡` над списком видна при `canExpand`, зовёт `onToggleExpand`. Анимация: `transition: "width .18s"` на корневом div. В PadelLeague: `const rail = useRailExpanded();` и `<WideRail … expanded={rail.expanded} canExpand={rail.canExpand} onToggleExpand={rail.toggle} />`.

- [ ] **Step 3: InspectorPanel-шасси (за флагом, по умолчанию ВЫКЛ)**

```jsx
// InspectorPanel — шасси премиум-инспектора (спека: v1 за флагом, наполнение — проект
// «премиум-аналитика»). Флаг: localStorage.pp_inspector === "1".
import React from "react";

export const inspectorEnabled = () => {
  try { return localStorage.getItem("pp_inspector") === "1"; } catch (e) { return false; }
};

export default function InspectorPanel({ context }) {
  if (!inspectorEnabled()) return null;
  return (
    <div style={{ width: 300, flexShrink: 0, borderLeft: "1.5px dashed color-mix(in srgb, var(--yellow) 45%, transparent)",
      padding: "14px 14px", minHeight: "60vh" }}>
      <div style={{ color: "var(--yellow)", fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>✦ PRO · скоро</div>
      <div style={{ color: "var(--mut)", fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
        Контекст: {context || "—"}. Наполнение — этап «премиум-аналитика».
      </div>
    </div>
  );
}
```
Монтаж: в PadelLeague wide-обёртке после контент-колонки: `{isWide && <InspectorPanel context={tab} />}` (рендерит null при выключенном флаге — влияния нет).

- [ ] **Step 4: build + eslint.**
- [ ] **Step 5: финальный Playwright-смок**

390 (полный телефонный эталон: 4 вкладки, деталь, назад, создание), 1024 (рейл иконками, сплит на 4 вкладках), 1366 (гамбургер → сайдбар с подписями, состояние переживает reload), `/tv/CODE` гостем, `localStorage.pp_inspector="1"` → жёлтая панель появляется, флаг снят → исчезает. Обе темы на 1024.

- [ ] **Step 6: RELEASES.md** — в «Ожидает релиза» добавить пункт «Широкоэкранная версия v1 (рейл+сплит+ТВ-табло /tv/CODE; инспектор за флагом)».
- [ ] **Step 7: commit** — `"wide: морфинг рейла ≥1280, инспектор-шасси за флагом, RELEASES"`

---

### Task 9: гостевой WelcomeScreen на широком экране

Добавлено по запросу пользователя 2026-07-22: первый экран веба для незалогиненного
не должен оставаться узкой телефонной колонкой на десктопе.

**Files:**
- Modify: `src/components/WelcomeScreen.jsx` (отдельный lazy-чанк гостя — Perf-путь
  не менять: никаких новых импортов тяжёлых модулей, только вёрстка/CSS).

**Требования:**
- ≥900px: двухколонный hero — слева заголовок/теглайн/CTA («Войти», «Подробнее о
  PadelPack»), справа существующий превью-блок (демо-тизер), выровненные по центру
  экрана, max-width ~1040px; крупнее кегль заголовка (clamp).
- <900px: рендер байт-в-байт как сейчас (медиазапрос/`useIsWide`-подобный matchMedia
  локально в файле — НЕ импортировать `components/wide/wide.js`, чтобы не тянуть
  чанк PadelLeague в гостевой путь; допустим дубль 10-строчного хука или чистый CSS
  `@media` в `<style>`).
- Lighthouse guest Perf не должен упасть (память: perf-guest-path — гость грузит
  лёгкий WelcomeScreen; проверить размер чанка до/после, дельта ≤ +2KB).
- Проверка: Playwright 390 (эталон) и 1366 (двухколонный hero, CTA работает —
  открывает LoginScreen); `npm run build` размер чанка WelcomeScreen в выводе.
- Commit: `wide: гостевой WelcomeScreen — двухколонный hero на десктопе`.

## Self-review (выполнен)

- Покрытие спеки: раскладка/брейкпоинты — Tasks 1,8; 4 вкладки — Tasks 2–5; пустые состояния — Tasks 2–5 (EmptyDetail, без новых запросов); ТВ-режим кнопка+`/tv/` — Tasks 6–7; инспектор-шасси — Task 8; «телефон не меняется» — проверка 390px в каждой задаче. Спековский пункт «стек внутри детали» покрыт существующим механизмом (`prof`-стейт внутри GameCard/TournamentView уже регистрирует back) — отдельной задачи не требует, проверяется в смоках Task 2–3.
- Плейсхолдеров нет; сигнатуры `WideSplit/EmptyDetail/TvBoard/useIsWide/useRailExpanded` согласованы между задачами.
- Отступление от TDD-шаблона скилла осознанно: в репо нет тест-фреймворка (CLAUDE.md) — каждая задача несёт build+eslint+Playwright-проверки вместо юнит-тестов.
