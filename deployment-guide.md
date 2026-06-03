# Падел · Лига друзей — план разворачивания

Пошаговый план запуска MVP: бэкенд на Supabase, фронтенд-PWA на статическом хостинге. Можно отмечать пункты по ходу.

---

## 0. Что собрано (карта файлов)

```
src/
├─ App.jsx                  # корень: сессия, роутинг, вход/приложение/гость
├─ PadelLeague.jsx          # основной экран (рейтинг, игры, история)
├─ lib/
│  ├─ supabase.js           # клиент Supabase
│  ├─ padelApi.js           # запросы: игроки, игры, слоты, результат
│  ├─ auth.js               # email + Google вход, сессия, профиль
│  └─ statsApi.js           # запросы профиля и аналитики
└─ components/
   ├─ LoginScreen.jsx       # единый вход: Telegram / Email / SMS
   ├─ TelegramLogin.jsx     # виджет входа через Telegram
   ├─ GuestJoin.jsx         # вход по ссылке /j/CODE без аккаунта
   ├─ AdminCreateUser.jsx   # форма создания пользователей админом
   ├─ PlayerProfile.jsx     # экран профиля игрока
   ├─ InstallPWA.jsx        # кнопка «Установить приложение»
   └─ Analytics.jsx         # дашборд аналитики группы

supabase/functions/
   ├─ submit-result/        # ввод счёта + пересчёт ELO (сервер)
   ├─ admin-create-user/    # создание пользователя админом
   ├─ telegram-auth/        # проверка подписи Telegram
   └─ send-sms-hook/        # отправка SMS-кода через РФ-провайдера

SQL (порядок прогона):
   1) schema.sql
   2) auth_and_rls.sql
   3) admin_users.sql
   4) analytics.sql

Конфиги деплоя: vite.config.js, netlify.toml / vercel.json / _redirects
Иконки PWA: pwa-192, pwa-512, pwa-maskable-512, apple-touch-icon, favicon-32x32
```

---

## 1. Локальная подготовка

1. Создай проект Vite + React, если ещё нет: `npm create vite@latest padel -- --template react`.
2. Разложи файлы по структуре выше (`src/lib`, `src/components`, `supabase/functions`).
3. Иконки PWA положи в папку `public/`.
4. Установи зависимости:
   - `npm i @supabase/supabase-js lucide-react`
   - `npm i -D vite-plugin-pwa`
5. Подключи `vite.config.js` (с блоком VitePWA).

---

## 2. Supabase: проект и база

1. На supabase.com → **New project**. Сохрани пароль БД, выбери ближний регион (напр. Frankfurt).
2. **SQL Editor** → прогони по очереди: `schema.sql` → `auth_and_rls.sql` → `admin_users.sql` → `analytics.sql`.
3. Проверь в **Table Editor**: появились `profiles`, `groups`, `group_members`, `games`, `game_slots`, `matches`, `rating_changes`.
4. Возьми ключи в **Project Settings → API**: Project URL и anon public key.
5. В корне проекта создай `.env`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

---

## 3. Стартовые данные и первый администратор

1. Зарегистрируйся в приложении (или создай пользователя в Auth) — это создаст твой профиль.
2. Назначь себя админом (один раз, в SQL Editor):
   ```sql
   update profiles set is_admin = true where email = 'твой_email';
   ```
3. Создай первую группу и добавь себя участником (Table Editor или SQL):
   ```sql
   insert into groups (name, owner_id)
     values ('Наша компания', (select id from profiles where email='твой_email'))
     returning id;
   -- подставь полученный group_id ниже:
   insert into group_members (group_id, profile_id, rating)
     values ('GROUP_ID', (select id from profiles where email='твой_email'), 1000);
   ```
4. Запомни этот `group_id` — его нужно прокинуть в приложение (в `App.jsx` и далее в экраны).

---

## 4. Edge Functions (серверные функции)

1. Установи CLI и залогинься: `npm i -g supabase`, `supabase login`, `supabase link --project-ref <ref>`.
2. Задеплой функции:
   - `supabase functions deploy submit-result`
   - `supabase functions deploy admin-create-user`
   - `supabase functions deploy telegram-auth`
   - `supabase functions deploy send-sms-hook --no-verify-jwt`  ← важно: без JWT
