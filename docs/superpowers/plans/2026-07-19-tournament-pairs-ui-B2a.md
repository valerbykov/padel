# Турнир: запись парами — B2a (публичная запись на /t/CODE) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На публичной странице `/t/CODE` дать записываться ПАРАМИ: ростер сгруппирован по парам, у открытой пары «X ищет напарника» → «Встать напарником», плюс «Создать пару»; поддержать персональную ссылку `/t/CODE?pair=N`.

**Architecture:** Бэкенд/жеребьёвка уже принимают `pair_no` (Часть A): `joinTournamentByCode(code, name, pairNo)` → RPC. Единственная серверная правка здесь — добавить `pair_no` в агрегат `players` RPC `get_tournament_by_code` (иначе аноним его не видит). Плюс общий хелпер группировки `src/lib/pairs.js` и переработка карточки записи в `TournamentJoin.jsx`. Организаторская часть (ин-апп лобби, старт-гейт, таблица) — отдельный план **B2b**.

**Tech Stack:** Vite + React 18 (plain JS); Supabase RPC; i18n ru/en/es.

## Global Constraints

- Node heap: префикс `NODE_OPTIONS=--max-old-space-size=512`. Билд OOM — всплыть, не поднимать молча.
- Plain JS, no TS. Комментарии по-русски. **Никакого литерального текста в JSX — только `tr("ключ")`** (ESLint-гейт).
- Тест-фреймворка НЕТ: гейт — `npm run build` `✓ built` + node-смоук чистых функций.
- Миграция на ПРОД через Supabase MCP (`apply_migration`, проект `ofewhhcwswjxvlqsygxu`) + дубль `.sql` в `migrations/`.
- Парные форматы = `king_of_hill`, `round_robin`. НЕ деплоить (батч). Коммитить только файлы таска (в дереве есть посторонние правки — не трогать).

---

### Task 1: Миграция — `pair_no` в `get_tournament_by_code`

**Files:**
- Create: `migrations/2026-07-19_get_tournament_by_code_pair_no.sql`
- Apply: Supabase MCP `apply_migration`

**Interfaces:**
- Produces: RPC `get_tournament_by_code` теперь отдаёт `pair_no` у каждого игрока в `players`.

- [ ] **Step 1: Написать миграцию** (это полная текущая функция + одна новая строка `'pair_no', tp.pair_no,`)

Создать `migrations/2026-07-19_get_tournament_by_code_pair_no.sql`:
```sql
-- Добавляем pair_no в агрегат players (иначе аноним на /t/CODE не видит пары).
create or replace function public.get_tournament_by_code(p_code text)
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select to_jsonb(t) - 'group_id' - 'created_by' || jsonb_build_object(
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tp.id, 'profile_id', tp.profile_id, 'name', tp.name,
        'pair_no', tp.pair_no,
        'created_at', tp.created_at,
        'avatar_url', p.avatar_url
      ) order by tp.created_at)
      from tournament_players tp
      left join profiles p on p.id = tp.profile_id
      where tp.tournament_id = t.id
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'round_number', m.round_number, 'court', m.court,
        'team_a', m.team_a, 'team_b', m.team_b, 'score_a', m.score_a, 'score_b', m.score_b
      ) order by m.round_number, m.court)
      from tournament_matches m where m.tournament_id = t.id
    ), '[]'::jsonb)
  )
  from tournaments t where t.invite_code = upper(p_code) limit 1;
$function$;
```

- [ ] **Step 2: Применить на прод** — `apply_migration` name `get_tournament_by_code_pair_no`, query = файл. Expected `{"success":true}`.

- [ ] **Step 3: Проверить** — `execute_sql`:
```sql
select (pg_get_functiondef(oid) like '%''pair_no'', tp.pair_no%') as has_pair_no
from pg_proc where proname = 'get_tournament_by_code';
```
Expected: `has_pair_no = true`.

- [ ] **Step 4: Commit**
```bash
git add migrations/2026-07-19_get_tournament_by_code_pair_no.sql
git commit -m "миграция: pair_no в get_tournament_by_code (пары видны анониму на /t/CODE)"
```

---

### Task 2: i18n-ключи записи парами

**Files:**
- Modify: `src/lib/i18n.js` (ru после `trn_contact_link_ph`; en/es аналогично)

**Interfaces:**
- Produces: `trn_pairs`, `trn_create_pair`, `trn_join_partner`, `trn_looking_partner`, `trn_pair_you_in` во всех локалях.

