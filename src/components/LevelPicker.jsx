// components/LevelPicker.jsx
// Событийный уровень (турнир/игра): МНОЖЕСТВЕННЫЙ выбор принимаемых уровней —
// тапаешь чипы, каждый добавляет/убирает значение. Ввод «сырой»; родитель
// санитайзит через lib/levels.sanitizeEventLevel перед сохранением.
import React, { useState, useRef } from "react";
import { t } from "../lib/i18n";
import { LETTER_OPTIONS, sysColor } from "../lib/levels";

const PT_OPTIONS = ["1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0"];

const inputStyle = {
  width: "100%", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10,
  color: "var(--ink)", fontFamily: "'Outfit',sans-serif", fontSize: 14, padding: "9px 10px",
  outline: "none", boxSizing: "border-box",
};

export default function LevelPicker({ value, onChange }) {
  const [sys, setSys] = useState(value?.sys || "pt");
  const [vals, setVals] = useState(
    Array.isArray(value?.vals) ? value.vals.map(String) : value?.val != null ? [String(value.val)] : []
  );
  const [lbl, setLbl] = useState(value?.lbl || "");
  // ref всегда держит актуальный vals — чтобы быстрые последовательные тапы по
  // чипам копились (без него замыкание vals было бы устаревшим до ре-рендера).
  const valsRef = useRef(vals);
  valsRef.current = vals;

  const push = (nextVals, nextLbl) => {
    const vv = (nextVals ?? vals).map((x) => String(x).trim()).filter(Boolean);
    if (!vv.length) { onChange(null); return; }
    onChange({ sys, vals: vv, lbl: nextLbl ?? lbl });
  };
  const pickSys = (k) => { setSys(k); setVals([]); valsRef.current = []; setLbl(""); onChange(null); };
  const toggle = (v) => {
    const prev = valsRef.current;
    const next = prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v];
    valsRef.current = next; setVals(next); push(next);
  };
  const setOth = (v) => { const nv = v.trim() ? [v] : []; setVals(nv); push(nv); };

  const accent = sysColor(sys);
  const accentFg = "var(--lime-fg)";
  const chip = (on) => ({
    flexShrink: 0, border: "1px solid var(--line)", borderRadius: 8, padding: "7px 12px",
    fontWeight: 800, fontSize: 13, cursor: "pointer",
    background: on ? accent : "var(--bg)", color: on ? accentFg : "var(--mut)",
    borderColor: on ? accent : "var(--line)",
  });

  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
        {t("evt_level_label")} <span style={{ color: "var(--mut)", fontWeight: 500 }}>({t("evt_level_opt")})</span>
      </div>
      <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 10, padding: 3, marginBottom: 10 }}>
        {[["pt", "Playtomic"], ["ltr", t("pc_level_sys_ltr")], ["oth", t("pc_level_sys_oth")]].map(([k, lbl2]) => (
          <button key={k} type="button" onClick={() => pickSys(k)} style={{ flex: 1, border: "none", borderRadius: 8, padding: "7px 0", cursor: "pointer", fontWeight: 700, fontSize: 12, background: sys === k ? sysColor(k) : "none", color: sys === k ? "var(--lime-fg)" : "var(--mut)" }}>{lbl2}</button>
        ))}
      </div>

      {sys === "oth" ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input value={lbl} onChange={(e) => { setLbl(e.target.value); push(vals, e.target.value); }} placeholder={t("pc_level_sysname_ph")} style={inputStyle} />
          <input value={vals[0] || ""} onChange={(e) => setOth(e.target.value)} placeholder={t("pc_level_val_ph")} style={{ ...inputStyle, maxWidth: 120 }} />
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: "var(--mut)", marginBottom: 7 }}>{t("evt_level_multi_hint")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(sys === "pt" ? PT_OPTIONS : LETTER_OPTIONS).map((v) => (
              <button key={v} type="button" onClick={() => toggle(v)} style={chip(vals.includes(v))}>{v}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
