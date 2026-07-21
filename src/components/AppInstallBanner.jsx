// components/AppInstallBanner.jsx
// Кастомный баннер «Установить/Открыть приложение» для мобильного веба — там, где
// нет системного (Safari iOS показывает свой Smart App Banner, его не дублируем).
// В потоке сверху (как у Safari): при скролле уезжает, sticky-топбар прилипает под ним.
// Синяя кнопка — намеренно НЕ лаймовая, чтобы выделяться на фоне лаймового UI.
import React, { useEffect, useRef, useState } from "react";
import { isNativeApp } from "../lib/platform";
import { t } from "../lib/i18n";

const APP_STORE = "https://apps.apple.com/ru/app/padelpack/id6787536510";
const DISMISS_KEY = "pp_appbanner_dismissed";
const ua = () => { try { return navigator.userAgent || ""; } catch (e) { return ""; } };

export default function AppInstallBanner() {
  const [state, setState] = useState(null); // null | "ios" | "android"
  const [, bump] = useState(0);             // форс-перерисовка при смене языка
  const fbTimer = useRef(null);             // таймер фолбэка в App Store

  const clearFb = () => { if (fbTimer.current) { clearTimeout(fbTimer.current); fbTimer.current = null; } };

  // Баннер живёт в Root (вне дерева App) — на смену языка реагируем через событие.
  // Плюс отменяем pending-таймер фолбэка, если вкладка ушла в фон (приложение
  // открылось) или закрылась — иначе он позже насильно уведёт в App Store.
  useEffect(() => {
    const onLang = () => bump((n) => n + 1);
    const onHide = () => { if (document.hidden) clearFb(); };
    window.addEventListener("pp-langchange", onLang);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", clearFb);
    return () => {
      clearFb();
      window.removeEventListener("pp-langchange", onLang);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", clearFb);
    };
  }, []);

  useEffect(() => {
    try {
      if (isNativeApp()) return;
      if (localStorage.getItem(DISMISS_KEY)) return;
      const u = ua();
      const iOS = /iphone|ipad|ipod/i.test(u);
      const android = /android/i.test(u);
      if (!iOS && !android) return;                                  // десктоп — не показываем
      const safari = iOS && /safari/i.test(u) && !/crios|fxios|edgios|yabrowser|opios|duckduckgo/i.test(u);
      if (iOS && safari) return;                                     // у Safari iOS есть системный баннер
      setState(iOS ? "ios" : "android");
    } catch (e) { /* ignore */ }
  }, []);

  if (!state) return null;
  const dismiss = () => { clearFb(); try { localStorage.setItem(DISMISS_KEY, "1"); } catch (e) {} setState(null); };
  // «Установлено или нет» из веба не определить (кроме системного баннера Safari).
  // Поэтому: пробуем ОТКРЫТЬ приложение по deep link; если не открылось (вкладка
  // осталась видимой ~1.4с) — на iOS уводим в App Store. Android: только deep link
  // (публичного стора пока нет — фолбэк добавим при выходе в Play/RuStore).
  const open = () => {
    const deep = `padelpack://padelpack.app${location.pathname}${location.search}`;
    if (state === "ios") {
      clearFb();
      fbTimer.current = setTimeout(() => {
        fbTimer.current = null;
        if (!document.hidden) window.location.href = APP_STORE;
      }, 1400);
    }
    try { window.location.href = deep; } catch (e) {}
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
      paddingTop: "calc(9px + env(safe-area-inset-top))",
      background: "var(--surface, #11211b)", borderBottom: "1px solid var(--line, #22382c)",
      fontFamily: "'Outfit',sans-serif", position: "relative", zIndex: 70,
    }}>
      <button onClick={dismiss} aria-label={t("banner_close")} style={{ background: "none", border: "none", color: "var(--mut, #7d9488)", fontSize: 17, lineHeight: 1, cursor: "pointer", padding: 4, flexShrink: 0 }}>✕</button>
      <img src="/logo-mark-dark.webp" alt="" width="40" height="40" style={{ borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink, #eef3ee)", lineHeight: 1.15 }}>PadelPack</div>
        <div style={{ fontSize: 11.5, color: "var(--mut, #7d9488)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t("banner_sub")}
        </div>
      </div>
      <button onClick={open} style={{ flexShrink: 0, background: "var(--lime, #c8ff2d)", color: "var(--lime-fg, #0a1612)", border: "none", borderRadius: 999, padding: "8px 17px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
        {t("banner_open")}
      </button>
    </div>
  );
}
