// lib/supabase.js
// Инициализация клиента Supabase.
// Переменные берутся из .env (Vite). Заполни своими значениями из
// Supabase → Project Settings → API:
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGci...
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn("Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, anon, {
  auth: {
    // PKCE: вход возвращает ?code=..., который мы обмениваем на сессию.
    // Нужно для корректной обработки OAuth-возврата по deep link в нативе.
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
