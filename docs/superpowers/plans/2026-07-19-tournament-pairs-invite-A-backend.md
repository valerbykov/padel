# Турнир: пары + приглашение — Часть A (бэкенд и логика) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать турнирам данные и логику для записи ПАРАМИ (поле `pair_no`) и обогащённого приглашения (поля `description`/`ends_at`/`contact_*`), с жеребьёвкой KotH из готовых пар и итоговой таблицей по парам.

**Architecture:** Прод-Postgres (Supabase) получает миграции через Supabase MCP (проект `ofewhhcwswjxvlqsygxu`); те же `.sql` кладём в `migrations/`. RPC `join_tournament` расширяется 4-м аргументом `p_pair_no` (создать пару / встать в пару). Чистая логика (`americano.js`, `mexicano.js`) и тонкие обёртки (`tournamentApi.js`) правятся под пары. UI — отдельная Часть B.

**Tech Stack:** Vite + React 18 (plain JS, no TS); Supabase (Postgres + RLS + RPC); ESM. Тест-фреймворка НЕТ — проверяем `build` + ad-hoc `node`-смоук чистых функций + SQL-интроспекцией.

## Global Constraints

- Node с тесным heap: префикс `NODE_OPTIONS=--max-old-space-size=512` для node/npm. Билд может OOM под этим лимитом — не поднимать молча, всплыть.
- Plain JavaScript/JSX, TypeScript НЕТ.
- Комментарии и любая копия — по-русски. Бренды конкурентов в копии не используем.
- Миграции применяются на ПРОД через Supabase MCP `apply_migration` (проект `ofewhhcwswjxvlqsygxu`); дубликат `.sql` — в `migrations/`.
- Парные форматы: `king_of_hill` (есть), `round_robin` (будущее E), `beat_the_box` (легаси). Solo: `americano`, `mexicano`.
- НЕ деплоить (Netlify-кредиты, батчинг). Коммитить каждый таск.
- Существующий столбец `tournament_players.seat` НЕ трогаем; пары держим на `pair_no`.
- Клиент вызывает `join_tournament` тремя именованными аргументами сегодня; после Task 3 — всегда четырьмя (`p_pair_no` включительно), чтобы PostgREST резолвил новый 4-арг оверлоад.

---

### Task 1: Миграция — `pair_no` + поля приглашения + страховочный триггер

**Files:**
- Create: `migrations/2026-07-19_tournament_pairs_and_invite_fields.sql`
- Apply: Supabase MCP `apply_migration` (проект `ofewhhcwswjxvlqsygxu`)

**Interfaces:**
- Produces: колонка `tournament_players.pair_no integer`; колонки `tournaments.description text`, `ends_at timestamptz`, `contact_name text`, `contact_link text`; триггер `trg_tournament_pair_max2` (не даёт вставить 3-го в пару, `raise 'pair_full'`).

- [ ] **Step 1: Написать миграцию**

Создать `migrations/2026-07-19_tournament_pairs_and_invite_fields.sql`:

```sql
-- Пары: pair_no на tournament_players (два ряда с одним pair_no = пара;
-- открытая пара = pair_no с одним рядом). Плюс поля приглашения на tournaments.
alter table tournament_players add column if not exists pair_no integer;
create index if not exists tournament_players_pair_idx
  on tournament_players (tournament_id, pair_no) where pair_no is not null;

alter table tournaments add column if not exists description text;
alter table tournaments add column if not exists ends_at timestamptz;
alter table tournaments add column if not exists contact_name text;
alter table tournaments add column if not exists contact_link text;

-- Страховка: не больше 2 игроков на (tournament_id, pair_no). RPC проверяет тоже,
-- но триггер закрывает гонку (двое напарников на одно место одновременно).
create or replace function public.tournament_pair_max2()
returns trigger language plpgsql as $$
begin
  if NEW.pair_no is not null then
    if (select count(*) from tournament_players
          where tournament_id = NEW.tournament_id and pair_no = NEW.pair_no
            and id <> NEW.id) >= 2 then
      raise exception 'pair_full';
    end if;
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_tournament_pair_max2 on tournament_players;
create trigger trg_tournament_pair_max2
  before insert or update of pair_no, tournament_id on tournament_players
  for each row execute function public.tournament_pair_max2();
```

