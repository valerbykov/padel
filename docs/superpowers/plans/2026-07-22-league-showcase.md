# Витрина лиги «Афиша-герой + живая лента» (фаза A) — план

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Публичная `/l/CODE` получает афишу событий (турниры+игры): ближайшее —
постером-героем, остальные — лентой с «пульсом» и переходом на `/t/`/`/j/`; событие
можно скрыть из афиши тумблером. Только показ и переходы (запись — на существующих
страницах).

**Архитектура:** 2 миграции (поле `listed`; расширение `get_public_league` полями
`events`/`recent`) + правки `LeaguePublicPage.jsx` (секции афиши поверх готового
двухколонника) + тумблер в создании турнира/игры. Всё на CSS-токенах (домашняя тема).

**Tech Stack:** Vite + React 18 (JSX), Supabase Postgres RPC (SECURITY DEFINER, grant anon), i18n ru/en/es.

## Global Constraints

- Спек: `docs/superpowers/specs/2026-07-22-league-showcase-design.md`. Макет:
  `scratchpad/league-hero-feed-mockup.html`.
- Витрина FREE, домашняя тема, только токены (`--bg/--lime/...`); брендинг — не здесь.
- Экспозиция данных = только уже публичное на `/t/`/`/j/` (имена, аватары, взнос,
  места, время записи). Ничего нового чувствительного. RPC — SECURITY DEFINER, grant `anon, authenticated`; существующие поля не менять (обратная совместимость).
- Русский текст в JSX только через i18n `t(...)` (ESLint `no-restricted-syntax`); цвета — токены.
- Фаза A: НЕ трогаем запись/очередь/заявки (переходы на `/t/{code}`, `/j/{code}`); полное событие — ярлык «полный», без кнопки. Realtime/поллинг не добавляем.
- Тест-фреймворка нет: проверка = `NODE_OPTIONS=--max-old-space-size=512 npm run build` + `npx eslint src/` + Playwright 390/1280 на реальной лиге.
- Прод-миграции применяет контроллер через Supabase MCP (проект PadelPack `ofewhhcwswjxvlqsygxu`) с проверкой; деплой Netlify — пользователь.

---

### Task 1: Поле `listed` (тумблер афиши)

**Files:**
- Create: `migrations/2026-07-22_events_listed.sql`

**Interfaces:**
- Produces: `tournaments.listed`, `games.listed` (boolean, not null, default true).

- [ ] **Шаг 1:** Миграция:
```sql
-- Тумблер «показывать событие в афише лиги» (дефолт — показываем).
alter table public.tournaments add column if not exists listed boolean not null default true;
alter table public.games       add column if not exists listed boolean not null default true;
```
- [ ] **Шаг 2:** В отчёте отметить: применяется контроллером на прод через MCP; клиентского кода тут нет; дефолт true → существующие события видны.
- [ ] **Шаг 3 (commit).**

---

### Task 2: Расширение `get_public_league` (events + recent)

**Files:**
- Create: `migrations/2026-07-22_get_public_league_events.sql`

**Interfaces:**
- Consumes: `tournaments.listed`, `games.listed` (Task 1).
- Produces: в возврате `get_public_league(p_code)` появляются ключи `events` и `recent`.

- [ ] **Шаг 1:** Прочитать текущую функцию (`migrations/2026-07-12_public_tournament_avatars.sql`, строки ~33–80) и пересоздать `create or replace`, СОХРАНив все существующие ключи (group-поля, members, member_count, games_count, created_at, logo_url, telegram_url) и добавив два:
  - `'events'` — `jsonb_agg` объединения (турниры `status in ('open','active')` + игры `status='open'`), только `listed = true`, сортировка по `coalesce(starts_at, 'infinity')`, лимит 10. На событие:
    `kind` ('tournament'|'game'), `id`, `invite_code`, `name` (турнир: `name`; игра: `title`), `starts_at`, `place`, `status`, `format` (турнир, иначе null), `level` (турнир `level` jsonb, иначе null), `fee_per_player`, `fee_currency`, `taken` (турнир: count tournament_players; игра: count занятых slots), `target` (турнир: `target_size`; игра: 4), `going` (до 5: `name`+`avatar_url` через left join profiles, по времени записи), `last_join` (`{name, at}` последней записи — для пульса).
  - `'recent'` — 3 последних завершённых (турниры `status='finished'` + игры `status='played'`), сортировка по времени завершения desc: `kind`, `name`, `ended_at`/дата, `format` (для эмодзи). Победителя НЕ включаем в фазе A (дорого) — можно опустить.
  - Если поля вроде `ended_at`/времени завершения нет — использовать доступное (`created_at`/max match time); при неоднозначности взять `created_at` и отметить в отчёте.
