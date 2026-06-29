// main.jsx — точка входа приложения.
// Рендерим App (он показывает приложение лиги + кнопку «Войти»),
// а не PadelLeague напрямую — иначе пропадает экран авторизации.
import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Фолбэк для ленивых чанков: App грузит тяжёлые экраны через React.lazy.
function Splash() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #0a1612)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", border: "3px solid rgba(255,255,255,.12)", borderTopColor: "var(--lime, #c8ff2d)", animation: "appspin .7s linear infinite" }} />
      <style>{`@keyframes appspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<Splash />}>
      <App />
    </Suspense>
  </React.StrictMode>
);
