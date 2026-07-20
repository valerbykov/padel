// main.jsx — точка входа приложения.
// Рендерим App (он показывает приложение лиги + кнопку «Войти»),
// а не PadelLeague напрямую — иначе пропадает экран авторизации.
import React from "react";
import { createRoot } from "react-dom/client";
import Root from "./Root";
import { isNativeApp } from "./lib/platform";
import { initI18n } from "./lib/i18n";
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

// Прячем нативный сплеш, когда веб-приложение отрисовалось. Capacitor рекомендует
// звать hide() вручную; в capacitor.config launchAutoHide:false — сплеш ждёт нас
// (не прячется по таймауту, пока грузится бандл). На вебе window.Capacitor нет —
// вызов no-op. Идемпотентно (повторный hide безвреден).
function hideSplash() {
  try { window.Capacitor?.Plugins?.SplashScreen?.hide?.({ fadeOutDuration: 250 }); } catch (_) { /* нет плагина/веб */ }
}
// Жёсткий фолбэк: даже если рендер не дошёл (катастрофа с бандлом), сплеш не залипнет.
setTimeout(hideSplash, 8000);

// Root — тонкий гейт: гостю показывает Landing без supabase/App, остальное грузит лениво.
function renderApp() {
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  );
  // после первого кадра приложения прячем сплеш (передаём эстафету веб-UI)
  requestAnimationFrame(() => requestAnimationFrame(hideSplash));
}

// Активную локаль (+ ru как фолбэк) грузим ДО первого рендера: t() синхронная, к
// моменту рендера словарь должен быть на месте. Локали — отдельные чанки, поэтому
// в стартовый бандл входит только нужный язык, а не все три. Если чанк локали не
// подтянулся (стухший деплой), даём стухшему-чанку перезагрузить; иначе всё равно
// рендерим (t() отдаст ru-фолбэк/ключи — не белый экран).
initI18n()
  .catch((e) => { if (isChunkLoadError(e)) reloadForStaleChunk((e && e.message) || "i18n chunk"); })
  .finally(renderApp);
