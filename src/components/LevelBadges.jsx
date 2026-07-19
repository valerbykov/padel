// components/LevelBadges.jsx
// Бейджи самозаявленного уровня игрока (см. lib/levels.js). Пусто → ничего.
import React from "react";
import { formatLevel } from "../lib/levels";

export default function LevelBadges({ levels, compact = false }) {
  const list = Array.isArray(levels) ? levels : [];
  const shown = list.map((l) => formatLevel(l)).filter(Boolean);
  if (!shown.length) return null;
  const color = (sys) => sys === "pt" ? "var(--lime)" : sys === "ltr" ? "#7cc4e0" : "var(--mut)";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: compact ? 0 : 6 }}>
      {list.map((l, i) => {
        const label = formatLevel(l);
        if (!label) return null;
        const c = color(l.sys);
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", borderRadius: 999,
            padding: compact ? "1px 7px" : "3px 9px", fontSize: compact ? 10.5 : 12, fontWeight: 700,
            color: c, background: `color-mix(in srgb, ${c} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 40%, transparent)` }}>
            {label}
          </span>
        );
      })}
    </div>
  );
}