- [ ] **Step 2: Применить на прод через Supabase MCP**

Вызвать `apply_migration` с `project_id: "ofewhhcwswjxvlqsygxu"`, `name: "tournament_pairs_and_invite_fields"`, `query` = содержимое файла.
Expected: `{"success":true}`.

- [ ] **Step 3: Проверить структуру SQL-интроспекцией**

Через Supabase MCP `execute_sql` (project `ofewhhcwswjxvlqsygxu`):

```sql
select
  (select count(*) from information_schema.columns
     where table_name='tournament_players' and column_name='pair_no') as has_pair_no,
  (select count(*) from information_schema.columns
     where table_name='tournaments' and column_name in ('description','ends_at','contact_name','contact_link')) as trn_fields,
  (select count(*) from pg_trigger where tgname='trg_tournament_pair_max2') as has_trigger;
```
Expected: `has_pair_no=1`, `trn_fields=4`, `has_trigger=1`.

- [ ] **Step 4: Commit**

```bash
git add migrations/2026-07-19_tournament_pairs_and_invite_fields.sql
git commit -m "миграция: pair_no + поля приглашения + триггер max-2-в-паре"
```

---

### Task 2: Миграция — `join_tournament` c `p_pair_no` (4-арг оверлоад)

**Files:**
- Create: `migrations/2026-07-19_join_tournament_pairs.sql`
- Apply: Supabase MCP `apply_migration`

**Interfaces:**
- Consumes: колонка `pair_no` (Task 1), триггер (Task 1).
- Produces: функция `join_tournament(p_code text, p_name text, p_profile_id uuid, p_pair_no integer)` → `jsonb`. Возвраты: `{ok:true}` (solo/новый), `{ok,already:true}`, `{ok,linked:true}`, `{ok,pair_no:N}` (создана/занята пара). Исключения: `tournament_not_found`, `tournament_closed`, `tournament_full`, `pair_not_found`, `pair_full`.

- [ ] **Step 1: Написать миграцию**

Создать `migrations/2026-07-19_join_tournament_pairs.sql`. Это НОВЫЙ 4-арг оверлоад; легаси 2-арг и 3-арг оставляем, их почистим отдельной миграцией после батча. **`p_profile_id` и `p_pair_no` — БЕЗ `default`**: с default'ами 3-арг вызов легаси-функции становится неоднозначным (`function is not unique`) и запись на турнир падает. Без default'ов 3-арг вызов резолвится в легаси, 4-арг — в эту (клиент всегда шлёт 4 арг):

```sql
-- Запись парами: 4-й аргумент p_pair_no. null на парном формате → создать пару
-- (вернуть её номер); N → встать напарником в пару N (атомарность добивает триггер
-- max-2). solo-форматы p_pair_no игнорируют. Профиль строго из auth.uid();
-- привязка гостя — только по верифиц. email/phone/telegram (по имени убрана ранее).
drop function if exists public.join_tournament(text, text, uuid, integer);
create function public.join_tournament(
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
begin
  select * into v_t from tournaments where invite_code = upper(p_code);
  if not found then raise exception 'tournament_not_found'; end if;
  if v_t.status <> 'open' then raise exception 'tournament_closed'; end if;

  v_is_pair := v_t.format = any(array['king_of_hill','round_robin','beat_the_box']);

  if v_uid is not null then
    select * into v_me from profiles where user_id = v_uid;
    v_pid := v_me.id;
  else
    v_pid := null;
  end if;

  -- (a) уже участвует тем же профилем → идемпотентно
  if v_pid is not null and exists (
       select 1 from tournament_players where tournament_id = v_t.id and profile_id = v_pid
     ) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  -- (b) тот же человек уже добавлен ГОСТЕМ → привязка по ВЕРИФИЦ. контакту
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
            or (nullif(btrim(v_me.phone), '') is not null and (
                    nullif(btrim(pr.phone), '') = nullif(btrim(v_me.phone), '')
                 or nullif(btrim(pr.contacts->>'phone'), '') = nullif(btrim(v_me.phone), '')
               ))
            or (nullif(btrim(v_me.contacts->>'telegram'), '') is not null
                and lower(nullif(btrim(pr.contacts->>'telegram'), ''))
                  = lower(nullif(btrim(v_me.contacts->>'telegram'), '')))
          )
        limit 1
     );
    if found then
      return jsonb_build_object('ok', true, 'linked', true);
    end if;
  end if;

  -- ёмкость (число игроков)
  select count(*) into v_count from tournament_players where tournament_id = v_t.id;
  if v_count >= v_t.target_size then raise exception 'tournament_full'; end if;

  -- (c) парный формат: создать пару или встать в пару N
  if v_is_pair then
    if p_pair_no is null then
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

  -- (d) solo — плоская вставка
  insert into tournament_players (tournament_id, name, profile_id)
  values (v_t.id, p_name, v_pid);
  return jsonb_build_object('ok', true);
end; $function$;
```

