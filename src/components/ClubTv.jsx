// ClubTv — единый адаптивный «ТВ клуба» (полноэкранное табло по всей лиге).
// Публичный /tv/l/CODE (без логина, поллинг get_public_league) + кнопка в
// управлении лигой. Ротация непустых экранов (~15с, нижняя полоса-таймер):
//   1) табло активного турнира (корты + таблица) — TvTournamentScreen;
//   2) таблица лиги;
//   3) ближайшее: 1 главное событие + 2 ниже + QR на мероприятие;
//   4) о PadelPack + QR на скачивание приложения.
// Дизайн — общий с TvBoard (TV_CSS, подложка-корт, фикс-палитра). Данные —
// только публичные RPC. Гейт PRO пока не вешаем.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getPublicLeague } from "../lib/padelApi";
import { getTournamentByCode } from "../lib/tournamentApi";
import { TV_CSS, TvBackdrop, TvMessage, TvTournamentScreen, useTvClock, Av } from "./TvBoard";
import { WEB_BASE } from "../lib/platform";
import { useWakeLock } from "../lib/useWakeLock";
import { t as tr, dateLocale } from "../lib/i18n";

const ROTATE_MS = 15000;
const POLL_MS = 20000;

// ── QR: генерим SVG по набору URL (лига / мероприятие / приложение) ──────────
function useQrs(urls) {
  const [qrs, setQrs] = useState({});
  const key = urls.filter(Boolean).join("|");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mod = await import("qrcode-generator");
        const make = mod.default || mod;
        const next = {};
        for (const u of urls.filter(Boolean)) {
          const q = make(0, "M"); q.addData(u); q.make();
          next[u] = q.createSvgTag(4, 0).replace("<svg ", '<svg style="width:100%;height:100%;display:block" ');
        }
        if (alive) setQrs(next);
      } catch (e) { /* без QR переживём */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return qrs;
}

function Qr({ svg, size = "big", scan }) {
  return (
    <div className={`pptv-qr ${size}`}>
      {scan && <span className="pptv-scan">{scan}</span>}
      <span className="cn tl" /><span className="cn tr" /><span className="cn bl" /><span className="cn br" />
      {svg ? <span dangerouslySetInnerHTML={{ __html: svg }} /> : <span style={{ width: "100%", height: "100%" }} />}
    </div>
  );
}

// ── Экран: таблица лиги ──────────────────────────────────────────────────────
function StandingsScreen({ league, leagueQr, dots }) {
  const rows = (league.members || []).slice(0, 8);
  return (
    <>
      <div className="pptv-lgbody">
        {rows.map((m, i) => (
          <div key={i} className={`pptv-lr${i === 0 ? " lead" : ""}`}>
            <span className="rk">{i + 1}</span>
            <Av url={m.avatar_url} name={m.name} cls="av" />
            <span className="nm">{m.name}</span>
            <span className="gm">{m.matches} {tr("tv_games_short")}</span>
            <span className="rt">{m.rating}</span>
          </div>
        ))}
      </div>
      <div className="pptv-foot">
        {dots}
        <div style={{ marginLeft: "auto" }}><Qr svg={leagueQr} size="sm" scan={tr("tv_scan_join")} /></div>
      </div>
    </>
  );
}

// ── Экран: ближайшие — 1 главное + до 2 ниже + QR на мероприятие ─────────────
function UpcomingScreen({ league, hero, rest, eventQr, dots }) {
  const fmtWhen = (iso) => {
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString(dateLocale(), { weekday: "short" }).toUpperCase()} · ${d.toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" })}`;
    } catch (e) { return ""; }
  };
  const free = hero?.target ? Math.max(0, hero.target - (hero.taken || 0)) : null;
  return (
    <>
      <div className="pptv-split">
        <div className="pptv-hero">
          <span className="tag">{hero.status === "open" ? tr("tv_reg_open") : tr("showcase_join")}</span>
          <div className="when">{fmtWhen(hero.starts_at)}</div>
          <div className="ev">{hero.kind === "tournament" ? "🏆" : "⚔"} {hero.name}</div>
          {hero.place && <div className="pl">📍 {hero.place}</div>}
          {free != null && <div className="seats">{free === 0 ? `🔴 ${tr("tv_full")}` : `🟡 ${tr("tv_seats_left").replace("{n}", String(free))}`}</div>}
          {rest.length > 0 && (
            <div style={{ marginTop: "1.6cqw", display: "flex", flexDirection: "column", gap: ".8cqw" }}>
              {rest.slice(0, 2).map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "1cqw", fontSize: "1.3cqw", color: "var(--mut)" }}>
                  <span style={{ color: "var(--accent)", fontWeight: 800, minWidth: "8cqw" }}>{fmtWhen(e.starts_at)}</span>
                  <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.kind === "tournament" ? "🏆" : "⚔"} {e.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <Qr svg={eventQr} size="big" scan={tr("tv_scan_event")} />
      </div>
      <div className="pptv-foot">{dots}</div>
    </>
  );
}

