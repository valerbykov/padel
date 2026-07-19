# Доделки: взносы у игр, персональные ссылки, привязка гостя, мелочи — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Checkbox (`- [ ]`) syntax.

**Goal:** Закрыть отложенные follow-up'ы: (A) рабочие взносы у ИГР (зеркало турнирных); (B) генерация персональной ссылки `/t/CODE?pair=N`; (C) безопасность привязки гостя (верифиц. телефон, без редактируемого telegram); (D) мелочи (money.js символы, сброс addingToPair).

**Architecture:** Взносы игр строим зеркалом турнирных: колонки на `games` + таблица `game_fee_payments` (ключ = `game_slots.id`) + RPC `set_game_fee`/`get_game_fee_payments`/`toggle_game_fee_paid` (SECURITY DEFINER). Push-напоминание НЕ делаем (его нет и у турниров — `remind_fee_debtors` отсутствует; кнопка «в чат» работает). Guest-fix правит 4-арг `join_tournament` (ветка b).

**Tech Stack:** Vite + React 18 (plain JS); Supabase RPC; i18n.

## Global Constraints
- Node heap: `NODE_OPTIONS=--max-old-space-size=512`. Plain JS, no TS. Комментарии по-русски. Только `tr()` в JSX.
- Тест нет: гейт — `npm run build` `✓ built` + node-смоук + SQL-интроспекция.
- Миграции на ПРОД через Supabase MCP + дубль `.sql` в `migrations/`. Не деплоить (батч). Коммитить только файлы таска.

---

### Task 1: Миграция — бэкенд взносов у игр (зеркало турнирных)

**Files:** Create `migrations/2026-07-19_game_fees.sql`; apply via MCP.

- [ ] **Step 1: Миграция**:
```sql
-- Взносы у игр (не работали: не было колонок/таблицы/RPC). Зеркало турнирных,
-- ключ оплаты = game_slots.id (как players.key в FeesCard игры).
alter table games add column if not exists fee_per_player integer;
alter table games add column if not exists fee_currency text;
alter table games add column if not exists fee_timing text not null default 'end';

create table if not exists game_fee_payments (
  slot_id uuid primary key references game_slots(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  marked_by uuid,
  created_at timestamptz not null default now()
);
alter table game_fee_payments enable row level security;
-- Доступ только через SECURITY DEFINER RPC ниже (клиентских политик нет).

create or replace function public.set_game_fee(p_game_id uuid, p_per_player integer, p_currency text, p_timing text)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_g games%rowtype;
begin
  select * into v_g from games where id = p_game_id;
  if not found then raise exception 'game_not_found'; end if;
  if not (is_group_admin(v_g.group_id) or v_g.host_id = current_profile_id()) then
    raise exception 'forbidden';
  end if;
  if p_per_player is not null and p_per_player <= 0 then raise exception 'bad_amount'; end if;
  update games set
    fee_per_player = p_per_player,
    fee_currency = nullif(btrim(p_currency), ''),
    fee_timing = coalesce(nullif(btrim(p_timing), ''), 'end')
  where id = p_game_id;
end; $function$;

create or replace function public.get_game_fee_payments(p_game_id uuid)
returns setof uuid language sql stable security definer set search_path to 'public'
as $function$
  select f.slot_id from game_fee_payments f
  join games g on g.id = f.game_id
  where f.game_id = p_game_id and is_group_member(g.group_id);
$function$;

create or replace function public.toggle_game_fee_paid(p_slot_id uuid)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare v_s game_slots%rowtype; v_g games%rowtype; v_me uuid;
begin
  select * into v_s from game_slots where id = p_slot_id;
  if not found then raise exception 'slot_not_found'; end if;
  select * into v_g from games where id = v_s.game_id;
  v_me := current_profile_id();
  if not (
    (v_s.profile_id is not null and v_s.profile_id = v_me)
    or is_group_admin(v_g.group_id)
    or v_g.host_id = v_me
  ) then raise exception 'forbidden'; end if;

  if exists (select 1 from game_fee_payments where slot_id = p_slot_id) then
    delete from game_fee_payments where slot_id = p_slot_id;
    return false;
  else
    insert into game_fee_payments (slot_id, game_id, marked_by)
    values (p_slot_id, v_s.game_id, v_me);
    return true;
  end if;
end; $function$;
```

