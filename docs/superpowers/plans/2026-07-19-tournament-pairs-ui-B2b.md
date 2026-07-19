# Турнир: запись парами — B2b (организатор + таблица) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать организатору в приложении собирать ПАРЫ (лобби по парам по одобренному макету `prestart-pairs`), заблокировать старт парного турнира пока не все в полных парах, и показывать итоговую/текущую таблицу ПО ПАРАМ с подсветкой чемпион-пары.

**Architecture:** Всё уже готово в слоях ниже (Часть A + B2a): `addTournamentPlayer(id, {profileId,name,pairNo})`, `startTournament` (KotH требует `pair_no`), `pairStandings` (`americano.js`), `groupPairs/openPairs/nextPairNo/allPaired` (`pairs.js`). Здесь — только UI в `Tournaments.jsx` + мелкий фикс `copyTournament`. Парная запись публично — уже в B2a.

**Tech Stack:** Vite + React 18 (plain JS); i18n ru/en/es.

## Global Constraints

- Node heap: префикс `NODE_OPTIONS=--max-old-space-size=512`.
- Plain JS, no TS. Комментарии по-русски. **Только `tr()` в JSX** (ESLint-гейт).
- Тест-фреймворка НЕТ: гейт — `npm run build` `✓ built`.
- Парные форматы определяем как `fmt.category === "pair"` (в `TournamentView` `fmt = fmtById(trnData.format)` доступен). Solo — прежнее поведение без изменений.
- НЕ деплоить (батч). Коммитить только файлы таска (в дереве есть посторонние правки — не трогать).

---

### Task 1: i18n-ключи лобби пар

**Files:**
- Modify: `src/lib/i18n.js` (после `trn_pair_you_in` в каждой локали)

**Interfaces:**
- Produces: `trn_no_pair`, `trn_choose_partner`, `trn_new_pair`, `trn_need_pairs` во всех локалях.

- [ ] **Step 1: RU** — найти `trn_pair_you_in: 'Ты в паре',` и добавить сразу после:
```js
    trn_no_pair: 'Без пары', trn_choose_partner: 'Выбрать напарника', trn_new_pair: 'Создать пару', trn_need_pairs: 'Собери все пары (закрой открытые места)',
```
- [ ] **Step 2: EN** — после `trn_pair_you_in: "You're paired",`:
```js
    trn_no_pair: 'No pair', trn_choose_partner: 'Choose partner', trn_new_pair: 'Create a pair', trn_need_pairs: 'Complete all pairs (close open spots)',
```
- [ ] **Step 3: ES** — после `trn_pair_you_in: 'Estás emparejado',`:
```js
    trn_no_pair: 'Sin pareja', trn_choose_partner: 'Elegir compañero', trn_new_pair: 'Crear pareja', trn_need_pairs: 'Completa todas las parejas (cierra los huecos)',
```
- [ ] **Step 4: Verify** — `grep -c "trn_choose_partner\|trn_need_pairs\|trn_new_pair" src/lib/i18n.js` → `9`; `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 5: Commit**
```bash
git add src/lib/i18n.js
git commit -m "i18n: ключи лобби пар (без пары/выбрать напарника/собери пары)"
```

---

### Task 2: `copyTournament` переносит `pair_no`

**Files:**
- Modify: `src/lib/tournamentApi.js` (`copyTournament`, строка с `addTournamentPlayer(trn.id, { profileId: p.profile_id || null, name: p.name })`)

**Interfaces:**
- Produces: копия парного турнира сохраняет пары.

- [ ] **Step 1: Пробросить pairNo**

Найти в `copyTournament`:
```js
    for (const p of players) {
      await addTournamentPlayer(trn.id, { profileId: p.profile_id || null, name: p.name });
    }
```
Заменить на:
```js
    for (const p of players) {
      await addTournamentPlayer(trn.id, { profileId: p.profile_id || null, name: p.name, pairNo: p.pair_no ?? null });
    }
```

- [ ] **Step 2: Сборка** — `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 3: Commit**
```bash
git add src/lib/tournamentApi.js
git commit -m "copyTournament: переносить pair_no (копия парного турнира сохраняет пары)"
```

---

### Task 3: Ин-апп лобби по парам (организатор)

**Files:**
- Modify: `src/components/Tournaments.jsx` (импорты; `TournamentView` — стейт; лобби-ростер ~1226-1251)

**Interfaces:**
- Consumes: `groupPairs`, `openPairs`, `nextPairNo` (`pairs.js`); `addTournamentPlayer(id, {...,pairNo})`; `removeTournamentPlayer(id)`; ключи Task 1 + `trn_pairs`/`trn_looking_partner` (B2a).
- Produces: для `fmt.category === "pair"` — ростер по парам с выбором напарника; solo — прежний плоский ростер.

