// lib/auth.js
// Авторизация через Supabase Auth: email/пароль + Google.
import { supabase } from "./supabase";
import { authRedirectTo, isNativeApp, capPlugin, NATIVE_REDIRECT } from "./platform";

// --- nonce для нативного Sign in with Apple (Apple хранит SHA256(nonce) в токене,
//     Supabase сверяет с raw nonce) ---
function randomNonce(len = 32) {
  const cs = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = new Uint8Array(len);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  return Array.from(bytes, (b) => cs[b % cs.length]).join("");
}
async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- регистрация / вход ---------- */

// Регистрация по email. name попадёт в метаданные и далее в profiles (через триггер).
export async function signUpEmail(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  return data;
}

export async function signInEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Вход через Google (OAuth).
// Веб: обычный редирект на текущий домен.
// Нативка (Capacitor): Google запрещает вход во встроенном webview, поэтому
// открываем системный браузер, а возврат ловим по deep link в App.jsx
// (см. handleAuthCallbackUrl).
let _googleInited = false;
async function ensureGoogleInit(Social) {
  if (_googleInited) return;
  await Social.initialize({
    google: {
      iOSClientId: import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID,
      webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID,
    },
  });
  _googleInited = true;
}

export async function signInGoogle() {
  // iOS + Android: нативный Google (capgo social-login) → idToken → Supabase, без браузера.
  // iOS использует iOSClientId, Android — webClientId (serverClientId).
  const platform = typeof window !== "undefined" && window.Capacitor?.getPlatform?.();
  const Social = capPlugin("SocialLogin");
  const nativeGoogleOk = isNativeApp() && Social && (
    (platform === "ios" && import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID) ||
    (platform === "android" && import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID)
  );
  if (nativeGoogleOk) {
    await ensureGoogleInit(Social);
    const res = await Social.login({ provider: "google", options: { scopes: ["email", "profile"] } });
    const idToken = res?.result?.idToken;
    if (!idToken) throw new Error("Google: не получен idToken");
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
    if (error) throw error;
    return data;
  }

  const redirectTo = authRedirectTo();

  if (isNativeApp()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    const Browser = capPlugin("Browser");
    if (Browser && data?.url) {
      await Browser.open({ url: data.url });
    } else if (data?.url) {
      window.location.href = data.url; // запасной путь
    }
    return data;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
  return data;
}

// Вход через Apple (обязателен на iOS по правилу App Store 4.8, т.к. есть Google).
// Тот же путь, что Google: нативка — системный браузер + возврат по deep link.
export async function signInApple() {
  // iOS: нативная шторка Apple (без Safari) — быстрый UX и «правильный» путь для App Store.
  const platform = typeof window !== "undefined" && window.Capacitor?.getPlatform?.();
  const SignInWithApple = capPlugin("SignInWithApple");
  if (isNativeApp() && platform === "ios" && SignInWithApple) {
    const rawNonce = randomNonce();
    const hashedNonce = await sha256hex(rawNonce);
    const res = await SignInWithApple.authorize({ scopes: "email name", nonce: hashedNonce });
    const idToken = res?.response?.identityToken;
    if (!idToken) throw new Error("Apple: не получен identity token");
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple", token: idToken, nonce: rawNonce,
    });
    if (error) throw error;
    return data;
  }

  // Веб/Android/фолбэк: OAuth через системный браузер.
  const redirectTo = authRedirectTo();
  if (isNativeApp()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    const Browser = capPlugin("Browser");
    if (Browser && data?.url) await Browser.open({ url: data.url });
    else if (data?.url) window.location.href = data.url;
    return data;
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: { redirectTo },
  });
  if (error) throw error;
  return data;
}

// Обработка возврата по deep link (padelapp://login-callback?...).
// Вызывается из слушателя appUrlOpen в App.jsx. Поддерживает PKCE (?code=)
// и implicit-поток (#access_token=). Возвращает true, если сессия установлена.
export async function handleAuthCallbackUrl(url) {
  try {
    const u = new URL(url);
    const code = u.searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      capPlugin("Browser")?.close?.();
      return true;
    }
    const hash = u.hash?.startsWith("#") ? u.hash.slice(1) : u.hash || "";
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
      capPlugin("Browser")?.close?.();
      return true;
    }
  } catch (e) {
    console.warn("[auth] не удалось обработать callback URL:", e);
  }
  return false;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/* ---------- сессия и профиль ---------- */

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session; // null, если не залогинен
}

// Подписка на изменение статуса входа (вызывать в корне приложения).
// Возвращает функцию отписки.
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

// Текущий профиль (строка из таблицы profiles), созданный триггером при регистрации.
export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}


/* ---------- Яндекс (Yandex ID) — OAuth code flow ---------- */
// Яндекса нет в нативных провайдерах Supabase, поэтому свой поток:
// 1) редирект на oauth.yandex.ru; 2) возврат с ?code=; 3) edge-функция yandex-auth
// меняет code на сессию (как telegram-auth).
const YANDEX_CLIENT_ID = import.meta.env.VITE_YANDEX_CLIENT_ID;

export function signInYandex() {
  if (!YANDEX_CLIENT_ID) { console.warn("VITE_YANDEX_CLIENT_ID не задан"); return; }
  const redirect = isNativeApp() ? NATIVE_REDIRECT : window.location.origin + "/";
  const u = new URL("https://oauth.yandex.ru/authorize");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", YANDEX_CLIENT_ID);
  u.searchParams.set("redirect_uri", redirect);
  u.searchParams.set("state", "padel_yandex");
  // Нативка: Яндекс во встроенном webview капризен — открываем системный браузер,
  // возврат ловим по deep link (padelpack://login-callback?code=...) в App.jsx.
  if (isNativeApp()) {
    const Browser = capPlugin("Browser");
    if (Browser) { Browser.open({ url: u.toString() }); return; }
  }
  window.location.href = u.toString();
}

// Вызвать на старте: если вернулись с Яндекса (?code=...&state=padel_yandex) —
// меняем code на сессию Supabase. Возвращает true при успехе.
export async function handleYandexCallback(rawUrl) {
  let qs;
  if (rawUrl) { const i = rawUrl.indexOf("?"); qs = i >= 0 ? rawUrl.slice(i + 1) : ""; }
  else { qs = (typeof window !== "undefined" ? window.location.search : "").replace(/^\?/, ""); }
  const sp = new URLSearchParams(qs);
  if (sp.get("state") !== "padel_yandex" || !sp.get("code")) return false;
  const code = sp.get("code");
  const redirect = isNativeApp() ? NATIVE_REDIRECT : window.location.origin + "/";
  try {
    const { data, error } = await supabase.functions.invoke("yandex-auth", { body: { code, redirect_uri: redirect } });
    if (error) throw error;
    let r = await supabase.auth.verifyOtp({ email: data.email, token: data.token, type: "email" });
    if (r.error && data.token_hash) r = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: "email" });
    return !r.error;
  } catch (e) {
    console.warn("yandex callback failed", e);
    return false;
  } finally {
    if (!rawUrl && typeof window !== "undefined") window.history.replaceState({}, "", window.location.pathname);
  }
}
