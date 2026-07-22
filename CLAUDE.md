# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PadelPack — a padel league app for friends: link invites, match scoring, tournaments, and league standings. It ships as one codebase in three forms: a **Vite + React 18 SPA**, an installable **PWA** (`vite-plugin-pwa`), and a **native iOS/Android app** via **Capacitor 8** (the native shells wrap the same `dist/` web build). The backend is entirely **Supabase** (Postgres + RLS + Deno Edge Functions + Storage) — there is no custom server.

The frontend is plain JavaScript/JSX (no TypeScript). Edge Functions in `supabase/functions/` are TypeScript/Deno. **Source comments and UI copy are in Russian**; the primary market is Russia and the default UI language is `ru`.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # production build → dist/
npm run preview    # serve the built dist/ locally
npx cap sync       # after a build: copy dist/ into ios/ and android/ native shells
```

- **Lint:** an ESLint flat config (`eslint.config.js`, ignores `dist`) exists, but `eslint` itself is **not** a declared dependency — run `npm i -D eslint` first, then `npx eslint .`.
- **Tests:** there is no test framework or test suite in this repo.
- **Native run:** open `ios/` in Xcode or `android/` in Android Studio after `npx cap sync`.
- **Edge Functions:** deploy individually, e.g. `supabase functions deploy submit-result`. `send-sms-hook` **must** be deployed with `--no-verify-jwt` (it is an auth hook, called without a user JWT).
- The user runs Node with a tight heap: prefix node/npm commands with `NODE_OPTIONS=--max-old-space-size=512`. A Vite build can OOM under this cap — surface it rather than silently raising the limit.

Build-time env vars (all `VITE_*`, injected by the host): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROXY_URL` (optional RU proxy), `VITE_GEO_URL`, `VITE_GOOGLE_IOS_CLIENT_ID`, `VITE_GOOGLE_WEB_CLIENT_ID`, `VITE_YANDEX_CLIENT_ID`.

## Architecture

**Render tree & code-splitting.** `main.jsx` → `Root.jsx` (thin Suspense gate) → `App.jsx` (lazy) → `PadelLeague.jsx`. `App.jsx` owns auth/session, the user's leagues (groups), active-league selection, theme, and language, then hands the active league to `PadelLeague.jsx` — a ~2400-line component holding the whole tabbed UI (`welcome` / `board`=Друзья / `games` / `tournaments` / `history`). Heavy and route-specific screens are `lazy()`-loaded; `PadelLeague` is pre-warmed on load. `vite.config.js` splits `react` and `supabase` into their own long-cached vendor chunks.

**Routing has no router library.** `App.jsx` matches `window.location.pathname` with regexes: `/j/CODE` (join by invite), `/t/CODE` (join tournament), `/r/UUID` (claim profile), `/l/CODE` (public league page). All hosts (`netlify.toml`, `vercel.json`) are configured to SPA-fallback every path to `index.html` so these client routes and invite links don't 404.

**Data layer** lives in `src/lib/*Api.js` (`padelApi.js`, `tournamentApi.js`, `statsApi.js`): thin wrappers over the Supabase client and Postgres RPCs. **Table and column names in these files must match `supabase/sql/*.sql`** (`01_schema.sql`, `02_auth_and_rls.sql`, `03_admin_users.sql`, `04_analytics.sql`); `migrations/` holds dated incremental changes on top. Cold start is collapsed into a single `app_bootstrap` RPC (`bootstrapApp` in `padelApi.js`) that returns profile + leagues + leaderboard + counts in one round trip and pre-warms the cache; callers fall back to the older per-query cascade if the RPC isn't deployed.

**The Supabase client is custom (`src/lib/supabase.js`) — read it before touching networking.** There is one database reachable by two paths: `direct` (hosted Supabase, fast worldwide) and `proxy` (`VITE_SUPABASE_PROXY_URL` = **`ru.padelpack.app`** — a Yandex Cloud VM **in Russia** terminating TLS, tunneled via awg0 to the Stockholm Vultr box's nginx `ru-internal.conf`, which forwards to Supabase Frankfurt; `api.padelpack.app` is the Stockholm box itself, serving `/geo` and a direct Supabase pass-through). It defaults to direct, probes quickly, and on RF-style failures (timeout/reset) permanently switches that browser to proxy (persisted in `localStorage`). The custom `fetch` also does timeout + single retry for idempotent GET/HEAD and de-dupes identical in-flight GETs. Auth uses `flowType: "implicit"`.

**Client cache (`src/lib/cache.js`)** is stale-while-revalidate backed by `localStorage`, keyed **per league** (`swr(key, fn)`), which is why data appears instantly on flaky networks and why switching leagues doesn't leak the previous league's roster. Mutations in `padelApi.js` bust specific keys (`bustKey`/`bustCache`).

**Platform detection (`src/lib/platform.js`)** deliberately does **not** import `@capacitor/core`, so the web build compiles without Capacitor installed — it reads `window.Capacitor` at runtime. Use `isNativeApp()` to branch native vs web, `WEB_BASE` (`https://padelpack.app`) for share links (native `location.origin` is `capacitor://localhost`), and the `padelpack://login-callback` deep-link scheme for auth returns.

**Auth (`src/lib/auth.js`)** spans several channels: email/password, phone OTP (via the `send-sms-hook` Edge Function), Google and Apple (native sheets through Capacitor social-login plugins; system browser + deep link on native, since Google forbids in-webview OAuth), Telegram, and Yandex. Telegram and Yandex exchange their code/payload for a Supabase session inside the `telegram-auth` / `yandex-auth` Edge Functions.

**Edge Functions (`supabase/functions/`)** cover the privileged/server-side work: `submit-result` (record match results), `admin-create-user`, `telegram-auth`, `yandex-auth`, `send-sms-hook`, `send-due-reminders` (push-notification cron), `notify-telegram`, `delete-account`.

**Tournament formats** are pure algorithms in `src/lib/americano.js` and `src/lib/mexicano.js` (pairing/round scheduling). **i18n** is `src/lib/i18n.js` (`ru`/`en`/`es`, `ru` default) with country→language guessing in `src/lib/region.js`.

## Conventions & gotchas

- The service worker (`vite.config.js` Workbox) caches fonts and public Supabase Storage avatars aggressively but **must never cache Supabase API responses** — data and auth must stay fresh.
- `patch-package` runs on `postinstall` and patches `@capacitor-community/apple-sign-in` (`patches/`); don't remove the patch step.
- New client routes are added as a path regex in `App.jsx`; the SPA fallback to `index.html` is already global, so no host-config change is needed.
- Keep new shared frontend code free of direct `@capacitor/core` imports; go through `platform.js`.
