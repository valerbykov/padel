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

// История рейтинга для графика: старт 1000 + значения после каждого матча.
export async function getRatingHistory(groupId, profileId) {
  const { data, error } = await supabase
    .from("rating_changes")
    .select("rating_after, created_at")
    .eq("group_id", groupId)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return [1000, ...data.map((d) => d.rating_after)];
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
