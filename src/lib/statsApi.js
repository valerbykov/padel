// lib/statsApi.js
// Запросы для экрана профиля и аналитики (поверх analytics.sql).
import { supabase } from "./supabase";

export async function getPlayerStats(groupId, profileId) {
  const { data, error } = await supabase.rpc("player_stats", { p_group_id: groupId, p_profile_id: profileId });
  if (error) throw error;
  return data;
}

export async function getPlayerRecentMatches(groupId, profileId, limit = 10) {
  const { data, error } = await supabase.rpc("player_recent_matches", {
    p_group_id: groupId, p_profile_id: profileId, p_limit: limit,
  });
  if (error) throw error;
  return data || [];
}

// История рейтинга: точки с датами (r = рейтинг после матча, at = когда).
// Даты нужны графику для фильтра по периоду, недельной дельты и рекордов по месяцам.
export async function getRatingHistory(groupId, profileId) {
  const { data, error } = await supabase
    .from("rating_changes")
    .select("rating_after, created_at")
    .eq("group_id", groupId)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((d) => ({ r: d.rating_after, at: d.created_at }));
}

// Недельные дельты рейтинга всех участников лиги: profile_id → Σdelta за 7 дней.
// Один лёгкий запрос для трендов в таблице «Друзья».
export async function getWeekDeltas(groupId) {
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data, error } = await supabase
    .from("rating_changes")
    .select("profile_id, delta")
    .eq("group_id", groupId)
    .gt("created_at", weekAgo);
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.profile_id] = (map[r.profile_id] || 0) + (r.delta || 0); });
  return map;
}

export async function getGroupAnalytics(groupId) {
  // Передаём таймзону клиента, чтобы сервер группировал матчи по дням в ЛОКАЛЬНОЙ
  // дате пользователя (иначе вечерние матчи «уезжают» на соседний день).
  let tz = "UTC";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { /* ignore */ }
  const { data, error } = await supabase.rpc("group_analytics", { p_group_id: groupId, p_tz: tz });
  if (error) throw error;
  return data;
}
