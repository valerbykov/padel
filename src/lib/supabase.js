// lib/supabase.js
// Инициализация клиента Supabase.
// Переменные берутся из .env (Vite). Заполни своими значениями из
// Supabase → Project Settings → API:
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGci...
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn("Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
}

// Свой fetch для клиента Supabase: таймаут + один повтор на свежем соединении.
// Зачем: REST ходит по одному постоянному HTTP/2-соединению. Если сеть роняет его
// молча, Chrome ловит ERR_HTTP2_PING_FAILED, а уже ушедшие запросы висят минутами
// до длинного таймаута (помогает лишь переключение вкладки — сброс сокета).
// Обрываем по таймауту и повторяем — но только идемпотентные GET/HEAD, чтобы не
// задвоить мутации (отправку счёта и т.п.).
const FETCH_TIMEOUT_MS = 12000;

function timedFetch(input, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  if (init.signal) {
    if (init.signal.aborted) ctrl.abort();
    else init.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function resilientCore(input, init = {}) {
  const method = (init.method || "GET").toUpperCase();
  const canRetry = method === "GET" || method === "HEAD";
  try {
    return await timedFetch(input, init);
  } catch (e) {
    // ERR_HTTP2_PING_FAILED / обрыв сети → TypeError; таймаут → AbortError.
    const transient = e && (e.name === "AbortError" || e instanceof TypeError);
    if (canRetry && transient) {
      await new Promise((r) => setTimeout(r, 300));
      return await timedFetch(input, init); // свежее соединение
    }
    throw e;
  }
}

// Дедуп одинаковых параллельных GET/HEAD: при частом переключении вкладок на
// нестабильной сети одинаковые запросы (profiles, auth user и т.п.) идут пачками
// и забивают соединение. Склеиваем их в один сетевой запрос — тело буферизуем и
// раздаём копии. Мутации (POST/PATCH/DELETE) не трогаем.
const _getInflight = new Map();
const reqUrl = (input) => (typeof input === "string" ? input : (input && input.url) || String(input));

async function fetchBuffered(input, init) {
  const resp = await resilientCore(input, init);
  const body = await resp.arrayBuffer();
  return { body, status: resp.status, statusText: resp.statusText, headers: resp.headers };
}
function bufToResponse(b) {
  const nullBody = b.status === 204 || b.status === 205 || b.status === 304;
  return new Response(nullBody ? null : b.body, { status: b.status, statusText: b.statusText, headers: b.headers });
}

function resilientFetch(input, init = {}) {
  const method = (init.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") {
    const key = method + " " + reqUrl(input);
    let p = _getInflight.get(key);
    if (!p) {
      p = fetchBuffered(input, init).finally(() => _getInflight.delete(key));
      _getInflight.set(key, p);
    }
    return p.then(bufToResponse);
  }
  return resilientCore(input, init);
}

export const supabase = createClient(url, anon, {
  global: { fetch: resilientFetch },
  auth: {
    // implicit: токен приходит в #access_token прямо в URL — корректно работает
    // в standalone-PWA (возврат от Google в Safari/PWA) и совместимо с нативным
    // deep-link (handleAuthCallbackUrl в auth.js понимает и access_token, и code).
    // PKCE здесь ломал вход в установленной PWA на iOS (обмен code требует verifier
    // из localStorage, который теряется при возврате через Safari).
    flowType: "implicit",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
