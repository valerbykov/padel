// components/Analytics.jsx
// Аналитика лиги с переключателем Все / Игры / Турниры. Каждая метрика считается
// по выбранному источнику (игры = таблица matches; турниры = сыгранные
// tournament_matches) — числа больше не путаются между собой. Тап по игроку в
// «самые активные» открывает его карточку. Рендерится внутри вкладки «Друзья».
import React, { useEffect, useState } from "react";
import { getGroupAnalytics } from "../lib/statsApi";
import { Swords, Users, Flame, ArrowLeft } from "lucide-react";
import { t, nGames } from "../lib/i18n";

function Bars({ data }) {
  const w = 320, h = 150, pad = 24;
  if (!data || data.length === 0)
    return <div style={{ color: "var(--mut)", fontSize: 13, textAlign: "center", padding: "26px 0" }}>{t("an_no_period")}</div>;
  const max = Math.max(...data.map((d) => d.count), 1);
  const bw = (w - pad - 8) / data.length;
  const midY = (h - 26) / 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
      <text x={9} y={midY} fontSize="8" fill="var(--mut)" textAnchor="middle" fontFamily="Outfit" transform={`rotate(-90 9 ${midY})`}>{t("an_axis_matches")}</text>
      <text x={pad - 4} y={14} fontSize="8" fill="var(--mut)" textAnchor="end" fontFamily="Outfit">{max}</text>
      {data.map((d, i) => {
        const bh = ((h - 34 - 8) * d.count) / max;
        const x = pad + i * bw;
        return (
          <g key={i}>
            <rect x={x + bw * 0.18} y={h - 22 - bh} width={bw * 0.64} height={bh} rx="3" fill="var(--lime)" />
            {d.count > 0 && <text x={x + bw / 2} y={h - 26 - bh} fontSize="8" fill="var(--mut)" textAnchor="middle" fontFamily="Outfit">{d.count}</text>}
            <text x={x + bw / 2} y={h - 8} fontSize="9" fill="var(--mut)" textAnchor="middle" fontFamily="Outfit">{d.week}</text>
          </g>
        );
      })}
    </svg>
  );
}

const Tile = ({ icon, label, value }) => (
  <div className="an-card an-tile">
    <div style={{ display: "flex", justifyContent: "center", color: "var(--lime)", marginBottom: 4 }}>{icon}</div>
    <div className="an-display" style={{ fontSize: 26 }}>{value ?? 0}</div>
    <div style={{ fontSize: 11, color: "var(--mut)" }}>{label}</div>
  </div>
);

export default function Analytics({ groupId, onBack, players = [], onOpenPlayer }) {
  const [data, setData] = useState(undefined);
  const [mode, setMode] = useState("all");

  useEffect(() => {
    let active = true;
    getGroupAnalytics(groupId)
      .then((d) => active && setData(d))
      .catch(() => active && setData(null));
    return () => { active = false; };
  }, [groupId]);

  // Срез по режиму. Фолбэк на плоскую старую форму, если миграция ещё не применена.
  const md = data ? (data[mode] || data) : null;

  return (
    <div className="pl-pop" style={{ fontFamily: "'Outfit',sans-serif" }}>
      <style>{`.an-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px;}.an-tile{flex:1;text-align:center;}.an-display{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-.3px;}`}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        {onBack && (
          <button className="pl-ghost" style={{ padding: "6px 12px" }} onClick={onBack}>
            <ArrowLeft size={14} style={{ display: "inline", marginRight: 4 }} />{t("back")}
          </button>
        )}
        <h1 className="an-display" style={{ fontSize: 24, margin: 0 }}>{t("an_title")}</h1>
      </div>

      {data === undefined && <p style={{ color: "var(--mut)" }}>{t("loading")}</p>}
      {data === null && <p style={{ color: "var(--coral)" }}>{t("an_error")}</p>}

      {data && md && (
        <>
          {/* Переключатель Все / Игры / Турниры */}
          <div style={{ display: "flex", gap: 4, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: 3, marginBottom: 14 }}>
            {[["all", t("filter_all")], ["games", t("filter_games")], ["tours", t("filter_tours")]].map(([key, label]) => (
              <button key={key} onClick={() => setMode(key)} style={{
                flex: 1, border: "none", borderRadius: 9, padding: "8px 0", cursor: "pointer",
                fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 700,
                background: mode === key ? "var(--lime)" : "transparent",
                color: mode === key ? "var(--lime-fg)" : "var(--mut)",
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Tile icon={<Swords size={18} />} label={t("an_matches")} value={md.total_matches} />
            <Tile icon={<Users size={18} />} label={t("an_players")} value={data.total_players} />
            <Tile icon={<Flame size={18} />} label={t("an_active30")} value={md.active_30d} />
          </div>

          <div className="an-card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 6 }}>{t("an_per_week")}</div>
            <Bars data={md.matches_per_week} />
          </div>

          <div className="an-display" style={{ fontSize: 14, color: "var(--mut)", marginBottom: 2 }}>{t("an_most_active")}</div>
          <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 8 }}>{t("an_most_active_hint")}</div>
          {(md.top_active || []).length === 0 && <div className="an-card" style={{ color: "var(--mut)", textAlign: "center" }}>{t("an_no_data")}</div>}
          {(md.top_active || []).map((p, i) => {
            const full = p.id ? (players.find((x) => x.id === p.id) || { id: p.id, name: p.name }) : null;
            const tap = full && onOpenPlayer ? () => onOpenPlayer(full) : undefined;
            return (
              <div key={i} className="an-card" onClick={tap}
                style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 12, cursor: tap ? "pointer" : "default" }}>
                <span className="an-display" style={{ width: 24, color: "var(--mut)" }}>{i + 1}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 12, color: "var(--mut)" }}>{nGames(p.matches)}</span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
