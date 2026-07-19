# Взносы на старте + валюта (E4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Организатор задаёт взнос ДО начала турнира (не только после), выбирает тумблером «собираем в начале/в конце» (влияет на видимость по умолчанию, но карточка доступна ВСЕГДА) и валюту (дефолт по региону, display-only, без реальных платежей). Сумма видна на приглашении `/t/CODE`.

**Architecture:** Только ТУРНИРЫ (у `games` нет fee-колонки/RPC — их взносы уже нерабочие, не трогаем). Новые колонки `tournaments.fee_currency`, `fee_timing`. RPC `set_tournament_fee` расширяется 4-арг оверлоадом БЕЗ default'ов (2-арг остаётся — иначе задеплоенный клиент сломается до батча). Хелпер валют `src/lib/money.js`, дефолт по региону в `region.js`. `FeesCard` получает пропы currency/timing; рендер-гейт турнира «finished-only» снимаем.

**Tech Stack:** Vite + React 18 (plain JS); Supabase RPC; i18n ru/en/es.

## Global Constraints

- Node heap: префикс `NODE_OPTIONS=--max-old-space-size=512`.
- Plain JS, no TS. Комментарии по-русски. **Только `tr()` в JSX** (ESLint-гейт).
- Тест-фреймворка НЕТ: гейт — `npm run build` `✓ built` + node-смоук.
- Миграция на ПРОД через Supabase MCP + дубль `.sql` в `migrations/`.
- **RPC: НЕ дропать 2-арг `set_tournament_fee`; добавить 4-арг БЕЗ default'ов** (иначе неоднозначность/поломка задеплоенного клиента).
- `fee_timing` ∈ {'start','end'}, дефолт 'end'. НЕ деплоить (батч). Коммитить только файлы таска.

---

### Task 1: Миграция — `fee_currency`/`fee_timing` + 4-арг `set_tournament_fee`

**Files:**
- Create: `migrations/2026-07-19_tournament_fee_currency_timing.sql`
- Apply: Supabase MCP `apply_migration`

- [ ] **Step 1: Написать миграцию**:
```sql
-- Взносы: валюта + когда собираем (start/end). display-only, без реальных платежей.
alter table tournaments add column if not exists fee_currency text;
alter table tournaments add column if not exists fee_timing text not null default 'end';

-- 4-арг оверлоад set_tournament_fee (валюта+тайминг). БЕЗ default'ов — иначе 2-арг
-- вызов задеплоенного клиента станет неоднозначным. 2-арг НЕ дропаем (чистим после батча).
create function public.set_tournament_fee(p_tournament_id uuid, p_per_player integer, p_currency text, p_timing text)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_t tournaments%rowtype;
begin
  select * into v_t from tournaments where id = p_tournament_id;
  if not found then raise exception 'tournament_not_found'; end if;
  if not (is_group_admin(v_t.group_id) or v_t.created_by = current_profile_id()) then
    raise exception 'forbidden';
  end if;
  if p_per_player is not null and p_per_player <= 0 then raise exception 'bad_amount'; end if;
  update tournaments set
    fee_per_player = p_per_player,
    fee_currency = nullif(btrim(p_currency), ''),
    fee_timing = coalesce(nullif(btrim(p_timing), ''), 'end')
  where id = p_tournament_id;
end; $function$;
```

- [ ] **Step 2: Применить** — `apply_migration` name `tournament_fee_currency_timing`, query = файл. Expected `{"success":true}`.
- [ ] **Step 3: Проверить** — `execute_sql`:
```sql
select
  (select count(*) from information_schema.columns where table_name='tournaments' and column_name in ('fee_currency','fee_timing')) as cols,
  (select count(*) from pg_proc where proname='set_tournament_fee' and pg_get_function_identity_arguments(oid)='p_tournament_id uuid, p_per_player integer, p_currency text, p_timing text') as has_4arg;
```
Expected: `cols = 2`, `has_4arg = 1`.
- [ ] **Step 4: Commit**
```bash
git add migrations/2026-07-19_tournament_fee_currency_timing.sql
git commit -m "миграция: fee_currency/fee_timing + 4-арг set_tournament_fee"
```

---

### Task 2: `src/lib/money.js` — валюты и форматирование

**Files:**
- Create: `src/lib/money.js`
- Test: `scratchpad/smoke-money.mjs` (временный)

**Interfaces:**
- Produces: `CURRENCIES = ["RUB","EUR","USD","GBP","ARS","MXN","BRL","AED"]`; `formatMoney(n, cur)` → строка с символом валюты (Intl, 0 знаков); `currencySymbol(cur)`.

