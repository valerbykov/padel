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
    // implicit: токен приходит в #access_token прямо в URL — корректно работает
    // в standalone-PWA (возврат от Google в Safari/PWA) и совместимо с нативным
    // deep-link (handleAuthCallbackUrl в auth.js понимает и access_token, и code).
    // PKCE здесь ломал вход в установленной PWA на iOS (обмен code требует verifier
    // из localStorage, который теряется при возврате через Safari).
    flowType: "implicit",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
