// components/OpenInApp.jsx
// «Открыть в приложении» на гостевых веб-страницах (/l /j /t /r): сценарий
// «все скачали приложение, а QR ведёт в браузер». QR-сканеры открывают URL в
// браузере, откуда https-ссылка в натив не уводит — но переход на кастомную
// схему ПО ТАПУ пользователя браузеры разрешают. Схема padelpack:// уже
// зарегистрирована на iOS/Android, а appUrlOpen→routeFromUrl в App.jsx понимает
// URL вида padelpack://padelpack.app/<path> (hostname совпадает).
//
// Таймер-фолбэк: браузер не умеет узнать, установлено ли приложение. Если через
// ~1.6с после тапа вкладка всё ещё видима (в натив не ушли) — показываем ссылку
// на стор. Если приложение открылось, вкладка уходит в фон (visibilitychange /
// pagehide) и таймер отменяется.
import React, { useEffect, useRef, useState } from "react";
import { isNativeApp } from "../lib/platform";
import { t } from "../lib/i18n";

const APP_STORE_URL = "https://apps.apple.com/ru/app/padelpack/id6787536510";
const PLAY_URL = "https://play.google.com/store/apps/details?id=app.padelpack";

const ua = () => { try { return navigator.userAgent; } catch (e) { return ""; } };
const isIOS = () => /iphone|ipad|ipod/i.test(ua());
const isMobileBrowser = () => !isNativeApp() && /iphone|ipad|ipod|android/i.test(ua());

export default function OpenInApp({ path, style }) {
  const [failed, setFailed] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // приложение открылось → вкладка в фоне → фолбэк не нужен
    const cancel = () => { if (document.hidden) { clearTimeout(timerRef.current); } };
    document.addEventListener("visibilitychange", cancel);
    window.addEventListener("pagehide", cancel);
    return () => {
      clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", cancel);
      window.removeEventListener("pagehide", cancel);
    };
  }, []);

  if (!isMobileBrowser()) return null;
  const href = `padelpack://padelpack.app${path.startsWith("/") ? path : `/${path}`}`;
  const storeUrl = isIOS() ? APP_STORE_URL : PLAY_URL;

  const onTap = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // всё ещё на этой вкладке → в натив не ушли → приложения, видимо, нет
      if (!document.hidden) setFailed(true);
    }, 1600);
  };

  const base = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    padding: "11px 14px", borderRadius: 12, textDecoration: "none",
    fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 14,
  };
  return (
    <div style={style}>
      <a href={href} onClick={onTap} style={{
        ...base,
        background: "color-mix(in srgb, var(--lime) 10%, transparent)",
        border: "1px solid color-mix(in srgb, var(--lime) 40%, transparent)",
        color: "var(--lime)",
      }}>
        📲 {t("open_in_app")}
      </a>
      {failed && (
        <a href={storeUrl} style={{
          ...base, marginTop: 8,
          background: "var(--surface2, rgba(255,255,255,.05))",
          border: "1px solid var(--line, rgba(255,255,255,.15))",
          color: "var(--ink, #eef3ee)", fontSize: 13,
        }}>
          {t("open_in_app_store")}
        </a>
      )}
    </div>
  );
}
