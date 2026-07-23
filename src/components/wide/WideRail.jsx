// WideRail — вертикальная навигация слева на ≥900px (заменяет нижние табы).
// Task 1: только иконки (72px). Task 8: морфинг в сайдбар с подписями на ≥1280px
// (гамбургер → localStorage-флаг pp_rail_exp, см. useRailExpanded в wide.js).
// Wide-полировка: лига-свитчер вверху + профиль/тема/колокольчик внизу
// (перенесены из верхнего TopBar App.jsx; в широком режиме верхний бар убран).
import React from "react";
import { Users, Swords, Trophy, History, Sun, Moon } from "lucide-react";
import { t } from "../../lib/i18n";
import LeagueSwitcher from "../LeagueSwitcher";
import NotificationBell from "../NotificationBell";
import Avatar from "../Avatar";

export default function WideRail({
  tab, goTab, session, activeLeague, expanded, canExpand, onToggleExpand,
  // перенесённые из TopBar контролы (только залогиненному):
  leagues = [], leaguesReady = true, isAdmin = false,
  onLeagueChange, onLeagueCreated, onLeagueUpdated, onLeagueLeft,
  profileName = "", profileAvatarUrl = null, profileId = null, onEditProfile,
  theme = "dark", onThemeToggle, onOpenEvent,
}) {
  const items = [
    session && { id: "board", icon: Users, label: t("tab_friends") },
    { id: "games", icon: Swords, label: t("tab_games") },
    { id: "tournaments", icon: Trophy, label: t("tab_tournaments") },
    session && { id: "history", icon: History, label: t("tab_history") },
  ].filter(Boolean);
  return (
    <div style={{ width: expanded ? 244 : 72, flexShrink: 0, borderRight: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 30,
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

      {/* Лига — переключатель вверху (перенос из TopBar). Гостю не показываем. */}
      {session && (
        <div style={{ margin: expanded ? "0 0 6px" : "0 0 4px", alignSelf: "stretch" }}>
          <LeagueSwitcher compact expanded={expanded} leagues={leagues} leaguesReady={leaguesReady} activeLeague={activeLeague} isAdmin={isAdmin}
            onLeagueChange={onLeagueChange} onLeagueCreated={onLeagueCreated} onLeagueUpdated={onLeagueUpdated} onLeagueLeft={onLeagueLeft} />
        </div>
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

      {/* Низ рейла: колокольчик + профиль + тема (перенос из TopBar). */}
      {session && (
        <>
          <div style={{ height: 1, background: "var(--line)", margin: expanded ? "4px 12px" : "4px 12px", alignSelf: "stretch" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: expanded ? "flex-start" : "center", gap: expanded ? 6 : 0, margin: expanded ? "0 10px" : 0 }}>
            <NotificationBell leagues={leagues} activeLeague={activeLeague} onOpen={onOpenEvent} />
            {expanded && <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--mut)" }}>{t("nav_notifications")}</span>}
          </div>
          {onEditProfile && (expanded ? (
            <button onClick={onEditProfile} title={profileName || t("pc_title")}
              style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 8px 0", padding: "7px 10px", borderRadius: 12, border: "none", background: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Outfit',sans-serif" }}>
              <Avatar name={profileName} url={profileAvatarUrl} id={profileId} size={30} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profileName || t("pc_title")}</span>
            </button>
          ) : (
            <button onClick={onEditProfile} title={profileName || t("pc_title")} aria-label={profileName || t("pc_title")}
              style={{ margin: "2px auto 0", padding: 0, border: "none", background: "none", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <Avatar name={profileName} url={profileAvatarUrl} id={profileId} size={38} />
            </button>
          ))}
          <button onClick={onThemeToggle} aria-label={t("aria_theme")} title={t(theme === "dark" ? "theme_to_light" : "theme_to_dark")}
            style={expanded
              ? { display: "flex", alignItems: "center", gap: 10, margin: "2px 8px 0", padding: "8px 12px", borderRadius: 12, border: "none", background: "none", cursor: "pointer", color: "var(--mut)", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 12.5 }
              : { width: 46, height: 40, margin: "2px auto 0", borderRadius: 10, border: "none", background: "none", cursor: "pointer", color: "var(--mut)", display: "grid", placeItems: "center" }}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {expanded && <span>{t(theme === "dark" ? "theme_to_light" : "theme_to_dark")}</span>}
          </button>
        </>
      )}
    </div>
  );
}
