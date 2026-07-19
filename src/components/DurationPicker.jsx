// components/DurationPicker.jsx
// Сегментированный выбор длительности (в минутах) — ряд чипов, как в DateTimePicker.
import React from "react";
import { t } from "../lib/i18n";

function fmtDur(min) {
  const h = Math.floor(min / 60), m = min % 60;
  const H = h ? `${h} ${t("dur_h")}` : "";
  const M = m ? `${m} ${t("dur_min")}` : "";
  return [H, M].filter(Boolean).join(" ");
}

export default function DurationPicker({ value, onChange, options = [60, 90, 120, 150, 180, 240] }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--mut)", textTransform: "uppercase", letterSpacing: .7, marginBottom: 7 }}>{t("dur_label")}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((min) => {
          const on = value === min;
          return (
            <button key={min} type="button" onClick={() => onChange(min)} style={{
              padding: "7px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif",
              background: on ? "var(--lime)" : "var(--surface2)",
              border: "1px solid " + (on ? "var(--lime)" : "var(--line)"),
              color: on ? "var(--lime-fg)" : "var(--mut)",
            }}>{fmtDur(min)}</button>
          );
        })}
      </div>
    </div>
  );
}
