// lib/shareLink.js
// Надёжно поделиться ссылкой на всех платформах. Главное: в Android WebView НЕТ
// navigator.share (и navigator.clipboard часто не работает без secure-context) —
// поэтому на нативе идём через плагин Capacitor Share, а в вебе — navigator.share
// с фолбэком на буфер обмена. Возвращает "shared" | "copied" | "failed" для фидбека.
import { isNativeApp, capPlugin } from "./platform";

export async function shareUrl({ title = "PadelPack", text = "", url }) {
  // 1) Натив — системный share-sheet через Capacitor Share.
  if (isNativeApp()) {
    const Share = capPlugin("Share");
    if (Share) {
      try { await Share.share({ title, text, url, dialogTitle: title }); return "shared"; }
      catch (e) {
        const m = String(e?.message || e).toLowerCase();
        if (m.includes("cancel")) return "shared"; // пользователь закрыл лист — это ок
        // иначе падаем в фолбэки ниже
      }
    }
  }
  // 2) Веб — Web Share API (iOS Safari/WKWebView его поддерживает).
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text, url }); return "shared";
    }
  } catch (e) { if (e && e.name === "AbortError") return "shared"; }
  // 3) Буфер обмена.
  try { await navigator.clipboard.writeText(url); return "copied"; } catch (e) { /* ниже legacy */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand("copy"); document.body.removeChild(ta);
    return "copied";
  } catch (e) { /* ignore */ }
  return "failed";
}
