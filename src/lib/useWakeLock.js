// useWakeLock — держит экран включённым (Screen Wake Lock API), пока смонтирован
// компонент (ТВ-табло на планшете/стойке). Поддержка: Chrome/Edge/Android давно;
// iOS/iPadOS Safari — с 16.4. Где API нет — тихо ничего не делаем (не падаем).
// Блокировка сама снимается, когда вкладка уходит в фон (переключение приложений,
// блокировка) — поэтому перезапрашиваем на возврате видимости.
import { useEffect } from "react";

export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        if (cancelled) return;
        lock = await navigator.wakeLock.request("screen");
        // Если система сняла блокировку (например, ушли в фон) — сбрасываем ссылку,
        // чтобы onVisible перезапросил свежую.
        lock.addEventListener?.("release", () => { lock = null; });
      } catch (e) { /* нет прав/жеста/поддержки — работаем без wake lock */ }
    };
    const onVisible = () => { if (document.visibilityState === "visible" && !lock) acquire(); };

    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      try { lock && lock.release(); } catch (e) { /* уже снята */ }
      lock = null;
    };
  }, [active]);
}