- [ ] **Step 2: Применить** — `apply_migration` name `game_fees`. Expected `{"success":true}`.
- [ ] **Step 3: Проверить** — `execute_sql`:
```sql
select
  (select count(*) from information_schema.columns where table_name='games' and column_name in ('fee_per_player','fee_currency','fee_timing')) as cols,
  (select count(*) from information_schema.tables where table_name='game_fee_payments') as tbl,
  (select count(*) from pg_proc where proname in ('set_game_fee','get_game_fee_payments','toggle_game_fee_paid')) as rpcs;
```
Expected: `cols=3, tbl=1, rpcs=3`.
- [ ] **Step 4: Commit** `git add migrations/2026-07-19_game_fees.sql && git commit -m "миграция: бэкенд взносов у игр (колонки + game_fee_payments + RPC)"`

---

### Task 2: Миграция — безопасность привязки гостя в `join_tournament`

**Files:** Create `migrations/2026-07-19_join_tournament_verified_phone.sql`; apply via MCP.

Проблема: ветка (b) матчит гостя по `v_me.phone`/`contacts->>'telegram'` — это РЕДАКТИРУЕМЫЕ поля профиля, любой может подставить чужой телефон/telegram и «забрать» гостевую строку. Фикс: матчить телефон по ВЕРИФИЦ. `auth.users.phone` (OTP), telegram убрать. Email оставить (не редактируется клиентом).

- [ ] **Step 1: Написать миграцию** — полный 4-арг `join_tournament` (текущий, с изменённой веткой b). Это `create or replace` той же 4-арг сигнатуры:
```sql
create or replace function public.join_tournament(
  p_code text, p_name text, p_profile_id uuid, p_pair_no integer)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_t    tournaments;
  v_me   profiles;
  v_uid  uuid := auth.uid();
  v_pid  uuid;
  v_count int;
  v_is_pair boolean;
  v_pair_count int;
  v_new_pair int;
  v_auth_phone text;
begin
  select * into v_t from tournaments where invite_code = upper(p_code);
  if not found then raise exception 'tournament_not_found'; end if;
  if v_t.status <> 'open' then raise exception 'tournament_closed'; end if;

  v_is_pair := v_t.format = any(array['king_of_hill','round_robin']);

  if v_uid is not null then
    select * into v_me from profiles where user_id = v_uid;
    v_pid := v_me.id;
    v_auth_phone := (select phone from auth.users where id = v_uid); -- ВЕРИФИЦ. телефон (OTP)
  else
    v_pid := null;
  end if;

  if v_pid is not null and exists (
       select 1 from tournament_players where tournament_id = v_t.id and profile_id = v_pid
     ) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  -- (b) привязка гостя ТОЛЬКО по проверяемым признакам: email (не редактируется
  --     клиентом) и ВЕРИФИЦ. телефон из auth.users. Telegram убран (contacts
  --     редактируется свободно → подделываем матч).
  if v_pid is not null then
    update tournament_players tp
       set profile_id = v_pid,
           name       = coalesce(nullif(btrim(p_name), ''), tp.name)
     where tp.id = (
       select tp2.id
         from tournament_players tp2
         left join profiles pr on pr.id = tp2.profile_id
        where tp2.tournament_id = v_t.id
          and tp2.profile_id is distinct from v_pid
          and (pr.id is null or pr.user_id is null)
          and (
               (nullif(btrim(v_me.email), '') is not null and (
                    lower(btrim(pr.email)) = lower(btrim(v_me.email))
                 or lower(btrim(pr.contacts->>'email')) = lower(btrim(v_me.email))
               ))
            or (nullif(btrim(v_auth_phone), '') is not null and (
                    nullif(btrim(pr.phone), '') = nullif(btrim(v_auth_phone), '')
                 or nullif(btrim(pr.contacts->>'phone'), '') = nullif(btrim(v_auth_phone), '')
               ))
          )
        limit 1
     );
    if found then
      return jsonb_build_object('ok', true, 'linked', true);
    end if;
  end if;

  select count(*) into v_count from tournament_players where tournament_id = v_t.id;
  if v_count >= v_t.target_size then raise exception 'tournament_full'; end if;

  if v_is_pair then
    if p_pair_no is null then
      perform pg_advisory_xact_lock(hashtextextended(v_t.id::text, 0));
      select coalesce(max(pair_no), 0) + 1 into v_new_pair
        from tournament_players where tournament_id = v_t.id;
      insert into tournament_players (tournament_id, name, profile_id, pair_no)
      values (v_t.id, p_name, v_pid, v_new_pair);
      return jsonb_build_object('ok', true, 'pair_no', v_new_pair);
    else
      select count(*) into v_pair_count
        from tournament_players where tournament_id = v_t.id and pair_no = p_pair_no;
      if v_pair_count = 0 then raise exception 'pair_not_found'; end if;
      if v_pair_count >= 2 then raise exception 'pair_full'; end if;
      insert into tournament_players (tournament_id, name, profile_id, pair_no)
      values (v_t.id, p_name, v_pid, p_pair_no);
      return jsonb_build_object('ok', true, 'pair_no', p_pair_no);
    end if;
  end if;

  insert into tournament_players (tournament_id, name, profile_id)
  values (v_t.id, p_name, v_pid);
  return jsonb_build_object('ok', true);
end; $function$;
```

