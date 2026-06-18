// components/CourtView.jsx
// Корт с подложкой. Режимы:
//   mode="sum"  — Американо: счёт одной команды, второй = разница, сохраняется сразу.
//   mode="free" — обычная игра: счёт каждой команды отдельно, затем «Записать».
//   mode="sets" — обычная игра с детальным счётом: 3 сета (A:B каждый), без скролла.
// Props: teamAvatarsA/B=[] — массивы URL аватарок; scoreDetail=[{a,b},...] — для отображения.
import React, { useState, useEffect } from "react";

const COURT_IMG = "/padel-court.png";

function Chip({ name, avatarUrl, x, y, team }) {
  const color = team === "A" ? "#c8ff2d" : "#5fd0ff";
  return (
    <div style={{
      position: "absolute", left: `${x}%`, top: `${y}%`,
      transform: "translate(-50%,-50%)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      maxWidth: "27%",
    }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" style={{
          width: "clamp(22px,7vw,32px)", height: "clamp(22px,7vw,32px)",
          borderRadius: "50%", objectFit: "cover",
          border: `2px solid ${color}`, background: "#0a1612", flexShrink: 0,
        }} />
      ) : (
        <div style={{
          width: "clamp(22px,7vw,32px)", height: "clamp(22px,7vw,32px)",
          borderRadius: "50%",
          background: "rgba(10,22,18,.82)", border: `2px solid ${color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "clamp(9px,2.8vw,12px)", fontWeight: 700, color: "#eef3ee", flexShrink: 0,
        }}>
          {(name || "?").trim().charAt(0).toUpperCase()}
        </div>
      )}
      <div style={{
        background: "rgba(10,22,18,.82)", border: `1px solid ${color}`,
        borderRadius: 6, padding: "1px 5px",
        fontSize: "clamp(8px,2.2vw,10px)", fontWeight: 600, color: "#eef3ee",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        maxWidth: "100%",
      }}>{name || "—"}</div>
    </div>
  );
}

function SetChip({ val, team, onClick, editable }) {
  const color = team === "A" ? "#c8ff2d" : "#5fd0ff";
  return (
    <div onClick={editable ? onClick : undefined} style={{
      minWidth: "clamp(32px,10vw,42px)", padding: "clamp(6px,2.5vw,9px) clamp(8px,3.5vw,12px)",
      textAlign: "center", fontFamily: "'Outfit',sans-serif", fontWeight: 800,
      fontSize: "clamp(16px,6vw,22px)", lineHeight: 1,
      background: val != null ? "rgba(10,22,18,.9)" : "#16291f",
      border: `1.5px solid ${val != null ? color : "#22382c"}`,
      borderRadius: 10, color: val != null ? "#eef3ee" : "#7d9488",
      cursor: editable ? "pointer" : "default",
      userSelect: "none",
    }}>
      {val ?? "–"}
    </div>
  );
}

export default function CourtView({
  courtNumber = 1,
  courtName,
  onRenameCourt,
  teamA = [], teamB = [],
  teamAvatarsA = [], teamAvatarsB = [],
  scoreA = null, scoreB = null,
  scoreDetail = null,
  points = 32, editable = false, onSave,
  mode = "sum", maxScore, bgUrl = COURT_IMG,
}) {
  const max = maxScore != null ? maxScore : (mode === "sum" ? points : mode === "sets" ? 7 : 3);

  // sum / free state
  const [pickFor, setPickFor] = useState(null);
  const [range, setRange] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dA, setDA] = useState(scoreA);
  const [dB, setDB] = useState(scoreB);
  useEffect(() => { setDA(scoreA); setDB(scoreB); }, [scoreA, scoreB]);

  // sets state
  const initSets = (detail) =>
    (detail?.length > 0)
      ? detail.map((s) => ({ a: s.a ?? null, b: s.b ?? null }))
      : [{ a: null, b: null }];  // по умолчанию 1 сет
  const [setsDetail, setSetsDetail] = useState(() => initSets(scoreDetail));
  const [pickSets, setPickSets] = useState(null); // {setIdx, team}
  useEffect(() => { setSetsDetail(initSets(scoreDetail)); }, [JSON.stringify(scoreDetail)]); // eslint-disable-line

  const setsWonA = setsDetail.filter((s) => s.a != null && s.b != null && s.a > s.b).length;
  const setsWonB = setsDetail.filter((s) => s.a != null && s.b != null && s.b > s.a).length;
  const allSetsEntered = setsDetail.every((s) => s.a != null && s.b != null);
  const setsValid = allSetsEntered;  // ничья допустима

  // Ranges (ровно по 10: 0-9, 10-19, ...)
  const ranges = [];
  for (let s = 0; s <= max;) { const e = Math.min(s + 9, max); ranges.push([s, e]); s = e + 1; }
  const useRanges = max > 11;

  const dispA = mode === "sets" ? setsWonA : dA;
  const dispB = mode === "sets" ? setsWonB : dB;
  const aWin = dispA != null && dispB != null && dispA > dispB;
  const bWin = dispA != null && dispB != null && dispB > dispA;
  const savedAlready = scoreA != null && scoreB != null;

  const openPick = (team) => { setRange(null); setPickFor(team); };
  const closePick = () => { setPickFor(null); setRange(null); };
  const closePickSets = () => setPickSets(null);

  const pickSumFree = async (team, n) => {
    if (mode === "sum") {
      const a = team === "A" ? n : points - n;
      const b = points - a;
      setDA(a); setDB(b); closePick();
      setBusy(true); try { await onSave(a, b); } finally { setBusy(false); }
    } else {
      if (team === "A") setDA(n); else setDB(n);
      closePick();
    }
  };

  const pickSetScore = (n) => {
    const { setIdx, team } = pickSets;
    setSetsDetail((prev) => prev.map((s, i) => i === setIdx ? { ...s, [team.toLowerCase()]: n } : s));
    setPickSets(null);
  };

  const addSet = () => { if (setsDetail.length < 5) setSetsDetail(prev => [...prev, { a: null, b: null }]); };
  const removeLastSet = () => { if (setsDetail.length > 1) setSetsDetail(prev => prev.slice(0, -1)); };

  const saveSets = async () => {
    if (!setsValid || busy) return;
    setBusy(true);
    try { await onSave(setsWonA, setsWonB, setsDetail); }
    finally { setBusy(false); }
  };

  const saveFree = async () => {
    if (dA == null || dB == null || dA === dB || busy) return;
    setBusy(true); try { await onSave(dA, dB); } finally { setBusy(false); }
  };

  // Picker state (общий для sum/free и sets)
  const pickerOpen = pickFor || pickSets;
  const pickerMax = pickSets ? 7 : max;
  const pickerColor = ((pickFor || pickSets?.team) === "A") ? "#c8ff2d" : "#5fd0ff";
  const pickerCurVal = pickSets
    ? setsDetail[pickSets.setIdx]?.[pickSets.team.toLowerCase()]
    : (pickFor === "A" ? dA : dB);
  const closePicker = () => { closePick(); closePickSets(); };

  const getPickerTitle = () => {
    if (pickSets) return <>Сет {pickSets.setIdx + 1} · команда <b style={{ color: pickerColor }}>{pickSets.team}</b> (0–7)</>;
    if (useRanges && !range) return <>Счёт команды <b style={{ color: pickerColor }}>{pickFor}</b> — диапазон</>;
    return <>Счёт команды <b style={{ color: pickerColor }}>{pickFor}</b> (0–{max})</>;
  };

  const box = (val, win, team) => (
    <div
      onClick={() => editable && mode !== "sets" && openPick(team)}
      style={{
        fontFamily: "'Outfit',sans-serif", fontWeight: 800,
        fontSize: "clamp(18px,7.5vw,30px)", minWidth: "clamp(38px,12vw,54px)",
        textAlign: "center", padding: "clamp(5px,2vw,8px) clamp(7px,3vw,12px)",
        borderRadius: 10, lineHeight: 1, cursor: editable && mode !== "sets" ? "pointer" : "default",
        background: win ? "#c8ff2d" : "rgba(10,22,18,.82)", color: win ? "#0a1612" : "#eef3ee",
        border: `2px solid ${win ? "#c8ff2d" : "rgba(255,255,255,.4)"}`,
        boxShadow: win ? "0 0 16px rgba(200,255,45,.5)" : "none",
      }}
    >{val == null ? "–" : val}</div>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Корт */}
      <div style={{ position: "relative", width: "100%", borderRadius: 14, overflow: "hidden" }}>
        <img src={bgUrl} alt="корт" style={{ width: "100%", display: "block" }} />
        {editable && mode !== "sets" && !savedAlready && !pickFor && (
          <>
            <div onClick={() => openPick("A")} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", cursor: "pointer" }} aria-label="ввести счёт команды A" />
            <div onClick={() => openPick("B")} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", cursor: "pointer" }} aria-label="ввести счёт команды B" />
          </>
        )}

        {(courtNumber != null || courtName) && (
          <div
            onClick={onRenameCourt && courtNumber != null ? () => { const v = window.prompt("Название корта", courtName || ("Корт " + courtNumber)); if (v !== null) onRenameCourt(v.trim()); } : undefined}
            style={{ position: "absolute", top: 8, left: 10, fontFamily: "'Outfit',sans-serif", fontWeight: 800, textTransform: "uppercase", fontSize: 13, letterSpacing: 1, color: "#fff", background: "rgba(10,22,18,.55)", padding: "2px 8px", borderRadius: 8, cursor: onRenameCourt && courtNumber != null ? "pointer" : "default" }}
          >
            {courtName || ("Корт " + courtNumber)}{onRenameCourt && courtNumber != null ? " ✎" : ""}
          </div>
        )}

        <Chip name={teamA[0]} avatarUrl={teamAvatarsA[0]} x={20} y={28} team="A" />
        <Chip name={teamA[1]} avatarUrl={teamAvatarsA[1]} x={20} y={72} team="A" />
        <Chip name={teamB[0]} avatarUrl={teamAvatarsB[0]} x={80} y={28} team="B" />
        <Chip name={teamB[1]} avatarUrl={teamAvatarsB[1]} x={80} y={72} team="B" />

        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", display: "flex", alignItems: "center", gap: 8 }}>
          {box(mode === "sets" ? setsWonA : dA, aWin, "A")}
          <span style={{ color: "#fff", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22 }}>:</span>
          {box(mode === "sets" ? setsWonB : dB, bWin, "B")}
        </div>

        {editable && mode !== "sets" && !savedAlready && !pickFor && (
          <div style={{ position: "absolute", left: "50%", bottom: "5%", transform: "translateX(-50%)", fontSize: 11, color: "#fff", background: "rgba(10,22,18,.55)", padding: "2px 8px", borderRadius: 8 }}>
            нажми на свою половину поля, чтобы ввести счёт
          </div>
        )}

        {/* Оверлей выбора числа */}
        {pickerOpen && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(5,12,9,.93)", display: "flex", flexDirection: "column", padding: 12, animation: "cvpop .18s ease-out both" }}>
            <style>{`@keyframes cvpop{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}`}</style>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: "'Outfit',sans-serif", color: "#eef3ee", fontSize: 13 }}>
                {!pickSets && useRanges && range && (
                  <button onClick={() => setRange(null)} style={{ background: "none", border: "none", color: "#c8ff2d", cursor: "pointer", marginRight: 8 }}>←</button>
                )}
                {getPickerTitle()}
              </span>
              <button onClick={closePicker} style={{ background: "none", border: "none", color: "#7d9488", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              {!pickSets && useRanges && !range ? (
                <div style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {ranges.map(([s, e]) => (
                    <button key={s} onClick={() => setRange([s, e])} style={{
                      padding: "16px 0", borderRadius: 12, cursor: "pointer",
                      fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 20,
                      background: "#16291f", color: "#eef3ee", border: "1px solid #22382c",
                    }}>{s}–{e}</button>
                  ))}
                </div>
              ) : (
                <div style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                  {(() => {
                    const lo = !pickSets && useRanges && range ? range[0] : 0;
                    const hi = !pickSets && useRanges && range ? range[1] : pickerMax;
                    const arr = [];
                    for (let n = lo; n <= hi; n++) arr.push(n);
                    return arr.map((n) => {
                      const cur = pickerCurVal === n;
                      return (
                        <button key={n} disabled={busy} onClick={() => pickSets ? pickSetScore(n) : pickSumFree(pickFor, n)} style={{
                          padding: "12px 0", borderRadius: 12, cursor: "pointer",
                          fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 20,
                          background: cur ? "#c8ff2d" : "#16291f",
                          color: cur ? "#0a1612" : "#eef3ee",
                          border: "1px solid #22382c",
                        }}>{n}</button>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
            {mode === "sum" && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#7d9488", textAlign: "center" }}>
                счёт второй команды посчитается сам
              </div>
            )}
          </div>
        )}
      </div>

      {/* Детальный счёт по сетам */}
      {mode === "sets" && (
        <div style={{ marginTop: 8, background: "#11211b", border: "1px solid #22382c", borderRadius: 12, padding: "8px 14px" }}>
          {setsDetail.map((s, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "7px 0",
              borderBottom: i < 2 ? "1px solid #1a2e22" : "none",
            }}>
              <span style={{ fontSize: 12, color: "#7d9488", width: 44, flexShrink: 0 }}>Сет {i + 1}</span>
              <SetChip val={s.a} team="A" editable={editable && !savedAlready} onClick={() => setPickSets({ setIdx: i, team: "A" })} />
              <span style={{ color: "#7d9488", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 14 }}>:</span>
              <SetChip val={s.b} team="B" editable={editable && !savedAlready} onClick={() => setPickSets({ setIdx: i, team: "B" })} />
            </div>
          ))}
          {editable && !savedAlready && !allSetsEntered && (
            <div style={{ fontSize: 11, color: "#7d9488", textAlign: "center", paddingTop: 6 }}>
              нажми на счёт сета, чтобы ввести
            </div>
          )}
          {editable && !savedAlready && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {setsDetail.length < 5 && (
                <button onClick={addSet} style={{
                  flex: 1, padding: "7px 0", borderRadius: 10, border: "1px dashed #22382c",
                  background: "transparent", color: "#7d9488", cursor: "pointer", fontSize: 13, fontFamily: "'Outfit',sans-serif",
                }}>+ сет</button>
              )}
              {setsDetail.length > 1 && (
                <button onClick={removeLastSet} style={{
                  padding: "7px 14px", borderRadius: 10, border: "1px solid #22382c",
                  background: "transparent", color: "#7d9488", cursor: "pointer", fontSize: 13,
                }}>−</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Кнопка записи — sets */}
      {editable && mode === "sets" && !savedAlready && (
        <button onClick={saveSets} disabled={!setsValid || busy} style={{
          width: "100%", marginTop: 8, padding: 11, borderRadius: 12, border: "none",
          cursor: setsValid ? "pointer" : "not-allowed", fontWeight: 700,
          fontFamily: "'Outfit',sans-serif", background: "#c8ff2d", color: "#0a1612",
          filter: (!setsValid || busy) ? "grayscale(.6) brightness(.7)" : "none",
        }}>
          {busy ? "Записываю…" : !allSetsEntered ? "Введи счёт всех сетов" : "Записать результат"}
        </button>
      )}

      {/* Кнопка записи — free */}
      {editable && mode === "free" && (
        <button onClick={saveFree} disabled={dA == null || dB == null || dA === dB || busy} style={{
          width: "100%", marginTop: 8, padding: 11, borderRadius: 12, border: "none",
          cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit',sans-serif",
          background: "#c8ff2d", color: "#0a1612",
          filter: (dA == null || dB == null || dA === dB || busy) ? "grayscale(.6) brightness(.7)" : "none",
        }}>
          {busy ? "Записываю…" : (dA != null && dB != null && dA === dB ? "Ничья недопустима" : "Записать результат")}
        </button>
      )}
    </div>
  );
}