- [ ] **Step 1: RU** — найти строку с `trn_contact_link_ph: 'Телеграм / телефон / ссылка',` и добавить сразу после:
```js
    trn_pairs: 'Пары', trn_create_pair: 'Создать пару', trn_join_partner: 'Встать напарником', trn_looking_partner: 'ищет напарника', trn_pair_you_in: 'Ты в паре',
```
- [ ] **Step 2: EN** — после `trn_contact_link_ph: 'Telegram / phone / link',`:
```js
    trn_pairs: 'Pairs', trn_create_pair: 'Create a pair', trn_join_partner: 'Join as partner', trn_looking_partner: 'looking for a partner', trn_pair_you_in: "You're paired",
```
- [ ] **Step 3: ES** — после `trn_contact_link_ph: 'Telegram / teléfono / enlace',`:
```js
    trn_pairs: 'Parejas', trn_create_pair: 'Crear pareja', trn_join_partner: 'Unirse de pareja', trn_looking_partner: 'busca pareja', trn_pair_you_in: 'Estás emparejado',
```
- [ ] **Step 4: Verify** — `grep -c "trn_join_partner\|trn_looking_partner\|trn_create_pair" src/lib/i18n.js` → `9`; затем `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 5: Commit**
```bash
git add src/lib/i18n.js
git commit -m "i18n: ключи записи парами (ru/en/es)"
```

---

### Task 3: Хелпер группировки пар `src/lib/pairs.js`

**Files:**
- Create: `src/lib/pairs.js`
- Test: `scratchpad/smoke-pairs.mjs` (временный)

**Interfaces:**
- Produces: `groupPairs(players)` → `{ pairs: [{pair_no, members:[p,…]}] (по возр. pair_no), pool: [p без pair_no] }`; `nextPairNo(players)` → `max(pair_no)+1`; `openPairs(players)` → пары с < 2 участниками; `allPaired(players)` → bool (нет пула, все пары полные, ≥1 пара).

- [ ] **Step 1: Смоук (упадёт)** — `scratchpad/smoke-pairs.mjs`:
```js
import assert from "node:assert/strict";
import { groupPairs, nextPairNo, openPairs, allPaired } from "/root/padel-app/src/lib/pairs.js";

const players = [
  { id: "a", name: "Аня", pair_no: 1 }, { id: "b", name: "Игорь", pair_no: 1 },
  { id: "c", name: "Лена", pair_no: 2 }, // открытая пара
  { id: "d", name: "Олег", pair_no: null }, // без пары
];
const { pairs, pool } = groupPairs(players);
assert.equal(pairs.length, 2, "2 пары");
assert.equal(pairs[0].members.length, 2, "пара 1 полная");
assert.equal(pairs[1].members.length, 1, "пара 2 открытая");
assert.equal(pool.length, 1, "1 без пары");
assert.equal(nextPairNo(players), 3, "следующий номер 3");
assert.equal(openPairs(players).length, 1, "1 открытая");
assert.equal(allPaired(players), false, "не все в парах");
assert.equal(allPaired([{ id: "a", pair_no: 1 }, { id: "b", pair_no: 1 }]), true, "все в парах");
console.log("OK smoke-pairs");
```
- [ ] **Step 2: Run — упадёт** — `NODE_OPTIONS=--max-old-space-size=512 node /tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-pairs.mjs` → FAIL (нет модуля).
- [ ] **Step 3: Реализовать** — создать `src/lib/pairs.js`:
```js
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
```
- [ ] **Step 4: Run — пройдёт** — та же команда → `OK smoke-pairs`. Затем `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`. Удалить смоук: `rm -f /tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-pairs.mjs`.
- [ ] **Step 5: Commit**
```bash
git add src/lib/pairs.js
git commit -m "lib/pairs: группировка ростера по парам (groupPairs/nextPairNo/openPairs/allPaired)"
```

---

### Task 4: `TournamentJoin.jsx` — запись парами на `/t/CODE`

**Files:**
- Modify: `src/components/TournamentJoin.jsx` (`join()` ~108-123; ростер-блок ~180-207; join-кнопка ~209-225; импорты)

**Interfaces:**
- Consumes: `groupPairs` (Task 3); `joinTournamentByCode(code, name, pairNo)` (Часть A); `t.players[].pair_no` (Task 1); ключи Task 2.
- Produces: для парного формата — ростер по парам + «Встать напарником»/«Создать пару»; `?pair=N` таргетинг.

- [ ] **Step 1: Импорт хелпера**

В `src/components/TournamentJoin.jsx` после строки `import { usePublicChrome, PublicToggles, plural } from "./publicChrome";` добавить:
```jsx
import { groupPairs } from "../lib/pairs";
```

- [ ] **Step 2: Обобщить `join()` под `pairNo` + прочитать `?pair=N`**

Заменить `join` (строки ~108-123):
```jsx
  const join = async () => {
    const display = session ? (profileName || tr("guest_default_name")) : name.trim();
    if (!session && !name.trim()) return;
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const res = await joinTournamentByCode(code, display);
      setJoined(true);
      setJoinNote(res?.already ? tr("tj_already") : res?.linked ? tr("tj_linked") : "");
      await load();
    }
    catch (e) {
      const map = { tournament_full: tr("err_tour_full"), tournament_closed: tr("err_tour_closed"), tournament_not_found: tr("err_tour_not_found") };
      setErr(map[e.message] || tr("err_join"));
    } finally { setBusy(false); }
  };
