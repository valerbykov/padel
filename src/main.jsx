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

// Root — тонкий гейт: гостю показывает Landing без supabase/App, остальное грузит лениво.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