- [ ] **Step 2: Применить** — `apply_migration` name `join_tournament_verified_phone`. Expected success.
- [ ] **Step 3: Проверить** — `execute_sql`:
```sql
select
  (position('auth.users where id = v_uid' in pg_get_functiondef(oid)) > 0) as has_verified_phone,
  (position('telegram' in pg_get_functiondef(oid)) = 0) as telegram_removed
from pg_proc where proname='join_tournament'
  and pg_get_function_identity_arguments(oid)='p_code text, p_name text, p_profile_id uuid, p_pair_no integer';
```
Expected: `has_verified_phone=true`, `telegram_removed=true`.
- [ ] **Step 4: Commit** `git add migrations/2026-07-19_join_tournament_verified_phone.sql && git commit -m "безопасность: привязка гостя по верифиц. телефону (auth.users), telegram убран"`

---

### Task 3: `padelApi.js` — GAME_SELECT + setGameFee 4-арг

**Files:** Modify `src/lib/padelApi.js` (`GAME_SELECT` ~203; `setGameFee` ~669).

- [ ] **Step 1: GAME_SELECT** — добавить `fee_per_player, fee_currency, fee_timing` в список колонок `games` в строке `GAME_SELECT`.
- [ ] **Step 2: setGameFee 4-арг** — заменить:
```js
export async function setGameFee(gameId, perPlayer) {
  const { error } = await supabase.rpc("set_game_fee", { p_game_id: gameId, p_per_player: perPlayer });
  if (error) throw error;
}
```
на:
```js
export async function setGameFee(gameId, perPlayer, currency = null, timing = "end") {
  const { error } = await supabase.rpc("set_game_fee", { p_game_id: gameId, p_per_player: perPlayer, p_currency: currency || "", p_timing: timing || "end" });
  if (error) throw error;
}
```
- [ ] **Step 3: Build** → `✓ built`. **Commit** `git add src/lib/padelApi.js && git commit -m "padelApi: GAME_SELECT += fee-поля; setGameFee с валютой/таймингом"`

---

### Task 4: `PadelLeague.jsx` — проброс валюты/тайминга в игровую FeesCard

**Files:** Modify `src/PadelLeague.jsx` (импорт `defaultCurrency`; `defCur` стейт; игровой `<FeesCard ...>` ~2957).

- [ ] **Step 1: Импорт** — добавить `import { defaultCurrency } from "./lib/region";` (если не импортирован).
- [ ] **Step 2: defCur** — в компоненте, где рендерится игровая FeesCard, рядом с состоянием добавить:
```jsx
  const [defCur, setDefCur] = useState("EUR");
  useEffect(() => { defaultCurrency().then(setDefCur).catch(() => {}); }, []);
```
(если такого стейта ещё нет в этом компоненте).
- [ ] **Step 3: Пропы** — в игровой `<FeesCard ... api={{...}} cardClass="pl-card" />` добавить пропы (используя `anchor`, который уже в скоупе):
```jsx
              currency={anchor.fee_currency} timing={anchor.fee_timing} defaultCurrency={defCur}
```
- [ ] **Step 4: Build** → `✓ built`. **Commit** `git add src/PadelLeague.jsx && git commit -m "игры: проброс валюты/тайминга в карточку взносов"`