- [ ] **Step 1: Импорт хелпера**

Найти в `Tournaments.jsx` строку `import StandingsTable from "./StandingsTable";` и добавить после неё:
```jsx
import { groupPairs, openPairs, nextPairNo, allPaired } from "../lib/pairs";
```

- [ ] **Step 2: Стейт «кого добавляем в пару»**

В `TournamentView`, рядом с другими `useState` (после `const [unlocked, setUnlocked] = ...`) добавить:
```jsx
  const [addingToPair, setAddingToPair] = useState(null); // pair_no | "new" | null — куда добавляем
```

- [ ] **Step 3: Заменить лобби-ростер на парный (для парных форматов)**

Найти блок ростера в лобби (список `trnData.players.map((p) => (...))` и следующий за ним `{!readOnly && (<AddPlayer ... />)}`, строки ~1226-1251). Заменить ВЕСЬ этот участок (от `{trnData.players.map((p) => (` до закрытия `AddPlayer`-блока включительно) на:
```jsx
            {fmt.category === "pair" ? (() => {
              const { pairs, pool } = groupPairs(trnData.players);
              const pairCap = Math.floor((trnData.target_size || 0) / 2);
              const done = pairs.filter((pr) => pr.members.length === 2).length;
              // Строка игрока внутри пары/пула: аватар + имя + (тап на профиль) + ✕
              const member = (p) => {
                const tap = onOpenPlayer && p.profile_id ? () => onOpenPlayer(p.profile_id) : null;
                return (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span onClick={tap || undefined} style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, cursor: tap ? "pointer" : "default" }}>
                      <Avatar name={p.name} url={avatarOfTp(p.id)} id={p.profile_id} size={26} />
                      <span style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{p.name}</span>
                    </span>
                    {!readOnly && (
                      <button aria-label={tr("delete_btn")} onClick={async () => { try { await removeTournamentPlayer(p.id); } catch (e) {} setAddingToPair(null); load(); }}
                        style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", border: "none", background: "color-mix(in srgb, var(--coral) 16%, transparent)", color: "var(--coral)", display: "grid", placeItems: "center", cursor: "pointer" }}>
                        <X size={12} />
                      </button>
                    )}
                  </span>
                );
              };
              return (
                <>
                  <div style={{ fontSize: 12, color: "var(--mut)", fontWeight: 700, marginBottom: 8 }}>{tr("trn_pairs")} {done}/{pairCap}</div>
                  {pairs.map((pr) => (
                    <div key={pr.pair_no} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "9px 4px", borderBottom: "1px solid var(--line)" }}>
                      <span style={{ width: 16, flexShrink: 0, fontWeight: 800, color: "var(--mut)", fontSize: 13, textAlign: "center" }}>{pr.pair_no}</span>
                      {member(pr.members[0])}
                      <span style={{ color: "var(--mut)", fontWeight: 700 }}>&amp;</span>
                      {pr.members[1] ? member(pr.members[1]) : (
                        !readOnly ? (
                          <button onClick={() => setAddingToPair(pr.pair_no)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1.5px dashed color-mix(in srgb, var(--lime) 45%, transparent)", background: "none", borderRadius: 999, padding: "5px 12px", color: "var(--lime)", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                            ＋ {tr("trn_choose_partner")}
                          </button>
                        ) : <span style={{ color: "var(--mut)", fontSize: 12.5 }}>{tr("trn_looking_partner")}</span>
                      )}
                    </div>
                  ))}
                  {pool.length > 0 && (
                    <>
                      <div style={{ fontSize: 11.5, color: "var(--mut)", textTransform: "uppercase", letterSpacing: .5, fontWeight: 800, margin: "10px 0 6px" }}>{tr("trn_no_pair")}</div>
                      {pool.map((p) => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", padding: "8px 4px", borderBottom: "1px solid var(--line)" }}>{member(p)}</div>
                      ))}
                    </>
                  )}
                  {!readOnly && addingToPair == null && trnData.players.length < trnData.target_size && (
                    <button onClick={() => setAddingToPair("new")} className="tr-btn" style={{ marginTop: 12, background: "color-mix(in srgb, var(--lime) 12%, transparent)", color: "var(--lime)", border: "1px solid color-mix(in srgb, var(--lime) 40%, transparent)" }}>
                      ＋ {tr("trn_new_pair")}
                    </button>
                  )}
                  {!readOnly && addingToPair != null && (
                    <div style={{ marginTop: 10 }}>
                      <AddPlayer players={players} existing={trnData.players} meId={currentProfileId}
                        disabled={trnData.players.length >= trnData.target_size}
                        onAdd={async (entry) => {
                          const pairNo = addingToPair === "new" ? nextPairNo(trnData.players) : addingToPair;
                          await addTournamentPlayer(trnData.id, { ...entry, pairNo });
                          setAddingToPair(null); load();
                        }} />
                    </div>
                  )}
                </>
              );
            })() : (
              <>
                {trnData.players.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderBottom: "1px solid var(--line)", background: p.profile_id === currentProfileId ? "color-mix(in srgb, var(--lime) 10%, transparent)" : undefined, borderRadius: p.profile_id === currentProfileId ? 8 : undefined }}>
                    {(() => {
                      const tap = onOpenPlayer && p.profile_id ? () => onOpenPlayer(p.profile_id) : null;
                      return (
                        <div onClick={tap || undefined} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, cursor: tap ? "pointer" : "default" }}>
                          <Avatar name={p.name} url={avatarOfTp(p.id)} id={p.profile_id} size={34} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        </div>
                      );
                    })()}
                    {!readOnly && (
                      <button aria-label={tr("delete_btn")} onClick={async () => { try { await removeTournamentPlayer(p.id); } catch (e) {} load(); }}
                        style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: "none", background: "color-mix(in srgb, var(--coral) 16%, transparent)", color: "var(--coral)", display: "grid", placeItems: "center", cursor: "pointer" }}>
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <AddPlayer players={players} existing={trnData.players} meId={currentProfileId}
                    disabled={trnData.players.length >= trnData.target_size}
                    onAdd={async (entry) => { await addTournamentPlayer(trnData.id, entry); load(); }} />
                )}
              </>
            )}
```

