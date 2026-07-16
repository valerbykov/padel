// components/OpenInApp.jsx
// «Открыть в приложении» на гостевых веб-страницах (/l /j /t /r): сценарий
// «все скачали приложение, а QR ведёт в браузер». QR-сканеры открывают URL в
// браузере, откуда https-ссылка в натив не уводит — но переход на кастомную
// схему ПО ТАПУ пользователя браузеры разрешают. Схема padelpack:// уже
// зарегистрирована на iOS/Android, а appUrlOpen→routeFromUrl в App.jsx понимает
// URL вида padelpack://padelpack.app/<path> (hostname совпадает).
// Если приложения нет — тап просто ничего не сделает (веб-флоу остаётся основным),
// поэтому кнопка вторичная и только на мобильных браузерах (не в нативе).
import React from "react";
import { isNativeApp } from "../lib/platform";
import { t } from "../lib/i18n";

const isMobileBrowser = () => {
  try { return !isNativeApp() && /iphone|ipad|ipod|android/i.test(navigator.userAgent); }
  catch (e) { return false; }
};

export default function OpenInApp({ path, style }) {
  if (!isMobileBrowser()) return null;
  const href = `padelpack://padelpack.app${path.startsWith("/") ? path : `/${path}`}`;
  return (
    <a href={href} style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
      padding: "11px 14px", borderRadius: 12, textDecoration: "none",
      background: "color-mix(in srgb, var(--lime) 10%, transparent)",
      border: "1px solid color-mix(in srgb, var(--lime) 40%, transparent)",
      color: "var(--lime)", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 14,
      ...style,
    }}>
      📲 {t("open_in_app")}
    </a>
  );
}