---

### Task 5: Персональная ссылка на пару — кнопка «поделиться» у открытой пары

**Files:** Modify `src/components/Tournaments.jsx` (ин-апп лобби, open-pair рядом с «＋ Выбрать напарника»); i18n ключ.

Читаемая сторона `?pair=N` уже есть — добавляем ГЕНЕРАЦИЮ: у открытой пары кнопка «🔗» шарит `/t/CODE?pair=<pair_no>`.

- [ ] **Step 1: i18n** — добавить `trn_share_pair` (ru: 'Ссылка на пару', en: 'Pair link', es: 'Enlace de pareja') в 3 локали.
- [ ] **Step 2: Хелпер шаринга** — в `TournamentView` добавить (рядом с другими хендлерами):
```jsx
  const sharePairLink = async (pairNo) => {
    const url = `${tournamentLink(trnData.invite_code)}?pair=${pairNo}`;
    const Share = (typeof window !== "undefined" && window.Capacitor?.Plugins?.Share) || null;
    if (Share) { try { await Share.share({ url }); return; } catch (e) { /* отмена — ок */ } }
    try { await navigator.clipboard.writeText(url); showToast(tr("copied")); }
    catch (e) { showToast(tr("copy_manual")); }
  };
```
(`tournamentLink` уже импортирован в файле; `copied`/`copy_manual` — существующие ключи.)
- [ ] **Step 3: Кнопка** — в ин-апп лобби, в ветке открытой пары (где рендерится `＋ {tr("trn_choose_partner")}`), сразу ПОСЛЕ этой кнопки добавить (в том же контейнере, только для `!readOnly`):
```jsx
                          <button onClick={() => sharePairLink(pr.pair_no)} aria-label={tr("trn_share_pair")}
                            style={{ marginLeft: 6, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 999, padding: "5px 10px", color: "var(--mut)", cursor: "pointer", fontSize: 12.5 }}>🔗</button>
```
- [ ] **Step 4: Build** → `✓ built`. **Commit** `git add src/components/Tournaments.jsx src/lib/i18n.js && git commit -m "турниры: кнопка «ссылка на пару» (генерация /t/CODE?pair=N)"`

---

### Task 6: Мелочи — money.js символы + сброс addingToPair

**Files:** Modify `src/lib/money.js`; `src/components/Tournaments.jsx`.

- [ ] **Step 1: money.js — различить $** — в `SYMBOLS` заменить строку так, чтобы `$`-валюты не сливались:
```js
const SYMBOLS = { RUB: "₽", EUR: "€", USD: "$", GBP: "£", ARS: "AR$", MXN: "MX$", BRL: "R$", AED: "AED" };
```
- [ ] **Step 2: Tournaments — не закрывать панель добавления при удалении чужого игрока** — в обработчике `×` внутри `member()` (`try { await removeTournamentPlayer(p.id); } catch (e) {} setAddingToPair(null); load();`) убрать `setAddingToPair(null);` (удаление игрока не должно сбрасывать открытую панель выбора напарника):
```js
onClick={async () => { try { await removeTournamentPlayer(p.id); } catch (e) {} load(); }}
```
- [ ] **Step 3: Build** → `✓ built`. **Commit** `git add src/lib/money.js src/components/Tournaments.jsx && git commit -m "мелочи: различаем $-валюты (AR$/MX$); удаление игрока не закрывает панель пары"`

---

## Не делаем
- Push-напоминание взносов (`remind_*_fee_debtors`) — отсутствует и у турниров, требует отдельной интеграции с крон-пушами; кнопка «в чат» работает. Отдельный follow-up.
- Reload-guard в приватном режиме и index-key бейджей — минор без функционального бага.

## Self-review
- **Покрытие:** взносы игр бэкенд (T1) + клиент (T3,T4); безопасность гостя (T2); персональная ссылка (T5); мелочи (T6).
- **Согласованность:** game_fee RPC зеркалят турнирные (auth host/admin, ключ slot_id); `set_game_fee` 4-арг без ambiguity (2-арг не было); guest-fix не меняет сигнатуру join_tournament (тот же 4-арг). `formatMoney` использует новые символы.
- **Прод-безопасность:** миграции идемпотентны; game_fee_payments RLS enabled без клиентских политик (только definer RPC).
