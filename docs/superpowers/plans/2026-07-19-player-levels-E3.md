# Уровни игрока (E3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Игрок сам заявляет свой уровень НЕСКОЛЬКИМИ бейджами (`{sys, val, lbl?}` — Playtomic 0–7 / буквы / другое), они хранятся в профиле и показываются на его профиле и в лиге. Дизайн — по одобренному макету `e3-levels`.

**Architecture:** Новая колонка `profiles.levels jsonb`. Профиль-редактор (`ProfileEditor.jsx`) сохраняет инлайн через `supabase.from("profiles").update(...)` (авто-дебаунс) — добавляем поле `levels` туда. Показ — общий компонент `LevelBadges.jsx` + чистый хелпер `formatLevel` (`src/lib/levels.js`), рендерится в `PlayerDetail` (PadelLeague.jsx) и в строке борда лиги. Скриншота нет (решено ранее).

**Tech Stack:** Vite + React 18 (plain JS); Supabase; i18n ru/en/es.

## Global Constraints

- Node heap: префикс `NODE_OPTIONS=--max-old-space-size=512`.
- Plain JS, no TS. Комментарии по-русски. **Только `tr()` в JSX** (ESLint-гейт).
- Тест-фреймворка НЕТ: гейт — `npm run build` `✓ built` + node-смоук чистых функций.
- Миграция на ПРОД через Supabase MCP + дубль `.sql` в `migrations/`.
- Модель бейджа: `{ sys: "pt"|"ltr"|"oth", val: string, lbl?: string }` (`lbl` — только для `oth`, имя системы). НЕ деплоить (батч). Коммитить только файлы таска.

---

### Task 1: Миграция — `profiles.levels jsonb`

**Files:**
- Create: `migrations/2026-07-19_profiles_levels.sql`
- Apply: Supabase MCP `apply_migration`

- [ ] **Step 1: Написать миграцию** — `migrations/2026-07-19_profiles_levels.sql`:
```sql
-- Самозаявленные уровни игрока: массив {sys, val, lbl?} (Playtomic/буквы/другое).
alter table profiles add column if not exists levels jsonb not null default '[]'::jsonb;
```
- [ ] **Step 2: Применить** — `apply_migration` name `profiles_levels`, query = файл. Expected `{"success":true}`.
- [ ] **Step 3: Проверить** — `execute_sql`:
```sql
select count(*) as has_levels from information_schema.columns
where table_name='profiles' and column_name='levels';
```
Expected: `has_levels = 1`.
- [ ] **Step 4: Commit**
```bash
git add migrations/2026-07-19_profiles_levels.sql
git commit -m "миграция: profiles.levels jsonb (самозаявленные уровни игрока)"
```

---

### Task 2: i18n-ключи уровней

**Files:**
- Modify: `src/lib/i18n.js` (ru после `pc_email`; en/es аналогично)

**Interfaces:**
- Produces: `pc_my_level`, `pc_level_hint`, `pc_level_add`, `pc_level_sys_ltr`, `pc_level_sys_oth`, `pc_level_val_ph`, `pc_level_sysname_ph`, `pc_level_add_btn` во всех локалях. (Playtomic — бренд, не переводим, литерал в коде.)