3. Задай секреты (по мере необходимости):
   - Telegram: `supabase secrets set TELEGRAM_BOT_TOKEN=...`
   - SMS: `supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_..." SMSC_LOGIN=... SMSC_PASSWORD=...`
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` Supabase подставляет в функции сам.

---

## 5. Авторизация (по каналам)

**Email (magic-link)** — самый простой, рекомендуется как базовый.
1. Authentication → Providers → **Email**: включить.
2. На время разработки можно выключить «Confirm email».

**Telegram**
1. В @BotFather создай бота → получи токен (он уже в секретах из шага 4).
2. В @BotFather: `/setdomain` → укажи домен приложения (на localhost не работает).
3. В `App.jsx` пропиши `BOT_NAME` (username бота без @).

**SMS (опционально, для входа по номеру)**
1. Authentication → Providers → **Phone**: включить.
2. Authentication → Hooks → **Send SMS hook** → HTTP → URL функции `send-sms-hook`. Скопировать secret в `SEND_SMS_HOOK_SECRET`.
3. Учесть: SMS на РФ-номера дороги у зарубежных провайдеров — в хуке используется РФ-провайдер (smsc.ru). Сверься, что Send SMS Hook доступен на твоём тарифе.

> Рекомендация: основной канал — Telegram + Email как надёжный резерв. SMS добавляй, только если он реально нужен аудитории.

---

## 6. Подключение реальных данных вместо демо

В `PadelLeague.jsx` сейчас данные лежат в `window.storage` (демо). Заменить на вызовы `padelApi` с реальным `group_id`:
- таблица рейтинга → `getLeaderboard(groupId)`
- добавить игрока → `addMember(groupId, name)`
- создать игру → `createGame(groupId, {...})`
- вход по коду → `getGameByCode(code)` / занять слот → `joinSlotByCode(...)`
- ввод счёта → `submitResult(gameId, sA, sB)`
- профиль игрока → экран `PlayerProfile` (через `statsApi`)
- живые слоты → `subscribeToGame(gameId, ...)` (убирает кнопку «Обновить»)

---

## 7. Деплой фронтенда

1. Залей код в GitHub.
2. Подключи репозиторий к хостингу (рекомендация: **Netlify**; Vercel — при готовности к платному плану под коммерцию; Cloudflare Pages — учесть риски доступности в РФ).
3. Build command `npm run build`, output `dist`. Конфиг (`netlify.toml` / `vercel.json` / `_redirects` в `public/`) уже задаёт SPA-fallback, чтобы `/j/CODE` не давал 404.
4. В настройках хостинга добавь переменные `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.
5. Получишь ссылку вида `имя.netlify.app`.

---

## 8. После первого деплоя (частые грабли)

1. **Supabase → Auth → URL Configuration**: впиши новый домен в Site URL и Redirect URLs (иначе magic-link/Telegram не вернут в приложение).
2. **@BotFather → /setdomain**: укажи новый домен (иначе кнопка Telegram не отрисуется).
3. Проверь, что ссылка-приглашение `https://домен/j/CODE` открывает `GuestJoin`, а не 404.
4. Проверь PWA через Lighthouse (DevTools → вкладка PWA): манифест и service worker валидны, появляется установка.

---

## 9. Свой домен (когда будешь готов)

1. Привяжи домен (напр. `padel.app`) к хостингу — HTTPS на Netlify/Vercel/Cloudflare выдаётся автоматически.
2. Повтори шаги 8.1 и 8.2 уже с новым доменом.
3. Приглашения станут вида `https://padel.app/j/CODE`.

---

## 10. Чек-лист «всё живое»

- [ ] Регистрация/вход работает хотя бы одним каналом
- [ ] Профиль создаётся автоматически при первом входе
- [ ] Создание игры даёт код и ссылку
- [ ] Друг открывает ссылку и занимает слот без аккаунта
- [ ] Ввод счёта меняет рейтинг (через Edge Function)
- [ ] Экран профиля и аналитика показывают данные
- [ ] Приложение ставится на телефон (PWA)

---

## Дальнейшее развитие (после MVP)

- Редактирование/удаление игроков и матчей (админ-панель)
- Турниры и сезоны с обнулением рейтинга
- Привязка гостевых записей к аккаунту (когда гость регистрируется)
- Расширенная аналитика для клубов как платная функция
- Перенос с PWA на нативную обёртку (Capacitor) при необходимости

> Замечание про монетизацию: до публичного коммерческого запуска заранее проверь актуальные условия тарифов (Supabase, выбранный хостинг, SMS-провайдер) и юридические аспекты (хранение персональных данных пользователей из РФ — имя, телефон, email).
