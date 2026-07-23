// components/Analytics.jsx
// Аналитика лиги v2: инструмент организатора + повод для гордости лиги.
// Сверху вниз: KPI с динамикой (всего/+за неделю, активные с долей, рекорд дня) →
// «Пульс» (столбики по неделям, тренд месяц-к-месяцу; лента по дням — по тапу) →
// «Дни стаи» (гистограмма по дням недели) → самые активные (аватары + бары, 30д) →
// «Спящие» (30+ дней без игр; тап — карточка) → «Связка лиги» (лучшая пара) →
// «Веха стаи» (прогресс к круглому числу матчей + прогноз по темпу).
// Данные: group_analytics v2 (migrations/2026-07-10_group_analytics_v2.sql);
// связка — из getBoardMatches (swr-кэш, грузится и для стриков в Board).
import React, { useEffect, useRef, useState } from "react";
import { getGroupAnalytics } from "../lib/statsApi";
import { getBoardMatches } from "../lib/padelApi";
import { playerAvatar, avatarFallback , avatarBg, avatarOnLoad} from "../lib/avatar";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useIsWide } from "./wide/wide";
import { t, currentLang } from "../lib/i18n";
import BackButton from "./BackButton";

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

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth; }, [perDay]);

  const hasAny = days.some((d) => d.count > 0);
  return (
    <div>
      <div ref={scrollRef} style={{ display: "flex", gap: 6, overflowX: "auto", padding: "2px 2px 8px", scrollbarWidth: "thin" }}>
        {days.map((d) => {
          const isToday = d.key === todayKey;
          const wd = d.dt.getDay();
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

// Понедельник недели, к которой относится дата.
const mondayOf = (dt) => {
  const d = new Date(dt); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

const CT = ({ children, style }) => (
  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--mut)", letterSpacing: .3, textTransform: "uppercase", ...style }}>{children}</div>
);

export default function Analytics({ groupId, onBack, players = [], onOpenPlayer, profileId = null }) {
  const isWide = useIsWide();     // ≥900: дашборд-сетка вместо вертикальной колонки
  const [data, setData] = useState(undefined);
  const [mode, setMode] = useState("all");
  const [showDays, setShowDays] = useState(false);
  const [pair, setPair] = useState(null);

  useEffect(() => {
    let active = true;
    getGroupAnalytics(groupId)
      .then((d) => active && setData(d))
      .catch(() => active && setData(null));
    return () => { active = false; };
  }, [groupId]);

  // «Связка лиги»: лучшая пара по synergy-индексу (Σразницы ÷ (матчей+3), мин. 3
  // совместных матча) — из тех же матчей, что грузятся для стриков в Board (swr).
  useEffect(() => {
    let active = true;
    getBoardMatches(groupId).then((rows) => {
      if (!active || !rows) return;
      const pairs = {};
      rows.forEach((m) => {
        const diff = (m.sets_a || 0) - (m.sets_b || 0);
        [[m.team_a, diff], [m.team_b, -diff]].forEach(([team, d]) => {
          if (!Array.isArray(team) || team.length !== 2 || !team[0] || !team[1]) return;
          const key = [...team].sort().join("|");
          if (!pairs[key]) pairs[key] = { a: team[0], b: team[1], n: 0, w: 0, diff: 0 };
          pairs[key].n++; pairs[key].diff += d;
          if (d > 0) pairs[key].w++;
        });
      });
      let best = null;
      Object.values(pairs).forEach((p) => {
        if (p.n < 3) return;
        const score = p.diff / (p.n + 3);
        if (!best || score > best.score) best = { ...p, score };
      });
      setPair(best);
    }).catch(() => {});
    return () => { active = false; };
  }, [groupId]);

  const md = data ? (data[mode] || data) : null;
  const perDay = md?.matches_per_day || [];

  // За 7 дней — сумма подённых счётчиков.
  const last7 = (() => {
    const cut = new Date(); cut.setHours(0, 0, 0, 0); cut.setDate(cut.getDate() - 6);
    return perDay.reduce((s, d) => (d.date >= dayKey(cut) ? s + (d.count || 0) : s), 0);
  })();
  const peak = md?.busiest_day || null;
  const peakDate = peak ? (() => { try { const [y, m, dd] = peak.date.split("-"); return new Date(y, m - 1, dd).toLocaleDateString(getLocale(), { day: "numeric", month: "short" }); } catch (e) { return ""; } })() : "";

  // «Пульс»: 12 недель, счётчик по неделям из подённых данных.
  const weeks = (() => {
    const map = {};
    perDay.forEach((d) => {
      try { map[dayKey(mondayOf(new Date(d.date)))] = (map[dayKey(mondayOf(new Date(d.date)))] || 0) + (d.count || 0); } catch (e) {}
    });
    const out = [];
    const cur = mondayOf(new Date());
    for (let i = 11; i >= 0; i--) {
      const wk = new Date(cur); wk.setDate(cur.getDate() - i * 7);
      out.push({ key: dayKey(wk), count: map[dayKey(wk)] || 0, dt: wk });
    }
    return out;
  })();
  const wMax = Math.max(1, ...weeks.map((w) => w.count));

  // Тренд месяц-к-месяцу.
  const mom = (() => {
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, "0")}`;
    let cur = 0, prev = 0;
    perDay.forEach((d) => {
      if (d.date.startsWith(curKey)) cur += d.count || 0;
      else if (d.date.startsWith(prevKey)) prev += d.count || 0;
    });
    if (prev === 0) return null;
    return Math.round(((cur - prev) / prev) * 100);
  })();

  // «Дни стаи»: сумма матчей по дням недели (пн..вс).
  const weekdays = (() => {
    const acc = [0, 0, 0, 0, 0, 0, 0]; // пн..вс
    perDay.forEach((d) => {
      try { acc[(new Date(d.date).getDay() + 6) % 7] += d.count || 0; } catch (e) {}
    });
    return acc;
  })();
  const wdMax = Math.max(1, ...weekdays);
  const wdLabels = (() => {
    const base = mondayOf(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base); d.setDate(base.getDate() + i);
      return d.toLocaleDateString(getLocale(), { weekday: "short" }).replace(".", "");
    });
  })();

  // «Спящие»: РЕАЛЬНО играли, но 30+ дней назад. Новенькие без единой игры —
  // отдельный блок (это не «уснувшие», их надо звать, а не будить).
  const sleeping = (() => {
    if (!data?.members) return [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return data.members
      .filter((m) => m.last_played)
      .map((m) => ({ ...m, days: Math.floor((today - new Date(m.last_played)) / 864e5) }))
      .filter((m) => m.days > 30)
      .sort((a, b) => b.days - a.days)
      .slice(0, 8);
  })();
  const newbies = (data?.members || []).filter((m) => !m.last_played).slice(0, 8);

  // «Веха стаи»: следующее круглое число матчей лиги + прогноз по темпу 4 недель.
  const milestone = (() => {
    const total = data?.all?.total_matches || 0;
    if (!total) return null;
    const MS = [50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000];
    const next = MS.find((x) => x > total);
    if (!next) return null;
    const prev = [...MS].reverse().find((x) => x <= total) || 0;
    const allPerDay = data?.all?.matches_per_day || [];
    const cut = new Date(); cut.setDate(cut.getDate() - 28);
    const recent = allPerDay.reduce((s, d) => (d.date >= dayKey(cut) ? s + (d.count || 0) : s), 0);
    const perWeek = recent / 4;
    let eta = null;
    if (perWeek > 0) {
      const dt = new Date(Date.now() + ((next - total) / perWeek) * 7 * 864e5);
      eta = dt.toLocaleDateString(getLocale(), dt.getFullYear() === new Date().getFullYear() ? { month: "long" } : { month: "long", year: "numeric" });
    }
    return { next, prev, total, left: next - total, prog: (total - prev) / (next - prev), eta };
  })();

  const topActive = md?.top_active || [];
  const topMax = Math.max(1, ...topActive.map((p) => p.matches || 0));
  const findPlayer = (id) => players.find((x) => x.id === id) || null;

  return (
    <div className="pl-pop" style={{ fontFamily: "'Outfit',sans-serif" }}>
      <style>{`.an-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px;}.an-tile{flex:1;text-align:center;min-width:0;padding:11px 6px;}.an-display{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-.3px;}
        .an-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start;}
        .an-grid>*{margin-bottom:0 !important;}
        .an-grid .an-full{grid-column:1 / -1;}`}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        {onBack && !isWide && <BackButton onClick={onBack} />}
        <h1 className="an-display" style={{ fontSize: 24, margin: 0 }}>{t("an_title")}</h1>
      </div>

      {data === undefined && <p style={{ color: "var(--mut)" }}>{t("loading")}</p>}
      {data === null && <p style={{ color: "var(--coral)" }}>{t("an_error")}</p>}

      {data && md && (
        <div className={isWide ? "an-grid" : undefined}>
          {/* Переключатель Все / Игры / Турниры */}
          <div className={isWide ? "an-full" : undefined} style={{ display: "flex", gap: 4, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: 3, marginBottom: 12 }}>
            {[["all", t("filter_all")], ["games", t("filter_games")], ["tours", t("filter_tours")]].map(([key, label]) => (
              <button key={key} onClick={() => setMode(key)} style={{
                flex: 1, border: "none", borderRadius: 9, padding: "8px 0", cursor: "pointer",
                fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 700,
                background: mode === key ? "var(--lime)" : "transparent",
                color: mode === key ? "var(--lime-fg)" : "var(--mut)",
              }}>{label}</button>
            ))}
          </div>

          {/* KPI с динамикой */}
          <div className={isWide ? "an-full" : undefined} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div className="an-card an-tile">
              <div className="an-display" style={{ fontSize: 22 }}>{md.total_matches ?? 0}</div>
              <div style={{ fontSize: 10, color: "var(--mut)", marginTop: 1 }}>{t("an_matches")}</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, marginTop: 3, color: last7 > 0 ? "var(--lime)" : "transparent" }}>+{last7} {t("wk_suffix")}</div>
            </div>
            <div className="an-card an-tile">
              <div className="an-display" style={{ fontSize: 22, color: "var(--lime)" }}>
                {data.active_30d ?? 0}<span style={{ fontSize: 13, color: "var(--mut)" }}>/{data.total_players ?? 0}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--mut)", marginTop: 1 }}>{t("an_active30")}</div>
              <div style={{ height: 3, background: "var(--surface2)", borderRadius: 2, marginTop: 5, overflow: "hidden" }}>
                <span style={{ display: "block", width: `${data.total_players ? Math.round(100 * (data.active_30d || 0) / data.total_players) : 0}%`, height: "100%", background: "var(--lime)" }} />
              </div>
            </div>
            <div className="an-card an-tile">
              <div className="an-display" style={{ fontSize: 22, color: "var(--yellow)" }}>{peak ? peak.count : 0}</div>
              <div style={{ fontSize: 10, color: "var(--mut)", marginTop: 1 }}>{t("an_peak")}</div>
              <div style={{ fontSize: 9.5, color: "var(--mut)", marginTop: 3, opacity: .8 }}>{peakDate || " "}</div>
            </div>
          </div>

          {/* Пульс: столбики по неделям; лента по дням — по тапу */}
          <div className={`an-card${isWide ? " an-full" : ""}`} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <CT>{t("an_pulse")}</CT>
              {mom !== null && (
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: mom >= 0 ? "var(--lime)" : "var(--coral)" }}>
                  {mom >= 0 ? "↑ +" : "↓ "}{mom}% {t("an_mom")}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 74, marginTop: 14 }}>
              {weeks.map((w, i) => {
                const isLast = i === weeks.length - 1;
                const h = w.count > 0 ? Math.max(8, Math.round(100 * w.count / wMax)) : 4;
                return (
                  <div key={w.key} title={`${w.dt.toLocaleDateString(getLocale(), { day: "numeric", month: "short" })}: ${w.count}`}
                    style={{ flex: 1, position: "relative", height: `${h}%`, borderRadius: "4px 4px 2px 2px",
                      background: isLast ? "var(--lime)" : w.count > 0 ? `color-mix(in srgb, var(--lime) ${15 + Math.round(45 * w.count / wMax)}%, var(--surface2))` : "var(--surface2)" }}>
                    {isLast && w.count > 0 && <span style={{ position: "absolute", top: -15, left: "50%", transform: "translateX(-50%)", fontSize: 10, fontWeight: 800, color: "var(--lime)" }}>{w.count}</span>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", fontSize: 9, color: "var(--mut)", marginTop: 5 }}>
              <span>{weeks[0]?.dt.toLocaleDateString(getLocale(), { day: "numeric", month: "short" })}</span>
              <span style={{ marginLeft: "auto" }}>{t("an_this_week")}</span>
            </div>
            <button onClick={() => setShowDays((v) => !v)}
              style={{ width: "100%", marginTop: 8, padding: "7px 0", border: "none", background: "none", color: "var(--mut)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              {showDays ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {t("an_show_days")}
            </button>
            {showDays && <ActivityCalendar perDay={perDay} />}
          </div>

          {/* Дни стаи: по дням недели */}
          <div className="an-card" style={{ marginBottom: 12 }}>
            <CT>{t("an_weekdays")}</CT>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56, marginTop: 12 }}>
              {weekdays.map((c, i) => (
                <div key={i} title={`${wdLabels[i]}: ${c}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{ borderRadius: 4, height: `${c > 0 ? Math.max(8, Math.round(100 * c / wdMax)) : 4}%`,
                    background: c === wdMax && c > 0 ? "var(--lime)" : c > 0 ? `color-mix(in srgb, var(--lime) ${15 + Math.round(45 * c / wdMax)}%, var(--surface2))` : "var(--surface2)" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, fontSize: 9.5, marginTop: 5, textAlign: "center" }}>
              {wdLabels.map((l, i) => (
                <span key={i} style={{ flex: 1, textTransform: "capitalize", fontWeight: weekdays[i] === wdMax && weekdays[i] > 0 ? 800 : 400,
                  color: weekdays[i] === wdMax && weekdays[i] > 0 ? "var(--lime)" : i >= 5 ? "var(--coral)" : "var(--mut)" }}>{l}</span>
              ))}
            </div>
          </div>

          {/* Самые активные — за 30 дней, с аватарами и барами */}
          <div className="an-card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <CT>{t("an_most_active")}</CT>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--mut)", opacity: .8 }}>{t("an_top30")}</span>
            </div>
            {topActive.length === 0 && <div style={{ color: "var(--mut)", textAlign: "center", fontSize: 12, padding: "10px 0 4px" }}>{t("an_no_data")}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 11 }}>
              {topActive.map((p, i) => {
                const full = p.id ? findPlayer(p.id) : null;
                const tap = full && onOpenPlayer ? () => onOpenPlayer(full) : undefined;
                return (
                  <div key={i} onClick={tap} style={{ display: "flex", alignItems: "center", gap: 9, cursor: tap ? "pointer" : "default" }}>
                    <img src={playerAvatar(full?.avatar_url, p.id || p.name, p.name)} onError={avatarFallback(p.id || p.name, p.name)} onLoad={avatarOnLoad} alt=""
                      style={{ ...avatarBg(p.id || p.name, p.name), width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, width: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {p.name}{p.id === profileId ? " " : ""}{p.id === profileId && <span style={{ fontSize: 9, color: "var(--lime-fg)", background: "var(--lime)", borderRadius: 5, padding: "0 4px", fontWeight: 800 }}>{t("fr_you")}</span>}
                    </span>
                    <div style={{ flex: 1, height: 14, background: "var(--surface2)", borderRadius: 7, overflow: "hidden" }}>
                      <span style={{ display: "block", width: `${Math.round(100 * (p.matches || 0) / topMax)}%`, height: "100%", background: `color-mix(in srgb, var(--lime) ${i === 0 ? 55 : 40}%, transparent)`, borderRadius: 7 }} />
                    </div>
                    <span className="an-display" style={{ fontSize: 13, width: 22, textAlign: "right", color: i === 0 ? "var(--lime)" : "var(--ink)" }}>{p.matches}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Новенькие: ещё ни одной игры — позитивный блок, не «спящие» */}
          {newbies.length > 0 && (
            <div className="an-card" style={{ marginBottom: 12, border: "1px solid color-mix(in srgb, var(--lime) 30%, transparent)" }}>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <CT style={{ color: "var(--lime)" }}>{t("an_newbies")}</CT>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--mut)", opacity: .8 }}>{t("an_newbies_hint")}</span>
              </div>
              <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
                {newbies.map((m) => {
                  const full = findPlayer(m.id);
                  const tap = full && onOpenPlayer ? () => onOpenPlayer(full) : undefined;
                  return (
                    <span key={m.id} onClick={tap} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 999, padding: "4px 11px 4px 4px", cursor: tap ? "pointer" : "default" }}>
                      <img src={playerAvatar(full?.avatar_url, m.id, m.name)} onError={avatarFallback(m.id, m.name)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(m.id, m.name), width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                      <span style={{ fontSize: 11.5, fontWeight: 600 }}>{m.name}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Спящие: играли, но 30+ дней назад */}
          {sleeping.length > 0 && (
            <div className="an-card" style={{ marginBottom: 12, border: "1px solid color-mix(in srgb, var(--coral) 30%, transparent)" }}>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <CT style={{ color: "var(--coral)" }}>{t("an_sleeping")}</CT>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--mut)", opacity: .8 }}>{t("an_sleep_hint")}</span>
              </div>
              <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
                {sleeping.map((m) => {
                  const full = findPlayer(m.id);
                  const tap = full && onOpenPlayer ? () => onOpenPlayer(full) : undefined;
                  return (
                    <span key={m.id} onClick={tap} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 999, padding: "4px 11px 4px 4px", cursor: tap ? "pointer" : "default" }}>
                      <img src={playerAvatar(full?.avatar_url, m.id, m.name)} onError={avatarFallback(m.id, m.name)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(m.id, m.name), width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                      <span style={{ fontSize: 11.5, fontWeight: 600 }}>{m.name}</span>
                      <span style={{ fontSize: 9.5, color: "var(--mut)" }}>{t("an_days_short").replace("{n}", String(m.days))}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Связка лиги: лучшая пара */}
          {pair && (() => {
            const pa = findPlayer(pair.a), pb = findPlayer(pair.b);
            const nm = (x) => (x?.name || "?").split(" ")[0];
            return (
              <div className="an-card" style={{ marginBottom: 12 }}>
                <CT>{t("an_pair")}</CT>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <span style={{ display: "flex", flexShrink: 0 }}>
                    <img src={playerAvatar(pa?.avatar_url, pair.a, pa?.name)} onError={avatarFallback(pair.a, pa?.name)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(pair.a, pa?.name), width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--surface)" }} />
                    <img src={playerAvatar(pb?.avatar_url, pair.b, pb?.name)} onError={avatarFallback(pair.b, pb?.name)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(pair.b, pb?.name), width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--surface)", marginLeft: -10 }} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nm(pa, pair.a)} + {nm(pb, pair.b)}</div>
                    <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 1 }}>
                      {t("an_pair_sub").replace("{n}", String(pair.n)).replace("{p}", String(Math.round(100 * pair.w / pair.n)))}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="an-display" style={{ fontSize: 17, color: "var(--lime)" }}>{pair.score > 0 ? "+" : ""}{pair.score.toFixed(1)}</div>
                    <div style={{ fontSize: 9, color: "var(--mut)" }}>{t("partner_index")}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Веха стаи: прогресс к круглому числу матчей */}
          {milestone && mode === "all" && (
            <div className="an-card" style={{ marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <CT>{t("an_milestone")}</CT>
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--yellow)" }}>{t("an_milestone_left").replace("{n}", String(milestone.left))}</span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 8 }}>{t("an_milestone_goal").replace("{n}", String(milestone.next))} 🏁</div>
              <div style={{ height: 8, background: "var(--surface2)", borderRadius: 5, marginTop: 8, overflow: "hidden" }}>
                <span style={{ display: "block", width: `${Math.max(4, Math.round(milestone.prog * 100))}%`, height: "100%", background: "var(--lime)", borderRadius: 5 }} />
              </div>
              <div style={{ display: "flex", fontSize: 9.5, color: "var(--mut)", marginTop: 4 }}>
                <span>{t("an_milestone_played").replace("{n}", String(milestone.total))}</span>
                {milestone.eta && <span style={{ marginLeft: "auto" }}>{t("an_milestone_eta").replace("{m}", milestone.eta)}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
