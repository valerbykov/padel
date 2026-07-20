// lib/routeResolvers.js — лёгкие резолверы гостевых ссылок (/t/, /j/) для App.jsx.
// ВАЖНО: импортируем ТОЛЬКО supabase, без tournamentApi/padelApi — иначе App-чанк
// (критический путь) тянул бы americano/mexicano и прочий тяжёлый код ради двух
// маленьких запросов. RLS сам гейтит: строка вернётся только участнику лиги.
import { supabase } from "./supabase";

// Турнир по коду среди доступных пользователю (участнику лиги). null = нет доступа.
export async function findMyTournamentByCode(code) {
  try {
    const { data, error } = await supabase.from("tournaments")
      .select("id, group_id").ilike("invite_code", code.trim()).maybeSingle();
    if (error || !data) return null;
    return data;
  } catch (e) { return null; }
}

// Игра по коду среди доступных пользователю. ilike — регистронезависимо (реальные
// коды в верхнем регистре, демо в нижнем; /j/-обработчик код аплокейсит). null = нет доступа.
export async function findMyGameByCode(code) {
  try {
    const { data, error } = await supabase.from("games")
      .select("id, group_id").ilike("invite_code", code.trim()).maybeSingle();
    if (error || !data) return null;
    return data;
  } catch (e) { return null; }
}
