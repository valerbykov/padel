// Root.jsx — тонкий гейт загрузки.
// Гостю на старте показываем Landing БЕЗ загрузки supabase и основного App —
// это убирает ~50 КБ JS со стартового экрана (быстрее первый рендер/LCP).
// Полноценный App грузим лениво, как только он реально нужен: есть сессия,
// открыта ссылка-приглашение, вернулись с OAuth или гость явно зашёл/жмёт «Войти».
import React, { useState, useCallback, lazy, Suspense } from "react";
import Landing from "./components/Landing";
import { setLang } from "./lib/i18n";

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

// Supabase хранит сессию в localStorage под ключом sb-<ref>-auth-token.
// Его наличие — надёжный признак «вероятно авторизован» без загрузки supabase.
function hasSupabaseSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) return true;
    }
  } catch { /* localStorage недоступен */ }
  return false;
}

// Нужно ли сразу грузить полноценный App (минуя лендинг)?
function shouldEnterApp() {
  const { pathname, hash, search } = window.location;
  if (/^\/(j|t|r|l)\//.test(pathname)) return true;     // приглашения / турнир / claim / публичная лига
  if (hash.includes("access_token")) return true;        // возврат с OAuth (implicit flow)
  const sp = new URLSearchParams(search);
  if (sp.has("code") || sp.has("join")) return true;     // Яндекс-callback / ?join=CODE
  try { if (localStorage.getItem("plLandingSeen")) return true; } catch { /* ignore */ }
  if (hasSupabaseSession()) return true;                 // вероятно уже авторизован
  return false;
}

export default function Root() {
  const [entered, setEntered] = useState(shouldEnterApp);
  const [loginIntent, setLoginIntent] = useState(false);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("plTheme") || "dark"; } catch { return "dark"; } });
  const [lang, setLangState] = useState(() => { try { return localStorage.getItem("plLang") || "ru"; } catch { return "ru"; } });

  const toggleTheme = useCallback(() => {
    setTheme((t) => { const n = t === "dark" ? "light" : "dark"; try { localStorage.setItem("plTheme", n); } catch { /* ignore */ } return n; });
  }, []);
  const onLangChange = useCallback((l) => { setLang(l); setLangState(l); }, []);

  if (entered) {
    return (
      <Suspense fallback={<Splash />}>
        <App initialShowLogin={loginIntent} />
      </Suspense>
    );
  }

  return (
    <Landing
      theme={theme}
      lang={lang}
      onThemeToggle={toggleTheme}
      onLangChange={onLangChange}
      onStart={() => { setLoginIntent(true); setEntered(true); }}
      onBrowse={() => { try { localStorage.setItem("plLandingSeen", "1"); } catch { /* ignore */ } setEntered(true); }}
    />
  );
}
