# Публичная `/t/CODE` — афиша, профили, широкий экран, единый вход — план

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Гостевая страница турнира `/t/CODE` переходит на афишу + участники (строки на
телефоне, большие профили-карточки на десктопе) с бейджами уровня Playtomic/Lunda,
двухколонной раскладкой ≥900px; единый одиночный «Войти» на всех публичных страницах.

**Архитектура:** Публичный RPC отдаёт `levels`. Афиша выносится из `TournamentView` в
общий `TournamentPoster` (один источник). Новый `PublicRoster` рендерит участников
(карточки/строки + бейджи + дашед-слоты). `TournamentJoin` для открытого гостя
компонует афишу + ростер + запись через `useIsWide`/`WideSplit`. «Войти» переезжает в
общий `PublicToggles`.

**Tech Stack:** Vite + React 18 (JSX, без TS), Supabase (Postgres RPC), i18n ru/en/es.

## Global Constraints

- Спек: `docs/superpowers/specs/2026-07-22-public-tournament-wide-design.md`. Макет: `scratchpad/t-guest-wide-mockup.html` (v4).
- Русский текст в JSX — только через i18n-ключи (ESLint-гейт `no-restricted-syntax`).
- Цвета — только через CSS-токены темы (никакого хардкода; ESLint-гейт).
- Тест-фреймворка нет: проверка каждой задачи = `NODE_OPTIONS=--max-old-space-size=512 npm run build` без ошибок + `npx eslint src/` чисто + (где визуально) Playwright/скрин на 390px и ≥1280px.
- Телефонная логика записи (`join()`, гость/сессия) не меняется — только презентация.
- Рейтинг/звания на публичную НЕ выносим. Только `levels`.
- Натив функционально не затрагивается (та же вёрстка <900px).
- Деплой Netlify и прод-миграции — вручную пользователем, не в рамках задач.

---

### Task 1: Публичный RPC отдаёт `levels`

**Files:**
- Create: `migrations/2026-07-22_get_tournament_by_code_levels.sql`

**Interfaces:**
- Produces: в агрегате `players` появляется поле `levels` (jsonb-массив `[{sys,val}]`).

- [ ] **Шаг 1:** Скопировать тело текущей функции из `migrations/2026-07-19_get_tournament_by_code_pair_no.sql` и добавить одно поле в `jsonb_build_object` игроков — `'levels', p.levels` (рядом с `'avatar_url', p.avatar_url`). Профиль уже приджойнен (`left join profiles p on p.id = tp.profile_id`). Полный файл:

```sql
-- Добавляем levels игрока в публичный агрегат players (бейджи уровня на /t/CODE).
create or replace function public.get_tournament_by_code(p_code text)
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select to_jsonb(t) - 'group_id' - 'created_by' || jsonb_build_object(
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tp.id, 'profile_id', tp.profile_id, 'name', tp.name,
        'pair_no', tp.pair_no,
        'created_at', tp.created_at,
        'avatar_url', p.avatar_url,
        'levels', p.levels
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
grant execute on function public.get_tournament_by_code(text) to anon, authenticated;
```

- [ ] **Шаг 2:** В отчёте отметить: миграцию применяет пользователь на прод-БД (Mac/Supabase). Старые клиенты лишнее поле игнорируют. Правок клиента здесь нет.
- [ ] **Шаг 3 (commit):** `git add migrations/2026-07-22_get_tournament_by_code_levels.sql && git commit`.

---

### Task 2: Вынести афишу в общий `TournamentPoster`

**Files:**
- Modify: `src/components/Tournaments.jsx` (блок `const afisha` — строки ~983–1059; использование `{afisha}` ~строка 1068)
- Возможно Create: `src/components/TournamentPoster.jsx` (или экспорт из `Tournaments.jsx`)

**Interfaces:**
- Produces: `export function TournamentPoster({ trn, fmt, readOnly, onShare, onTv, onDelete, avatarOfTp, toast })` — рендерит текущий `.trp-poster` 1:1. Действия (share/tv/delete) опциональны: не переданы → не показываются.

