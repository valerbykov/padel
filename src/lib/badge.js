// lib/badge.js
// Бейдж с числом непрочитанного на ИКОНКЕ приложения.
// Нативка (Android/iOS) — плагин @capawesome/capacitor-badge (доступ через
// window.Capacitor.Plugins, как и остальные плагины — см. platform.js);
// PWA/веб — стандартный Badging API (navigator.setAppBadge, Chrome/Edge,
// установленное приложение). Ошибки глотаем: бейдж — некритичное украшение.
import { capPlugin } from "./platform";

let permChecked = false;

export async function setAppBadgeCount(n) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  const Badge = capPlugin("Badge");
  if (Badge) {
    try {
      // iOS требует разрешения на уведомления; спрашиваем один раз за сессию
      // (обычно уже выдано регистрацией пушей).
      if (!permChecked) {
        permChecked = true;
        try {
          const p = await Badge.checkPermissions?.();
          if (p && p.display === "prompt") await Badge.requestPermissions?.();
        } catch (e) { /* ignore */ }
      }
      if (count > 0) await Badge.set({ count });
      else await Badge.clear();
      return;
    } catch (e) { /* плагин не вшит в сборку — пробуем веб-путь */ }
  }
  try {
    if (count > 0) await navigator.setAppBadge?.(count);
    else await navigator.clearAppBadge?.();
  } catch (e) { /* браузер не поддерживает — тихо */ }
}
