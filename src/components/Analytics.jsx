// components/Analytics.jsx
// Аналитика лиги: переключатель Все / Игры / Турниры. Верх — плашки, которые
// реально интересны организатору (всего матчей, за 7 дней, рекордный день),
// затем календарь активности по дням (листается по неделям), затем самые активные
// игроки. Игры считаются как матчи в таблице matches, турниры — сыгранные
// tournament_matches. Рендерится внутри вкладки «Друзья».
import React, { useEffect, useRef, useState } from "react";
import { getGroupAnalytics } from "../lib/statsApi";
import { Swords, CalendarDays, Flame, ArrowLeft } from "lucide-react";
import { t, nGames, currentLang } from "../lib/i18n";

const getLocale = () => ({ ru: "ru-RU", en: "en-US", es: "es-ES" }[currentLang] || undefined);
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Календарь активности: непрерывная лента дней (последние ~10 недель), листается
// влево/вправо; в каждом дне — сколько матчей сыграно, цвет по интенсивности.
function ActivityCalendar({ perDay }) {
  const LOCALE = getLocale();
  const scrollRef = useRef(null);
  const map = {};
  (perDay || []).forEach((d) => { if (d && d.date) map[d.date] = d.count; });

  const WINDOW = 70; // ~10 недель
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = dayKey(today);
  const days = [];
  for (let i = WINDOW - 1; i >= 0; i--) {
    const dt = new Date(today); dt.setDate(today.getDate() - i);
    days.push({ dt, key: dayKey(dt), count: map[dayKey(dt)] || 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.count));

  // По умолчанию проматываем к сегодняшнему дню (правый край).
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth; }, [perDay]);

  const hasAny = days.some((d) => d.count > 0);
  return (
    <div>
      <div ref={scrollRef} style={{ display: "flex", gap: 6, overflowX: "auto", padding: "2px 2px 8px", scrollbarWidth: "thin" }}>
        {days.map((d) => {
          const isToday = d.key === todayKey;
          const wd = d.dt.getDay(); // 0=вс, 6=сб
          const weekend = wd === 0 || wd === 6;
          const intensity = d.count > 0 ? 18 + Math.round(64 * d.count / max) : 0;
          return (
            <div key={d.key} style={{ flexShrink: 0, width: 40, textAlign: "center" }} title={`${d.dt.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" })}: ${d.count}`}>
              <div style={{ fontSize: 9, color: weekend ? "var(--coral)" : "var(--mut)", fontWeight: 600, marginBottom: 3, textTransform: "capitalize" }}>{d.dt.toLocaleDateString(LOCALE, { weekday: "short" }).replace(".", "")}</div>
              <div style={{
                height: 44, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center",
                background: d.count > 0 ? `color-mix(in srgb, var(--lime) ${intensity}%, transparent)` : "var(--surface2)",
                border: isToday ? "1.5px solid var(--lime)" : "1px solid var(--line)",
              }}>
                <span className="an-display" style={{ fontSize: 17, color: d.count > 0 ? "var(--ink)" : "var(--mut)", opacity: d.count > 0 ? 1 : .5 }}>{d.count > 0 ? d.count : "·"}</span>
              </div>
              <div style={{ fontSize: 9, color: "var(--mut)", marginTop: 3 }}>{d.dt.toLocaleDateString(LOCALE, { day: "numeric", month: "numeric" })}</div>
            </div>
          );
        })}
      </div>
      {!hasAny && <div style={{ color: "var(--mut)", fontSize: 12, textAlign: "center", padding: "2px 0 4px" }}>{t("an_no_period")}</div>}
    </div>
  );
}

const Tile = ({ icon, label, value, sub }) => (
  <div className="an-card an-tile">
    <div style={{ display: "flex", justifyContent: "center", color: "var(--lime)", marginBottom: 4 }}>{icon}</div>
    <div className="an-display" style={{ fontSize: 24 }}>{value ?? 0}</div>
    <div style={{ fontSize: 11, color: "var(--mut)" }}>{label}</div>
    {sub && <div style={{ fontSize: 10, color: "var(--mut)", marginTop: 1, opacity: .8 }}>{sub}</div>}
  </div>
);