```
на:
```jsx
  // pairNo: null — solo или «создать пару» (RPC сам решит по формату); N — встать в пару N.
  const join = async (pairNo = null) => {
    const display = session ? (profileName || tr("guest_default_name")) : name.trim();
    if (!session && !name.trim()) return;
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const res = await joinTournamentByCode(code, display, pairNo);
      setJoined(true);
      setJoinNote(res?.already ? tr("tj_already") : res?.linked ? tr("tj_linked") : "");
      await load();
    }
    catch (e) {
      const map = { tournament_full: tr("err_tour_full"), tournament_closed: tr("err_tour_closed"), tournament_not_found: tr("err_tour_not_found"), pair_full: tr("err_tour_full"), pair_not_found: tr("err_join") };
      setErr(map[e.message] || tr("err_join"));
    } finally { setBusy(false); }
  };
```

Затем добавить чтение `?pair=N` и признак парного формата. Сразу ПОСЛЕ строки `const canEdit = ...` (около 126) добавить:
```jsx
  const isPair = !!t && (t.format === "king_of_hill" || t.format === "round_robin");
  const targetPair = (() => { try { const v = new URLSearchParams(window.location.search).get("pair"); return v && /^\d+$/.test(v) ? Number(v) : null; } catch (e) { return null; } })();
