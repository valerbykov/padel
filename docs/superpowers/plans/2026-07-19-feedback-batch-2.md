# План: пакет правок по фидбеку (2026-07-19, батч 2)

Верификация в этом репо = `npm run build` + Playwright-смоук (нет тест-фреймворка). Прод-миграции — через Supabase MCP, БЕЗ ловушки overload-с-default (урок join_tournament). Весь клиент — ОДИН батч-деплой в конце (Netlify — я; натив + edge — пользователь на Mac).

## Решения пользователя
- **Уровень события**: и одиночное значение, И диапазон «от–до». Модель `level jsonb = {sys, val, val2?}` (val2 задан → диапазон). Для игр И турниров.
- **Иконки уровней**: настоящие логотипы. Сохранены `src/assets/levels/lunda.webp` (для `ltr`), `playtomic.webp` (для `pt`). `oth` — без иконки.
- **Длительность**: и игры, и турниры (миграция `games.ends_at`). Дефолт: турнир 2ч, игра 1ч.

## Миграции (прод, делаю аккуратно, первыми)
- **M1** `games.ends_at timestamptz`. `create_game` RPC: +`p_ends_at` (проверить, что overload один → добавить с default безопасно).
- **M2** `tournaments.level jsonb`, `games.level jsonb` (nullable). `createTournament`/`create_game` пишут level. `get_tournament_by_code` (to_jsonb) — уже отдаст. `GAME_SELECT`/`T_SELECT` += level (+ends_at у игр).
- **M3** `levels` в ростер/лидерборд: `padelApi.js:82` group_members select += `levels`; `app_bootstrap` RPC (лидерборд) += levels; источник PlayerDetail. БАГ «уровень не виден» = данные не тянутся.
- **M4** `_demo_showcase`: 1 завершённый (KotH) + 1 идёт (RR active, часть матчей) + 1 собирает (open). + примеры level/ends_at.

## Батчи UI
- **B-levels**: LevelBadges — иконки (pt/ltr) + подпись; ProfileEditor — блок уровня ПОСЛЕ почты + пикер Playtomic (селект вместо голого числа, decimals уже ок); компонент EventLevelPicker (одиночный+диапазон) в создание турнира и игры; показ уровня события на приглашении/афише + в карточке игры.
- **B-forms**: селектор длительности (замена времени окончания) в создании турнира и игры (2ч/1ч); тумблер «контакт из Лиги» (карусель друзей+я, вкл по умолч.; выкл → 2 поля — паттерн Tournaments.jsx:866-898 / PadelLeague:2590-2607); черновик создания турнира не теряется при смене вкладки (persist в sessionStorage).
- **B-fees**: настройка взноса в создании игры + показ FeesCard в карточке игры ДО «played» (чинит нестыковку «в начале/в конце», сейчас гейт `game.status==="played"` PadelLeague:2917).
- **B-polish**: LIVE-точка медленный пульс (PadelLeague:3000 + list-badge :2200; keyframes + prefers-reduced-motion); `King of the Court`→«Король корта» (i18n fmt_koh_*); имена пары в одну строку (убрать `flexWrap:wrap` Tournaments.jsx:1283 + TournamentJoin.jsx:202, name spans уже nowrap+ellipsis, добавить flex:1 minWidth:0); подсказка «ссылка для этой пары» у 🔗.

## Верификация + деплой
build → Playwright-смоук (ru/en/es: лендинг, создание турнира/игры, бейджи уровня, LIVE) → ревью (typescript/react reviewer на диффы) → Netlify deploy + git push. Пользователю на Mac: build + `npx cap sync` + `supabase functions deploy` если менялись edge.