export default function Analytics({ groupId, onBack, players = [], onOpenPlayer }) {
  const [data, setData] = useState(undefined);
  const [mode, setMode] = useState("all");

  useEffect(() => {
    let active = true;
    getGroupAnalytics(groupId)
      .then((d) => active && setData(d))
      .catch(() => active && setData(null));
    return () => { active = false; };
  }, [groupId]);

  const md = data ? (data[mode] || data) : null;

  // «За 7 дней» — сумма подённых счётчиков за последнюю неделю.
  const last7 = (() => {
    if (!md?.matches_per_day) return 0;
    const cut = new Date(); cut.setHours(0, 0, 0, 0); cut.setDate(cut.getDate() - 6);
    return md.matches_per_day.reduce((s, d) => (d.date >= dayKey(cut) ? s + (d.count || 0) : s), 0);
  })();
  const peak = md?.busiest_day || null;
  const peakDate = peak ? (() => { try { const [y, m, dd] = peak.date.split("-"); return new Date(y, m - 1, dd).toLocaleDateString(getLocale(), { day: "numeric", month: "short" }); } catch (e) { return ""; } })() : "";

  return (
    <div className="pl-pop" style={{ fontFamily: "'Outfit',sans-serif" }}>
      <style>{`.an-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px;}.an-tile{flex:1;text-align:center;min-width:0;padding:12px 8px;}.an-display{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-.3px;}`}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        {onBack && (
          <button className="pl-ghost" style={{ padding: "6px 12px" }} onClick={onBack}>
            <ArrowLeft size={14} style={{ display: "inline", marginRight: 4 }} />{t("back")}
          </button>
        )}
        <h1 className="an-display" style={{ fontSize: 24, margin: 0 }}>{t("an_title")}</h1>
      </div>

      {data === undefined && <p style={{ color: "var(--mut)" }}>{t("loading")}</p>}
      {data === null && <p style={{ color: "var(--coral)" }}>{t("an_error")}</p>}

      {data && md && (
        <>
          {/* Переключатель Все / Игры / Турниры */}
          <div style={{ display: "flex", gap: 4, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: 3, marginBottom: 14 }}>
            {[["all", t("filter_all")], ["games", t("filter_games")], ["tours", t("filter_tours")]].map(([key, label]) => (
              <button key={key} onClick={() => setMode(key)} style={{
                flex: 1, border: "none", borderRadius: 9, padding: "8px 0", cursor: "pointer",
                fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 700,
                background: mode === key ? "var(--lime)" : "transparent",
                color: mode === key ? "var(--lime-fg)" : "var(--mut)",
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Tile icon={<Swords size={18} />} label={t("an_matches")} value={md.total_matches} />
            <Tile icon={<CalendarDays size={18} />} label={t("an_last7")} value={last7} />
            <Tile icon={<Flame size={18} />} label={t("an_peak")} value={peak ? peak.count : 0} sub={peak ? peakDate : ""} />
          </div>

          <div className="an-card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "var(--mut)", fontWeight: 600 }}>{t("an_cal_title")}</div>
              <div style={{ fontSize: 10, color: "var(--mut)" }}>{t("an_cal_hint")}</div>
            </div>
            <ActivityCalendar perDay={md.matches_per_day} />
          </div>

          <div className="an-display" style={{ fontSize: 14, color: "var(--mut)", marginBottom: 2 }}>{t("an_most_active")}</div>
          <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 8 }}>{t("an_most_active_hint")}</div>
          {(md.top_active || []).length === 0 && <div className="an-card" style={{ color: "var(--mut)", textAlign: "center" }}>{t("an_no_data")}</div>}
          {(md.top_active || []).map((p, i) => {
            const full = p.id ? (players.find((x) => x.id === p.id) || { id: p.id, name: p.name }) : null;
            const tap = full && onOpenPlayer ? () => onOpenPlayer(full) : undefined;
            return (
              <div key={i} className="an-card" onClick={tap}
                style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 12, cursor: tap ? "pointer" : "default" }}>
                <span className="an-display" style={{ width: 24, color: "var(--mut)" }}>{i + 1}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 12, color: "var(--mut)" }}>{nGames(p.matches)}</span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
