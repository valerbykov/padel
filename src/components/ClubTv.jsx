// ClubTv — единый адаптивный «ТВ клуба» для экрана в клубе / планшета на стойке.
// Крутит экраны по всей ЛИГЕ (публичный /tv/l/CODE, без логина, поллинг
// get_public_league), пропуская пустые:
//   • табло каждого АКТИВНОГО турнира (корты+таблица) — переиспользует TvTournamentScreen;
//   • таблица лиги (рейтинг участников);
//   • ближайшие игры/турниры (запись по QR/ссылке).
// Данные — только публичные RPC (get_public_league + get_tournament_by_code),
// новых миграций не требует. Гейт PRO пока не вешаем (доступно всем).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getPublicLeague } from "../lib/padelApi";
import { getTournamentByCode } from "../lib/tournamentApi";
import { TV_S as S, TvMessage, TvTournamentScreen } from "./TvBoard";
import { WEB_BASE } from "../lib/platform";
import { useWakeLock } from "../lib/useWakeLock";
import { t as tr, dateLocale } from "../lib/i18n";

const ROTATE_MS = 15000;  // смена экрана
const POLL_MS = 20000;    // обновление данных лиги

// Инициалы для аватар-заглушки (без импорта тяжёлого avatar.js — тут простой круг).
function initials(name) {
  const w = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  return (w.length >= 2 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}
const BG = ["#E63946", "#F4A261", "#2A9D8F", "#264653", "#457B9D", "#8E44AD", "#E76F51", "#3D5A80", "#6A4C93", "#1D8A99"];
function bgOf(name) {
  const s = String(name || "");
  const h = [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
  return BG[h % BG.length];
}
function Av({ url, name, size = "3vmin" }) {
  const st = { width: size, height: size, borderRadius: "50%", flexShrink: 0, objectFit: "cover", display: "grid", placeItems: "center", fontWeight: 800, fontSize: "1.3vmin", color: "#fff", background: bgOf(name) };
  return url ? <img src={url} alt="" style={st} /> : <span style={st}>{initials(name)}</span>;
}

// ── Экран: таблица лиги ──────────────────────────────────────────────────────
function StandingsScreen({ league }) {
  const rows = (league.members || []).slice(0, 12);
  return (
    <>
      <div style={S.top}><span style={S.eyebrow}>📊 {tr("tv_league_table")}</span>
        <span style={{ color: "var(--mut)", fontSize: "1.6vmin", fontWeight: 700 }}>{league.name}</span></div>
      <div style={{ ...S.tablePane, flex: 1, marginTop: "2.5vmin", background: "transparent", border: "none", padding: 0 }}>
        {rows.map((m, i) => (
          <div key={i} style={{ ...S.trow, gap: "1.8vmin", fontSize: "2.6vmin", padding: ".8vmin 1.4vmin",
            background: i === 0 ? "color-mix(in srgb, var(--lime) 12%, transparent)" : (i % 2 ? "rgba(255,255,255,.02)" : "none") }}>
            <span style={{ width: "3.5vmin", color: i === 0 ? "var(--lime)" : "var(--mut)", fontWeight: 900, textAlign: "center" }}>{i + 1}</span>
            <Av url={m.avatar_url} name={m.name} size="3.4vmin" />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
            <span style={{ color: "var(--mut)", fontSize: "1.7vmin", fontWeight: 700 }}>{m.matches} {tr("tv_games_short")}</span>
            <span style={{ fontWeight: 900, color: i === 0 ? "var(--lime)" : "var(--ink)", minWidth: "8vmin", textAlign: "right" }}>{m.rating}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Экран: ближайшие игры/турниры ────────────────────────────────────────────
function UpcomingScreen({ league }) {
  const fmtWhen = (iso) => {
    try {
      const d = new Date(iso);
      return { day: d.toLocaleDateString(dateLocale(), { weekday: "short" }).toUpperCase(),
        time: d.toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" }) };
    } catch (e) { return { day: "", time: "" }; }
  };
  const evs = (league.events || []).slice(0, 4);
  return (
    <>
      <div style={S.top}><span style={S.eyebrow}>🗓 {tr("tv_upcoming")}</span>
        <span style={{ color: "var(--mut)", fontSize: "1.6vmin", fontWeight: 700 }}>{tr("tv_join_hint")}</span></div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.6vmin", marginTop: "2.5vmin", minHeight: 0 }}>
        {evs.map((e) => {
          const w = fmtWhen(e.starts_at);
          const free = e.target ? Math.max(0, e.target - (e.taken || 0)) : null;
          return (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "2vmin", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6vmin", padding: "1.6vmin 2vmin" }}>
              <div style={{ textAlign: "center", flexShrink: 0, minWidth: "9vmin" }}>
                <div style={{ fontSize: "2.8vmin", fontWeight: 900, color: "var(--lime)", lineHeight: 1 }}>{w.day || "—"}</div>
                <div style={{ fontSize: "1.6vmin", color: "var(--mut)", fontWeight: 700, marginTop: ".3vmin" }}>{w.time}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "2.4vmin", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.kind === "tournament" ? "🏆" : "⚔"} {e.name}
                </div>
                {e.place && <div style={{ fontSize: "1.6vmin", color: "var(--mut)", marginTop: ".3vmin", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.place}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: ".6vmin", flexShrink: 0 }}>
                <span style={{ fontSize: "1.7vmin", fontWeight: 800, color: free === 0 ? "var(--mut)" : "var(--yellow)" }}>
                  {free === 0 ? tr("tv_full") : free != null ? tr("tv_seats_left").replace("{n}", String(free)) : ""}
                </span>
                <div style={{ display: "flex" }}>
                  {(e.going || []).slice(0, 4).map((g, i) => (
                    <span key={i} style={{ marginLeft: i ? "-.6vmin" : 0, border: ".2vmin solid var(--surface)", borderRadius: "50%" }}>
                      <Av url={g.avatar_url} name={g.name} size="2.6vmin" />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function ClubTv({ code = null, onClose = null }) {
  const [league, setLeague] = useState(undefined);   // undefined=грузим, null=не найдена
  const [tours, setTours] = useState({});            // code → данные активного турнира (с матчами)
  const [idx, setIdx] = useState(0);
  const [qr, setQr] = useState(null);
  const loadedRef = useRef(false);
  useWakeLock(true);   // держим экран включённым (планшет на стойке не гаснет)

  // Поллинг публичного состояния лиги.
  useEffect(() => {
    if (!code) return;
    let alive = true;
    const load = () => getPublicLeague(code)
      .then((l) => { if (alive && l) { loadedRef.current = true; setLeague(l); } else if (alive && !loadedRef.current) setLeague(null); })
      .catch(() => { if (alive && !loadedRef.current) setLeague(null); });
    load();
    const id = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [code]);

  // Догрузка табло активных турниров (по их кодам из events). Держим только те,
  // где уже есть матчи (идёт игра) — «открытый» на регистрацию турнир без матчей
  // не показываем как табло (он в «ближайших»).
  const tourCodes = useMemo(() =>
    (league?.events || []).filter((e) => e.kind === "tournament" && e.invite_code && e.status !== "finished")
      .map((e) => e.invite_code), [league]);
  const tourKey = tourCodes.join(",");
  useEffect(() => {
    if (!tourCodes.length) { setTours({}); return; }
    let alive = true;
    Promise.all(tourCodes.map((c) => getTournamentByCode(c).then((d) => [c, d]).catch(() => [c, null])))
      .then((pairs) => {
        if (!alive) return;
        const next = {};
        for (const [c, d] of pairs) if (d && (d.matches || []).length && d.status !== "finished") next[c] = d;
        setTours(next);
      });
    const id = setInterval(() => {
      Promise.all(tourCodes.map((c) => getTournamentByCode(c).then((d) => [c, d]).catch(() => [c, null])))
        .then((pairs) => { if (!alive) return; const next = {}; for (const [c, d] of pairs) if (d && (d.matches || []).length && d.status !== "finished") next[c] = d; setTours(next); });
    }, POLL_MS);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourKey]);

  // QR на страницу лиги — генерируем один раз.
  useEffect(() => {
    if (!code || qr) return;
    let alive = true;
    (async () => {
      try {
        const mod = await import("qrcode-generator");
        const make = mod.default || mod;
        const q = make(0, "M"); q.addData(`${WEB_BASE}/l/${code}`); q.make();
        const svg = q.createSvgTag(4, 0).replace("<svg ", '<svg style="width:100%;height:100%;display:block" ');
        if (alive) setQr(svg);
      } catch (e) { /* без QR переживём */ }
    })();
    return () => { alive = false; };
  }, [code, qr]);

  // Esc — закрыть (ин-апп режим).
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Сборка списка экранов (только непустые).
  const screens = useMemo(() => {
    if (!league) return [];
    const list = [];
    for (const c of tourCodes) if (tours[c]) list.push({ key: "t:" + c, kind: "tour", data: tours[c] });
    if ((league.members || []).length) list.push({ key: "standings", kind: "standings" });
    if ((league.events || []).length) list.push({ key: "upcoming", kind: "upcoming" });
    return list;
  }, [league, tours, tourCodes]);

  // Ротация экранов. Сбрасываем индекс, если список изменился/укоротился.
  useEffect(() => {
    if (screens.length <= 1) { setIdx(0); return; }
    const id = setInterval(() => setIdx((i) => (i + 1) % screens.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [screens.length]);
  const safeIdx = screens.length ? idx % screens.length : 0;
  const cur = screens[safeIdx];

  if (league === undefined) return <TvMessage text={tr("loading")} onClose={onClose} />;
  if (league === null) return <TvMessage text={tr("err_league_not_found")} onClose={onClose} />;
  if (!screens.length) return <TvMessage text={`${league.name}\n${tr("tv_empty")}`} muted={false} onClose={onClose} />;

  // Экран турнира — самодостаточный (со своей шапкой/футером); лигу-хрому не рисуем.
  if (cur.kind === "tour") {
    return (
      <div style={S.root}>
        <TvTournamentScreen t={cur.data} bare />
        <Footer league={league} qr={qr} screens={screens} safeIdx={safeIdx} onClose={onClose} code={code} />
      </div>
    );
  }
  return (
    <div style={S.root}>
      {/* Бренд-шапка лиги (задел под PRO-брендинг: логотип/название). */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.6vmin", marginBottom: ".5vmin" }}>
        <div style={{ width: "3.4vmin", height: "3.4vmin", borderRadius: "1vmin", flexShrink: 0, display: "grid", placeItems: "center",
          background: "color-mix(in srgb, var(--lime) 16%, transparent)", color: "var(--lime)", fontWeight: 900, fontSize: "1.8vmin", overflow: "hidden" }}>
          {league.logo_url ? <img src={league.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (league.name?.[0] || "?").toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: "2vmin", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{league.name}</div>
          <div style={{ fontSize: "1.3vmin", color: "var(--mut)", fontWeight: 700 }}>{tr("tv_padel_league")} · {league.member_count} {tr("tv_players_short")}</div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {cur.kind === "standings" && <StandingsScreen league={league} />}
        {cur.kind === "upcoming" && <UpcomingScreen league={league} />}
      </div>
      <Footer league={league} qr={qr} screens={screens} safeIdx={safeIdx} onClose={onClose} code={code} />
    </div>
  );
}

// Общий футер: URL/QR лиги + точки ротации + закрыть.
function Footer({ league, qr, screens, safeIdx, onClose, code }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2vmin", marginTop: "1.5vmin" }}>
      <div style={{ flex: 1 }}>
        <div style={{ color: "var(--mut)", fontSize: "1.4vmin", fontWeight: 700 }}>{tr("tv_join_league")}</div>
        <div style={{ color: "var(--lime)", fontSize: "2vmin", fontWeight: 900, letterSpacing: ".1vmin" }}>padelpack.app/l/{code}</div>
        {screens.length > 1 && (
          <div style={{ display: "flex", gap: ".8vmin", marginTop: "1vmin" }}>
            {screens.map((s, i) => (
              <span key={s.key} style={{ width: "1.4vmin", height: "1.4vmin", borderRadius: "50%", background: i === safeIdx ? "var(--lime)" : "var(--line)" }} />
            ))}
          </div>
        )}
      </div>
      {qr && <div style={{ width: "9vmin", height: "9vmin", borderRadius: "1vmin", background: "#fff", padding: ".6vmin", flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: qr }} />}
      {onClose && <button onClick={onClose} style={{ ...S.close, alignSelf: "flex-start" }}>✕</button>}
    </div>
  );
}
