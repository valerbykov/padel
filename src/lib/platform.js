// lib/platform.js
// Определение платформы для нативной обёртки (Capacitor) vs веб/PWA.
// Намеренно НЕ импортируем @capacitor/core, чтобы веб-сборка собиралась
// даже без установленного Capacitor. В нативном webview Capacitor сам
// внедряет глобальный объект window.Capacitor.

// Кастомная URL-схема приложения (зарегистрировать в Xcode URL Types
// и в AndroidManifest intent-filter). Должна совпадать со значением в
// Supabase → Authentication → URL Configuration → Redirect URLs.
export const NATIVE_SCHEME = "padelpack";
export const NATIVE_REDIRECT = `${NATIVE_SCHEME}://login-callback`;

// Канонический веб-домен для ссылок-«поделиться». В нативке window.location.origin =
// capacitor://localhost, поэтому для share-ссылок берём фиксированный домен (на него
// же настроены App Links / Universal Links).
export const WEB_BASE = "https://padelpack.app";

// true — приложение запущено как нативное (iOS/Android через Capacitor).
export function isNativeApp() {
  return !!(
    typeof window !== "undefined" &&
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === "function" &&
    window.Capacitor.isNativePlatform()
  );
}

// Куда Supabase должен вернуть пользователя после входа:
// в нативе — по deep link, на вебе — на текущий домен.
export function authRedirectTo() {
  if (isNativeApp()) return NATIVE_REDIRECT;
  return typeof window !== "undefined" ? window.location.origin : NATIVE_REDIRECT;
}

// Доступ к нативным плагинам Capacitor (если есть).
export function capPlugin(name) {
  return (typeof window !== "undefined" && window.Capacitor?.Plugins?.[name]) || null;
}
