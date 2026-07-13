// components/DateTimePicker.jsx
// Кастомный выбор даты и времени (без системных <input type=date/time>):
//   • чипы-пресеты даты (Сегодня / Завтра / ближайшая Сб / +7 дней),
//   • сворачиваемый мини-календарь (неделя с понедельника),
//   • чипы времени + компактный степпер для точного значения.
// Значения наружу — те же строки, что у нативных инпутов: day="YYYY-MM-DD",
// time="HH:MM", поэтому вызывающий код (сборка ISO) не меняется.
import React, { useState } from "react";
import { t, dateLocale } from "../lib/i18n";
import { Calendar, Clock, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, dd] = (s || "").split("-").map(Number); return new Date(y, (m || 1) - 1, dd || 1); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
// Ближайшая суббота (если сегодня суббота — следующая).
const nextSaturday = (from) => { const x = new Date(from); const diff = (6 - x.getDay() + 7) % 7 || 7; x.setDate(x.getDate() + diff); return x; };

export default function DateTimePicker({ day, time, onDay, onTime }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sel = parseYmd(day);
  const [calOpen, setCalOpen] = useState(false);
  const [view, setView] = useState(() => new Date(sel.getFullYear(), sel.getMonth(), 1)); // видимый месяц
  const [customTime, setCustomTime] = useState(false);

  const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const dateLabel = sel.toLocaleDateString(dateLocale(), { day: "numeric", month: "long", weekday: "short" });

  const presets = [
    { key: "today", label: t("dt_today"), d: today },
    { key: "tomorrow", label: t("dt_tomorrow"), d: addDays(today, 1) },
    { key: "sat", label: t("dt_saturday"), d: nextSaturday(today) },
    { key: "week", label: t("dt_in_week"), d: addDays(today, 7) },
  ];
  const pickDate = (d) => { onDay(ymd(d)); setView(new Date(d.getFullYear(), d.getMonth(), 1)); };

  // Сетка месяца, неделя с понедельника.
  const monthGrid = () => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; // Пн=0
    const start = addDays(first, -startOffset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  };
  const monthTitle = view.toLocaleDateString(dateLocale(), { month: "long", year: "numeric" });
  const dows = t("dt_dows").split(","); // «Пн,Вт,…»

  const timePresets = ["18:00", "19:00", "20:00", "21:00", "22:00"];
  const [th, tm] = (time || "00:00").split(":").map(Number);
  const bumpH = (n) => onTime(`${pad((th + n + 24) % 24)}:${pad(tm)}`);
  const bumpM = (n) => { let m = tm + n; let h = th; if (m >= 60) { m -= 60; h = (h + 1) % 24; } if (m < 0) { m += 60; h = (h + 23) % 24; } onTime(`${pad(h)}:${pad(m)}`); };

  const lab = { fontSize: 10.5, fontWeight: 800, color: "var(--mut)", textTransform: "uppercase", letterSpacing: .7, margin: "16px 2px 7px" };
  const chip = (on) => ({ padding: "7px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif",
    background: on ? "color-mix(in srgb, var(--lime) 16%, transparent)" : "var(--surface2)",
    border: "1px solid " + (on ? "color-mix(in srgb, var(--lime) 45%, transparent)" : "var(--line)"),
    color: on ? "var(--lime)" : "var(--mut)" });
  const picker = { display: "flex", alignItems: "center", gap: 10, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 13, padding: "12px 14px", cursor: "pointer" };

  return (
    <div>
      {/* ── Дата ── */}
      <div style={lab}>{t("dt_date")}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {presets.map((p) => (
          <button key={p.key} type="button" style={chip(isSameDay(sel, p.d))} onClick={() => pickDate(p.d)}>{p.label}</button>
        ))}
      </div>
      <div style={picker} onClick={() => setCalOpen((o) => !o)}>
        <span style={{ color: "var(--lime)", display: "flex", flexShrink: 0 }}><Calendar size={15} /></span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", textTransform: "capitalize" }}>{dateLabel}</span>
        <span style={{ marginLeft: "auto", color: "var(--mut)", display: "flex", transition: "transform .2s", transform: calOpen ? "rotate(180deg)" : "none" }}><ChevronDown size={16} /></span>
      </div>
      {calOpen && (
        <div style={{ marginTop: 8, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 14, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} style={{ background: "none", border: "none", color: "var(--mut)", cursor: "pointer", display: "flex", padding: 4 }}><ChevronLeft size={17} /></button>
            <b style={{ fontSize: 13, color: "var(--ink)", textTransform: "capitalize" }}>{monthTitle}</b>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} style={{ background: "none", border: "none", color: "var(--mut)", cursor: "pointer", display: "flex", padding: 4 }}><ChevronRight size={17} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
            {dows.map((d, i) => <div key={i} style={{ fontSize: 9, color: "var(--mut)", textAlign: "center", fontWeight: 700, paddingBottom: 3 }}>{d}</div>)}
            {monthGrid().map((d, i) => {
              const inMonth = d.getMonth() === view.getMonth();
              const isSel = isSameDay(d, sel);
              const isToday = isSameDay(d, today);
              return (
                <button key={i} type="button" onClick={() => pickDate(d)}
                  style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                    fontWeight: isSel ? 800 : 600, fontFamily: "'Outfit',sans-serif", borderRadius: 9, cursor: "pointer", border: isToday && !isSel ? "1px solid color-mix(in srgb, var(--lime) 50%, transparent)" : "1px solid transparent",
                    background: isSel ? "var(--lime)" : "transparent", color: isSel ? "var(--lime-fg)" : (inMonth ? "var(--ink)" : "color-mix(in srgb, var(--mut) 50%, transparent)") }}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Время ── */}
      <div style={lab}>{t("dt_time")}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {timePresets.map((tp) => (
          <button key={tp} type="button" onClick={() => { onTime(tp); setCustomTime(false); }}
            style={{ flexShrink: 0, padding: "9px 13px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif",
              background: !customTime && time === tp ? "var(--lime)" : "var(--surface2)", border: "1px solid " + (!customTime && time === tp ? "var(--lime)" : "var(--line)"),
              color: !customTime && time === tp ? "var(--lime-fg)" : "var(--mut)" }}>{tp}</button>
        ))}
        <button type="button" onClick={() => setCustomTime((c) => !c)}
          style={{ flexShrink: 0, padding: "9px 13px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif",
            background: customTime ? "var(--lime)" : "var(--surface2)", border: "1px solid " + (customTime ? "var(--lime)" : "var(--line)"),
            color: customTime ? "var(--lime-fg)" : "var(--mut)", display: "inline-flex", alignItems: "center", gap: 5 }}><Clock size={13} /> {t("dt_custom")}</button>
      </div>
      {customTime && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 10, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 13, padding: "12px 0" }}>
          <Stepper value={pad(th)} onUp={() => bumpH(1)} onDown={() => bumpH(-1)} />
          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--mut)" }}>:</span>
          <Stepper value={pad(tm)} onUp={() => bumpM(5)} onDown={() => bumpM(-5)} />
        </div>
      )}
    </div>
  );
}

function Stepper({ value, onUp, onDown }) {
  const btn = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 9, width: 34, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--lime)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <button type="button" style={btn} onClick={onUp}><ChevronLeft size={16} style={{ transform: "rotate(90deg)" }} /></button>
      <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, color: "var(--ink)", minWidth: 40, textAlign: "center" }}>{value}</span>
      <button type="button" style={btn} onClick={onDown}><ChevronLeft size={16} style={{ transform: "rotate(-90deg)" }} /></button>
    </div>
  );
}