```

- [ ] **Step 3: Ростер по парам (для парных форматов)**

Найти блок-IIFE ростера (строки ~180-207, начинается с `{/* Кто уже записан … */}` и `const players = t.players || [];`). Заменить ВЕСЬ этот IIFE на:
```jsx
                {/* Ростер: для парных форматов — по парам, иначе плоские чипы */}
                {isPair ? (() => {
                  const { pairs, pool } = groupPairs(t.players || []);
                  const filled = (t.players || []).length;
                  const pct = t.target_size ? Math.round((filled / t.target_size) * 100) : 0;
                  const chip = (p) => (
                    <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px 4px 4px", borderRadius: 999, background: "var(--surface2)", border: "1px solid var(--line)", fontSize: 12.5, fontWeight: 600, maxWidth: "100%", minWidth: 0 }}>
                      <img src={playerAvatar(p.profile?.avatar_url || p.avatar_url, p.profile_id || p.name)} onError={avatarFallback(p.profile_id || p.name)} onLoad={avatarOnLoad} alt=""
                        style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flexShrink: 0, ...avatarBg(p.profile_id || p.name) }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{p.name}</span>
                    </span>
                  );
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: "var(--mut)", fontWeight: 700, marginBottom: 8 }}>{tr("trn_pairs")} · {pairs.filter((pr) => pr.members.length === 2).length}/{Math.floor((t.target_size || 0) / 2)}</div>
                      {pairs.map((pr) => (
                        <div key={pr.pair_no} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                          {chip(pr.members[0])}
                          <span style={{ color: "var(--mut)", fontWeight: 700 }}>&amp;</span>
                          {pr.members.length === 2 ? chip(pr.members[1]) : (
                            <>
                              <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 11px", borderRadius: 999, border: "1.5px dashed var(--line)", color: "var(--mut)", fontSize: 12.5 }}>{tr("trn_looking_partner")}</span>
                              {!joined && <button className="tj-ghost" style={{ fontSize: 12, color: "var(--lime)" }} onClick={() => join(pr.pair_no)}>{tr("trn_join_partner")}</button>}
                            </>
                          )}
                        </div>
                      ))}
                      {pool.map((p) => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                          {chip(p)}<span style={{ fontSize: 11.5, color: "var(--mut)" }}>{tr("trn_looking_partner")}</span>
                        </div>
                      ))}
                      <div style={{ height: 6, borderRadius: 4, background: "var(--surface2)", overflow: "hidden", margin: "10px 0 4px" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "var(--lime)", transition: "width .3s" }} />
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--mut)" }}>{filled}/{t.target_size}</div>
                    </div>
                  );
                })() : (() => {
                  const players = t.players || [];
                  const freeN = Math.max(0, (t.target_size || 0) - players.length);
                  const pct = t.target_size ? Math.round((players.length / t.target_size) * 100) : 0;
                  return (
                    <>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                        {players.map((p) => (
                          <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px 4px 4px", borderRadius: 999, background: "var(--surface2)", border: "1px solid var(--line)", fontSize: 12.5, fontWeight: 600, maxWidth: "100%", minWidth: 0 }}>
                            <img src={playerAvatar(p.profile?.avatar_url || p.avatar_url, p.profile_id || p.name)} onError={avatarFallback(p.profile_id || p.name)} onLoad={avatarOnLoad} alt=""
                              style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0, ...avatarBg(p.profile_id || p.name) }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{p.name}</span>
                          </span>
                        ))}
                        {Array.from({ length: Math.min(freeN, 8) }).map((_, i) => (
                          <span key={"f" + i} style={{ display: "inline-flex", alignItems: "center", padding: "4px 11px", borderRadius: 999, border: "1.5px dashed var(--line)", color: "var(--mut)", fontSize: 12.5 }}>{tr("pub_spot_chip")}</span>
                        ))}
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: "var(--surface2)", overflow: "hidden", marginBottom: 4 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "var(--lime)", transition: "width .3s" }} />
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--mut)", marginBottom: 14 }}>
                        {players.length}/{t.target_size} · {tr("pub_spots_left").replace("{n}", String(freeN))}
                      </div>
                    </>
                  );
                })()}
```

- [ ] **Step 4: Кнопка записи — под парный формат**

Найти join-кнопку (строки ~223-225):
```jsx
                <button className="tj-btn" disabled={(!session && !name.trim()) || busy} onClick={join}>
                  {busy ? tr("pub_joining") : tr("pub_join_trn")}
                </button>
```
Заменить на:
```jsx
                {isPair ? (
                  <button className="tj-btn" disabled={(!session && !name.trim()) || busy} onClick={() => join(targetPair)}>
                    {busy ? tr("pub_joining") : (targetPair ? tr("trn_join_partner") : tr("trn_create_pair"))}
                  </button>
                ) : (
                  <button className="tj-btn" disabled={(!session && !name.trim()) || busy} onClick={() => join()}>
                    {busy ? tr("pub_joining") : tr("pub_join_trn")}
                  </button>
                )}
```

- [ ] **Step 5: Сборка**

Run: `NODE_OPTIONS=--max-old-space-size=512 npm run build`
Expected: `✓ built`.

- [ ] **Step 6: Commit**
```bash
git add src/components/TournamentJoin.jsx
git commit -m "приглашение /t/CODE: запись парами (ростер по парам, встать напарником, ?pair=N)"
```

---

## Deferred (в B2b)
Ин-апп лобби по парам + `AddPlayer` с целевой парой + пул «без пары»; старт-гейт полноты пар для парных форматов; экран формирования пар (по макету `prestart-pairs`); `pairStandings` + обобщённая подсветка чемпион-пары в итоговой таблице.

## Self-review
- **Покрытие:** RPC pair_no (Task 1) ✓; i18n (Task 2) ✓; хелпер группировки (Task 3) ✓; `/t/CODE` запись парами + `?pair=N` (Task 4) ✓. Организаторская часть и таблица — в B2b (заявлено).
- **Плейсхолдеров нет:** весь SQL/JS/JSX/ключи целиком.
- **Согласованность:** `groupPairs` из Task 3 потребляется Task 4; `join(pairNo)` шлёт `joinTournamentByCode(code, display, pairNo)` (сигнатура Части A); `t.players[].pair_no` появляется из Task 1; `isPair` по id формата (`king_of_hill`/`round_robin`) — как в остальном коде.
- **ESLint-гейт:** все строки через `tr()`.
