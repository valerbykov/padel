// components/CourtView.jsx
// Корт с подложкой. Режимы:
//   mode="sum"  — Американо: счёт одной команды, второй = разница, сохраняется сразу.
//   mode="free" — обычная игра: счёт каждой команды отдельно, затем «Записать».
//   mode="sets" — обычная игра с детальным счётом: 3 сета (A:B каждый), без скролла.
// Props: teamAvatarsA/B=[] — массивы URL аватарок; scoreDetail=[{a,b},...] — для отображения.
import React, { useState, useEffect } from "react";
import { dogAvatar, avatarFallback } from "../lib/avatar";
import { t } from "../lib/i18n";

const COURT_IMG = "/padel-court.png";

function Chip({ name, avatarUrl, x, y, team, id, onTap, noTap }) {
  const color = team === "A" ? "var(--lime)" : "var(--coral)";
  const tappable = !noTap && id && onTap;
  return (
    <div onClick={tappable ? () => onTap(id) : undefined} style={{
      position: "absolute", left: `${x}%`, top: `${y}%`,
      transform: "translate(-50%,-50%)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
      maxWidth: "26%", cursor: tappable ? "pointer" : "default",
      pointerEvents: noTap ? "none" : "auto",
    }}>
      <img src={avatarUrl || dogAvatar(name)} onError={avatarFallback(name)} alt="" loading="lazy" decoding="async" style={{
        width: "clamp(44px,13vw,60px)", height: "clamp(44px,13vw,60px)",
        borderRadius: "50%", objectFit: "cover",
        border: `3px solid ${color}`, background: "var(--surface)", flexShrink: 0,
      }} />
      <div style={{
        background: "color-mix(in srgb, var(--surface) 88%, transparent)", border: `1px solid ${color}`,
        borderRadius: 7, padding: "2px 6px",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        fontSize: "clamp(11px,2.9vw,13px)", fontWeight: 600, color: "var(--ink)",
        lineHeight: 1.15, textAlign: "center", wordBreak: "normal", overflowWrap: "break-word", hyphens: "none",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        maxWidth: "100%",
      }}>{name || "—"}</div>
    </div>
  );
}