- [ ] **Step 1: RU** — найти `pc_first_name: 'Имя', pc_last_name: 'Фамилия', pc_phone: 'Телефон', pc_email: 'Почта',` и добавить сразу после:
```js
    pc_my_level: 'Мой уровень', pc_level_hint: 'Твоя самооценка из внешних систем — видна всем', pc_level_add: 'Добавить уровень', pc_level_sys_ltr: 'Буквы', pc_level_sys_oth: 'Другое', pc_level_val_ph: 'Значение', pc_level_sysname_ph: 'Система (напр. AJPP)', pc_level_add_btn: 'Добавить',
```
- [ ] **Step 2: EN** — после `pc_first_name: 'First name', pc_last_name: 'Last name', pc_phone: 'Phone', pc_email: 'Email',`:
```js
    pc_my_level: 'My level', pc_level_hint: 'Your self-assessment from external systems — visible to all', pc_level_add: 'Add level', pc_level_sys_ltr: 'Letters', pc_level_sys_oth: 'Other', pc_level_val_ph: 'Value', pc_level_sysname_ph: 'System (e.g. AJPP)', pc_level_add_btn: 'Add',
```
- [ ] **Step 3: ES** — после `pc_first_name: 'Nombre', pc_last_name: 'Apellido', pc_phone: 'Teléfono', pc_email: 'Correo',`:
```js
    pc_my_level: 'Mi nivel', pc_level_hint: 'Tu autoevaluación de sistemas externos — visible para todos', pc_level_add: 'Añadir nivel', pc_level_sys_ltr: 'Letras', pc_level_sys_oth: 'Otro', pc_level_val_ph: 'Valor', pc_level_sysname_ph: 'Sistema (p.ej. AJPP)', pc_level_add_btn: 'Añadir',
```
- [ ] **Step 4: Verify** — `grep -c "pc_my_level\|pc_level_add_btn\|pc_level_sys_oth" src/lib/i18n.js` → `9`; `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 5: Commit**
```bash
git add src/lib/i18n.js
git commit -m "i18n: ключи уровней игрока (ru/en/es)"
```

---

### Task 3: Хелпер `src/lib/levels.js`

**Files:**
- Create: `src/lib/levels.js`
- Test: `scratchpad/smoke-levels.mjs` (временный)

**Interfaces:**
- Produces: `LEVEL_SYSTEMS = ["pt","ltr","oth"]`; `LETTER_OPTIONS = ["E","D","D+","C","C+","B","A"]`; `formatLevel(lvl)` → строка для бейджа (`pt`→`"Playtomic {val}"`, `oth`→`"{lbl} {val}"`, `ltr`→`"{val}"`); `sanitizeLevels(arr)` → отфильтрованный валидный массив.

- [ ] **Step 1: Смоук (упадёт)** — `scratchpad/smoke-levels.mjs`:
```js
import assert from "node:assert/strict";
import { formatLevel, sanitizeLevels, LEVEL_SYSTEMS } from "/root/padel-app/src/lib/levels.js";

assert.equal(formatLevel({ sys: "pt", val: "3.5" }), "Playtomic 3.5");
assert.equal(formatLevel({ sys: "ltr", val: "C" }), "C");
assert.equal(formatLevel({ sys: "oth", val: "4", lbl: "AJPP" }), "AJPP 4");
assert.equal(formatLevel({ sys: "oth", val: "4" }), "4"); // нет lbl
assert.equal(formatLevel(null), "");
assert.equal(formatLevel({ sys: "pt", val: "" }), "");
assert.deepEqual(sanitizeLevels([{ sys: "pt", val: "3" }, { sys: "x", val: "1" }, { sys: "ltr", val: "" }, "junk"]), [{ sys: "pt", val: "3" }]);
assert.ok(LEVEL_SYSTEMS.includes("pt"));
console.log("OK smoke-levels");
```
- [ ] **Step 2: Run — упадёт** — `NODE_OPTIONS=--max-old-space-size=512 node /tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-levels.mjs` → FAIL.
- [ ] **Step 3: Реализовать** — `src/lib/levels.js`:
```js
// lib/levels.js
// Самозаявленный уровень игрока. Единого мирового стандарта нет: Playtomic 0–7 —
// ближе всего к общему; буквы (РФ) — локально; «другое» — свободно (Аргентина/NTRP).
// Модель бейджа: { sys: "pt"|"ltr"|"oth", val: string, lbl?: string }.

export const LEVEL_SYSTEMS = ["pt", "ltr", "oth"];
export const LETTER_OPTIONS = ["E", "D", "D+", "C", "C+", "B", "A"];

// Строка для бейджа. Playtomic — бренд, не переводим.
export function formatLevel(lvl) {
  if (!lvl || typeof lvl !== "object") return "";
  const val = (lvl.val == null ? "" : String(lvl.val)).trim();
  if (!val) return "";
  if (lvl.sys === "pt") return `Playtomic ${val}`;
  if (lvl.sys === "oth") return `${(lvl.lbl || "").trim()} ${val}`.trim();
  return val; // ltr
}