Примечание: если точный вид старого плоского ростера в файле немного отличается (стиль строки/кнопки ✕), сохрани фактический старый вид в ELSE-ветке (solo не меняем визуально), а новую — как здесь. Ключевое: ветвление по `fmt.category === "pair"`.

- [ ] **Step 4: Сборка** — `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 5: Commit**
```bash
git add src/components/Tournaments.jsx
git commit -m "турниры: ин-апп лобби по парам (выбрать напарника, без пары, создать пару)"
```

---

### Task 4: Старт-гейт полноты пар

**Files:**
- Modify: `src/components/Tournaments.jsx` (`canStart`/`startHint` ~1060-1065)

**Interfaces:**
- Consumes: `allPaired` (`pairs.js`, импортирован в Task 3); `fmt.category`.
- Produces: для парных форматов старт разрешён только когда все в полных парах.

- [ ] **Step 1: Дополнить canStart/startHint**

Найти:
```jsx
  const canStart = isBtb
    ? trnData.players.length >= 4 && trnData.players.length % 2 === 0
    : trnData.players.length >= 4 && trnData.players.length % 4 === 0;
  const startHint = isBtb
    ? (trnData.players.length % 2 !== 0 ? tr("trn_need_even") : null)
    : (trnData.players.length % 4 !== 0 ? tr("trn_need_mult4") : null);
```
Заменить на:
```jsx
  const pairFmt = fmt.category === "pair" && !isBtb; // king_of_hill (и будущий round_robin)
  const countOk = isBtb
    ? trnData.players.length >= 4 && trnData.players.length % 2 === 0
    : trnData.players.length >= 4 && trnData.players.length % 4 === 0;
  // Для парных форматов дополнительно требуем, чтобы все были в ПОЛНЫХ парах.
  const canStart = countOk && (!pairFmt || allPaired(trnData.players));
  const startHint = (isBtb
    ? (trnData.players.length % 2 !== 0 ? tr("trn_need_even") : null)
    : (trnData.players.length % 4 !== 0 ? tr("trn_need_mult4") : null))
    || (pairFmt && countOk && !allPaired(trnData.players) ? tr("trn_need_pairs") : null);
```

- [ ] **Step 2: Сборка** — `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 3: Commit**
```bash
git add src/components/Tournaments.jsx
git commit -m "турниры: старт парного турнира заблокирован пока не все в полных парах"
```

---

### Task 5: Итоговая/текущая таблица ПО ПАРАМ + чемпион-пара

**Files:**
- Modify: `src/components/Tournaments.jsx` (импорт `pairStandings`; `table` ~993; `champ`/`kothPair` ~1017-1027; `<StandingsTable>` ~1487)

**Interfaces:**
- Consumes: `pairStandings` (`americano.js`); `kothChampionPair` (в файле); `fmt.category`.
- Produces: для парных форматов таблица = строки-ПАРЫ; чемпион-пара подсвечена (👑 через `championIds`).

- [ ] **Step 1: Импорт pairStandings**