- [ ] **Step 2: Применить на прод**

`apply_migration` project `ofewhhcwswjxvlqsygxu`, name `join_tournament_pairs`, query = файл.
Expected: `{"success":true}`.

- [ ] **Step 3: Проверить, что 4-арг оверлоад существует**

`execute_sql`:
```sql
select count(*) as has_4arg from pg_proc
where proname='join_tournament'
  and pg_get_function_identity_arguments(oid) = 'p_code text, p_name text, p_profile_id uuid, p_pair_no integer';
```
Expected: `has_4arg=1`.

- [ ] **Step 4: Смоук создания пары анонимом (гость)**

Создаём временный открытый парный турнир и дважды зовём RPC (аноним → гость, путь `p_pair_no=null` создаёт пару, затем `p_pair_no=<номер>` занимает её). `execute_sql`:
```sql
do $$
declare v_id uuid; r1 jsonb; r2 jsonb; v_pn int; v_cnt int;
begin
  insert into tournaments (group_id, invite_code, name, format, points_per_game, target_size, status)
  values (null, 'ZZTEST', 'pairtest', 'king_of_hill', 24, 8, 'open') returning id into v_id;
  r1 := public.join_tournament('ZZTEST','Гость A', null, null);
  v_pn := (r1->>'pair_no')::int;
  r2 := public.join_tournament('ZZTEST','Гость B', null, v_pn);
  select count(*) into v_cnt from tournament_players where tournament_id=v_id and pair_no=v_pn;
  raise notice 'r1=% r2=% count=%', r1, r2, v_cnt;  -- ожидаем pair_no у обоих, count=2
  assert v_cnt = 2, 'pair should have 2 members';
  assert (r2->>'pair_no')::int = v_pn, 'second joins same pair';
  delete from tournaments where id = v_id;  -- убираем тестовые данные
end $$;
```
Expected: NOTICE с `count=2`, ассерты проходят, тестовый турнир удалён.

- [ ] **Step 5: Commit**

```bash
git add migrations/2026-07-19_join_tournament_pairs.sql
git commit -m "миграция: join_tournament + p_pair_no (создать/занять пару)"
```

---

### Task 3: `tournamentApi.js` — проброс `pair_no` и полей приглашения

**Files:**
- Modify: `src/lib/tournamentApi.js` (T_SELECT :13-16; `createTournament` :18-35; `addTournamentPlayer` :97-112; `joinTournamentByCode` :120-133)

**Interfaces:**
- Consumes: RPC 4-арг (Task 2).
- Produces: `createTournament(groupId, {..., description, endsAt, contactName, contactLink})`; `addTournamentPlayer(tournamentId, {profileId, name, pairNo})`; `joinTournamentByCode(code, name, pairNo=null)` (всегда шлёт `p_pair_no`); `getTournament`/`_listTournaments` возвращают `pair_no` у игроков и `description`/`ends_at`/`contact_*` у турнира.

- [ ] **Step 1: Расширить T_SELECT**

В `src/lib/tournamentApi.js` заменить блок `T_SELECT` (:13-16) на:

```js
const T_SELECT =
  "id, invite_code, name, format, points_per_game, target_size, status, court_names, koth_champion_rule, created_by, created_at, starts_at, ends_at, place, description, contact_name, contact_link, open_scoring, " +
  "players:tournament_players(id, profile_id, name, pair_no, created_at, profile:profiles(name, avatar_url)), " +
  "matches:tournament_matches(id, round_number, court, team_a, team_b, score_a, score_b)";
```