// ── Экран: о PadelPack + QR на скачивание приложения ─────────────────────────
function AboutScreen({ appQr, dots }) {
  return (
    <>
      <div className="pptv-split">
        <div className="pptv-hero">
          <span className="tag lime">{tr("tv_about_tag")}</span>
          <h1 dangerouslySetInnerHTML={{ __html: tr("tv_about_h1") }} />
          <div className="pptv-props">
            <div><b>🏆</b> {tr("tv_about_p1")}</div>
            <div><b>📊</b> {tr("tv_about_p2")}</div>
            <div><b>⚡</b> {tr("tv_about_p3")}</div>
          </div>
          <div className="pptv-stores">{tr("tv_about_stores")}</div>
        </div>
        <Qr svg={appQr} size="big" scan={tr("tv_scan_get")} />
      </div>
      <div className="pptv-foot">{dots}</div>
    </>
  );
}

export default function ClubTv({ code = null, onClose = null }) {
  const [league, setLeague] = useState(undefined);
  const [tours, setTours] = useState({});
  const [idx, setIdx] = useState(0);
  const loadedRef = useRef(false);
  const clock = useTvClock();
  useWakeLock(true);

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

  const tourCodes = useMemo(() =>
    (league?.events || []).filter((e) => e.kind === "tournament" && e.invite_code && e.status !== "finished").map((e) => e.invite_code), [league]);
  const tourKey = tourCodes.join(",");
  useEffect(() => {
    if (!tourCodes.length) { setTours({}); return; }
    let alive = true;
    const load = () => Promise.all(tourCodes.map((c) => getTournamentByCode(c).then((d) => [c, d]).catch(() => [c, null])))
      .then((pairs) => { if (!alive) return; const next = {}; for (const [c, d] of pairs) if (d && (d.matches || []).length && d.status !== "finished") next[c] = d; setTours(next); });
    load();
    const id = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourKey]);

  // Афиша: главное открытое событие + остальные.
  const events = league?.events || [];
  const hero = events.find((e) => e.status === "open") || events[0] || null;
  const rest = hero ? events.filter((e) => e !== hero) : [];
  const heroHref = hero ? `${WEB_BASE}/${hero.kind === "tournament" ? "t" : "j"}/${hero.invite_code}` : null;
  const leagueUrl = `${WEB_BASE}/l/${code}`;
  const qrs = useQrs([leagueUrl, heroHref, WEB_BASE]);

  const screens = useMemo(() => {
    if (!league) return [];
    const list = [];
    for (const c of tourCodes) if (tours[c]) list.push({ key: "t:" + c, kind: "tour", data: tours[c] });
    if ((league.members || []).length) list.push({ key: "standings", kind: "standings" });
    if (hero) list.push({ key: "upcoming", kind: "upcoming" });
    list.push({ key: "about", kind: "about" });   // «о PadelPack» — всегда
    return list;
  }, [league, tours, tourCodes, hero]);

  useEffect(() => {
    if (screens.length <= 1) { setIdx(0); return; }
    const id = setInterval(() => setIdx((i) => (i + 1) % screens.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [screens.length]);
  const safeIdx = screens.length ? idx % screens.length : 0;
  const cur = screens[safeIdx];

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (league === undefined) return <TvMessage text={tr("loading")} onClose={onClose} />;
  if (league === null) return <TvMessage text={tr("err_league_not_found")} onClose={onClose} />;
  if (!screens.length) return <TvMessage text={`${league.name}\n${tr("tv_empty")}`} onClose={onClose} />;

  // Нижняя полоса-таймер: активная точка заполняется за ROTATE_MS → переключение.
  const dots = (
    <div className="pptv-rot">
      {screens.map((s, i) => (
        <i key={s.key} className={i === safeIdx ? "on" : ""}>
          {i === safeIdx && <b key={safeIdx} style={{ animationDuration: `${ROTATE_MS}ms` }} />}
        </i>
      ))}
    </div>
  );

  // Бренд-шапка (варьируется по экрану).
  const head = (nm, sub, live = false, logo = null) => (
    <div className="pptv-head">
      <div className="pptv-logo">{logo || (league.logo_url ? <img src={league.logo_url} alt="" /> : (league.name?.[0] || "?").toUpperCase())}</div>
      <div style={{ minWidth: 0 }}><div className="pptv-nm">{nm}</div><div className="pptv-sub">{sub}</div></div>
      {live && <span className="pptv-live"><i />LIVE</span>}
      <span className="pptv-clock">{clock}</span>
    </div>
  );

  let header, body;
  if (cur.kind === "tour") {
    const fmtName = cur.data.name || "";
    header = head(league.name, fmtName, true);
    body = <TvTournamentScreen t={cur.data} clock={clock} header={false} />;
  } else if (cur.kind === "standings") {
    header = head(tr("tv_league_table"), `${league.name} · ${league.member_count} ${tr("tv_players_short")}`);
    body = <StandingsScreen league={league} leagueQr={qrs[leagueUrl]} dots={dots} />;
  } else if (cur.kind === "upcoming") {
    header = head(tr("tv_upcoming"), tr("tv_join_hint"));
    body = <UpcomingScreen league={league} hero={hero} rest={rest} eventQr={qrs[heroHref]} dots={dots} />;
  } else {
    header = head("PadelPack", tr("tv_about_sub"), false, "P");
    body = <AboutScreen appQr={qrs[WEB_BASE]} dots={dots} />;
  }

  return (
    <div className="pptv">
      <style>{TV_CSS}</style>
      <TvBackdrop />
      {onClose && <button className="pptv-close" onClick={onClose}>✕</button>}
      {header}
      {body}
    </div>
  );
}