// Оставляет только валидные записи (известная система + непустое значение).
export function sanitizeLevels(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((l) => l && typeof l === "object" && LEVEL_SYSTEMS.includes(l.sys) && String(l.val || "").trim())
    .map((l) => {
      const out = { sys: l.sys, val: String(l.val).trim() };
      if (l.sys === "oth" && String(l.lbl || "").trim()) out.lbl = String(l.lbl).trim();
      return out;
    });
}
```
- [ ] **Step 4: Run — пройдёт** — та же команда → `OK smoke-levels`. Затем `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`. Удалить: `rm -f /tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-levels.mjs`.
- [ ] **Step 5: Commit**
```bash
git add src/lib/levels.js
git commit -m "lib/levels: модель и formatLevel/sanitizeLevels для уровней игрока"
```

---

### Task 4: Компонент `LevelBadges.jsx` (показ)

**Files:**
- Create: `src/components/LevelBadges.jsx`

**Interfaces:**
- Consumes: `formatLevel` (Task 3).
- Produces: `<LevelBadges levels={[…]} compact? />` — рисует бейджи уровней; ничего, если пусто.

- [ ] **Step 1: Реализовать** — `src/components/LevelBadges.jsx`:
```jsx
// components/LevelBadges.jsx
// Бейджи самозаявленного уровня игрока (см. lib/levels.js). Пусто → ничего.
import React from "react";
import { formatLevel } from "../lib/levels";

export default function LevelBadges({ levels, compact = false }) {
  const list = Array.isArray(levels) ? levels : [];
  const shown = list.map((l) => formatLevel(l)).filter(Boolean);
  if (!shown.length) return null;
  const color = (sys) => sys === "pt" ? "var(--lime)" : sys === "ltr" ? "#7cc4e0" : "var(--mut)";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: compact ? 0 : 6 }}>
      {list.map((l, i) => {
        const label = formatLevel(l);
        if (!label) return null;
        const c = color(l.sys);
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", borderRadius: 999,
            padding: compact ? "1px 7px" : "3px 9px", fontSize: compact ? 10.5 : 12, fontWeight: 700,
            color: c, background: `color-mix(in srgb, ${c} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 40%, transparent)` }}>
            {label}
          </span>
        );
      })}
    </div>
  );
}
```
- [ ] **Step 2: Сборка** — `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 3: Commit**
```bash
git add src/components/LevelBadges.jsx
git commit -m "components/LevelBadges: показ бейджей уровня игрока"
```

---

### Task 5: Редактор уровней в `ProfileEditor.jsx`

**Files:**
- Modify: `src/components/ProfileEditor.jsx` (стейт ~100-121; гидрация ~162-175; save-объект ~221-226; дебаунс-deps ~248; вставка секции внутри карточки «ДАННЫЕ»)

**Interfaces:**
- Consumes: `LEVEL_SYSTEMS`/`LETTER_OPTIONS`/`sanitizeLevels` (`src/lib/levels.js`); ключи Task 2.
- Produces: секция «Мой уровень» — добавление/удаление бейджей; сохраняется в `profiles.levels`.

- [ ] **Step 1: Импорт**

Добавить в шапку `ProfileEditor.jsx` (рядом с другими импортами из `../lib`):
```jsx
import { LEVEL_SYSTEMS, LETTER_OPTIONS, sanitizeLevels } from "../lib/levels";
```

- [ ] **Step 2: Стейт**

После `const [telegram, setTelegram] = useState(profile?.contacts?.telegram || "");` добавить:
```jsx
  const [levels, setLevels] = useState(profile?.levels || []);
  const [lvlSys, setLvlSys] = useState("pt");
  const [lvlVal, setLvlVal] = useState("");
  const [lvlLbl, setLvlLbl] = useState("");
  const [lvlAdding, setLvlAdding] = useState(false);
```

