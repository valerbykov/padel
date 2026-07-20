// components/LevelBadges.jsx
// Бейджи самозаявленного уровня игрока (см. lib/levels.js). Пусто → ничего.
import React from "react";
import { formatLevel, formatEventLevel, eventVals } from "../lib/levels";
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
        const full = formatLevel(l);
        if (!full) return null;
        const icon = sysIcon(l.sys);
        // Компактно (борд/подиум) с иконкой — только значение (иконка несёт систему).
        // Не-компактно (карточка игрока) — полное имя «Playtomic 3.5»: место позволяет.
        const label = (icon && compact) ? String(l.val == null ? "" : l.val).trim() : full;
        const c = color(l.sys);
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, whiteSpace: "nowrap",
            padding: compact ? "1px 7px" : "3px 9px", fontSize: compact ? 10.5 : 12, fontWeight: 700,
            color: c, background: `color-mix(in srgb, ${c} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 40%, transparent)` }}>
            {icon && <img src={icon} alt="" width={compact ? 12 : 14} height={compact ? 12 : 14} style={{ borderRadius: 3, flexShrink: 0 }} />}
            {label}
          </span>
        );
      })}
    </div>
  );
}

// Бейдж событийного уровня (турнир/игра) — мультивыбор vals, см. lib/levels.js.
export function EventLevelBadge({ level, compact = false }) {
  if (!level || typeof level !== "object") return null;
  const icon = sysIcon(level.sys);
  const c = level.sys === "pt" ? "var(--lime)" : level.sys === "ltr" ? "#7cc4e0" : "var(--mut)";
  const pill = (content, key) => (
    <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, whiteSpace: "nowrap", padding: compact ? "1px 8px 1px 6px" : "3px 10px 3px 7px", fontSize: compact ? 11 : 12.5, fontWeight: 700, color: c, background: `color-mix(in srgb, ${c} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 40%, transparent)` }}>
      {icon && <img src={icon} alt="" width={compact ? 12 : 14} height={compact ? 12 : 14} style={{ borderRadius: 3, flexShrink: 0 }} />}
      {content}
    </span>
  );
  // С иконкой: каждое значение — отдельной таблеткой (иконка несёт систему,
  // «2.0» и «2.5» вместо слитного «2.0, 2.5»).
  if (icon) {
    const vals = eventVals(level);
    if (!vals.length) return null;
    return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 6, verticalAlign: "middle" }}>{vals.map((v, i) => pill(v, i))}</span>;
  }
  // Без иконки ("oth") — одна таблетка с полной подписью (свой lbl + значения).
  const label = formatEventLevel(level);
  if (!label) return null;
  return pill(label, 0);
}