- [ ] **Step 1: Смоук (упадёт)** — `scratchpad/smoke-money.mjs`:
```js
import assert from "node:assert/strict";
import { formatMoney, currencySymbol, CURRENCIES } from "/root/padel-app/src/lib/money.js";
assert.ok(CURRENCIES.includes("RUB") && CURRENCIES.includes("EUR"));
assert.ok(formatMoney(1500, "RUB").includes("1") && /₽/.test(formatMoney(1500, "RUB")));
assert.ok(/€/.test(formatMoney(20, "EUR")));
assert.ok(/\$/.test(formatMoney(20, "USD")));
assert.equal(formatMoney(0, "RUB"), formatMoney(0, "RUB")); // не падает на 0
assert.ok(formatMoney(10, "ZZZ").includes("10")); // неизвестная валюта — не падает
assert.equal(currencySymbol("RUB"), "₽");
console.log("OK smoke-money");
```
- [ ] **Step 2: Run — упадёт** — `NODE_OPTIONS=--max-old-space-size=512 node /tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-money.mjs` → FAIL.
- [ ] **Step 3: Реализовать** — `src/lib/money.js`:
```js
// lib/money.js
// Валюта взноса — display-only (без реальных платежей/конвертации). Форматируем
// через Intl; символ берём из Intl «currency»-части.

export const CURRENCIES = ["RUB", "EUR", "USD", "GBP", "ARS", "MXN", "BRL", "AED"];

const SYMBOLS = { RUB: "₽", EUR: "€", USD: "$", GBP: "£", ARS: "$", MXN: "$", BRL: "R$", AED: "AED" };

export function currencySymbol(cur) {
  return SYMBOLS[cur] || cur || "";
}

// «1 500 ₽» / «20 €» / «20 $». Символ — из нашей карты (НЕ зависит от локали
// зрителя; Intl style:"currency" рендерит RUB как «RUB» вне ru-локали). Число —
// с группировкой по локали зрителя. Символ суффиксом — единообразно и однозначно.
export function formatMoney(n, cur) {
  const amount = Number(n) || 0;
  const code = cur || "RUB";
  let num;
  try { num = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amount); }
  catch (e) { num = String(amount); }
  return `${num} ${currencySymbol(code)}`.trim();
}
```
- [ ] **Step 4: Run — пройдёт** — та же команда → `OK smoke-money`. Затем `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`. Удалить: `rm -f /tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-money.mjs`.
- [ ] **Step 5: Commit**
```bash
git add src/lib/money.js
git commit -m "lib/money: CURRENCIES + formatMoney/currencySymbol (валюта взноса, display-only)"
```

---

### Task 3: `region.js` — валюта по региону

**Files:**
- Modify: `src/lib/region.js` (добавить экспорт в конец)

**Interfaces:**
- Consumes: `detectCountry()` (уже есть).
- Produces: `currencyFromCountry(cc)` → код валюты; `defaultCurrency()` (async) → валюта по стране (дефолт "EUR" если неизвестно, "RUB" для РФ-СНГ).

- [ ] **Step 1: Добавить в конец `src/lib/region.js`**:
```js
// Валюта по стране для дефолта взноса (display-only). Неизвестно → EUR.
const COUNTRY_CURRENCY = {
  RU: "RUB", BY: "RUB", KZ: "RUB", KG: "RUB",
  US: "USD", GB: "GBP", AR: "ARS", MX: "MXN", BR: "BRL", AE: "AED",
};
export function currencyFromCountry(cc) {
  if (!cc) return "EUR";
  return COUNTRY_CURRENCY[String(cc).toUpperCase()] || "EUR";
}
export async function defaultCurrency() {
  try { return currencyFromCountry(await detectCountry()); } catch (e) { return "EUR"; }
}
```
Примечание: если `detectCountry` не экспортируется/иначе называется — использовать фактический экспорт определения страны из этого файла (в шапке видно, что есть `detectCountry`).

- [ ] **Step 2: Сборка** — `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 3: Commit**
```bash
git add src/lib/region.js
git commit -m "region: currencyFromCountry/defaultCurrency (дефолт валюты взноса по стране)"
```

---

### Task 4: i18n — ключи валюты/тайминга + нейтрализация ₽

**Files:**
- Modify: `src/lib/i18n.js` (fee-строки ru ~373, en ~790, es ~1207)

**Interfaces:**
- Produces: `fee_timing_label`, `fee_timing_start`, `fee_timing_end`, `fee_currency_label` во всех локалях; из `fee_ph_each`/`fee_ph_total` (ru) и `fee_remind_msg` (все) убран хардкод `₽`.

- [ ] **Step 1: Добавить ключи (в fee-блок каждой локали)** — в RU после `fee_title: 'Взносы',` (или рядом с прочими `fee_*`):
```js
    fee_timing_label: 'Когда собираем', fee_timing_start: 'В начале', fee_timing_end: 'В конце', fee_currency_label: 'Валюта',
