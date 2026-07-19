// components/LevelPicker.jsx
// Событийный уровень (турнир/игра): как выбор уровня в ProfileEditor, но с
// опциональным диапазоном (val2 — верхняя граница). Ввод — «сырые» строки;
// родитель санитайзит через lib/levels.sanitizeEventLevel перед сохранением.
import React, { useState } from "react";
import { t } from "../lib/i18n";
import { LETTER_OPTIONS } from "../lib/levels";

export default function LevelPicker({ value, onChange }) {
  const [sys, setSys] = useState(value?.sys || "pt");
  const [val, setVal] = useState(value?.val != null ? String(value.val) : "");
  const [val2, setVal2] = useState(value?.val2 != null ? String(value.val2) : "");
  const [lbl, setLbl] = useState(value?.lbl || "");
  const [range, setRange] = useState(!!value?.val2);

  const emit = (next) => {
    const v = next.val ?? val;
    if (!String(v || "").trim()) { onChange(null); return; }
    onChange({ sys: next.sys ?? sys, val: v, val2: next.range ?? range ? (next.val2 ?? val2) : "", lbl: next.lbl ?? lbl });
  };

  const pickSys = (k) => { setSys(k); setVal(""); setVal2(""); setLbl(""); onChange(null); };
  const setValAnd = (v) => { setVal(v); emit({ val: v }); };
  const setVal2And = (v) => { setVal2(v); emit({ val2: v }); };
  const toggleRange = () => {
    const nextRange = !range;
    setRange(nextRange);
    if (!nextRange) { setVal2(""); emit({ range: false, val2: "" }); }
    else emit({ range: true });
  };

  const valueInput = (v, onSet, ph) => {
    if (sys === "pt") return (
      <input type="number" min="0" max="7" step="0.5" value={v} onChange={(e) => onSet(e.target.value)} placeholder={ph}
        style={inputStyle} />
    );
    if (sys === "ltr") return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {LETTER_OPTIONS.map((L) => (
          <button key={L} type="button" onClick={() => onSet(L)} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "7px 0", width: "calc((100% - 36px)/7)", fontWeight: 800, cursor: "pointer", background: v === L ? "#7cc4e0" : "var(--bg)", color: v === L ? "#0a1612" : "var(--mut)" }}>{L}</button>
        ))}
      </div>
    );
    // oth
    return <input value={v} onChange={(e) => onSet(e.target.value)} placeholder={t("pc_level_val_ph")} style={inputStyle} />;
  };

  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
        {t("evt_level_label")} <span style={{ color: "var(--mut)", fontWeight: 500 }}>({t("evt_level_opt")})</span>
      </div>
      <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 10, padding: 3, marginBottom: 10 }}>
        {[["pt", "Playtomic"], ["ltr", t("pc_level_sys_ltr")], ["oth", t("pc_level_sys_oth")]].map(([k, lbl2]) => (
          <button key={k} type="button" onClick={() => pickSys(k)} style={{ flex: 1, border: "none", borderRadius: 8, padding: "7px 0", cursor: "pointer", fontWeight: 700, fontSize: 12, background: sys === k ? "var(--lime)" : "none", color: sys === k ? "var(--lime-fg)" : "var(--mut)" }}>{lbl2}</button>
        ))}
      </div>

      {sys === "oth" && (
        <input value={lbl} onChange={(e) => { setLbl(e.target.value); emit({ lbl: e.target.value }); }} placeholder={t("pc_level_sysname_ph")} style={{ ...inputStyle, marginBottom: 8 }} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1 }}>{valueInput(val, setValAnd, sys === "pt" ? "0 – 7" : t("pc_level_val_ph"))}</div>
        {range && (
          <>
            <span style={{ fontSize: 11.5, color: "var(--mut)", flexShrink: 0 }}>{t("evt_level_to")}</span>
            <div style={{ flex: 1 }}>{valueInput(val2, setVal2And, sys === "pt" ? "0 – 7" : t("pc_level_val_ph"))}</div>
          </>
        )}
      </div>

      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12, fontWeight: 600, color: "var(--mut)", cursor: "pointer" }}>
        <input type="checkbox" checked={range} onChange={toggleRange} style={{ accentColor: "var(--lime)" }} />
        {t("evt_level_range")}
      </label>
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10,
  color: "var(--ink)", fontFamily: "'Outfit',sans-serif", fontSize: 14, padding: "9px 10px",
  outline: "none", boxSizing: "border-box",
};
