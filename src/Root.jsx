// Root.jsx — тонкая обёртка: лениво грузит App под общий Suspense-фолбэк.
// Отдельный «мобильный лендинг» убран — гость сразу попадает в приложение
// (вкладка «Начало» → WelcomeScreen). Полноэкранный лендинг — /landing.html.
import React, { lazy, Suspense } from "react";

const App = lazy(() => import("./App"));

// Фолбэк, пока подгружается чанк App.
function Splash() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #0a1612)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", border: "3px solid rgba(255,255,255,.12)", borderTopColor: "var(--lime, #c8ff2d)", animation: "appspin .7s linear infinite" }} />
      <style>{`@keyframes appspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function Root() {
  return (
    <Suspense fallback={<Splash />}>
      <App />
    </Suspense>
  );
}