```
EN:
```js
    fee_timing_label: 'When to collect', fee_timing_start: 'At start', fee_timing_end: 'At end', fee_currency_label: 'Currency',
```
ES:
```js
    fee_timing_label: 'Cuándo cobrar', fee_timing_start: 'Al inicio', fee_timing_end: 'Al final', fee_currency_label: 'Moneda',
```

- [ ] **Step 2: Убрать хардкод ₽** — заменить значения ключей:
  - RU `fee_ph_each: 'Сумма с игрока, ₽'` → `fee_ph_each: 'Сумма с игрока'`; `fee_ph_total: 'Общая сумма, ₽'` → `fee_ph_total: 'Общая сумма'`.
  - RU `fee_remind_msg: '{names} — по {n} ₽ за турнир «{t}» 🎾'` → `fee_remind_msg: '{names} — по {n} за турнир «{t}» 🎾'`.
  - EN `fee_remind_msg: '{names} — {n} ₽ each for "{t}" 🎾'` → `fee_remind_msg: '{names} — {n} each for "{t}" 🎾'`.
  - ES `fee_remind_msg: '{names} — {n} ₽ cada uno por «{t}» 🎾'` → `fee_remind_msg: '{names} — {n} cada uno por «{t}» 🎾'`.
  (В FeesCard `{n}` теперь подставляется уже отформатированной суммой с валютой — см. Task 6.)

- [ ] **Step 3: Verify** — `grep -c "fee_timing_label\|fee_currency_label" src/lib/i18n.js` → `6`; `grep -c "₽" src/lib/i18n.js` → `0`; `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 4: Commit**
```bash
git add src/lib/i18n.js
git commit -m "i18n: ключи валюты/тайминга взноса + убран хардкод ₽ (ru/en/es)"
```

---

### Task 5: `tournamentApi.js` — читать/писать currency+timing

**Files:**
- Modify: `src/lib/tournamentApi.js` (`T_SELECT`; `getTournamentFee` ~267; `setTournamentFee` ~285)

**Interfaces:**
- Consumes: 4-арг RPC (Task 1).
- Produces: `T_SELECT` содержит `fee_per_player, fee_currency, fee_timing`; `getTournamentFee(id)` без изменений (число); `setTournamentFee(id, perPlayer, currency, timing)` → 4-арг RPC.

- [ ] **Step 1: T_SELECT** — в строку `T_SELECT` добавить `fee_per_player, fee_currency, fee_timing,` (в список колонок турнира, рядом с `open_scoring`).

- [ ] **Step 2: setTournamentFee** — заменить:
```js
export async function setTournamentFee(tournamentId, perPlayer) {
  const { error } = await supabase.rpc("set_tournament_fee", { p_tournament_id: tournamentId, p_per_player: perPlayer });
  if (error) throw error;
}
```
на:
```js
export async function setTournamentFee(tournamentId, perPlayer, currency = null, timing = "end") {
  const { error } = await supabase.rpc("set_tournament_fee", { p_tournament_id: tournamentId, p_per_player: perPlayer, p_currency: currency || "", p_timing: timing || "end" });
  if (error) throw error;
}
```

- [ ] **Step 3: Сборка** — `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 4: Commit**
```bash
git add src/lib/tournamentApi.js
git commit -m "tournamentApi: setTournamentFee с валютой/таймингом; T_SELECT += fee-поля"
```

---

### Task 6: `FeesCard.jsx` — валюта, тумблер тайминга, formatMoney

**Files:**
- Modify: `src/components/FeesCard.jsx` (импорт; проп-сигнатура; `fmtR`; setup-форма; `save`; remind-msg)

**Interfaces:**
- Consumes: `formatMoney`, `CURRENCIES` (`money.js`); ключи Task 4.
- Produces: `<FeesCard … currency timing defaultCurrency onFee? />` — форматирует суммы в валюте; в setup — тумблер тайминга + выбор валюты; `api.setFee(id, per, currency, timing)`.

- [ ] **Step 1: Импорт** — добавить в шапку `FeesCard.jsx`:
```jsx
import { formatMoney, CURRENCIES } from "../lib/money";
```

- [ ] **Step 2: Пропы + локальный стейт валюты/тайминга** — в сигнатуре компонента добавить пропы `currency = null, timing = "end", defaultCurrency = "EUR"`. Рядом с другими `useState` добавить:
```jsx
  const [cur, setCur] = useState(currency || defaultCurrency || "EUR");
  const [when, setWhen] = useState(timing || "end");
  useEffect(() => { setCur(currency || defaultCurrency || "EUR"); setWhen(timing || "end"); }, [currency, timing, defaultCurrency, entityId]);