- [ ] **Step 2: Принять новые поля в `createTournament`**

Заменить сигнатуру и insert `createTournament` (:18-35) на:

```js
export async function createTournament(groupId, { name, pointsPerGame = 32, targetSize = 8, createdBy, format = "americano", startsAt, endsAt, place, description, contactName, contactLink, kotHChampionRule, openScoring = false } = {}) {
  let t = null;
  for (let i = 0; i < 5; i++) {
    const res = await supabase.from("tournaments").insert({
      group_id: groupId, invite_code: genCode(), name: name?.trim() || null,
      points_per_game: pointsPerGame, target_size: targetSize, created_by: createdBy || null,
      status: "open", format,
      koth_champion_rule: format === "king_of_hill" ? (kotHChampionRule || "court_1") : null,
      starts_at: startsAt || null, ends_at: endsAt || null, place: place?.trim() || null,
      description: description?.trim() || null,
      contact_name: contactName?.trim() || null, contact_link: contactLink?.trim() || null,
      open_scoring: !!openScoring,
    }).select().single();
    if (!res.error) { t = res.data; break; }
    if (res.error.code !== "23505") throw res.error;
  }
  if (!t) throw new Error("Не удалось сгенерировать код");
  bustCache();
  return t;
}
```

- [ ] **Step 3: Принять `pairNo` в `addTournamentPlayer`**

Заменить `addTournamentPlayer` (:97-112) на:

```js
export async function addTournamentPlayer(tournamentId, { profileId = null, name, pairNo = null }) {
  // Идемпотентность для зарегистрированных: двойной тап «Занять» не должен
  // добавлять игрока дважды (дубль ломает жеребьёвку).
  if (profileId) {
    const { data: dup, error: dupErr } = await supabase.from("tournament_players")
      .select("id").eq("tournament_id", tournamentId).eq("profile_id", profileId).limit(1);
    if (dupErr) throw dupErr;
    if (dup && dup.length > 0) return;
  }
  const row = { tournament_id: tournamentId, profile_id: profileId, name: name.trim() };
  if (pairNo != null) row.pair_no = pairNo;
  const { error } = await supabase.from("tournament_players").insert(row);
  if (error) throw error;
  bustCache();
}
```

- [ ] **Step 4: Пробросить `p_pair_no` в `joinTournamentByCode`**

Заменить `joinTournamentByCode` (:120-133) на:

```js
export async function joinTournamentByCode(code, name, pairNo = null) {
  let profileId = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    profileId = data?.id || null;
  }
  const { data, error } = await supabase.rpc("join_tournament", {
    p_code: code, p_name: name.trim(), p_profile_id: profileId, p_pair_no: pairNo,
  });
  if (error) throw error;
  bustCache();
  return data; // { ok, already?, linked?, pair_no? }
}
```

- [ ] **Step 5: Проверить сборку**

Run: `NODE_OPTIONS=--max-old-space-size=512 npm run build`
Expected: `✓ built` без ошибок.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tournamentApi.js
git commit -m "tournamentApi: проброс pair_no и полей приглашения"
```

---

### Task 4: `mexicano.js` — `buildKotHLadderStart` из готовых пар (без shuffle)

**Files:**
- Modify: `src/lib/mexicano.js` (:50-61)
- Test: `/tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-koth.mjs` (временный)

**Interfaces:**
- Produces: `pairsFromPlayers(players)` → `[[idA,idB], …]` (группировка по `pair_no`, валидация полноты); `buildKotHLadderStart(pairs)` теперь принимает МАССИВ ПАР (а не playerIds), раскладывает по кортам без перемешивания.

- [ ] **Step 1: Написать смоук-тест (упадёт)**

Создать временный `scratchpad/smoke-koth.mjs`:

```js
import assert from "node:assert/strict";
import { buildKotHLadderStart, pairsFromPlayers } from "/root/padel-app/src/lib/mexicano.js";