- [ ] **Шаг 2 (verify):** после применения (контроллер) — `execute_sql` на реальном коде лиги: `events`/`recent` присутствуют, поля заполнены, порядок верный. В отчёте — фактический пример.
- [ ] **Шаг 3 (commit файла миграции).**

---

### Task 3: Тумблер «Показывать в афише лиги»

**Files:**
- Modify: `src/components/Tournaments.jsx` (мастер создания/редактирования турнира)
- Modify: `src/PadelLeague.jsx` (создание игры) — или там, где создаётся игра
- Modify: `src/lib/tournamentApi.js`, `src/lib/padelApi.js` (проброс `listed` в insert/update)
- Modify: `src/lib/locales/{ru,en,es}.js` (ключ `event_listed_label` + hint)

**Interfaces:**
- Consumes: `tournaments.listed`/`games.listed` (Task 1).

- [ ] **Шаг 1:** Найти insert/update турнира и игры; добавить `listed` (boolean) в payload; в UI создания/редактирования — чекбокс «Показывать в афише лиги», дефолт `true`. Значения через i18n: `event_listed_label: 'Показывать в афише лиги'` (ru) + en/es; hint по вкусу.
- [ ] **Шаг 2:** Read-only/права: тумблером управляет тот, кто и создаёт событие (не менять модель прав).
- [ ] **Шаг 3 (verify):** build + eslint. Создание турнира/игры с галочкой и без — поле пишется (проверить через уже применённый RPC или execute_sql).
- [ ] **Шаг 4 (commit).**

---

### Task 4: Афиша на `/l/CODE` (герой + лента + пульс + стена)

**Files:**
- Modify: `src/components/LeaguePublicPage.jsx`
- Modify: `src/lib/locales/{ru,en,es}.js` (ключи витрины)
- Modify: `src/lib/padelApi.js` (тип возврата `getPublicLeague` — прозрачно; убедиться, что `events`/`recent` доходят)

**Interfaces:**
- Consumes: `getPublicLeague` с `events`/`recent` (Task 2); `useIsWide` (готов).

- [ ] **Шаг 1:** Хелпер относительного времени «N мин/ч назад» (ru/en/es), без библиотек (чистая функция + i18n-ключи `ago_min`/`ago_hour`/`ago_day`/`just_now`).
- [ ] **Шаг 2:** Секции в левой колонке существующего двухколонника (по макету `league-hero-feed-mockup.html`):
  - **Афиша-герой** — первое `events` с `status==='open'` (иначе первое любое): бейдж статуса, Anton-титул, мета (дата/место/уровень/взнос), стек `going` + «N идут», строка пульса из `last_join`, счётчик «осталось `target−taken`» (красный при <3), CTA → `/t/{invite_code}` или `/j/{invite_code}`.
  - **«Дальше в лиге»** — остальные `events` таймлайном: дата-якорь, название, мета, прогресс `taken/target`, стек `going`, кнопка «Записаться»/«N мест»; полный → ярлык «полный» без кнопки; `status==='active'` → «идёт» + «Смотреть» (→ `/t/`).
  - **«Было круто»** — `recent` корешками (эмодзи формата + название + дата).
  - Подиум топ-3 и лидерборд — как сейчас, лидерборд под свёрткой «Полный рейтинг · N».
  - **«Вся стая»** — стена аватаров `members` (первые ~10 + «+N»).
  - Правый sticky — карточка клуба + CTA (существующие «Вступить» + «Записаться на {ближайшее}») + 1–2 строки пульса.
  - Телефон (`!isWide`) — стопкой + **липкая нижняя CTA** «Записаться · осталось N».
- [ ] **Шаг 3 — cold start:** нет `open`-событий → героя нет, показать маскота (🐕/emoji) + `showcase_soon` + Telegram; таймлайн/пульс скрыть; рейтинг/стена — как есть.
- [ ] **Шаг 4:** Ключи i18n (ru/en/es): `showcase_next` («Дальше в лиге»), `showcase_recent` («Было круто»), `showcase_wall` («Вся стая»/«Наши люди»), `showcase_going` («{n} идут»), `showcase_seats_left` («осталось {n}»), `showcase_full` («полный»), `showcase_live` («идёт»), `showcase_watch` («Смотреть»), `showcase_join_next` («Записаться на {name}»), `showcase_soon` («Скоро первое событие»), `showcase_full_rating` («Полный рейтинг · {n}»). Никакой сырой кириллицы в JSX.
- [ ] **Шаг 5 (verify):** build + eslint. Playwright на реальной лиге: 390px (стопка + липкая CTA) и 1280px (герой+таймлайн+sticky); лига без событий (cold start); полное событие (ярлык, без кнопки); идущее (Смотреть); тёмная/светлая. Кнопки ведут на верные `/t/`/`/j/`.
- [ ] **Шаг 6 (commit).**
