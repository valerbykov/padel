# Тумблер маскота вкл/выкл (вариант B, на инициалах) — план

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Бесплатный переключатель «Маскот (собаки)» в «Управлении лигой» (дефолт ВКЛ).
При ВЫКЛ активная лига: автозаглушка аватара (при ПУСТОМ avatar_url) — инициалы вместо
собаки; собачий словарь — нейтральный. Личный выбор (собака-пресет/фото) всегда
показывается. Применяется по активной лиге. Скоуп v1 — ин-апп.

**Архитектура:** флаг `mascot` на группе; App выставляет модульный флаг темы
(`setMascotEnabled`) на каждый рендер по активной лиге; `avatar.js` и хелпер словаря
ветвятся по флагу. Инициалы генерятся из имени (SVG data-URI), без ассетов.

**Tech Stack:** Vite + React 18 (JSX), Supabase, i18n ru/en/es.

## Global Constraints

- Спек: `docs/superpowers/specs/2026-07-22-mascot-toggle-design.md` (вариант B).
- Бесплатно всем (не Pro). Личный выбор (непустой `avatar_url`, включая `/avatars/dog-*`) —
  всегда показывается; флаг меняет ТОЛЬКО автозаглушку при пустом url.
- Флаг — модульный в `avatar.js`; App выставляет его синхронно на каждый рендер по
  активной лиге (иначе смена лиги/тумблера не перерисует аватары). Никакого React-контекста
  вокруг avatar-функций (они вызываются инлайн в JSX).
- Русский текст только через i18n; токены темы; ESLint-гейты.
- Скоуп v1 — ин-апп (активная лига). Публичные `/l/`,`/t/`,`/j/` — НЕ трогаем (fast-follow).
- Тест-фреймворка нет: build + eslint + Playwright (лига mascot on/off).
- Прод-миграция — контроллер через Supabase MCP.

---

### Task 1: Поле `mascot` на группе

**Files:** Create `migrations/2026-07-22_group_mascot.sql`

- [ ] **Шаг 1:** `alter table public.groups add column if not exists mascot boolean not null default true;`
- [ ] **Шаг 2:** Применяется контроллером на прод (MCP), дефолт true → все лиги с маскотом.
- [ ] **Шаг 3 (commit).**

---

### Task 2: `avatar.js` — режим инициалов + флаг

**Files:** Modify `src/lib/avatar.js`

**Interfaces:**
- Produces: `setMascotEnabled(bool)` (модульный флаг, дефолт true); `initialsAvatar(idOrName)`.

- [ ] **Шаг 1:** Модульная переменная `let mascotEnabled = true;` + `export function setMascotEnabled(v){ mascotEnabled = v !== false; }`.
- [ ] **Шаг 2:** `initialsAvatar(idOrName)` — SVG data-URI: круг с детерминированным по хэшу
  имени фоном (палитра из нескольких приятных цветов) + 1–2 буквы (инициалы из имени;
  из id — «?»/первая буква). Пример: `data:image/svg+xml;utf8,<svg...>` (encodeURIComponent).
- [ ] **Шаг 3:** Ветвление автозаглушки:
  - `playerAvatar(url, idOrName)`: `url ? url : (mascotEnabled ? dogAvatar(idOrName) : initialsAvatar(idOrName))`.
  - `avatarFallback(idOrName)` (onError): подставлять `dogAvatar` при mascot, иначе `initialsAvatar`.
  - `avatarBg(idOrName)`: фон-заглушка — `dogAvatar` при mascot, иначе `initialsAvatar`.
  - `dogAvatar` НЕ трогаем (пресеты и явный выбор используют его напрямую и должны оставаться собакой).
- [ ] **Шаг 4 (verify):** build + eslint; логически проверить: пустой url + mascot off → инициалы; непустой url (фото ИЛИ `/avatars/dog-*`) → показывается всегда.
- [ ] **Шаг 5 (commit).**

---

### Task 3: Тумблер в «Управлении лигой» + проброс флага

**Files:**
- Modify: `src/App.jsx` (выставлять `setMascotEnabled` по активной лиге на каждый рендер)
- Modify: `src/components/LeagueManager.jsx` (свитч «Маскот» + сохранение)
- Modify: `src/lib/padelApi.js` (mascot в select групп/bootstrap + update группы)
- Modify: `src/lib/locales/{ru,en,es}.js` (`league_mascot_label`, `league_mascot_hint`)

