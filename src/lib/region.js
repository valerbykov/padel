// lib/region.js
// Грубое определение «пользователь в РФ» — для гео-логики входа (по закону скрываем
// Google для РФ). Источники: IP-гео (кэш в localStorage) + сигнал гео-фолбэка supabase
// (ушли на прокси = нас троттлят = почти наверняка РФ).
import { supabaseEndpoint } from "./supabase";

const KEY = "pp_country";
let cached; // boolean | undefined

function fromProxySignal() {
  try { return supabaseEndpoint() === "proxy"; } catch { return false; }
}

// Синхронно, для первого рендера: кэш / сигнал прокси. По умолчанию НЕ РФ (мир видит Google).
export function isRussiaSync() {
  if (cached !== undefined) return cached;
  try { const c = localStorage.getItem(KEY); if (c) { cached = c === "RU"; return cached; } } catch (e) { /* ignore */ }
  if (fromProxySignal()) return true;
  return false;
}

// Асинхронно уточняем по IP (один раз, кэшируем).
export async function detectRegion() {
  try { const c = localStorage.getItem(KEY); if (c) { cached = c === "RU"; return cached; } } catch (e) { /* ignore */ }
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch("https://ipwho.is/?fields=country_code", { signal: ctrl.signal });
    clearTimeout(tm);
    const j = await r.json();
    const cc = j && j.country_code;
    if (cc) { try { localStorage.setItem(KEY, cc); } catch (e) { /* ignore */ } cached = cc === "RU"; return cached; }
  } catch (e) { /* ipwho недоступен */ }
  cached = fromProxySignal();
  return cached;
}
