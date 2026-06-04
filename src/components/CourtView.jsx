// components/CourtView.jsx
// Визуальный корт: подложка, имена игроков по углам, крупный счёт с подсветкой
// победителя и быстрый выбор счёта (лента 0..points). Используется в турнирах
// и обычных играх. props:
//   courtNumber, teamA:[n,n], teamB:[n,n], scoreA, scoreB, points, editable, onSave
import React, { useState } from "react";
import { Edit3 } from "lucide-react";

function Chip({ name, x, y, team }) {
  return (
    <div style={{
      position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)",
      maxWidth: "42%", textAlign: "center",
    }}>
      <div style={{
        background: "rgba(10,22,18,.82)", border: `1px solid ${team === "A" ? "#c8ff2d" : "#5fd0ff"}`,
        borderRadius: 10, padding: "5px 9px", fontSize: 12, fontWeight: 600, color: "#eef3ee",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{name || "—"}</div>
    </div>
  );
}

function CourtSvg() {
  // Вид сверху: корт падел со стеклом, сеткой и линиями подачи.
  return (
    <svg viewBox="0 0 300 200" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="cv-turf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#15485f" /><stop offset="100%" stopColor="#0f3a4d" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="288" height="188" rx="12" fill="url(#cv-turf)" stroke="#2a6076" strokeWidth="3" />
      {/* сетка по центру */}
      <line x1="6" y1="100" x2="294" y2="100" stroke="#eef3ee" strokeWidth="2.5" strokeDasharray="5 4" opacity="0.85" />
      {/* линии подачи */}
      <line x1="6" y1="52" x2="294" y2="52" stroke="#bfe6ef" strokeWidth="1.5" opacity="0.6" />
      <line x1="6" y1="148" x2="294" y2="148" stroke="#bfe6ef" strokeWidth="1.5" opacity="0.6" />
      {/* центральная линия подачи */}
      <line x1="150" y1="52" x2="150" y2="148" stroke="#bfe6ef" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

function ScoreBlock({ scoreA, scoreB, points }) {
  const half = points / 2;
  const aWin = scoreA > scoreB, bWin = scoreB > scoreA;
  const cell = (val, win) => ({
    fontFamily: "'Anton',sans-serif", fontSize: 30, minWidth: 52, textAlign: "center",
    padding: "6px 10px", borderRadius: 12, lineHeight: 1,
    background: win ? "#c8ff2d" : "rgba(10,22,18,.85)",
    color: win ? "#0a1612" : "#eef3ee",
    border: `2px solid ${win ? "#c8ff2d" : "#2a6076"}`,
    boxShadow: win ? "0 0 16px rgba(200,255,45,.5)" : "none",
  });
  return (
    <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", gap: 8 }}>
      <div style={cell(scoreA, aWin)}>{scoreA}</div>
      <span style={{ color: "#eef3ee", fontFamily: "'Anton',sans-serif", fontSize: 22 }}>:</span>
      <div style={cell(scoreB, bWin)}>{scoreB}</div>
    </div>
  );
}

export default function CourtView({ courtNumber = 1, teamA = [], teamB = [], scoreA = null, scoreB = null, points = 32, editable = false, onSave }) {
  const scored = scoreA != null && scoreB != null;
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState(scored ? scoreA : null);
  const [busy, setBusy] = useState(false);

  const showPicker = editable && (!scored || editing);

  const save = async () => {
    if (a == null) return;
    setBusy(true);
    try { await onSave(a, points - a); setEditing(false); } finally { setBusy(false); }
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "3 / 2", borderRadius: 14, overflow: "hidden" }}>
        <CourtSvg />
        <div style={{
          position: "absolute", top: 6, left: 10, fontFamily: "'Anton',sans-serif", textTransform: "uppercase",
          fontSize: 13, letterSpacing: 1, color: "#c8ff2d", background: "rgba(10,22,18,.6)", padding: "2px 8px", borderRadius: 8,
        }}>Корт {courtNumber}</div>

        <Chip name={teamB[0]} x={28} y={20} team="B" />
        <Chip name={teamB[1]} x={72} y={20} team="B" />
        <Chip name={teamA[0]} x={28} y={80} team="A" />
        <Chip name={teamA[1]} x={72} y={80} team="A" />

        {scored && !editing && <ScoreBlock scoreA={scoreA} scoreB={scoreB} points={points} />}
      </div>

      {/* быстрый выбор счёта */}
      {showPicker && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "#7d9488", marginBottom: 6 }}>
            Счёт команды A {a != null && <b style={{ color: "#eef3ee" }}>{a} : {points - a}</b>}
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "2px 0 8px" }}>
            {Array.from({ length: points + 1 }, (_, n) => (
              <button key={n} onClick={() => setA(n)} style={{
                flex: "0 0 auto", width: 42, height: 42, borderRadius: 11, cursor: "pointer",
                fontFamily: "'Anton',sans-serif", fontSize: 17,
                background: a === n ? "#c8ff2d" : "#16291f", color: a === n ? "#0a1612" : "#eef3ee",
                border: `1px solid ${a === n ? "#c8ff2d" : "#22382c"}`,
              }}>{n}</button>
            ))}
          </div>
          <button onClick={save} disabled={a == null || busy} style={{
            width: "100%", padding: 11, borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700,
            background: "#c8ff2d", color: "#0a1612", filter: a == null || busy ? "grayscale(.6) brightness(.7)" : "none",
            fontFamily: "'Outfit',sans-serif",
          }}>{busy ? "Сохраняю…" : "Сохранить счёт"}</button>
        </div>
      )}

      {/* кнопка редактирования уже сыгранного матча */}
      {editable && scored && !editing && (
        <button onClick={() => { setA(scoreA); setEditing(true); }} style={{
          width: "100%", marginTop: 6, padding: 8, borderRadius: 10, cursor: "pointer",
          background: "#16291f", color: "#7d9488", border: "1px solid #22382c", fontFamily: "'Outfit',sans-serif", fontSize: 13,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}><Edit3 size={14} /> Изменить счёт</button>
      )}
    </div>
  );
}