```

- [ ] **Step 3: Форматирование в валюте** — заменить:
```jsx
  const fmtR = (n) => `${n.toLocaleString("ru-RU")} ₽`;
```
на:
```jsx
  const fmtR = (n) => formatMoney(n, cur);
```
(Все существующие вызовы `fmtR(...)` продолжают работать — теперь в выбранной валюте.)

- [ ] **Step 4: Тумблер тайминга + выбор валюты в setup** — в setup-форме, ПЕРЕД блоком тумблера each/total (строка с `fee_mode_each`/`fee_mode_total`), вставить:
```jsx
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("fee_timing_label")}</div>
          <div style={{ display: "flex", gap: 4, background: "var(--surface2)", borderRadius: 10, padding: 3, marginBottom: 8 }}>
            {[["start", tr("fee_timing_start")], ["end", tr("fee_timing_end")]].map(([k, lbl]) => (
              <button key={k} onClick={() => setWhen(k)} style={{ flex: 1, border: "none", borderRadius: 8, padding: "7px 0", cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 12, background: when === k ? "var(--lime)" : "none", color: when === k ? "var(--lime-fg)" : "var(--mut)" }}>{lbl}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 4 }}>{tr("fee_currency_label")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {CURRENCIES.map((c) => (
              <button key={c} onClick={() => setCur(c)} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 700, fontSize: 12, background: cur === c ? "var(--lime)" : "var(--surface2)", color: cur === c ? "var(--lime-fg)" : "var(--mut)" }}>{c}</button>
            ))}
          </div>
```

- [ ] **Step 5: save с валютой/таймингом** — в `save`, заменить `await api.setFee(entityId, perPlayer);` на:
```jsx
    try { await api.setFee(entityId, perPlayer, cur, when); setFee(perPlayer); setSetup(false); }
```
(остальное тело `save` без изменений).

- [ ] **Step 6: remind-msg с валютой** — в `remindChat`, где строится `msg` через `fee_remind_msg`, заменить `.replace("{n}", String(per))` на `.replace("{n}", fmtR(per))` (сумма с валютой вместо голого числа; ₽ из строки убран в Task 4).

- [ ] **Step 7: Сборка** — `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 8: Commit**
```bash
git add src/components/FeesCard.jsx
git commit -m "взносы: валюта (formatMoney) + тумблер тайминга в setup + save currency/timing"
```

---

### Task 7: `Tournaments.jsx` — снять гейт «finished-only» + пробросить валюту/тайминг + чип на приглашении

**Files:**
- Modify: `src/components/Tournaments.jsx` (рендер FeesCard ~1557-1565; шапка турнира — чип взноса)

**Interfaces:**
- Consumes: `trnData.fee_currency`/`fee_timing`/`fee_per_player` (T_SELECT, Task 5); `defaultCurrency` (`region.js`); `formatMoney` (`money.js`).

- [ ] **Step 1: Импорты** — добавить в шапку `Tournaments.jsx`:
```jsx
import { formatMoney } from "../lib/money";
import { defaultCurrency } from "../lib/region";
```

- [ ] **Step 2: Дефолт валюты по региону** — в `TournamentView`, рядом с другими `useState`, добавить:
```jsx
  const [defCur, setDefCur] = useState("EUR");
  useEffect(() => { defaultCurrency().then(setDefCur).catch(() => {}); }, []);
```