- [ ] **Шаг 1:** Вынести JSX-блок афиши (`.trp-poster` … контакт) в компонент `TournamentPoster`. Внутренние зависимости передать пропсами: `trn` (данные), `fmt`, `readOnly`, коллбэки `onShare/onTv/onDelete`, `avatarOfTp`, `toast`, `isKoth`. CSS `.trp-*` уже глобальный (в `css` строки 102–119) — оставить как есть (или перенести вместе; НЕ дублировать).
- [ ] **Шаг 2:** В `TournamentView` заменить инлайновый `const afisha` на `<TournamentPoster ... />` с теми же значениями (share=`share`, tv=`() => setTvOpen(true)` при active, delete при isGroupMember). Визуально идентично.
- [ ] **Шаг 3 (verify):** build + eslint чисто. Playwright/скрин in-app афиши (набор/идёт/завершён) — парити с текущим (титул, мета-строки, взнос, контакт, кнопки на месте).
- [ ] **Шаг 4 (commit).**

---

### Task 3: Компонент `PublicRoster`

**Files:**
- Create: `src/components/PublicRoster.jsx`

**Interfaces:**
- Consumes: `LevelBadges` (`./LevelBadges`), `Avatar`/`avatar.js`, `groupPairs` (`../lib/pairs`).
- Produces: `export default function PublicRoster({ players, targetSize, isWide, isPair })`.

- [ ] **Шаг 1:** Реализовать презентационный (read-only) ростер:
  - `isWide` → сетка `repeat(3,1fr)` карточек: аватар 58px (`playerAvatar`/`dogAvatar`), имя, `<LevelBadges levels={p.levels} compact />`; + дашед-карточки на `max(0, targetSize − players.length)` свободных мест («свободно»).
  - `!isWide` → строки (borderBottom): аватар 36px + имя + `<LevelBadges levels={p.levels} compact />` в конце; + дашед-строки свободных мест.
  - `isPair` → группировать через `groupPairs(players)` и рендерить парами (номер + два игрока, как в приложении, но без ✕/контролов).
  - Стили — токенами темы; классы можно локальным `<style>` или инлайн (как в `TournamentJoin`).
- [ ] **Шаг 2 (verify):** build + eslint. Мини-проверка обоих режимов (можно временным маршрутом/скрином): карточки с бейджами и без (пустой `levels` → без бейджа), дашед-слоты по счётчику.
- [ ] **Шаг 3 (commit).**

---

### Task 4: Двухколонная гостевая `/t/` (открытый турнир)

**Files:**
- Modify: `src/components/TournamentJoin.jsx` (join-ветка открытого турнира: ~строки 144–358; CSS `.tj-*` строки 34–46)
- Modify: `src/lib/locales/{ru,en,es}.js` (добавить `pub_guest_rating_hint`)
- Consumes: `useIsWide` (`./wide/wide.js`), `TournamentPoster` (Task 2), `PublicRoster` (Task 3).

**Interfaces:**
- Consumes: `TournamentPoster`, `PublicRoster`, `useIsWide`.

- [ ] **Шаг 1:** Добавить ключ `pub_guest_rating_hint` в ru/en/es:
  - ru: `pub_guest_rating_hint: 'Как гость — без учёта в рейтинге. Войти сверху, чтобы результат засчитался.'`
  - en: `pub_guest_rating_hint: 'As a guest you play without rating. Sign in above so your result counts.'`
  - es: `pub_guest_rating_hint: 'Como invitado juegas sin ranking. Inicia sesión arriba para que cuente tu resultado.'`
