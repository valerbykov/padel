// main.jsx — точка входа приложения.
// Рендерим App (он показывает приложение лиги + кнопку «Войти»),
// а не PadelLeague напрямую — иначе пропадает экран авторизации.
import React from "react";
import { createRoot } from "react-dom/client";
import Root from "./Root";
import { isNativeApp } from "./lib/platform";
import "./index.css";

// Только в нативе (Capacitor) отключаем зум webview: в WKWebView пинч-зум
// «залипал» без кнопки сброса. В вебе зум НЕ трогаем — он нужен для доступности
// (слабовидящие) и держит Lighthouse Accessibility. window.Capacitor доступен к
// этому моменту (нативный бридж внедряет его до кода приложения).
if (isNativeApp()) {
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover");
}

// Стухший чанк после деплоя: у вернувшегося юзера в service worker / памяти
// закеширован старый index.html со старыми хешами чанков; после деплоя этих
// файлов на сервере уже нет → SPA-фолбэк отдаёт index.html (text/html), и
// динамический import lazy-роута (вход, турниры…) падает. Перезагружаем один
// раз, чтобы подтянуть свежий index. Защита от петли — не чаще раза в 10 c.
function isChunkLoadError(x) {
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch dynamically imported/i.test(String((x && x.message) || x || ""));
}
// Дублёры кулдауна в памяти модуля: если sessionStorage бросает (приватный режим,
// выключенное хранилище), опираемся на них — иначе кулдаун не работает и релоад
// уходит в петлю. reloadCount переживает сам reload через sessionStorage.
let lastReloadAt = 0;
let reloadCount = 0;
function reloadForStaleChunk(reason) {
  const now = Date.now();
  let last = lastReloadAt;
  try {
    last = Math.max(last, Number(sessionStorage.getItem("pp_chunk_reload_at")) || 0);
    reloadCount = Math.max(reloadCount, Number(sessionStorage.getItem("pp_chunk_reload_n")) || 0);
  } catch (_) { /* storage недоступен — работаем на module-переменных */ }

  if (now - last < 10000) return;   // недавно уже перезагружались — не зацикливаемся
  // Битый деплой / заблокированный CDN / офлайн выглядят как «стухший чанк», но
  // релоад их не чинит. После 3 попыток перестаём крутить петлю и логируем —
  // пусть ошибка всплывёт, а не маскируется бесконечной перезагрузкой.
  if (reloadCount >= 3) {
    console.error("[chunk-reload] лимит перезагрузок исчерпан, не перезагружаю:", reason);
    return;
  }

  lastReloadAt = now; reloadCount += 1;
  try {
    sessionStorage.setItem("pp_chunk_reload_at", String(now));
    sessionStorage.setItem("pp_chunk_reload_n", String(reloadCount));
  } catch (_) { /* ок — есть module-дублёры */ }
  console.error("[chunk-reload] перезагружаю за свежим index:", reason);
  window.location.reload();
}
window.addEventListener("vite:preloadError", (e) => { try { e.preventDefault(); } catch (_) {} reloadForStaleChunk((e && e.payload && e.payload.message) || "vite:preloadError"); });
window.addEventListener("unhandledrejection", (e) => { if (isChunkLoadError(e && e.reason)) reloadForStaleChunk((e.reason && e.reason.message) || String(e && e.reason)); });

// Root — тонкий гейт: гостю показывает Landing без supabase/App, остальное грузит лениво.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