// 4 пары (8 игроков), pair_no 1..4
const players = [
  { id: "a", pair_no: 1 }, { id: "b", pair_no: 1 },
  { id: "c", pair_no: 2 }, { id: "d", pair_no: 2 },
  { id: "e", pair_no: 3 }, { id: "f", pair_no: 3 },
  { id: "g", pair_no: 4 }, { id: "h", pair_no: 4 },
];
const pairs = pairsFromPlayers(players);
assert.equal(pairs.length, 4, "4 пары");
const m = buildKotHLadderStart(pairs);
assert.equal(m.length, 2, "2 корта из 4 пар, got " + m.length);
assert.ok(m[0].court === 1 && m[1].court === 2, "корты 1,2");
assert.deepEqual(m[0].team_a, ["a", "b"], "корт1 teamA = пара1");
assert.deepEqual(m[0].team_b, ["c", "d"], "корт1 teamB = пара2");
assert.equal(m[0].round_number, 1, "round 1");
// неполная пара → исключение
assert.throws(() => pairsFromPlayers([{ id: "a", pair_no: 1 }]), "неполная пара бросает");
console.log("OK smoke-koth");
```

- [ ] **Step 2: Запустить — упадёт (нет `pairsFromPlayers`)**

Run: `NODE_OPTIONS=--max-old-space-size=512 node /tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-koth.mjs`
Expected: FAIL — `pairsFromPlayers is not a function` / ошибка импорта.

- [ ] **Step 3: Реализовать**

В `src/lib/mexicano.js` заменить `buildKotHLadderStart` (:50-61) на:

```js
/**
 * Собрать пары из ростера по pair_no. players: [{id, pair_no}].
 * Возвращает [[idA,idB], …] в порядке возрастания pair_no. Бросает, если у кого-то
 * нет pair_no или пара неполна (полноту гарантирует старт-гейт в UI).
 */
export function pairsFromPlayers(players) {
  const groups = new Map();
  for (const p of players) {
    if (p.pair_no == null) throw new Error("У игрока нет пары");
    const g = groups.get(p.pair_no) || [];
    g.push(p.id);
    groups.set(p.pair_no, g);
  }
  const pairs = [];
  for (const pn of [...groups.keys()].sort((a, b) => a - b)) {
    const ids = groups.get(pn);
    if (ids.length !== 2) throw new Error("Пара неполна");
    pairs.push(ids);
  }
  return pairs;
}

/** Старт KotH: раунд 1 — все корты, по 2 ФИКС-пары на корт. Пары приходят готовыми
 *  (из pair_no), НЕ перемешиваем. pairs: [[idA,idB], …]. */
export function buildKotHLadderStart(pairs) {
  const courts = Math.floor(pairs.length / 2);
  const matches = [];
  for (let c = 0; c < courts; c++) {
    matches.push({ round_number: 1, court: c + 1, team_a: pairs[2 * c], team_b: pairs[2 * c + 1] });
  }
  return matches;
}
```

Удалить ставший ненужным импорт `shuffle`, если он больше нигде в файле не используется. Проверить: `shuffle` ещё используется в `buildFirstRound`, `buildKotHStart` — значит импорт ОСТАВИТЬ (не трогать строку 4).

- [ ] **Step 4: Запустить смоук — пройдёт**

Run: `NODE_OPTIONS=--max-old-space-size=512 node /tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-koth.mjs`
Expected: `OK smoke-koth`, без вывода `console.assert`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mexicano.js
git commit -m "mexicano: buildKotHLadderStart из готовых пар (pairsFromPlayers, без shuffle)"
```

---

### Task 5: `tournamentApi.startTournament` — валидация пар и передача их в жеребьёвку

**Files:**
- Modify: `src/lib/tournamentApi.js` (`startTournament` :150-186; импорт :4)

**Interfaces:**
- Consumes: `pairsFromPlayers`, `buildKotHLadderStart(pairs)` (Task 4).
- Produces: `startTournament(tournamentId, players, format)` — для `king_of_hill` строит пары из `pair_no` (валидирует полноту/чётность, иначе `throw`) и передаёт их в лесенку; остальные форматы без изменений.

- [ ] **Step 1: Добавить импорт `pairsFromPlayers`**

В `src/lib/tournamentApi.js` заменить строку импорта (:4):