Найти импорт из `../lib/americano` (например `import { detailedStandings } from "../lib/americano";` — точное имя может отличаться) и добавить в него `pairStandings`. Если `americano` уже импортируется — дописать `pairStandings` в список именованных импортов. (Проверить фактическую строку импорта `americano` в шапке файла.)

- [ ] **Step 2: Таблица по парам для парных форматов**

Найти:
```jsx
  const table = detailedStandings(trnData.players.map((p) => ({ id: p.id, name: p.name })), trnData.matches.filter((m) => m.round_number > 0));
```
Заменить на:
```jsx
  const isPairFmt = fmt.category === "pair";
  const playedForTable = trnData.matches.filter((m) => m.round_number > 0);
  const table = isPairFmt
    ? pairStandings(trnData.players, playedForTable)
    : detailedStandings(trnData.players.map((p) => ({ id: p.id, name: p.name })), playedForTable);
```

- [ ] **Step 3: Чемпион-пара как строка-пара**

Найти:
```jsx
  const kothPair = isKoth && trnData.status === "finished" ? kothChampionPair(trnData) : null;
  const champ = kothPair
    ? (() => {
        const rows = kothPair.map((pid) => table.find((r) => r.id === pid)).filter(Boolean);
        return {
          name: `${nameOf(kothPair[0])} & ${nameOf(kothPair[1])}`,
          points: rows.reduce((s, r) => s + (r.points || 0), 0),
          delta: rows.reduce((s, r) => s + (r.delta || 0), 0),
        };
      })()
    : table[0];
```
Заменить на:
```jsx
  // Чемпион парного формата — строка-ПАРА в table (по pair_no игрока-чемпиона из
  // kothChampionPair); иначе (solo) — лидер таблицы.
  const kothPair = isKoth && trnData.status === "finished" ? kothChampionPair(trnData) : null;
  const champPairNo = kothPair
    ? (trnData.players.find((p) => kothPair.includes(p.id))?.pair_no ?? null)
    : null;
  const champ = isPairFmt
    ? (champPairNo != null ? table.find((r) => r.pair_no === champPairNo) : table[0])
    : table[0];
  const champRowId = champ?.id || null; // для подсветки строки-пары
```

- [ ] **Step 4: Подсветка чемпион-пары + свой ряд в StandingsTable**

Найти:
```jsx
            <StandingsTable rows={table} highlightId={(trnData.players || []).find((p) => p.profile_id === currentProfileId)?.id} avatarOf={(row) => ({ url: avatarOfTp(row.id) })} championIds={trnData.status === "finished" ? kothPair : null} />
```
Заменить на:
```jsx
            <StandingsTable rows={table}
              highlightId={isPairFmt
                ? (() => { const me = (trnData.players || []).find((p) => p.profile_id === currentProfileId); return me?.pair_no != null ? `pair-${me.pair_no}` : null; })()
                : (trnData.players || []).find((p) => p.profile_id === currentProfileId)?.id}
              avatarOf={(row) => ({ url: isPairFmt ? null : avatarOfTp(row.id) })}
              championIds={trnData.status === "finished" && champRowId ? [champRowId] : null} />
```

Примечание: у строк-пар `id = "pair-N"`, `avatarOf` для них не даёт осмысленного аватара (нет одного игрока), поэтому `null`. Имя пары `"A & B"` уже в `row.name`.

- [ ] **Step 5: Сборка** — `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 6: Commit**
```bash
git add src/components/Tournaments.jsx
git commit -m "турниры: таблица по парам + подсветка чемпион-пары (парные форматы)"
```

---

## Self-review
- **Покрытие:** i18n (T1); copyTournament pair_no (T2); ин-апп лобби по парам по макету prestart-pairs (T3); старт-гейт полноты пар (T4); таблица+чемпион по парам (T5). Публичная запись — уже B2a.
- **Плейсхолдеров нет** (кроме двух явных «проверь фактическую строку импорта americano» / «сохрани фактический старый вид solo-ростера» — это указания найти-по-содержимому, не пропуски логики).
- **Согласованность:** `fmt.category === "pair"` — единый признак; `allPaired` (T4) и `groupPairs/openPairs/nextPairNo` (T3) из `pairs.js`; `pairStandings` (T5) из `americano.js`; строки-пары `id="pair-N"` согласованы между `table`, `champRowId`, `highlightId`, `championIds`.
- **ESLint-гейт:** весь видимый текст через `tr()`.
- **Деплой-зависимость:** этот план закрывает ин-апп путь; вместе с Частью A + B1 + B2a готов батч-деплой (до него KotH-старт на проде идёт по старому shuffle-коду).
