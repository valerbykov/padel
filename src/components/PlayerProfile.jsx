// components/PlayerProfile.jsx
// Экран профиля игрока: рейтинг, место, винрейт, график и последние матчи.
import React, { useEffect, useState } from "react";
import { getPlayerStats, getPlayerRecentMatches, getRatingHistory } from "../lib/statsApi";
import { ArrowLeft, Trophy, Percent, Swords } from "lucide-react";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.pp-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;padding:18px 16px 40px;
 background-image:radial-gradient(circle at 80% -10%,rgba(200,255,45,.10),transparent 45%);}
.pp-display{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.pp-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px;}
.pp-tile{flex:1;text-align:center;}
.pp-back{background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);
 padding:7px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:'Outfit';margin-bottom:14px;}
`;

function LineChart({ values }) {
  const w = 320, h = 130, pad = 12;
  if (!values || values.length < 2)
    return <div style={{ color: "#7d9488", fontSize: 13, textAlign: "center", padding: "26px 0" }}>Мало данных для графика — сыграй ещё.</div>;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const x = (i) => pad + (i * (w - 2 * pad)) / (values.length - 1);
  const y = (v) => h - pad - ((v - min) / span) * (h - 2 * pad);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
      <defs><linearGradient id="ppg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#c8ff2d" stopOpacity="0.32" /><stop offset="100%" stopColor="#c8ff2d" stopOpacity="0" />
      </linearGradient></defs>
      <polygon points={`${pad},${h - pad} ${pts} ${w - pad},${h - pad}`} fill="url(#ppg)" />
      <polyline points={pts} fill="none" stroke="#c8ff2d" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill="#0a1612" stroke="#c8ff2d" strokeWidth="2" />)}
    </svg>
  );
}

const Tile = ({ icon, label, value, color }) => (
  <div className="pp-card pp-tile">
    <div style={{ display: "flex", justifyContent: "center", color: color || "var(--mut)", marginBottom: 4 }}>{icon}</div>
    <div className="pp-display" style={{ fontSize: 22, color: color || "var(--ink)" }}>{value}</div>
    <div style={{ fontSize: 11, color: "var(--mut)" }}>{label}</div>
  </div>
);

export default function PlayerProfile({ groupId, profileId, onBack }) {
  const [stats, setStats] = useState(undefined);
  const [history, setHistory] = useState([]);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [s, h, m] = await Promise.all([
          getPlayerStats(groupId, profileId),
          getRatingHistory(groupId, profileId),
          getPlayerRecentMatches(groupId, profileId, 10),
        ]);
        if (!active) return;
        setStats(s); setHistory(h); setMatches(m);
      } catch (e) { if (active) setStats(null); }
    })();
    return () => { active = false; };
  }, [groupId, profileId]);

  const initials = (stats?.name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="pp-root">
      <style>{css}</style>
      {onBack && <button className="pp-back" onClick={onBack}><ArrowLeft size={16} /> Назад</button>}

      {stats === undefined && <p style={{ color: "var(--mut)" }}>Загрузка…</p>}
      {stats === null && <p style={{ color: "var(--coral)" }}>Не удалось загрузить профиль.</p>}

      {stats && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div className="pp-display" style={{ width: 60, height: 60, borderRadius: 16, background: "var(--lime)", color: "#0a1612",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{initials}</div>
            <div>
              <div className="pp-display" style={{ fontSize: 26 }}>{stats.name}</div>
              <div style={{ fontSize: 13, color: "var(--mut)" }}>#{stats.rank} из {stats.total_players} в рейтинге</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Tile icon={<Trophy size={18} />} label="Рейтинг" value={stats.rating} color="var(--lime)" />
            <Tile icon={<Percent size={18} />} label="Винрейт" value={`${stats.win_rate}%`} />
            <Tile icon={<Swords size={18} />} label="Игр" value={stats.matches} />
          </div>

          <div className="pp-card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 6 }}>Динамика рейтинга</div>
            <LineChart values={history} />
          </div>

          <div className="pp-display" style={{ fontSize: 14, color: "var(--mut)", marginBottom: 8 }}>Последние матчи</div>
          {matches.length === 0 && <div className="pp-card" style={{ color: "var(--mut)", textAlign: "center" }}>Матчей пока нет.</div>}
          {matches.map((m) => {
            const my = m.on_team_a ? m.team_a : m.team_b;
            const opp = m.on_team_a ? m.team_b : m.team_a;
            const myScore = m.on_team_a ? m.sets_a : m.sets_b;
            const oppScore = m.on_team_a ? m.sets_b : m.sets_a;
            return (
              <div key={m.id} className="pp-card" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
                <span className="pp-display" style={{ fontSize: 12, width: 38, color: m.won ? "var(--lime)" : "var(--coral)" }}>{m.won ? "WIN" : "LOSS"}</span>
                <div style={{ flex: 1, fontSize: 13 }}>
                  <span style={{ color: "var(--mut)" }}>с</span> {(my || []).join(" / ")}<br />
                  <span style={{ color: "var(--mut)" }}>против</span> {(opp || []).join(" / ")}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="pp-display" style={{ fontSize: 18 }}>{myScore}:{oppScore}</div>
                  <div style={{ fontSize: 12, color: m.delta >= 0 ? "var(--lime)" : "var(--coral)" }}>{m.delta >= 0 ? "+" : ""}{m.delta}</div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