```js
import { buildFirstRound, buildMexicanoRound, buildKotHStart, buildKotHNextMatch, buildKotHLadderStart, buildKotHLadderRound, pairsFromPlayers } from "./mexicano";
```

- [ ] **Step 2: Строить пары для KotH внутри `startTournament`**

В `startTournament` (:150-186): валидацию количества игроков для KotH оставляем (kratno 4). Заменить блок выбора `rawMatches` (:172-176) на:

```js
  let rawMatches;
  if (isBtb) rawMatches = buildKotHStart(ids);
  else if (isKoth) rawMatches = buildKotHLadderStart(pairsFromPlayers(players));
  else if (format === "mexicano") rawMatches = buildFirstRound(ids);
  else rawMatches = buildMatches(ids);
```

Примечание: `pairsFromPlayers(players)` бросит понятную ошибку, если пары не сформированы — старт-гейт в UI (Часть B) до этого не доводит; на легаси-KotH без `pair_no` старт честно упадёт, а не соберёт случайные пары.

- [ ] **Step 3: Проверить сборку**

Run: `NODE_OPTIONS=--max-old-space-size=512 npm run build`
Expected: `✓ built` без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/lib/tournamentApi.js
git commit -m "startTournament: KotH стартует из pair_no-пар (валидация полноты)"
```

---

### Task 6: `americano.js` — итоговая таблица ПО ПАРАМ (`pairStandings`)

**Files:**
- Modify: `src/lib/americano.js` (добавить экспорт в конец файла, после `detailedStandings`)
- Test: `scratchpad/smoke-pairstandings.mjs` (временный)

**Interfaces:**
- Produces: `pairStandings(players, matches)` → `[{ id:"pair-N", pair_no, ids:[a,b], name:"A & B", points, against, wins, draws, losses, played, delta }]`, сортировка по `points`, затем `delta`. Очки берутся по КОМАНДЕ (через `pair_no` первого игрока команды), без задвоения партнёров.

- [ ] **Step 1: Написать смоук (упадёт)**

Создать `scratchpad/smoke-pairstandings.mjs`:

```js
import assert from "node:assert/strict";
import { pairStandings } from "/root/padel-app/src/lib/americano.js";