**Interfaces:** Consumes `setMascotEnabled` (Task 2), `groups.mascot` (Task 1).

- [ ] **Шаг 1:** Убедиться, что данные активной лиги содержат `mascot` — добавить колонку в
  select групп (и в `app_bootstrap` RPC, если он формирует leagues; проверить `bootstrapApp`).
  Если RPC формирует leagues без mascot — расширить RPC (миграция) ИЛИ дочитать mascot
  отдельным полем; выбрать минимально-инвазивно, отметить в отчёте.
- [ ] **Шаг 2:** В `App.jsx` вызвать `setMascotEnabled(active?.mascot !== false)` синхронно
  при рендере (до рендера дерева, зависящего от аватаров) — так смена активной лиги и тумблера
  перерисовывают заглушки. Импорт из `./lib/avatar`.
- [ ] **Шаг 3:** В `LeagueManager.jsx` — свитч «Маскот» рядом с `membersCanAdd/Create` (тот же
  паттерн), значение из `group.mascot ?? true`, сохранение через существующий путь апдейта
  группы (добавить `mascot` в payload). Обновить локальный стейт активной лиги, чтобы
  перекрасилось без перезагрузки. Права — как у прочих настроек (владелец/организатор).
- [ ] **Шаг 4:** i18n: `league_mascot_label` ru «Маскот (собаки в аватарах)» / en «Mascot (dog avatars)» /
  es «Mascota (avatares de perros)»; `league_mascot_hint` ru «Выкл — у игроков без фото будут
  инициалы вместо собак» / en «Off — players without a photo get initials instead of dogs» /
  es «Desactivado — los jugadores sin foto tendrán iniciales en vez de perros».
- [ ] **Шаг 5 (verify):** build + eslint; Playwright: включить/выключить в «Управлении» — ростер
  Друзья/История перекрашивается (собаки↔инициалы) без перезагрузки; фото/выбранная собака
  остаются.
- [ ] **Шаг 6 (commit).**

---

### Task 4: Нейтральный словарь по флагу

**Files:**
- Modify: `src/lib/i18n.js` (хелпер выбора) или место рендера тиров
- Modify: `src/lib/locales/{ru,en,es}.js` (нейтральные варианты)
- Modify: `src/PadelLeague.jsx` (тир-бейджи, футер/эмодзи где хардкод)

**Interfaces:** Consumes mascot-флаг (через `avatar.js` `getMascotEnabled()` — добавить геттер в Task 2, ИЛИ передавать флаг; выбрать один способ).

- [ ] **Шаг 1:** Геттер `export function mascotOn(){ return mascotEnabled; }` в `avatar.js`
  (доп. к Task 2). Хелпер `tierLabel(baseKey)`: `mascotOn() ? t(baseKey) : t(baseKey+'_n')`.
- [ ] **Шаг 2:** Нейтральные ключи (ru/en/es), суффикс `_n`, к тир-лестнице (6 + short):
  - `tier_puppy_n` Новичок/Rookie/Novato; `tier_trainee_n` Любитель/Amateur/Aficionado;
    `tier_player_n` Игрок/Player/Jugador; `tier_hunter_n` Опытный/Skilled/Avanzado;
    `tier_predator_n` Мастер/Master/Maestro; `tier_leader_n` Чемпион/Champion/Campeón (+ *_short_n).
  - `tagline_n`: «лига друзей · своя игра на корте» / «friends' league · your game on court» /
    «liga de amigos · tu juego en pista».
  - `sc_footer_n`: «твоя лига 🎾» / «your league 🎾» / «tu liga 🎾».
- [ ] **Шаг 3:** В `PadelLeague.jsx` тир-бейджи брать через `tierLabel(...)`; эмодзи-иконка
  тира (🐶) при mascot off → нейтральная (🎾 или без); хардкод 🐕/«стая» в JSX (демо-герой,
  футер) — через нейтральные ключи по флагу. Слоган/футер — `mascotOn()? t(tagline): t(tagline_n)`.
- [ ] **Шаг 4 (verify):** build + eslint; Playwright: лига mascot=off — тир показывает
  «Чемпион…», слоган/футер без «стаи»/🐕; mascot=on — прежние собачьи термины.
- [ ] **Шаг 5 (commit).**
