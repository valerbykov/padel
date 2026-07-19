// components/LevelBadges.jsx
// Бейджи самозаявленного уровня игрока (см. lib/levels.js). Пусто → ничего.
import React from "react";
import { formatLevel, formatEventLevel } from "../lib/levels";
import ptIcon from "../assets/levels/playtomic.png";
import lundaIcon from "../assets/levels/lunda.png";

// Логотип системы уровня (Playtomic / буквенная Lunda-стиль); для "oth" — нет.
const sysIcon = (sys) => sys === "pt" ? ptIcon : sys === "ltr" ? lundaIcon : null;

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
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999,
            padding: compact ? "1px 7px" : "3px 9px", fontSize: compact ? 10.5 : 12, fontWeight: 700,
            color: c, background: `color-mix(in srgb, ${c} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 40%, transparent)` }}>
            {sysIcon(l.sys) && <img src={sysIcon(l.sys)} alt="" width={compact ? 12 : 14} height={compact ? 12 : 14} style={{ borderRadius: 3, flexShrink: 0 }} />}
            {label}
          </span>
        );
      })}
    </div>
  );
}

// Бейдж событийного уровня (турнир/игра) — с диапазоном val2, см. lib/levels.js.
export function EventLevelBadge({ level, compact = false }) {
  const label = formatEventLevel(level);
  if (!label) return null;
  const c = level.sys === "pt" ? "var(--lime)" : level.sys === "ltr" ? "#7cc4e0" : "var(--mut)";
  const icon = sysIcon(level.sys);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, padding: compact ? "1px 8px 1px 6px" : "3px 10px 3px 7px", fontSize: compact ? 11 : 12.5, fontWeight: 700, color: c, background: `color-mix(in srgb, ${c} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 40%, transparent)` }}>
      {icon && <img src={icon} alt="" width={compact ? 12 : 14} height={compact ? 12 : 14} style={{ borderRadius: 3, flexShrink: 0 }} />}
      {label}
    </span>
  );
}