const players = [
  { id: "a", name: "Аня", pair_no: 1 }, { id: "b", name: "Игорь", pair_no: 1 },
  { id: "c", name: "Макс", pair_no: 2 }, { id: "d", name: "Дима", pair_no: 2 },
];
// пара1 (a,b) обыграла пару2 (c,d) 24:18
const matches = [
  { round_number: 1, court: 1, team_a: ["a", "b"], team_b: ["c", "d"], score_a: 24, score_b: 18 },
];
const rows = pairStandings(players, matches);
assert.equal(rows.length, 2, "2 пары");
assert.equal(rows[0].pair_no, 1, "лидер — пара 1");
assert.equal(rows[0].points, 24, "очки пары = 24 (не задвоены), got " + rows[0].points);
assert.equal(rows[0].against, 18, "против = 18");
assert.ok(rows[0].wins === 1 && rows[0].losses === 0, "1 победа");
assert.equal(rows[0].played, 1, "1 сыгранный матч, got " + rows[0].played);
assert.equal(rows[0].name, "Аня & Игорь", "имя пары");
assert.equal(rows[0].delta, 6, "дельта 6");
assert.ok(rows[1].pair_no === 2 && rows[1].losses === 1, "пара 2 проиграла");
console.log("OK smoke-pairstandings");
```

- [ ] **Step 2: Запустить — упадёт**

Run: `NODE_OPTIONS=--max-old-space-size=512 node /tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-pairstandings.mjs`
Expected: FAIL — `pairStandings is not a function`.

- [ ] **Step 3: Реализовать**

В конец `src/lib/americano.js` добавить:

```js
// Итоговая таблица ПО ПАРАМ (парные форматы, напр. King of the Court). Очки
// начисляем по КОМАНДЕ через pair_no первого игрока команды — партнёры на одной
// стороне, поэтому суммировать двоих нельзя (задвоит). players: [{id,name,pair_no}].
export function pairStandings(players, matches) {
  const groups = {}; // pair_no -> { ids:[], names:[] }
  const pairOf = {}; // player id -> pair_no
  players.forEach((p) => {
    if (p.pair_no == null) return;
    const g = groups[p.pair_no] || (groups[p.pair_no] = { ids: [], names: [] });
    g.ids.push(p.id); g.names.push(p.name);
    pairOf[p.id] = p.pair_no;
  });
  const acc = {};
  Object.keys(groups).forEach((pn) => { acc[pn] = { points: 0, against: 0, wins: 0, draws: 0, losses: 0, played: 0 }; });
  for (const m of matches) {
    if (m.score_a == null || m.score_b == null) continue;
    const pa = pairOf[(m.team_a || [])[0]];
    const pb = pairOf[(m.team_b || [])[0]];
    const aWin = m.score_a > m.score_b, draw = m.score_a === m.score_b;
    if (pa != null && acc[pa]) {
      const s = acc[pa]; s.points += m.score_a; s.against += m.score_b; s.played++;
      if (draw) s.draws++; else if (aWin) s.wins++; else s.losses++;
    }
    if (pb != null && acc[pb]) {
      const s = acc[pb]; s.points += m.score_b; s.against += m.score_a; s.played++;
      if (draw) s.draws++; else if (!aWin) s.wins++; else s.losses++;
    }
  }
  return Object.keys(groups)
    .map((pn) => ({
      id: `pair-${pn}`, pair_no: Number(pn), ids: groups[pn].ids,
      name: groups[pn].names.join(" & "),
      ...acc[pn], delta: acc[pn].points - acc[pn].against,
    }))
    .sort((a, b) => b.points - a.points || b.delta - a.delta);
}
```

- [ ] **Step 4: Запустить смоук — пройдёт**

Run: `NODE_OPTIONS=--max-old-space-size=512 node /tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-pairstandings.mjs`
Expected: `OK smoke-pairstandings`.

- [ ] **Step 5: Финальная сборка + чистка смоук-файлов**

Run: `NODE_OPTIONS=--max-old-space-size=512 npm run build`
Expected: `✓ built`.
Затем удалить временные смоук-скрипты:
```bash
rm -f /tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-koth.mjs /tmp/claude-0/-root-padel-app/3adcedd6-1e75-452c-a00e-49f1b2a82b4b/scratchpad/smoke-pairstandings.mjs
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/americano.js
git commit -m "americano: pairStandings — итоговая таблица по парам"
```

---

## Deferred (не в Части A)

- **Часть B (UI)**: `TournamentJoin.jsx` (афиша + поля E1 + секция записи парами, ссылки `/t/CODE?pair=N`), `Tournaments.jsx` (ростер по парам, `AddPlayer` c `pairNo`, экран формирования пар на старте с блокировкой, поля в форме создания, подключение `pairStandings` + подсветка чемпион-пары), i18n-ключи (ru/en/es). Пишется после верификации Части A.
- **Чистка оверлоадов**: отдельной миграцией после батч-деплоя дропнуть легаси `join_tournament(text,text)` и `join_tournament(text,text,uuid)`, оставив только 4-арг (снимает готчу двух оверлоадов).
- E4 (взносы+валюта), E3 (уровни), E (Round Robin) — свои спеки.

## Self-review

- **Покрытие спека (Часть A):** `pair_no` + поля приглашения (Task 1) ✓; RPC `p_pair_no` создать/занять пару + возврат номера (Task 2) ✓; API-проброс (Task 3) ✓; `buildKotHLadderStart` из `pair_no` без рандома (Task 4-5) ✓; таблица по парам (Task 6) ✓. UI-части (афиша, экран формирования пар, ростер) — сознательно в Части B.
- **Плейсхолдеров нет:** весь SQL/JS приведён целиком.
- **Согласованность типов:** `pairsFromPlayers(players)→[[id,id]]` потребляется `buildKotHLadderStart(pairs)` (Task 4) и `startTournament` (Task 5); `join_tournament` возвращает `pair_no` (Task 2), который `joinTournamentByCode` отдаёт наверх (Task 3); `pairStandings` возвращает строки с `id/name/points/…/delta`, совместимые с `StandingsTable` (подключение — Часть B).
