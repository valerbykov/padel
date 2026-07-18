// lib/supabase.js
// Клиент Supabase с двумя «дорогами» к ОДНОЙ базе (реплик нет):
//   - direct: прямой hosted Supabase — весь мир, быстро;
//   - proxy:  через api.padelpack.app — Россия, обход троттлинга Cloudflare.
// По умолчанию ходим напрямую. Если запросы валятся как при РФ-фильтрации
// (таймаут / обрыв) — автоматически и навсегда (для этого браузера) уходим на прокси.
// Плюс первичная догадка по таймзоне, чтобы РФ-юзер сразу стартовал на прокси.
import { createClient } from "@supabase/supabase-js";

const DIRECT = import.meta.env.VITE_SUPABASE_URL;                 // прямой hosted Supabase
const PROXY  = import.meta.env.VITE_SUPABASE_PROXY_URL || "";     // прокси для РФ (может быть пустым)
const anon   = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!DIRECT || !anon) {
  console.warn("Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
}

const hostOf = (u) => { try { return new URL(u).host; } catch { return ""; } };
const DIRECT_HOST = hostOf(DIRECT);
const PROXY_HOST  = hostOf(PROXY);

const MODE_KEY = "pp_endpoint";

// По умолчанию ВСЕ ходят напрямую (быстро для мира). Если запрос падает как при
// РФ-фильтрации (таймаут/обрыв) — клиент сам переключается на прокси и запоминает
// это в localStorage (см. customFetch). Таймзоне не доверяем — она ненадёжна
// (VPN, поездки, кривые настройки), решает только реальный результат запроса.
let mode = "direct";
try {
  if (localStorage.getItem(MODE_KEY) === "proxy" && PROXY_HOST) mode = "proxy";
} catch { /* localStorage недоступен */ }

function persistMode(m) {
  mode = m;
  try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
}

// Базу клиента фиксируем при создании (чтобы и realtime шёл правильной дорогой).
const baseUrl = (mode === "proxy" && PROXY) ? PROXY : DIRECT;

// Переписать host запроса на прокси, когда mode === "proxy" (REST/auth на лету,
// даже если клиент создан с прямой базой — например при фолбэке в этой же сессии).
function applyMode(input) {
  if (!PROXY_HOST || !DIRECT_HOST || DIRECT_HOST === PROXY_HOST) return input;
  // Маршрут строго по текущему mode — В ОБЕ стороны. Клиент мог быть создан с любой
  // базой (proxy/direct из localStorage), поэтому при mode="direct" нужно возвращать
  // и proxy-host → direct-host, иначе под VPN (страна не РФ) запросы залипают на ru.
  const from = mode === "proxy" ? DIRECT_HOST : PROXY_HOST;
  const to   = mode === "proxy" ? PROXY_HOST  : DIRECT_HOST;
  if (from === to) return input;
  const rw = (u) => u.replace("//" + from, "//" + to);
  if (typeof input === "string") return rw(input);
  try { return (input && input.url) ? new Request(rw(input.url), input) : input; } catch { return input; }
}

const FETCH_TIMEOUT_MS = 7000;
const DIRECT_PROBE_MS = 6000; // на direct ждём недолго — при РФ-троттлинге быстро уходим на прокси
function timedFetch(input, init = {}, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  if (init.signal) {
    if (init.signal.aborted) ctrl.abort();
    else init.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// Таймаут + один повтор на свежем соединении (для идемпотентных GET/HEAD).
async function resilientCore(input, init = {}, opts = {}) {
  const ms = opts.ms || FETCH_TIMEOUT_MS;
  const method = (init.method || "GET").toUpperCase();
  const canRetry = opts.retry !== false && (method === "GET" || method === "HEAD");
  try {
    return await timedFetch(input, init, ms);
  } catch (e) {
    const transient = e && (e.name === "AbortError" || e instanceof TypeError);
    if (canRetry && transient) {
      await new Promise((r) => setTimeout(r, 300));
      return await timedFetch(input, init, ms);
    }
    throw e;
  }
}

// Дедуп одинаковых параллельных GET/HEAD: один сетевой запрос на всех.
const _getInflight = new Map();
const reqUrl = (input) => (typeof input === "string" ? input : (input && input.url) || String(input));
async function fetchBuffered(input, init, opts) {
  const resp = await resilientCore(input, init, opts);
  const body = await resp.arrayBuffer();
  return { body, status: resp.status, statusText: resp.statusText, headers: resp.headers };
}
function bufToResponse(b) {
  const nullBody = b.status === 204 || b.status === 205 || b.status === 304;
  return new Response(nullBody ? null : b.body, { status: b.status, statusText: b.statusText, headers: b.headers });
}
function dedupFetch(input, init = {}, opts) {
  const method = (init.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") {
    const key = method + " " + reqUrl(input);
    let p = _getInflight.get(key);
    if (!p) {
      p = fetchBuffered(input, init, opts).finally(() => _getInflight.delete(key));
      _getInflight.set(key, p);
    }
    return p.then(bufToResponse);
  }
  return resilientCore(input, init, opts);
}

// Точка входа: маршрутизация + авто-фолбэк на прокси при РФ-троттлинге.
async function customFetch(input, init = {}) {
  // На direct с доступным прокси — короткая проба (без 24-секундного ожидания
  // resilientCore); при сбое как при РФ-троттлинге сразу и навсегда уходим на прокси.
  if (mode === "direct" && PROXY_HOST) {
    try {
      return await dedupFetch(applyMode(input), init, { ms: DIRECT_PROBE_MS, retry: false });
    } catch (e) {
      const transient = e && (e.name === "AbortError" || e instanceof TypeError);
      if (transient) {
        persistMode("proxy");
        // Переотправлять на прокси безопасно ТОЛЬКО идемпотентные GET/HEAD. Для мутаций
        // (POST/PATCH/PUT/DELETE) origin мог УЖЕ обработать запрос до сброса соединения —
        // повтор задвоил бы эффект (двойной ELO, дубли слотов/участников). Режим уже
        // переключён на proxy, поэтому СЛЕДУЮЩИЙ вызов пойдёт через него; текущую мутацию
        // не пересылаем, а пробрасываем ошибку (пользователь повторит осознанно).
        const method = (init.method || "GET").toUpperCase();
        if (method === "GET" || method === "HEAD") {
          return await dedupFetch(applyMode(input), init);
        }
      }
      throw e;
    }
  }
  return dedupFetch(applyMode(input), init);
}

// Ключ хранения сессии ФИКСИРОВАННЫЙ: по умолчанию supabase-js выводит его из
// хоста URL (sb-<ref>-auth-token), и при переключении direct↔proxy (разные хосты)
// клиент после перезагрузки страницы не находил сессию → внезапный разлогин
// (например, «Вступить в лигу» с публичной страницы = полная навигация).
const STORAGE_KEY = "pp-auth";
try {
  // Миграция: подхватить сессию, сохранённую под старыми host-ключами.
  if (!localStorage.getItem(STORAGE_KEY)) {
    for (const u of [DIRECT, PROXY]) {
      const h = hostOf(u);
      if (!h) continue;
      const legacy = "sb-" + h.split(".")[0] + "-auth-token";
      const v = localStorage.getItem(legacy);
      if (v) { localStorage.setItem(STORAGE_KEY, v); break; }
    }
  }
} catch { /* localStorage недоступен */ }

export const supabase = createClient(baseUrl, anon, {
  global: { fetch: customFetch },
  auth: {
    // implicit: токен приходит в #access_token — корректно для standalone-PWA и нативного deep-link.
    flowType: "implicit",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: STORAGE_KEY,
  },
});

// Текущая «дорога» ("direct" | "proxy") — на случай индикатора/отладки.
export const supabaseEndpoint = () => mode;

// Принудительно перевести на прокси (напр. когда /geo определил РФ) — раньше, чем
// медленный фолбэк по таймауту сам это сделает.
export function preferProxy() {
  if (PROXY_HOST && mode !== "proxy") persistMode("proxy");
}

// Вернуть на прямой путь (напр. /geo показал НЕ РФ) — маршрут строго по стране.
export function preferDirect() {
  if (mode !== "direct") persistMode("direct");
}
