// lib/auth.js
// Авторизация через Supabase Auth: email/пароль + Google.
import { supabase } from "./supabase";
import { authRedirectTo, isNativeApp, capPlugin } from "./platform";

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
export async function signInGoogle() {
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