- [ ] **Step 3: Гидрация** — в блоке, где поля ставятся из `data.*` (после `setTelegram(...)`/`setWhatsapp(...)`), добавить:
```jsx
      setLevels(Array.isArray(data.levels) ? data.levels : []);
```

- [ ] **Step 4: Сохранение** — в объекте `supabase.from("profiles").update({...})` добавить поле (рядом с `contacts: {...}`):
```jsx
      levels: sanitizeLevels(levels),
```

- [ ] **Step 5: Авто-сохранение** — в массив зависимостей дебаунс-эффекта (`[firstName, lastName, phone, telegram, whatsapp, avatarUrl]`) добавить `levels`:
```jsx
  }, [firstName, lastName, phone, telegram, whatsapp, avatarUrl, levels]);
```

- [ ] **Step 6: Хелперы добавления/удаления** — рядом с другими хендлерами (напр. после `toggleRow`) добавить:
```jsx
  const addLevel = () => {
    const val = lvlVal.trim();
    if (!val) return;
    const lvl = { sys: lvlSys, val };
    if (lvlSys === "oth" && lvlLbl.trim()) lvl.lbl = lvlLbl.trim();
    setLevels((ls) => [...ls, lvl]);
    setLvlVal(""); setLvlLbl(""); setLvlAdding(false);
  };
  const removeLevel = (i) => setLevels((ls) => ls.filter((_, j) => j !== i));
```

- [ ] **Step 7: Секция «Мой уровень»** — внутри карточки «ДАННЫЕ», после строк контактов (Telegram/WhatsApp), вставить:
```jsx
        {/* Мой уровень (самозаявленные бейджи) */}
        <div style={{ padding: "12px 4px 4px", borderTop: "1px solid var(--line)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>🎖️ {t("pc_my_level")}</div>
          <div style={{ fontSize: 11.5, color: "var(--mut)", marginBottom: 8 }}>{t("pc_level_hint")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
            {levels.map((l, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "4px 6px 4px 11px", fontSize: 12.5, fontWeight: 700, background: "var(--surface2)", border: "1px solid var(--line)" }}>
                {l.sys === "pt" ? `Playtomic ${l.val}` : l.sys === "oth" ? `${(l.lbl || "").trim()} ${l.val}`.trim() : l.val}
                <button aria-label={t("delete_btn")} onClick={() => removeLevel(i)} style={{ border: "none", background: "none", color: "var(--mut)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
              </span>
            ))}
            {!lvlAdding && (
              <button onClick={() => setLvlAdding(true)} style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, padding: "4px 11px", fontSize: 12.5, fontWeight: 700, color: "var(--lime)", background: "none", border: "1.5px dashed var(--line)", cursor: "pointer" }}>＋ {t("pc_level_add")}</button>
            )}
          </div>
          {lvlAdding && (
            <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 10, padding: 3, marginBottom: 10 }}>
                {[["pt", "Playtomic"], ["ltr", t("pc_level_sys_ltr")], ["oth", t("pc_level_sys_oth")]].map(([k, lbl]) => (
                  <button key={k} onClick={() => { setLvlSys(k); setLvlVal(""); }} style={{ flex: 1, border: "none", borderRadius: 8, padding: "7px 0", cursor: "pointer", fontWeight: 700, fontSize: 12, background: lvlSys === k ? "var(--lime)" : "none", color: lvlSys === k ? "var(--lime-fg)" : "var(--mut)" }}>{lbl}</button>
                ))}
              </div>
              {lvlSys === "pt" && (
                <input className="pc-input" type="number" min="0" max="7" step="0.1" value={lvlVal} onChange={(e) => setLvlVal(e.target.value)} placeholder="0 – 7" />
              )}
              {lvlSys === "ltr" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {LETTER_OPTIONS.map((L) => (
                    <button key={L} onClick={() => setLvlVal(L)} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "7px 0", width: "calc((100% - 36px)/7)", fontWeight: 800, background: lvlVal === L ? "#7cc4e0" : "var(--bg)", color: lvlVal === L ? "#0a1612" : "var(--mut)" }}>{L}</button>
                  ))}
                </div>
              )}
              {lvlSys === "oth" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="pc-input" value={lvlLbl} onChange={(e) => setLvlLbl(e.target.value)} placeholder={t("pc_level_sysname_ph")} />
                  <input className="pc-input" value={lvlVal} onChange={(e) => setLvlVal(e.target.value)} placeholder={t("pc_level_val_ph")} style={{ maxWidth: 110 }} />
                </div>
              )}
              <button onClick={addLevel} disabled={!lvlVal.trim()} style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 10, border: "none", background: "var(--lime)", color: "var(--lime-fg)", fontWeight: 800, fontSize: 13, cursor: "pointer", opacity: lvlVal.trim() ? 1 : .5 }}>{t("pc_level_add_btn")}</button>
            </div>
          )}
        </div>
```
Примечание: если точное место после контактных строк в карточке «ДАННЫЕ» неочевидно — вставить секцию сразу перед закрытием карточки «ДАННЫЕ» (после последней контактной строки WhatsApp/Telegram). `t`, `var(--*)`, `pc-input` — уже в файле.