- [ ] **Step 3: Снять гейт «finished-only» + пробросить пропы** — заменить блок рендера FeesCard:
```jsx
            {/* Взносы за организацию: только завершённый турнир, не для зрителей */}
            {trnData.status === "finished" && !spectatorMode && (
              <FeesCard entityId={trnData.id} entityName={trnData.name}
                players={(trnData.players || []).map((p) => ({ key: p.id, profile_id: p.profile_id, name: p.name }))}
                me={currentProfileId} readOnly={readOnly}
                canManage={isAdmin || trnData.created_by === currentProfileId}
                avatarOf={avatarOfTp}
                api={{ getFee: getTournamentFee, getPaid: getFeePayments, setFee: setTournamentFee, togglePaid: toggleFeePaid, remind: remindFeeDebtors }} />
            )}
```
на:
```jsx
            {/* Взносы: доступны на любом этапе (не только finished), не для зрителей.
                Тайминг (fee_timing) — только подсказка; карточка сама скрывается,
                пока сумма не задана и ты не организатор. */}
            {!spectatorMode && (
              <FeesCard entityId={trnData.id} entityName={trnData.name}
                players={(trnData.players || []).map((p) => ({ key: p.id, profile_id: p.profile_id, name: p.name }))}
                me={currentProfileId} readOnly={readOnly}
                canManage={isAdmin || trnData.created_by === currentProfileId}
                avatarOf={avatarOfTp}
                currency={trnData.fee_currency} timing={trnData.fee_timing} defaultCurrency={defCur}
                api={{ getFee: getTournamentFee, getPaid: getFeePayments, setFee: setTournamentFee, togglePaid: toggleFeePaid, remind: remindFeeDebtors }} />
            )}
```

- [ ] **Step 4: Чип взноса в шапке турнира** — в мета-блоке шапки (после строки контакта, которую добавил B1 — `trnData.contact_name`), добавить чип, если взнос задан:
```jsx
        {trnData.fee_per_player > 0 && (
          <div style={{ marginTop: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--lime)", background: "color-mix(in srgb, var(--lime) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 40%, transparent)", borderRadius: 999, padding: "3px 10px" }}>
              💸 {formatMoney(trnData.fee_per_player, trnData.fee_currency)}
            </span>
          </div>
        )}
```

- [ ] **Step 5: Сборка** — `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 6: Commit**
```bash
git add src/components/Tournaments.jsx
git commit -m "взносы: доступны до старта (не только finished) + валюта/тайминг + чип в шапке"
```

---

### Task 8: `TournamentJoin.jsx` — чип взноса на приглашении `/t/CODE`

**Files:**
- Modify: `src/components/TournamentJoin.jsx` (импорт; карточка приглашения — после контакта, добавленного B1)

**Interfaces:**
- Consumes: `t.fee_per_player`/`t.fee_currency` (из `to_jsonb(t)`); `formatMoney` (`money.js`).

- [ ] **Step 1: Импорт** — добавить `import { formatMoney } from "../lib/money";` в шапку.

- [ ] **Step 2: Чип взноса** — найти строку контакта, добавленную в B1 (`{t.contact_name && …}` внутри блока `t.status === "open"`), и сразу после неё добавить:
```jsx
                {t.fee_per_player > 0 && <div style={{ marginBottom: 10 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "var(--lime)", background: "color-mix(in srgb, var(--lime) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 40%, transparent)", borderRadius: 999, padding: "3px 10px" }}>💸 {formatMoney(t.fee_per_player, t.fee_currency)}</span></div>}
```

- [ ] **Step 3: Сборка** — `NODE_OPTIONS=--max-old-space-size=512 npm run build` → `✓ built`.
- [ ] **Step 4: Commit**
```bash
git add src/components/TournamentJoin.jsx
git commit -m "приглашение /t/CODE: чип взноса с валютой"
```

---

## Deferred / замечания
- **Взносы у ИГР не работают** (нет `games.fee_per_player`, нет RPC `set_game_fee`) — досессионный баг, вне E4; вынести в глобальное ревью.
- Тайминг сейчас = сохранённая подсказка + видимость (карточка всегда доступна организатору). Явной «prominent-до-старта» логики не делаем (YAGNI).
- Чистка 2-арг `set_tournament_fee` — после батча.

## Self-review
- **Покрытие:** колонки+RPC (T1); money-хелпер (T2); дефолт валюты (T3); i18n+нейтрализация ₽ (T4); api (T5); FeesCard валюта/тайминг (T6); снятие гейта+чип шапки (T7); чип приглашения (T8).
- **Плейсхолдеров нет** (кроме явных «найди фактический экспорт/строку»).
- **Согласованность:** `formatMoney(n,cur)` — единый форматтер (FeesCard/шапка/приглашение); `setTournamentFee(id,per,cur,timing)`→4-арг RPC; `fee_currency/fee_timing` в T_SELECT (in-app) и `to_jsonb(t)` (публично); тумблер `when` и валюта `cur` в setup сохраняются вместе с суммой.
- **Без аварии:** 4-арг RPC без default'ов, 2-арг не дропнут → задеплоенный клиент жив до батча.
- **ESLint-гейт:** видимый текст через `tr()`; `₽` больше не хардкод.
