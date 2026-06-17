// components/Analytics.jsx
// Базовая аналитика группы: всего матчей/игроков, активные за 30 дней,
// динамика по неделям и самые активные игроки.
import React, { useEffect, useState } from "react";
import { getGroupAnalytics } from "../lib/statsApi";
import { Swords, Users, Flame } from "lucide-react";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.an-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;padding:18px 16px 40px;
 background-image:radial-gradient(circle at 0% -10%,rgba(200,255,45,.08),transparent 45%);}
.an-display{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.an-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px;}
.an-tile{flex:1;text-align:center;}
`;

function Bars({ data }) {
  const w = 320, h = 140, pad = 16;
  if (!data || data.length === 0)
    return <div style={{ color: "#7d9488", fontSize: 13, textAlign: "center", padding: "26px 0" }}>Нет матчей за период.</div>;
  const max = Math.max(...data.map((d) => d.count), 1);
  const bw = (w - 2 * pad) / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
      {data.map((d, i) => {
        const bh = ((h - 30 - pad) * d.count) / max;
        const x = pad + i * bw;
        return (
          <g key={i}>
            <rect x={x + bw * 0.18} y={h - 22 - bh} width={bw * 0.64} height={bh} rx="3" fill="#c8ff2d" />
            <text x={x + bw / 2} y={h - 8} fontSize="9" fill="#7d9488" textAnchor="middle" fontFamily="Outfit">{d.week}</text>
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

export default function Analytics({ groupId }) {
  const [data, setData] = useState(undefined);

  useEffect(() => {
    let active = true;
    getGroupAnalytics(groupId)
      .then((d) => active && setData(d))
      .catch(() => active && setData(null));
    return () => { active = false; };
  }, [groupId]);

  return (
    <div className="an-root">
      <style>{css}</style>
      <h1 className="an-display" style={{ fontSize: 28, marginBottom: 16 }}>Аналитика</h1>

      {data === undefined && <p style={{ color: "var(--mut)" }}>Загрузка…</p>}
      {data === null && <p style={{ color: "#ff6a52" }}>Не удалось загрузить аналитику.</p>}

      {data && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Tile icon={<Swords size={18} />} label="Матчей" value={data.total_matches} />
            <Tile icon={<Users size={18} />} label="Игроков" value={data.total_players} />
            <Tile icon={<Flame size={18} />} label="Активны (30д)" value={data.active_30d} />
          </div>

          <div className="an-card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 6 }}>Матчей по неделям</div>
            <Bars data={data.matches_per_week} />
          </div>

          <div className="an-display" style={{ fontSize: 14, color: "var(--mut)", marginBottom: 8 }}>Самые активные</div>
          {(data.top_active || []).length === 0 && <div className="an-card" style={{ color: "var(--mut)", textAlign: "center" }}>Пока нет данных.</div>}
          {(data.top_active || []).map((p, i) => (
            <div key={i} className="an-card" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 12 }}>
              <span className="an-display" style={{ width: 24, color: "var(--mut)" }}>{i + 1}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
              <span className="an-display" style={{ color: "var(--lime)" }}>{p.matches}</span>
              <span style={{ fontSize: 11, color: "var(--mut)" }}>игр</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
