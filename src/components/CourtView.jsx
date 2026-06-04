// components/CourtView.jsx
// Корт с подложкой-картинкой (public/padel-court.png). Игроки команды A слева,
// команды B справа (сетка на картинке вертикальная). Крупный счёт по центру:
// нажатие на блок команды открывает всплывающий выбор счёта (любой команды).
import React, { useState } from "react";

const COURT_IMG = "/padel-court.png"; // положить картинку в public/

function Chip({ name, x, y, team }) {
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", maxWidth: "34%", textAlign: "center" }}>
      <div style={{
        background: "rgba(10,22,18,.82)", border: `1px solid ${team === "A" ? "#c8ff2d" : "#5fd0ff"}`,
        borderRadius: 10, padding: "5px 9px", fontSize: 12, fontWeight: 600, color: "#eef3ee",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{name || "—"}</div>
    </div>
  );
}

export default function CourtView({ courtNumber = 1, teamA = [], teamB = [], scoreA = null, scoreB = null, points = 32, editable = false, onSave, bgUrl = COURT_IMG }) {
  const [pickFor, setPickFor] = useState(null); // 'A' | 'B' | null
  const [busy, setBusy] = useState(false);
  const scored = scoreA != null && scoreB != null;
  const aWin = scored && scoreA > scoreB;
  const bWin = scored && scoreB > scoreA;

  const choose = async (team, n) => {
    const a = team === "A" ? n : points - n;
    const b = team === "A" ? points - n : n;
    setBusy(true);
    try { await onSave(a, b); setPickFor(null); } finally { setBusy(false); }
  };

  const box = (val, win, team) => (
    <div onClick={() => editable && setPickFor(team)} style={{
      fontFamily: "'Anton',sans-serif", fontSize: 30, minWidth: 54, textAlign: "center", padding: "8px 12px",
      borderRadius: 12, lineHeight: 1, cursor: editable ? "pointer" : "default",
      background: win ? "#c8ff2d" : "rgba(10,22,18,.82)", color: win ? "#0a1612" : "#eef3ee",
      border: `2px solid ${win ? "#c8ff2d" : "rgba(255,255,255,.4)"}`,
      boxShadow: win ? "0 0 16px rgba(200,255,45,.5)" : "none",
    }}>{val == null ? "–" : val}</div>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ position: "relative", width: "100%", borderRadius: 14, overflow: "hidden" }}>
        <img src={bgUrl} alt="корт" style={{ width: "100%", display: "block" }} />

        <div style={{ position: "absolute", top: 8, left: 10, fontFamily: "'Anton',sans-serif", textTransform: "uppercase", fontSize: 13, letterSpacing: 1, color: "#fff", background: "rgba(10,22,18,.55)", padding: "2px 8px", borderRadius: 8 }}>Корт {courtNumber}</div>

        <Chip name={teamA[0]} x={20} y={28} team="A" />
        <Chip name={teamA[1]} x={20} y={72} team="A" />
        <Chip name={teamB[0]} x={80} y={28} team="B" />
        <Chip name={teamB[1]} x={80} y={72} team="B" />

        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", gap: 8 }}>
          {box(scoreA, aWin, "A")}
          <span style={{ color: "#fff", fontFamily: "'Anton',sans-serif", fontSize: 22 }}>:</span>
          {box(scoreB, bWin, "B")}
        </div>

        {editable && !scored && !pickFor && (
          <div style={{ position: "absolute", left: "50%", bottom: "5%", transform: "translateX(-50%)", fontSize: 11, color: "#fff", background: "rgba(10,22,18,.55)", padding: "2px 8px", borderRadius: 8 }}>
            нажми на счёт, чтобы ввести
          </div>
        )}

        {/* всплывающий выбор счёта поверх корта */}
        {pickFor && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(5,12,9,.88)", display: "flex", flexDirection: "column", padding: 12, animation: "cvpop .18s ease-out both" }}>
            <style>{`@keyframes cvpop{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}`}</style>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontFamily: "'Outfit',sans-serif", color: "#eef3ee", fontSize: 13 }}>
                Очки команды <b style={{ color: pickFor === "A" ? "#c8ff2d" : "#5fd0ff" }}>{pickFor}</b> (до {points})
              </span>
              <button onClick={() => setPickFor(null)} style={{ background: "none", border: "none", color: "#7d9488", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, alignContent: "start" }}>
              {Array.from({ length: points + 1 }, (_, n) => {
                const cur = (pickFor === "A" ? scoreA : scoreB) === n;
                return (
                  <button key={n} disabled={busy} onClick={() => choose(pickFor, n)} style={{
                    padding: "10px 0", borderRadius: 10, cursor: "pointer", fontFamily: "'Anton',sans-serif", fontSize: 16,
                    background: cur ? "#c8ff2d" : "#16291f", color: cur ? "#0a1612" : "#eef3ee", border: "1px solid #22382c",
                  }}>{n}</button>
                );
              })}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#7d9488", textAlign: "center" }}>счёт второй команды посчитается сам</div>
          </div>
        )}
      </div>
    </div>
  );
}
