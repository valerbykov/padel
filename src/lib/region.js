// lib/region.js
// Определение «пользователь в РФ» — для гео-логики входа (по закону скрываем Google для РФ).
// Приоритет источников:
//   1) свой эндпоинт на прокси (VITE_SUPABASE_PROXY_URL + "/geo") — надёжно из РФ, без сторонних API;
//   2) публичный ipwho.is — запасной;
//   3) сигнал гео-фолбэка supabase (ушли на прокси = нас троттлят = почти наверняка РФ).
import { supabaseEndpoint } from "./supabase";

const KEY = "pp_country";
let cached; // boolean | undefined
const PROXY = (import.meta.env.VITE_SUPABASE_PROXY_URL || "").replace(/\/$/, "");

function fromProxySignal() {
  try { return supabaseEndpoint() === "proxy"; } catch (e) { return false; }
}

// Синхронно, для первого рендера: кэш / сигнал прокси. По умолчанию НЕ РФ (мир видит Google).
export function isRussiaSync() {
  if (cached !== undefined) return cached;
  try { const c = localStorage.getItem(KEY); if (c) { cached = c === "RU"; return cached; } } catch (e) { /* ignore */ }
  if (fromProxySignal()) return true;
  return false;
}

async function fetchCountry(url, pick) {
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    const j = await r.json();
    return pick(j) || null;
  } finally { clearTimeout(tm); }
}

function remember(cc) {
  try { localStorage.setItem(KEY, cc); } catch (e) { /* ignore */ }
  cached = cc === "RU";
  return cached;
}

// Асинхронно уточняем страну (один раз, кэшируем).
export async function detectRegion() {
  // Всегда спрашиваем СВЕЖИЙ /geo (он на нашем сервере, быстрый). Иначе при VPN/переезде
  // застрянем на старой стране из кэша — поэтому кэш тут только как оффлайн-фолбэк.
  if (PROXY) {
    try { const cc = await fetchCountry(PROXY + "/geo", (j) => j && j.country); if (cc) return remember(cc); } catch (e) { /* ignore */ }
  }
  try { const cc = await fetchCountry("https://ipwho.is/?fields=country_code", (j) => j && j.country_code); if (cc) return remember(cc); } catch (e) { /* ignore */ }
  // Сеть не ответила — берём кэш, затем сигнал прокси.
  try { const c = localStorage.getItem(KEY); if (c) { cached = c === "RU"; return cached; } } catch (e) { /* ignore */ }
  cached = fromProxySignal();
  return cached;
}