- [ ] **Шаг 2:** Для открытого турнира (`t.status==="open" && !joined`) заменить старую чиповую join-карточку композицией: `TournamentPoster` (readOnly) + `PublicRoster` (players/targetSize/isPair) + join-блок (имя гостя + «Присоединиться» + `pub_guest_rating_hint` как `.jhint`, НЕ кнопка). Функцию `join()` и связанную логику не менять.
- [ ] **Шаг 3:** Раскладка через `const isWide = useIsWide()`:
  - `isWide` → грид `grid-template-columns:1fr 372px; gap:24px; align-items:start; max-width:980px; margin:0 auto` — слева `TournamentPoster`+`PublicRoster` (isWide=true), справа join-карточка (`position:sticky; top:16`).
  - `!isWide` → стопкой: `TournamentPoster`, `PublicRoster` (isWide=false), join-блок. `.tj-wrap` расширить до `max-width` десктопа при isWide (или обернуть контейнером с адаптивным max-width, как в `PadelLeague`).
  - Сфокусированный вид пары (`focusedPair`) и не-open статусы — не трогаем (идут прежним путём/через `TournamentView`).
- [ ] **Шаг 4 (verify):** build + eslint. Playwright/скрин на 390px (стопка, строки+бейджи, дашед-строки) и 1280px (две колонки, большие профили, дашед-карточки, sticky-запись, подсказка). Тёмная/светлая тема. Турнир парами.
- [ ] **Шаг 5 (commit).**

---

### Task 5: Единый «Войти» в `PublicToggles` + подчистка страниц

**Files:**
- Modify: `src/components/publicChrome.jsx` (`PublicToggles`)
- Modify: `src/components/TournamentJoin.jsx` (убрать кнопку `pub_login` ~152 и уже убранную `pub_login_for_rating2`)
- Modify: `src/components/GuestJoin.jsx` (убрать `gj-loginlink pub_login_for_rating` ~194; добавить подсказку)
- Modify: `src/components/LeaguePublicPage.jsx` (передать `onLogin` в `PublicToggles`)
- Modify: `src/lib/locales/{ru,en,es}.js` (удалить `pub_login_for_rating`, `pub_login_for_rating2`)

**Interfaces:**
- Produces: `PublicToggles({ theme, lang, onTheme, onLang, onLogin })` — при переданном `onLogin` рендерит кнопку «Войти» (`tr("pub_login")`, иконка `LogIn`) слева от язык/тема.

- [ ] **Шаг 1:** В `PublicToggles` добавить опциональный проп `onLogin`; когда задан — рендерить кнопку «Войти» первым элементом строки:

```jsx
{onLogin && (
  <button onClick={onLogin} aria-label="login"
    style={{ ...base, background: "var(--surface2)", color: "var(--ink)", padding: "6px 12px", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginRight: "auto" }}>
    <LogIn size={14} /> {tr("pub_login")}
  </button>
)}
```
(импортировать `LogIn` из `lucide-react` и `t as tr` из `../lib/i18n`.)

- [ ] **Шаг 2:** `TournamentJoin`: убрать собственную верхнюю кнопку `pub_login` (~152–154); передать `onLogin={() => setShowLogin(true)}` в тот `PublicToggles`, что уже рендерится на странице. (Форменная `pub_login_for_rating2` уже убрана в Task 4.)
- [ ] **Шаг 3:** `GuestJoin`: убрать `gj-loginlink pub_login_for_rating` (~194–195); передать `onLogin` в `PublicToggles`; при необходимости добавить короткую подсказку `pub_guest_rating_hint` под формой (не кнопку).
- [ ] **Шаг 4:** `LeaguePublicPage`: передать `onLogin={() => setShowLogin(true)}` в `PublicToggles` (там сейчас входа нет). Если на странице нет состояния `showLogin`/`LoginScreen` — добавить по образцу `GuestJoin` (стейт + ветка рендера `LoginScreen`).
- [ ] **Шаг 5:** `ClaimProfile` и гостевой лендинг — НЕ трогать (решение пользователя: claim-вход остаётся, лендинг топбар+герой остаются).
- [ ] **Шаг 6:** Удалить из ru/en/es ключи `pub_login_for_rating` и `pub_login_for_rating2`. Грепом убедиться, что ссылок в `src/` не осталось.
- [ ] **Шаг 7 (verify):** build + eslint чисто; `grep -rn "pub_login_for_rating" src/` — пусто. Скрин/проверка: на `/t/`, `/j/`, `/l/` ровно один «Войти» (в хедере), вход открывает `LoginScreen`.
- [ ] **Шаг 8 (commit).**
