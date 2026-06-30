// components/Analytics.jsx
// Базовая аналитика лиги: всего матчей/игроков, активные за 30 дней,
// динамика по неделям и самые активные игроки. Рендерится внутри вкладки
// «Друзья» (наследует тему приложения).
import React, { useEffect, useState } from "react";
import { getGroupAnalytics } from "../lib/statsApi";
import { Swords, Users, Flame, ArrowLeft } from "lucide-react";
import { t, nGames } from "../lib/i18n";

function Bars({ data }) {
  const w = 320, h = 140, pad = 16;
  if (!data || data.length === 0)
    return <div style={{ color: "var(--mut)", fontSize: 13, textAlign: "center", padding: "26px 0" }}>{t("an_no_period")}</div>;
  const max = Math.max(...data.map((d) => d.count), 1);
  const bw = (w - 2 * pad) / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
      {data.map((d, i) => {
        const bh = ((h - 30 - pad) * d.count) / max;
        const x = pad + i * bw;
        return (
          <g key={i}>
            <rect x={x + bw * 0.18} y={h - 22 - bh} width={bw * 0.64} height={bh} rx="3" fill="var(--lime)" />
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
    <div className="an-display" style={{ fontSize: 26 }}>{value}</div>
    <div style={{ fontSize: 11, color: "var(--mut)" }}>{label}</div>
  </div>
);

export default function Analytics({ groupId, onBack }) {
  const [data, setData] = useState(undefined);

  useEffect(() => {
    let active = true;
    getGroupAnalytics(groupId)
      .then((d) => active && setData(d))
      .catch(() => active && setData(null));
    return () => { active = false; };
  }, [groupId]);

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

      {data && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Tile icon={<Swords size={18} />} label={t("an_matches")} value={data.total_matches} />
            <Tile icon={<Users size={18} />} label={t("an_players")} value={data.total_players} />
            <Tile icon={<Flame size={18} />} label={t("an_active30")} value={data.active_30d} />
          </div>

          <div className="an-card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 6 }}>{t("an_per_week")}</div>
            <Bars data={data.matches_per_week} />
          </div>

          <div className="an-display" style={{ fontSize: 14, color: "var(--mut)", marginBottom: 8 }}>{t("an_most_active")}</div>
          {(data.top_active || []).length === 0 && <div className="an-card" style={{ color: "var(--mut)", textAlign: "center" }}>{t("an_no_data")}</div>}
          {(data.top_active || []).map((p, i) => (
            <div key={i} className="an-card" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 12 }}>
              <span className="an-display" style={{ width: 24, color: "var(--mut)" }}>{i + 1}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
              <span style={{ fontSize: 12, color: "var(--mut)" }}>{nGames(p.matches)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
