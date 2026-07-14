// lib/notifications.js
// Личные напоминания о сборе на игру/турнир.
// Модель: пользователь выбирает офсеты (за сколько до старта напоминать), сервер
// (edge-функция send-due-reminders по pg_cron) сам шлёт push через FCM всем, у кого
// событие «созрело». Здесь — чтение/запись настроек и регистрация push-токена устройства.
import { supabase } from "./supabase";
import { isNativeApp, capPlugin } from "./platform";

// Доступные офсеты (минуты до старта). key — ключ i18n для подписи чипа.
export const OFFSET_OPTIONS = [
  { min: 1440, key: "notif_off_day" }, // за день
  { min: 300,  key: "notif_off_5h" },  // за 5 часов
  { min: 120,  key: "notif_off_2h" },  // за 2 часа
  { min: 60,   key: "notif_off_1h" },  // за час
];
const DEFAULT_OFFSETS = [1440, 120];

function platformName() {
  try { return window.Capacitor?.getPlatform?.() || "android"; } catch { return "android"; }
}

// Пояс устройства — чтобы напоминания показывали локальное время старта.
function deviceTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
}

// Настройки текущего пользователя (или разумный дефолт, если строки ещё нет).
// notifyEvents — пуши о событиях лиги (новая игра/турнир/объявление), поверх enabled.
export async function getNotifPrefs() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { enabled: false, offsets: DEFAULT_OFFSETS, notifyEvents: true };
  const { data, error } = await supabase
    .from("notification_prefs").select("enabled, offsets, notify_events").eq("user_id", user.id).maybeSingle();
  if (error || !data) return { enabled: false, offsets: DEFAULT_OFFSETS, notifyEvents: true };
  const offsets = Array.isArray(data.offsets) && data.offsets.length ? data.offsets : DEFAULT_OFFSETS;
  return { enabled: !!data.enabled, offsets, notifyEvents: data.notify_events !== false };
}

// Сохранить настройки (upsert по user_id). offsets нормализуем: уникальные, по убыванию.
export async function saveNotifPrefs({ enabled, offsets, notifyEvents = true }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authed");
  const clean = [...new Set((offsets || []).filter((n) => Number.isFinite(n)))].sort((a, b) => b - a);
  const { error } = await supabase.from("notification_prefs").upsert(
    { user_id: user.id, enabled: !!enabled, offsets: clean, notify_events: !!notifyEvents, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) throw error;
  return { enabled: !!enabled, offsets: clean, notifyEvents: !!notifyEvents };
}

// Сохранить токен устройства (upsert по token — он уникален у FCM).
async function saveToken(token) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !token) return;
  await supabase.from("push_tokens").upsert(
    { token, user_id: user.id, platform: platformName(), tz: deviceTz(), updated_at: new Date().toISOString() },
    { onConflict: "token" }
  );
}

// Запросить разрешение и зарегистрировать push-токен. Только нативка (веб/PWA — no-op).
// Идемпотентно: слушатели вешаются один раз, register() можно звать на каждом старте.
export async function registerPush() {
  if (!isNativeApp()) return false;
  const PN = capPlugin("PushNotifications");
  if (!PN) return false;
  try {
    let perm = await PN.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PN.requestPermissions();
    }
    if (perm.receive !== "granted") return false;
    if (!registerPush._bound) {
      registerPush._bound = true;
      // Android → FCM-токен, iOS → APNs-токен (шлём на iOS напрямую в APNs из бэкенда).
      // platform сохраняется вместе с токеном (platformName()) — по нему рассылка выбирает канал.
      PN.addListener("registration", (t) => { saveToken(t && t.value).catch(() => {}); });
      PN.addListener("registrationError", () => {});
    }
    await PN.register();
    return true;
  } catch (_) { return false; }
}