function SetChip({ val, team, onClick, editable }) {
  const color = team === "A" ? "var(--lime)" : "var(--coral)";
  return (
    <div onClick={editable ? onClick : undefined} style={{
      minWidth: "clamp(40px,12vw,52px)", padding: "clamp(7px,2.6vw,10px) clamp(10px,3.5vw,14px)",
      textAlign: "center", fontFamily: "'Outfit',sans-serif", fontWeight: 800,
      fontSize: "clamp(16px,6vw,22px)", lineHeight: 1,
      background: "var(--surface2)",
      border: `2px solid ${val != null ? color : "var(--line)"}`,
      borderRadius: 10, color: val != null ? "var(--ink)" : "var(--mut)",
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
  teamIdsA = [], teamIdsB = [], onOpenPlayer,
  scoreA = null, scoreB = null,
  scoreDetail = null,
  points = 32, editable = false, onSave,
  mode = "sum", maxScore, bgUrl = COURT_IMG,
}) {
  const max = maxScore != null ? maxScore : (mode === "sum" ? points : mode === "sets" ? 7 : 3);

  const courtLabel = `${t("court_label")} ${courtNumber}`;
  const [editingName, setEditingName] = useState(false);  // инлайн-переименование корта
  const [nameVal, setNameVal] = useState("");

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
  const [buf, setBuf] = useState(""); // буфер цифрового ввода счёта
  useEffect(() => { setSetsDetail(initSets(scoreDetail)); }, [JSON.stringify(scoreDetail)]); // eslint-disable-line
  useEffect(() => { setBuf(""); }, [pickFor, pickSets]); // сброс при смене цели ввода

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
  const scoringActive = editable && mode !== "sets" && !savedAlready && !pickFor;

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
  const removeSet = (i) => { if (setsDetail.length > 1) setSetsDetail((prev) => prev.filter((_, j) => j !== i)); };

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
  const pickerColor = ((pickFor || pickSets?.team) === "A") ? "var(--lime)" : "var(--coral)";
  const pickerCurVal = pickSets
    ? setsDetail[pickSets.setIdx]?.[pickSets.team.toLowerCase()]
    : (pickFor === "A" ? dA : dB);
  const closePicker = () => { closePick(); closePickSets(); };

  // Цифровая клавиатура: прямой ввод счёта вместо «диапазон → число» для больших максимумов.
  const useKeypad = useRanges && !pickSets;
  const kpConfirm = (n) => { if (n == null || n > pickerMax) return; pickSumFree(pickFor, n); };
  const kpDigit = (d) => {
    if (buf === "" && d === 0) { kpConfirm(0); return; }       // одиночный «0» — сразу
    const cand = buf + String(d);
    const num = Number(cand);
    if (num > pickerMax) return;                                // не даём ввести больше максимума
    setBuf(cand);
    if (cand.length >= 2 || num * 10 > pickerMax) kpConfirm(num); // авто-подтверждение, когда дальше цифру не добавить
  };
  const KP = { padding: "16px 0", borderRadius: 12, cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, background: "var(--surface2)", color: "var(--ink)", border: "1px solid var(--line)" };

  const getPickerTitle = () => {
    if (pickSets) return <>{t("court_set")} {pickSets.setIdx + 1} · {t("court_team")} <b style={{ color: pickerColor }}>{pickSets.team}</b> (0–7)</>;
    return <>{t("court_team")} <b style={{ color: pickerColor }}>{pickFor}</b> · {t("court_score")} (0–{max})</>;
  };

  const box = (val, win, team) => (
    <div
      onClick={() => editable && mode !== "sets" && openPick(team)}
      style={{
        fontFamily: "'Outfit',sans-serif", fontWeight: 800,
        fontSize: "clamp(18px,7.5vw,30px)", minWidth: "clamp(38px,12vw,54px)",
        textAlign: "center", padding: "clamp(5px,2vw,8px) clamp(7px,3vw,12px)",
        borderRadius: 10, lineHeight: 1, cursor: editable && mode !== "sets" ? "pointer" : "default",
        background: win ? "var(--lime)" : "color-mix(in srgb, var(--surface) 88%, transparent)", color: win ? "var(--lime-fg)" : "var(--ink)",
        border: `2px solid ${win ? "var(--lime)" : "var(--line)"}`,
        boxShadow: win ? "0 0 16px color-mix(in srgb, var(--lime) 50%, transparent)" : "none",
      }}
    >{val == null ? "–" : val}</div>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      <style>{`
        .cv-num{transition:transform .1s, background .12s, border-color .12s;}
        .cv-num:hover:not(:disabled){background:color-mix(in srgb,var(--lime) 14%,var(--surface2));border-color:color-mix(in srgb,var(--lime) 40%,transparent);}
        .cv-num:active:not(:disabled){transform:scale(.94);}
        .cv-save{transition:transform .12s, filter .15s, box-shadow .15s;}
        .cv-save:hover:not(:disabled){filter:brightness(1.05);box-shadow:0 6px 18px -8px rgba(200,255,45,.6);}
        .cv-save:active:not(:disabled){transform:scale(.98);}
        .cv-setbtn{transition:filter .12s, transform .1s;}
        .cv-setbtn:hover{filter:brightness(1.1);}
        .cv-setbtn:active{transform:scale(.96);}
        .cv-court{--court:#1f4f86;--court-line:rgba(255,255,255,.85);--court-net:#15365e;display:block;width:100%;}
        body.pl-light .cv-court{--court:#cfe6f7;--court-line:rgba(20,45,80,.5);--court-net:#a7c6e2;}
        .cv-cta-arrow{display:inline-block;animation:cvArrow 1s ease-in-out infinite;}
        @keyframes cvArrow{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}
      `}</style>
      {/* Корт */}
      <div style={{ position: "relative", width: "100%", overflow: "visible", minHeight: (pickFor && useKeypad) ? 408 : undefined }}>
        <div style={{ padding: "0 12%" }}>
        <div style={{ borderRadius: 14, overflow: "hidden" }}>
        <svg className="cv-court" viewBox="0 0 320 180" preserveAspectRatio="none" aria-label={t("court_label")} style={{ aspectRatio: "16 / 9", height: "auto" }}>
          <rect x="0" y="0" width="320" height="180" style={{ fill: "var(--court)" }} />
          <g style={{ fill: "none", stroke: "var(--court-line)" }} strokeWidth="2.4">
            <rect x="7" y="7" width="306" height="166" />
            <line x1="52" y1="7" x2="52" y2="173" />
            <line x1="268" y1="7" x2="268" y2="173" />
            <line x1="52" y1="90" x2="268" y2="90" />
          </g>
          <rect x="155" y="7" width="10" height="166" style={{ fill: "var(--court-net)" }} />
          <line x1="160" y1="7" x2="160" y2="173" style={{ stroke: "var(--court-line)" }} strokeWidth="1.4" />
        </svg>
        </div>
        </div>
        {editable && mode !== "sets" && !savedAlready && !pickFor && (
          <>
            <div onClick={() => openPick("A")} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", cursor: "pointer" }} aria-label={`${t("court_score")} A`} />
            <div onClick={() => openPick("B")} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", cursor: "pointer" }} aria-label={`${t("court_score")} B`} />
          </>
        )}

        {(courtNumber != null || courtName) && (
          editingName ? (
            <input
              autoFocus
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { onRenameCourt(nameVal.trim()); setEditingName(false); } else if (e.key === "Escape") setEditingName(false); }}
              onBlur={() => { onRenameCourt(nameVal.trim()); setEditingName(false); }}
              placeholder={courtLabel}
              style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", maxWidth: "76%", boxSizing: "border-box", textAlign: "center", fontFamily: "'Outfit',sans-serif", fontWeight: 800, textTransform: "uppercase", fontSize: 13, letterSpacing: 1, color: "var(--ink)", background: "var(--surface)", border: "1px solid var(--lime)", borderRadius: 8, padding: "2px 10px", outline: "none", zIndex: 3 }}
            />
          ) : (
            <div
              onClick={onRenameCourt && courtNumber != null ? () => { setNameVal(courtName || ""); setEditingName(true); } : undefined}
              style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Outfit',sans-serif", fontWeight: 800, textTransform: "uppercase", fontSize: 13, letterSpacing: 1, color: "var(--ink)", background: "color-mix(in srgb, var(--surface) 80%, transparent)", padding: "2px 10px", borderRadius: 8, cursor: onRenameCourt && courtNumber != null ? "pointer" : "default", zIndex: 2 }}
            >
              {courtName || courtLabel}{onRenameCourt && courtNumber != null ? " ✎" : ""}
            </div>
          )
        )}

        <Chip name={teamA[0]} avatarUrl={teamAvatarsA[0]} id={teamIdsA[0]} onTap={onOpenPlayer} noTap={scoringActive} x={10} y={21} team="A" />
        <Chip name={teamA[1]} avatarUrl={teamAvatarsA[1]} id={teamIdsA[1]} onTap={onOpenPlayer} noTap={scoringActive} x={10} y={79} team="A" />
        <Chip name={teamB[0]} avatarUrl={teamAvatarsB[0]} id={teamIdsB[0]} onTap={onOpenPlayer} noTap={scoringActive} x={90} y={21} team="B" />
        <Chip name={teamB[1]} avatarUrl={teamAvatarsB[1]} id={teamIdsB[1]} onTap={onOpenPlayer} noTap={scoringActive} x={90} y={79} team="B" />

        <div style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
          display: "flex", alignItems: "center", gap: "clamp(8px,3vw,14px)",
          background: "color-mix(in srgb, var(--surface) 92%, #000)",
          border: "1px solid color-mix(in srgb, var(--line) 60%, transparent)",
          borderRadius: 20, padding: "clamp(6px,2.2vw,12px) clamp(14px,5vw,26px)",
          boxShadow: "0 10px 28px rgba(0,0,0,.5)", pointerEvents: "none",
        }}>
          <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "clamp(30px,12vw,48px)", lineHeight: 1, color: aWin ? "var(--lime)" : "var(--ink)" }}>{dispA == null ? 0 : dispA}</span>
          <span style={{ color: "var(--mut)", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "clamp(22px,8vw,34px)" }}>:</span>
          <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "clamp(30px,12vw,48px)", lineHeight: 1, color: bWin ? "var(--coral)" : "var(--ink)" }}>{dispB == null ? 0 : dispB}</span>
        </div>

        {editable && mode !== "sets" && !savedAlready && !pickFor && (
          <div style={{ position: "absolute", left: "50%", bottom: "7%", transform: "translateX(-50%)", pointerEvents: "none", display: "flex", alignItems: "center", gap: 6, fontFamily: "'Outfit',sans-serif", fontSize: "clamp(12px,3.4vw,14px)", fontWeight: 700, color: "var(--lime)", background: "color-mix(in srgb, var(--surface) 86%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 55%, transparent)", padding: "6px 14px", borderRadius: 999, whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(0,0,0,.35)" }}>
            {t("court_tap_cta")} <span className="cv-cta-arrow">›</span>
          </div>
        )}

        {/* Оверлей выбора числа */}
        {pickerOpen && (
          <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "var(--bg)", display: "flex", flexDirection: "column", padding: 12, animation: "cvpop .18s ease-out both" }}>
            <style>{`@keyframes cvpop{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}`}</style>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: "'Outfit',sans-serif", color: "var(--ink)", fontSize: 13 }}>
                {!pickSets && useRanges && range && (
                  <button onClick={() => setRange(null)} style={{ background: "none", border: "none", color: "var(--lime)", cursor: "pointer", marginRight: 8 }}>←</button>
                )}
                {getPickerTitle()}
              </span>
              <button onClick={closePicker} style={{ background: "none", border: "none", color: "var(--mut)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              {useKeypad ? (
                <>
                  {/* Дисплей набранного счёта */}
                  <div style={{ textAlign: "center", marginBottom: 12 }}>
                    <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 42, lineHeight: 1, color: buf === "" ? "var(--mut)" : pickerColor }}>
                      {buf === "" ? "0" : buf}
                    </span>
                    {mode === "sum" && (
                      <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--mut)" }}>
                        {t("court_opponent")}: <b style={{ color: "var(--ink)" }}>{points - (buf === "" ? 0 : Number(buf))}</b>
                      </div>
                    )}
                  </div>
                  {/* Клавиатура */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                      <button key={d} className="cv-num" disabled={busy} onClick={() => kpDigit(d)} style={KP}>{d}</button>
                    ))}
                    <button className="cv-num" disabled={busy || buf === ""} onClick={() => setBuf(buf.slice(0, -1))} style={{ ...KP, color: "var(--mut)", opacity: buf === "" ? .5 : 1 }}>⌫</button>
                    <button className="cv-num" disabled={busy} onClick={() => kpDigit(0)} style={KP}>0</button>
                    <button className="cv-num" disabled={busy || buf === ""} onClick={() => kpConfirm(Number(buf))} style={{ ...KP, background: buf === "" ? "var(--surface2)" : "var(--lime)", color: buf === "" ? "var(--mut)" : "var(--lime-fg)", border: "1px solid " + (buf === "" ? "var(--line)" : "var(--lime)") }}>✓</button>
                  </div>
                </>
              ) : (
                <div style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                  {(() => {
                    const arr = [];
                    for (let n = 0; n <= pickerMax; n++) arr.push(n);
                    return arr.map((n) => {
                      const cur = pickerCurVal === n;
                      return (
                        <button key={n} className="cv-num" disabled={busy} onClick={() => pickSets ? pickSetScore(n) : pickSumFree(pickFor, n)} style={{
                          padding: "12px 0", borderRadius: 12, cursor: "pointer",
                          fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 20,
                          background: cur ? "var(--lime)" : "var(--surface2)",
                          color: cur ? "var(--lime-fg)" : "var(--ink)",
                          border: "1px solid var(--line)",
                        }}>{n}</button>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
            {mode === "sum" && !useKeypad && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--mut)", textAlign: "center" }}>
                {t("court_auto_second")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Детальный счёт по сетам */}
      {mode === "sets" && (
        <div style={{ marginTop: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "8px 14px" }}>
          {setsDetail.map((s, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 0",
              borderBottom: i < setsDetail.length - 1 ? "1px solid var(--line)" : "none",
            }}>
              <span style={{ fontSize: 12, color: "var(--mut)", width: 50, flexShrink: 0 }}>{t("court_set")} {i + 1}</span>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <SetChip val={s.a} team="A" editable={editable && !savedAlready} onClick={() => setPickSets({ setIdx: i, team: "A" })} />
                <span style={{ color: "var(--mut)", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 14 }}>:</span>
                <SetChip val={s.b} team="B" editable={editable && !savedAlready} onClick={() => setPickSets({ setIdx: i, team: "B" })} />
              </div>
              <div style={{ width: 50, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
                {editable && !savedAlready && setsDetail.length > 1 && i === setsDetail.length - 1 && (
                  <button onClick={() => removeSet(i)} aria-label={t("delete_btn")} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "color-mix(in srgb, var(--coral) 16%, transparent)", color: "var(--coral)", cursor: "pointer", fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                )}
              </div>
            </div>
          ))}
          {editable && !savedAlready && !allSetsEntered && (
            <div style={{ fontSize: 11, color: "var(--mut)", textAlign: "center", paddingTop: 6 }}>
              {t("court_tap_set")}
            </div>
          )}
          {editable && !savedAlready && setsDetail.length < 5 && (
            <button className="cv-setbtn" onClick={addSet} style={{
              width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 10, border: "1px solid color-mix(in srgb, var(--lime) 45%, transparent)",
              background: "color-mix(in srgb, var(--lime) 12%, transparent)", color: "var(--lime)", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "'Outfit',sans-serif",
            }}>{t("court_add_set")}</button>
          )}
        </div>
      )}

      {/* Кнопка записи — sets */}
      {editable && mode === "sets" && !savedAlready && (
        <button className="cv-save" onClick={saveSets} disabled={!setsValid || busy} style={{
          width: "100%", marginTop: 8, padding: 11, borderRadius: 12, border: "none",
          cursor: setsValid ? "pointer" : "not-allowed", fontWeight: 700,
          fontFamily: "'Outfit',sans-serif", background: "var(--lime)", color: "var(--lime-fg)",
          filter: (!setsValid || busy) ? "grayscale(.6) brightness(.7)" : "none",
        }}>
          {busy ? t("court_recording") : !allSetsEntered ? t("court_enter_all_sets") : t("court_record")}
        </button>
      )}

      {/* Кнопка записи — free */}
      {editable && mode === "free" && (
        <button className="cv-save" onClick={saveFree} disabled={dA == null || dB == null || dA === dB || busy} style={{
          width: "100%", marginTop: 8, padding: 11, borderRadius: 12, border: "none",
          cursor: "pointer", fontWeight: 700, fontFamily: "'Outfit',sans-serif",
          background: "var(--lime)", color: "var(--lime-fg)",
          filter: (dA == null || dB == null || dA === dB || busy) ? "grayscale(.6) brightness(.7)" : "none",
        }}>
          {busy ? t("court_recording") : (dA != null && dB != null && dA === dB ? t("court_draw_not_allowed") : t("court_record"))}
        </button>
      )}
    </div>
  );
}
