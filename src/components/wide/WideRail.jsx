// WideRail — вертикальная навигация слева на ≥900px (заменяет нижние табы).
// Task 1: только иконки (72px). Морфинг в сайдбар с подписями — Task 8.
import React from "react";
import { Users, Swords, Trophy, History } from "lucide-react";
import { t } from "../../lib/i18n";

export default function WideRail({ tab, goTab, session, activeLeague }) {
  const items = [
    session && { id: "board", icon: Users, label: t("tab_friends") },
    { id: "games", icon: Swords, label: t("tab_games") },
    { id: "tournaments", icon: Trophy, label: t("tab_tournaments") },
    session && { id: "history", icon: History, label: t("tab_history") },
  ].filter(Boolean);
  return (
    <div style={{ width: 72, flexShrink: 0, borderRight: "1px solid var(--line)", position: "sticky", top: 0,
      height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      padding: "14px 0 16px", background: "color-mix(in srgb, var(--surface) 60%, var(--bg))" }}>
      {items.map(({ id, icon: Icon, label }) => (
        <button key={id} onClick={() => goTab(id)} title={label} aria-label={label}
          style={{ width: 46, height: 46, borderRadius: 12, border: "none", cursor: "pointer",
            display: "grid", placeItems: "center",
            background: tab === id ? "color-mix(in srgb, var(--lime) 14%, transparent)" : "none",
            color: tab === id ? "var(--lime)" : "var(--mut)" }}>
          <Icon size={21} strokeWidth={tab === id ? 2.6 : 2} />
        </button>
      ))}
      <div style={{ flex: 1 }} />
      {activeLeague && (
        <div title={activeLeague.name} style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--lime)",
          color: "var(--lime-fg)", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 13 }}>
          {(activeLeague.name || "?").trim().charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}
