// WideRail — вертикальная навигация слева на ≥900px (заменяет нижние табы).
// Task 1: только иконки (72px). Task 8: морфинг в сайдбар с подписями на ≥1280px
// (гамбургер → localStorage-флаг pp_rail_exp, см. useRailExpanded в wide.js).
import React from "react";
import { Users, Swords, Trophy, History } from "lucide-react";
import { t } from "../../lib/i18n";

export default function WideRail({ tab, goTab, session, activeLeague, expanded, canExpand, onToggleExpand }) {
  const items = [
    session && { id: "board", icon: Users, label: t("tab_friends") },
    { id: "games", icon: Swords, label: t("tab_games") },
    { id: "tournaments", icon: Trophy, label: t("tab_tournaments") },
    session && { id: "history", icon: History, label: t("tab_history") },
  ].filter(Boolean);
  return (
    <div style={{ width: expanded ? 244 : 72, flexShrink: 0, borderRight: "1px solid var(--line)", position: "sticky", top: 0,
      height: "100vh", display: "flex", flexDirection: "column", alignItems: expanded ? "stretch" : "center", gap: 6,
      padding: "14px 0 16px", background: "color-mix(in srgb, var(--surface) 60%, var(--bg))", transition: "width .18s" }}>
      {canExpand && (
        <button onClick={onToggleExpand} aria-label="menu"
          style={{ width: expanded ? "auto" : 46, height: 40, margin: expanded ? "0 10px 4px" : "0 0 4px", borderRadius: 10,
            border: "none", cursor: "pointer", background: "none", color: "var(--mut)",
            display: "flex", alignItems: "center", justifyContent: expanded ? "flex-start" : "center", fontSize: 18 }}>
          ≡
        </button>
      )}
      {items.map(({ id, icon: Icon, label }) => expanded ? (
        <button key={id} onClick={() => goTab(id)} title={label} aria-label={label}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", margin: "0 8px", borderRadius: 12,
            border: "none", cursor: "pointer", textAlign: "left", fontWeight: 700, fontSize: 13.5,
            background: tab === id ? "color-mix(in srgb, var(--lime) 14%, transparent)" : "none",
            color: tab === id ? "var(--lime)" : "var(--mut)" }}>
          <Icon size={21} strokeWidth={tab === id ? 2.6 : 2} />
          <span>{label}</span>
        </button>
      ) : (
        <button key={id} onClick={() => goTab(id)} title={label} aria-label={label}
          style={{ width: 46, height: 46, borderRadius: 12, border: "none", cursor: "pointer",
            display: "grid", placeItems: "center",
            background: tab === id ? "color-mix(in srgb, var(--lime) 14%, transparent)" : "none",
            color: tab === id ? "var(--lime)" : "var(--mut)" }}>
          <Icon size={21} strokeWidth={tab === id ? 2.6 : 2} />
        </button>
      ))}
      <div style={{ flex: 1 }} />
      {activeLeague && (expanded ? (
        <div title={activeLeague.name} style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 12px", minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--lime)", flexShrink: 0,
            color: "var(--lime-fg)", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 13 }}>
            {(activeLeague.name || "?").trim().charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {activeLeague.name}
          </span>
        </div>
      ) : (
        <div title={activeLeague.name} style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--lime)",
          color: "var(--lime-fg)", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 13, alignSelf: "center" }}>
          {(activeLeague.name || "?").trim().charAt(0).toUpperCase()}
        </div>
      ))}
    </div>
  );
}