- [ ] **Step 8: Сборка** — `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 9: Commit**
```bash
git add src/components/ProfileEditor.jsx
git commit -m "профиль: редактор уровней (Playtomic/буквы/другое, несколько бейджей)"
```

---

### Task 6: Показ бейджей в профиле игрока и на борде лиги

**Files:**
- Modify: `src/PadelLeague.jsx` (импорт; `PlayerDetail` шапка ~1732; строка борда ~989-996)

**Interfaces:**
- Consumes: `<LevelBadges>` (Task 4); `player.levels` (профиль-объект уже `select("*")`).

- [ ] **Step 1: Импорт**

Добавить в шапку `src/PadelLeague.jsx`:
```jsx
import LevelBadges from "./components/LevelBadges";
```

- [ ] **Step 2: В `PlayerDetail` — после контактов**

Найти в шапке `PlayerDetail` строку `<ContactLinks contacts={player.contacts} />` и добавить сразу после неё:
```jsx
          <LevelBadges levels={player.levels} />
```

- [ ] **Step 3: На борде лиги — компактно у имени**

Найти в строке борда мета-строку, где уже есть `<TierChip rating={p.rating} compact />` (около строк 989-996), и добавить рядом (в тот же контейнер, после TierChip):
```jsx
                <LevelBadges levels={p.levels} compact />
```
Примечание: `p` в борде — профиль участника (из `select`), поле `levels` доступно, если оно в выборке участников. Если у объекта участника `levels` отсутствует (выборка не `*`), бейджи просто не покажутся (компонент вернёт null) — некритично; полноценно уровни видны в `PlayerDetail`. (Проверить, тянет ли выборка участников `levels`; если нет и захотим на борде — добавить `levels` в соответствующий select в `padelApi.js`, но это НЕ блокер E3.)

- [ ] **Step 4: Сборка** — `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 5: Commit**
```bash
git add src/PadelLeague.jsx
git commit -m "лига: показ бейджей уровня в профиле игрока и на борде"
```

---

## Deferred (не в E3)
Бейджи уровня в турнирном ростере (там `p` — tournament_player без `levels`, нужен lookup по `profile_id` из `players`-пропа); буквенная шкала detailed; верификация/скриншот (решено НЕ делать).

## Self-review
- **Покрытие:** колонка (T1); i18n (T2); модель+formatLevel (T3); показ-компонент (T4); редактор в профиле (T5); показ в PlayerDetail+борде (T6).
- **Плейсхолдеров нет** (кроме явных «найди место вставки»/«проверь select участников» — это указания найти-по-содержимому).
- **Согласованность:** модель `{sys,val,lbl?}` едина в `levels.js`, `LevelBadges`, `ProfileEditor`; `formatLevel` — единственный форматтер; `sanitizeLevels` на сохранении отсекает мусор.
- **ESLint-гейт:** видимый текст через `t()`; «Playtomic» — бренд-литерал (не переводится), допустимо.
