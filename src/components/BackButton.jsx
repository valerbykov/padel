// components/BackButton.jsx
// iOS-стиль «назад»: шеврон + подпись (A) и жест свайпа от левого края экрана (B).
// Свайп — только touch/pen и только от самого края (x<=24), чтобы не конфликтовать
// со свайпами карточек (удаление/копирование) и с мышью на десктопе.
import React, { useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { t } from "../lib/i18n";

export default function BackButton({ onClick, label, style }) {
  useEffect(() => {
    if (!onClick) return;
    let sx = 0, sy = 0, on = false;
    const down = (e) => {
      if (e.pointerType === "mouse") return;
      if (e.clientX <= 24) { sx = e.clientX; sy = e.clientY; on = true; }
    };
    const move = (e) => {
      if (!on) return;
      if (Math.abs(e.clientY - sy) > 40) { on = false; return; }
      if (e.clientX - sx > 60) { on = false; onClick(); }
    };
    const end = () => { on = false; };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
    };
  }, [onClick]);

  return (
    <button onClick={onClick} aria-label={label || t("back")}
      style={{ display: "inline-flex", alignItems: "center", gap: 1, background: "none", border: "none", cursor: "pointer",
        color: "var(--lime)", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 15, padding: "6px 6px 6px 0", ...style }}>
      <ChevronLeft size={22} strokeWidth={2.5} style={{ marginLeft: -4, marginRight: -1 }} />
      {label || t("back")}
    </button>
  );
}
