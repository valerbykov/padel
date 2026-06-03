// lib/auth.js
// Авторизация через Supabase Auth: email/пароль + Google.
import { supabase } from "./supabase";

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

// Вход через Google (OAuth). После авторизации вернёт на текущий домен.
export async function signInGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
  return data;
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
