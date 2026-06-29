// PadelLeague.jsx — основной экран на реальных данных Supabase.
import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./lib/supabase";
import { getLeaderboard, addMember, removeMember, createGame, listGames, submitResult, linkFor, deleteGame, createLeague, joinLeague, getGroupCounts, getGroupProfiles, listMyGames, listMyHistoryMatches, getPlayedWith, getLeagueablePlayers, addExistingMember, getBoardMatches, getStatMatches, getHistoryMatches } from "./lib/padelApi";
import { getRatingHistory } from "./lib/statsApi";
import { listTournaments, listMyTournaments } from "./lib/tournamentApi";
import { t, nGames } from "./lib/i18n";
import { standings, detailedStandings } from "./lib/americano";
import StandingsTable from "./components/StandingsTable";
import { Trophy, Swords, History, Users, Share2, Check, X, RefreshCw, Copy, PlusCircle, ChevronUp, ChevronDown, ChevronRight, Calendar, MapPin, TrendingUp, LogIn, Award, Phone, Mail, ArrowLeft, Trash2, KeyRound, Shuffle, GripVertical } from "lucide-react";
import Tournaments, { TournamentView, TournamentCard, css as trCss } from "./components/Tournaments";
import { deleteTournament } from "./lib/tournamentApi";
import CourtView from "./components/CourtView";
import EmptyState from "./components/EmptyState";
import Avatar from "./components/Avatar";
import Logo from "./components/Logo";
import { dogAvatar, playerAvatar } from "./lib/avatar";

// Текущая дата-время в формате datetime-local (YYYY-MM-DDTHH:MM) с учётом таймзоны.
const nowLocalDT = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

function playerLevel(matches, rating) {
  if (rating >= 1200) return { label: t("level_legend"), color: "var(--yellow)" };
  if (matches >= 50)  return { label: t("level_master"), color: "var(--lime)" };
  if (matches >= 20)  return { label: t("level_experienced"), color: "#7ec8e3" };
  if (matches >= 5)   return { label: t("level_amateur"), color: "#a0d890" };
  return { label: t("level_beginner"), color: "var(--mut)" };
}

const fmtDate = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
body{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;--lime-fg:#0a1612;--topbar-bg:rgba(10,22,18,.92);--yellow:#ffd23f;--border:var(--line);--card:var(--surface);--fg:var(--ink);background:var(--bg);}
body.pl-light{--bg:#f2f7f4;--surface:#ffffff;--surface2:#e6f0ea;--line:#c4d9cc;--ink:#0d1f18;--mut:#4a7060;--lime:#2a7a00;--coral:#d93a1f;--lime-fg:#ffffff;--topbar-bg:rgba(242,247,244,.95);--yellow:#9a6800;}
.pl-root{font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;color-scheme:dark;
 background-image:radial-gradient(circle at 80% -10%,rgba(200,255,45,.10),transparent 45%),radial-gradient(circle at 0% 110%,rgba(40,120,90,.18),transparent 40%);}
.pl-root.pl-light{color-scheme:light;background-image:radial-gradient(circle at 80% -10%,rgba(42,122,0,.06),transparent 45%),radial-gradient(circle at 0% 110%,rgba(40,120,90,.08),transparent 40%);}
.pl-display{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.pl-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;}
.pl-btn{background:var(--lime);color:var(--lime-fg);font-weight:700;border:none;border-radius:14px;cursor:pointer;transition:transform .12s,filter .15s,box-shadow .15s;}
.pl-btn:hover:not(:disabled){filter:brightness(1.05);box-shadow:0 6px 18px -8px color-mix(in srgb,var(--lime) 70%,transparent);}
.pl-btn:active{transform:scale(.97);}.pl-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.pl-ghost{background:var(--surface2);color:var(--ink);border:1px solid var(--line);border-radius:14px;cursor:pointer;transition:background .15s,border-color .15s;}
.pl-ghost:hover{border-color:color-mix(in srgb,var(--lime) 35%,transparent);}
.pl-input,.pl-select{background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:'Outfit';font-size:16px;outline:none;width:100%;transition:border-color .15s,box-shadow .15s;}
.pl-input::placeholder{color:var(--mut);}
.pl-input:focus,.pl-select:focus{border-color:var(--lime);box-shadow:0 0 0 3px color-mix(in srgb,var(--lime) 18%,transparent);}
.pl-tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;color:var(--mut);cursor:pointer;font-size:11px;font-weight:600;padding:6px 0;position:relative;transition:color .15s;}
.pl-tab svg{position:relative;z-index:1;opacity:.8;transition:transform .15s,opacity .15s;}
.pl-tab:active svg{transform:scale(.9);}
.pl-tab.on{color:var(--lime);font-weight:800;}
.pl-tab.on svg{transform:scale(1.16) translateY(-1px);opacity:1;}
.pl-tab.on::before{content:"";position:absolute;top:2px;left:50%;transform:translateX(-50%);width:48px;height:30px;border-radius:15px;background:color-mix(in srgb,var(--lime) 15%,transparent);}
.pl-pop{animation:pop .35s cubic-bezier(.2,.8,.2,1) both;}
@keyframes pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.pl-codebox{font-family:'Outfit';font-weight:800;letter-spacing:6px;font-size:30px;color:var(--lime);text-align:center;background:var(--surface2);border:1px dashed var(--line);border-radius:14px;padding:12px;}
.pl-slot{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--surface2);border:1px solid var(--line);}
@media(max-width:400px){
  .pl-card{border-radius:14px;}
  .pl-display{letter-spacing:.3px;}
  .pl-codebox{font-size:24px;letter-spacing:4px;}
  .pl-tab{font-size:10px;padding:4px 0;}
  .pl-tab.on::before{width:42px;height:28px;}
  .pl-slot{padding:8px 10px;gap:8px;}
}
`;

function LineChart({ values }) {
  const w = 300, h = 120, pad = 10;
  if (!values || values.length < 2)
    return <div style={{ color: "var(--mut)", fontSize: 13, textAlign: "center", padding: "26px 0" }}>{t("chart_empty")}</div>;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const x = (i) => pad + (i * (w - 2 * pad)) / (values.length - 1);
  const y = (v) => h - pad - ((v - min) / span) * (h - 2 * pad);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
      <defs><linearGradient id="plg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: "var(--lime)", stopOpacity: 0.32 }} /><stop offset="100%" style={{ stopColor: "var(--lime)", stopOpacity: 0 }} /></linearGradient></defs>
      <polygon points={`${pad},${h - pad} ${pts} ${w - pad},${h - pad}`} fill="url(#plg)" />
      <polyline points={pts} fill="none" strokeWidth="2.5" style={{ stroke: "var(--lime)" }} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.5" strokeWidth="2" style={{ fill: "var(--bg)", stroke: "var(--lime)" }} />)}
    </svg>
  );
}

function Step({ label, v, set }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button className="pl-ghost" style={{ width: 34, height: 34, borderRadius: 10 }} onClick={() => set(Math.max(0, v - 1))}><ChevronDown size={16} /></button>
        <div className="pl-display" style={{ fontSize: 26, width: 26, color: "var(--lime)" }}>{v}</div>
        <button className="pl-ghost" style={{ width: 34, height: 34, borderRadius: 10 }} onClick={() => set(Math.min(3, v + 1))}><ChevronUp size={16} /></button>
      </div>
    </div>
  );
}

// Контакты: иконки-ссылки
function ContactLinks({ contacts = {} }) {
  if (!contacts || !Object.values(contacts).some(Boolean)) return null;
  const links = [
    contacts.whatsapp && { href: `https://wa.me/${contacts.whatsapp.replace(/\D/g, "")}`, label: "WA", color: "#25d366" },
    contacts.telegram && { href: `https://t.me/${contacts.telegram.replace(/^@/, "")}`, label: "TG", color: "#229ed9" },
    contacts.email    && { href: `mailto:${contacts.email}`, label: "✉", color: "var(--mut)" },
    contacts.phone    && { href: `tel:${contacts.phone}`, label: "☎", color: "var(--mut)" },
  ].filter(Boolean);
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
      {links.map((l) => (
        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" style={{
          padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
          background: "rgba(255,255,255,.07)", border: `1px solid ${l.color}`,
          color: l.color, textDecoration: "none",
        }}>{l.label}</a>
      ))}
    </div>
  );
}

/* --------------------------------- root ----------------------------------- */

export default function PadelLeague({ groupId, session, profileId, leagues = [], leaguesReady = true, activeLeague = null, isAdmin = false, onLeagueChange, onLeagueCreated, theme = "dark", lang = "ru", onThemeToggle, onLangChange, onLogin, onOpenLanding, onEditProfile, openSelfStatsNonce = 0 }) {
  const [tab, setTab] = useState(session ? "board" : "welcome");
  const [players, setPlayers] = useState([]);
  const [archiveNonce, setArchiveNonce] = useState(0);
  const bumpArchive = useCallback(() => setArchiveNonce((n) => n + 1), []);

  // Защита от гонки: если loadLeaderboard вызвался несколько раз (сначала без
  // groupId, потом с ним — пока активная лига доопределялась), применяем результат
  // ТОЛЬКО последнего вызова, иначе «соло»-ответ (played_with) затирает лидерборд
  // лиги и показывается заглушка онбординга.
  const lbSeq = useRef(0);
  const loadLeaderboard = useCallback(async () => {
    if (!groupId) {
      if (!leaguesReady) return;                  // лиги ещё грузятся
      if ((leagues?.length || 0) > 0) return;     // лиги есть, активная ещё не выбрана → ждём groupId, соло-путь не дёргаем
    }
    const seq = ++lbSeq.current;
    // groupId есть → лидерборд лиги; нет → «Играли вместе» по всем лигам (played_with)
    try {
      const data = groupId ? await getLeaderboard(groupId) : await getPlayedWith();
      if (seq === lbSeq.current) setPlayers(data);
    } catch (e) { /* noop */ }
  }, [groupId, leaguesReady, leagues]);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  // После логина/выхода синхронизируем вкладку.
  // Баг: tab инициализировался один раз ("welcome") и не менялся при появлении
  // сессии — экран welcome скрыт (нужен !session), board не выбран → пустой экран.
  useEffect(() => {
    setTab((prev) => {
      if (session && prev === "welcome") return "board";                     // вошёл → сразу «Друзья»
      if (!session && (prev === "board" || prev === "history")) return "welcome"; // вышел → «Начало»
      return prev;
    });
  }, [session]);

  useEffect(() => {
    document.body.classList.toggle("pl-light", theme === "light");
    return () => document.body.classList.remove("pl-light");
  }, [theme]);

  // При переключении вкладки всегда показываем её с самого верха (иначе заголовок
  // обрезается остаточной прокруткой прошлой вкладки).
  useEffect(() => { window.scrollTo({ top: 0, left: 0 }); }, [tab]);

  // «Моя статистика» из кабинета → вкладка «Друзья» (Board сам выберет себя).
  useEffect(() => { if (openSelfStatsNonce > 0) setTab("board"); }, [openSelfStatsNonce]);

  return (
    <div className={`pl-root${theme === "light" ? " pl-light" : ""}`}>
      <style>{css}</style>
      {/* Заголовок вкладки и переключатель лиги убраны — переключатель теперь в топбаре, имя вкладки видно в нижней навигации. */}
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "10px 16px calc(88px + env(safe-area-inset-bottom))" }}>

        {session && !groupId && tab !== "board" && (
          <div className="pl-card pl-pop" style={{ padding: 16, marginBottom: 12, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "var(--mut)", lineHeight: 1.4 }}>{t("welcome_choose_sub")}</div>
            <div style={{ fontSize: 12, color: "var(--lime)", marginTop: 10 }}>{t("league_switch_hint")}</div>
          </div>
        )}

        {tab === "welcome" && !session && <WelcomeScreen onLogin={onLogin} onBrowseGames={() => setTab("games")} onBrowseTournaments={() => setTab("tournaments")} onOpenLanding={onOpenLanding} theme={theme} lang={lang} onThemeToggle={onThemeToggle} onLangChange={onLangChange} />}
        {tab === "board" && (session ? <Board groupId={groupId} players={players} reload={loadLeaderboard} profileId={profileId} bumpArchive={bumpArchive} isAdmin={isAdmin} leagues={leagues} activeLeague={activeLeague} onLeagueChange={onLeagueChange} onLeagueCreated={onLeagueCreated} onEditProfile={onEditProfile} selfStatsNonce={openSelfStatsNonce} /> : <GateScreen />)}
        {tab === "games" && <Games groupId={groupId} players={players} reloadLeaderboard={loadLeaderboard} session={session} archiveNonce={archiveNonce} bumpArchive={bumpArchive} onLogin={onLogin} />}
        {tab === "tournaments" && <Tournaments groupId={groupId} players={players} profileId={profileId} bumpArchive={bumpArchive} session={session} onLogin={onLogin} isAdmin={isAdmin} />}
        {tab === "history" && (session ? <HistoryView groupId={groupId} players={players} profileId={profileId} isGroupMember={!!groupId} archiveNonce={archiveNonce} bumpArchive={bumpArchive} /> : <GateScreen />)}
      </div>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--topbar-bg)", borderTop: "1px solid var(--line)", backdropFilter: "blur(8px)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ maxWidth: 460, margin: "0 auto", display: "flex" }}>
          {!session && <button className={`pl-tab ${tab === "welcome" ? "on" : ""}`} onClick={() => setTab("welcome")}><LogIn size={20} strokeWidth={tab === "welcome" ? 2.6 : 2} />{t("tab_start")}</button>}
          {session && <button className={`pl-tab ${tab === "board" ? "on" : ""}`} onClick={() => setTab("board")}><Trophy size={20} strokeWidth={tab === "board" ? 2.6 : 2} />{t("tab_friends")}</button>}
          <button className={`pl-tab ${tab === "games" ? "on" : ""}`} onClick={() => setTab("games")}><Swords size={20} strokeWidth={tab === "games" ? 2.6 : 2} />{t("tab_games")}</button>
          <button className={`pl-tab ${tab === "tournaments" ? "on" : ""}`} onClick={() => setTab("tournaments")}><Award size={20} strokeWidth={tab === "tournaments" ? 2.6 : 2} />{t("tab_tournaments")}</button>
          {session && <button className={`pl-tab ${tab === "history" ? "on" : ""}`} onClick={() => setTab("history")}><History size={20} strokeWidth={tab === "history" ? 2.6 : 2} />{t("tab_history")}</button>}
        </div>
      </nav>
    </div>
  );
}


/* -------------------------------- GateScreen ------------------------------ */
function GateScreen() {
  return (
    <div className="pl-pop" style={{ textAlign: "center", padding: "40px 16px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <div className="pl-display" style={{ fontSize: 20, marginBottom: 8 }}>{t("gate_title")}</div>
      <div style={{ color: "var(--mut)", fontSize: 14, lineHeight: 1.5, maxWidth: 280, margin: "0 auto" }}>
        {t("gate_sub")}
      </div>
    </div>
  );
}

/* ------------------------------ WelcomeScreen ----------------------------- */
function WelcomeScreen({ onLogin, onBrowseGames, onBrowseTournaments, onOpenLanding, theme = "dark", lang = "ru", onThemeToggle, onLangChange }) {
  // Карточки = «что делать дальше» (онбординг), а не повтор витрины с лендинга.
  const features = [
    { icon: "🏆", title: t("feat_board_title"), sub: t("feat_board_sub") },   // создать/вступить в лигу
    { icon: "🔗", title: t("feat_stats_title"), sub: t("feat_stats_sub") },   // игры по ссылке
    { icon: "🎖️", title: t("feat_tour_title"), sub: t("feat_tour_sub") },     // уровни и ачивки
    { icon: "🎾", title: t("feat_pwa_title"), sub: t("feat_pwa_sub") },       // турниры
  ];
  return (
    <div className="pl-pop">
      {/* Hero */}
      <div style={{ textAlign: "center", padding: "28px 0 22px" }}>
        <img src={theme === "light" ? "/logo-mark-light.webp" : "/logo-mark-dark.webp"} alt="PadelPack" style={{ width: 60, height: 60, borderRadius: 16, margin: "0 auto 12px", display: "block", boxShadow: "0 8px 24px -10px rgba(0,0,0,.6)" }} />
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}><Logo theme={theme} showTagline /></div>
        <div style={{ fontSize: 14, color: "var(--mut)", lineHeight: 1.6, maxWidth: 270, margin: "10px auto 0" }}>
          {t("welcome_tagline")}
        </div>
      </div>

      {/* Feature cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
        {features.map(({ icon, title, sub }) => (
          <div key={title} className="pl-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px" }}>
            <div style={{ fontSize: 24, flexShrink: 0, width: 32, textAlign: "center" }}>{icon}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
              <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 2 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button className="pl-btn" style={{ width: "100%", padding: 15, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={onLogin}>
        {t("welcome_cta")}
      </button>
      <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--mut)" }}>
        {t("welcome_code_hint")}
      </div>

      {onOpenLanding && (
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button onClick={onOpenLanding} style={{ background: "none", border: "none", color: "var(--lime)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
            {t("lp_about")}
          </button>
        </div>
      )}

      {/* Lang + theme controls */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 18, flexWrap: "wrap" }}>
        <button onClick={() => { const o = ["ru", "en", "es"]; onLangChange?.(o[(o.indexOf(lang) + 1) % o.length]); }} style={{
          border: "1px solid var(--line)", borderRadius: 10, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
          background: "var(--surface2)", color: "var(--ink)", fontFamily: "'Outfit',sans-serif", display: "flex", alignItems: "center", gap: 6,
        }}>{lang.toUpperCase()} <span style={{ color: "var(--mut)", fontWeight: 400 }}>↻</span></button>
        <button onClick={onThemeToggle} style={{
          border: "1px solid var(--line)", borderRadius: 10, padding: "5px 9px",
          background: "var(--surface2)", color: "var(--mut)", cursor: "pointer",
          display: "flex", alignItems: "center", fontFamily: "'Outfit',sans-serif",
        }}>
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- Board ---------------------------------- */
function Board({ groupId, players, reload, profileId, bumpArchive, isAdmin, leagues, activeLeague, onLeagueChange, onLeagueCreated, onEditProfile, selfStatsNonce = 0 }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [netPlayers, setNetPlayers] = useState([]);
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState({ whatsapp: "", telegram: "", email: "", phone: "" });
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tourCounts, setTourCounts] = useState({});
  const [tourCountsByName, setTourCountsByName] = useState({});
  const [srv, setSrv] = useState(null);
  const [matchCounts, setMatchCounts] = useState({});
  const [streaks, setStreaks] = useState({});
  const [extraPlayers, setExtraPlayers] = useState([]);
  const [showLeagueMenu, setShowLeagueMenu] = useState(false);
  const [showNewLeague, setShowNewLeague] = useState(false); // "create" | "join" | false
  const [newLeagueName, setNewLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [leagueBusy, setLeagueBusy] = useState(false);
  const [leagueErr, setLeagueErr] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [publicLinkCopied, setPublicLinkCopied] = useState(false);
  const ranked = [...players].sort((a, b) => b.rating - a.rating);

  // «Моя статистика» из кабинета: открываем карточку текущего игрока, когда счётчик меняется.
  const lastStatsNonce = useRef(0);
  useEffect(() => {
    if (selfStatsNonce > 0 && selfStatsNonce !== lastStatsNonce.current && players.length) {
      const self = players.find((p) => p.id === profileId);
      if (self) { lastStatsNonce.current = selfStatsNonce; setSelected(self); }
    }
  }, [selfStatsNonce, players, profileId]);

  const gamesOf = (p) => srv ? (srv.games[p.id] ?? 0) : (matchCounts[p.id] || p.matches || 0);
  const toursOf = (p) => srv ? (srv.tours[p.id] ?? 0) : (tourCounts[p.id] || tourCountsByName[(p.name || "").trim().toLowerCase()] || 0);

  useEffect(() => {
    let active = true;
    if (!groupId) { setSrv(null); setExtraPlayers([]); setTourCounts({}); setTourCountsByName({}); setMatchCounts({}); setStreaks({}); return () => { active = false; }; }
    const memberIds = new Set(players.map((p) => p.id));
    Promise.all([
      listTournaments(groupId),
      getBoardMatches(groupId),
    ]).then(async ([tours, matchRows]) => {
      if (!active) return;
      // tourCounts
      const counts = {};
      const countsByName = {};
      tours.filter((tour) => tour.status === "finished" || tour.status === "active").forEach((tour) => {
        (tour.players || []).forEach((p) => {
          if (p.profile_id) counts[p.profile_id] = (counts[p.profile_id] || 0) + 1;
          else if (p.name) { const k = p.name.trim().toLowerCase(); countsByName[k] = (countsByName[k] || 0) + 1; }
        });
      });
      setTourCounts(counts);
      setTourCountsByName(countsByName);
      const mc = {};
      (matchRows || []).forEach((m) => {
        [...new Set([...(m.team_a || []), ...(m.team_b || [])])].forEach((id) => { if (id) mc[id] = (mc[id] || 0) + 1; });
      });
      if (active) setMatchCounts(mc);
      // Win streaks: traverse matches newest-first per player
      const rows = (matchRows || []);
      const sk = {};
      const streakIds = [...new Set(rows.flatMap((m) => [...(m.team_a || []), ...(m.team_b || [])]))];
      streakIds.forEach((id) => {
        let streak = 0;
        for (let i = rows.length - 1; i >= 0; i--) {
          const m = rows[i];
          const inA = (m.team_a || []).includes(id);
          const inB = (m.team_b || []).includes(id);
          if (!inA && !inB) continue;
          if (m.sets_a === m.sets_b) break; // ничья прерывает серию
          const won = inA ? m.sets_a > m.sets_b : m.sets_b > m.sets_a;
          if (won) streak++; else break;
        }
        if (streak >= 2) sk[id] = streak;
      });
      if (active) setStreaks(sk);
      // Extra (played in group, not member)
      const extraIds = new Set();
      tours.forEach((tour) => {
        (tour.players || []).forEach((p) => {
          if (p.profile_id && !memberIds.has(p.profile_id)) extraIds.add(p.profile_id);
        });
      });
      (matchRows || []).forEach((m) => {
        [...(m.team_a || []), ...(m.team_b || [])].forEach((id) => {
          if (id && !memberIds.has(id)) extraIds.add(id);
        });
      });
      if (extraIds.size > 0) {
        const profiles = await getGroupProfiles(groupId, [...extraIds]).catch(() => []);
        if (active) setExtraPlayers((profiles || []).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        if (active) setExtraPlayers([]);
      }
    }).catch(() => { if (active) { setTourCounts({}); setExtraPlayers([]); } });
    getGroupCounts(groupId).then((c) => { if (active) setSrv(c); }).catch(() => { if (active) setSrv(null); });
    return () => { active = false; };
  }, [groupId, players]);

  useEffect(() => {
    if (open && groupId) getLeagueablePlayers(groupId).then(setNetPlayers).catch(() => setNetPlayers([]));
  }, [open, groupId, players]);

  // Добавить уже существующего игрока (из других лиг) в один тап.
  const addExisting = async (p) => {
    if (busy) return;
    setBusy(true);
    try { await addExistingMember(groupId, p.id); setNetPlayers((prev) => prev.filter((x) => x.id !== p.id)); setQuery(""); reload(); }
    catch (e) { alert("Не удалось добавить игрока"); }
    finally { setBusy(false); }
  };

  // Создать нового гостя по введённому имени (контакты заполняются в профиле).
  const addGuest = async () => {
    const n = query.trim();
    if (!n || busy) return;
    setBusy(true);
    try { await addMember(groupId, n, {}); setQuery(""); reload(); }
    catch (e) { alert("Не удалось добавить игрока"); }
    finally { setBusy(false); }
  };

  if (selected) return (
    <PlayerDetail groupId={groupId} player={selected} players={players} close={() => setSelected(null)}
      isAdmin={isAdmin} onEditProfile={onEditProfile}
      onAddToLeague={isAdmin ? async () => {
        await supabase.from("group_members").insert({ group_id: groupId, profile_id: selected.id, rating: 1000 });
        reload();
        setSelected(null);
      } : undefined}
      onDelete={isAdmin ? async (deleteGames) => {
        await removeMember(groupId, selected.id);
        if (deleteGames) {
          const { data: slots } = await supabase.from("game_slots").select("game_id").eq("profile_id", selected.id);
          const gameIds = [...new Set((slots || []).map((s) => s.game_id))];
          if (gameIds.length > 0) { await supabase.from("games").delete().in("id", gameIds); bumpArchive && bumpArchive(); }
        }
        reload();
        setSelected(null);
      } : undefined}
    />
  );

  const copyInvite = async () => {
    if (!activeLeague?.invite_code) return;
    const text = `Вступай в лигу «${activeLeague.name}» — код: ${activeLeague.invite_code}`;
    try { await navigator.clipboard.writeText(text); } catch (e) {}
    setInviteCopied(true); setTimeout(() => setInviteCopied(false), 1800);
  };

  const copyPublicLink = async () => {
    if (!activeLeague?.invite_code) return;
    const url = `${window.location.origin}/l/${activeLeague.invite_code}`;
    try { await navigator.clipboard.writeText(url); } catch (e) {}
    setPublicLinkCopied(true); setTimeout(() => setPublicLinkCopied(false), 1800);
  };

  const handleCreateLeague = async () => {
    if (!newLeagueName.trim() || leagueBusy) return;
    setLeagueBusy(true); setLeagueErr("");
    try {
      const lg = await createLeague(newLeagueName.trim());
      onLeagueCreated && onLeagueCreated(lg);
      setShowNewLeague(false); setNewLeagueName("");
    } catch (e) { setLeagueErr(e.message || "Ошибка"); }
    finally { setLeagueBusy(false); }
  };

  const handleJoinLeague = async () => {
    if (joinCode.trim().length < 4 || leagueBusy) return;
    setLeagueBusy(true); setLeagueErr("");
    try {
      const lg = await joinLeague(joinCode.trim());
      onLeagueCreated && onLeagueCreated(lg);
      setShowNewLeague(false); setJoinCode("");
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("league_not_found")) setLeagueErr("Лига не найдена");
      else if (msg.includes("already_member")) setLeagueErr("Вы уже в этой лиге");
      else setLeagueErr(msg || "Ошибка");
    } finally { setLeagueBusy(false); }
  };

  return (
    <div className="pl-pop">
      {/* Без лиги — короткая подсказка; выбор/создание лиги теперь в переключателе в шапке. */}
      {(!leagues || leagues.length === 0) && (
        <div className="pl-card pl-pop" style={{ padding: 16, marginBottom: 12, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--mut)", lineHeight: 1.4 }}>{t("welcome_choose_sub")}</div>
          <div style={{ fontSize: 12, color: "var(--lime)", marginTop: 10 }}>{t("league_switch_hint")}</div>
        </div>
      )}

      {/* Код приглашения + публичная страница */}
      {activeLeague?.invite_code && (
        <div style={{ width: "100%", marginBottom: 12, padding: "12px 16px", background: "color-mix(in srgb, var(--lime) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 40%, transparent)", borderRadius: 14, fontFamily: "'Outfit'" }}>
          <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 4 }}>{t("league_invite_label")}</div>
          <div style={{ fontFamily: "'Anton'", fontSize: 24, letterSpacing: 5, color: "var(--lime)", marginBottom: 10 }}>{activeLeague.invite_code}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copyInvite} style={{ flex: 1, padding: "7px 0", background: "color-mix(in srgb, var(--lime) 18%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 35%, transparent)", borderRadius: 10, color: "var(--lime)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "'Outfit'" }}>
              {inviteCopied ? t("code_copied") : <><Copy size={12} /> {t("copy_code")}</>}
            </button>
            <button onClick={copyPublicLink} style={{ flex: 1, padding: "7px 0", background: "color-mix(in srgb, var(--lime) 18%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 35%, transparent)", borderRadius: 10, color: "var(--lime)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "'Outfit'" }}>
              {publicLinkCopied ? t("page_copied") : <><Share2 size={12} /> {t("league_page")}</>}
            </button>
          </div>
        </div>
      )}

      {groupId && ranked.length === 0 && (
        <div className="pl-card" style={{ padding: 20, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t("onboarding_title")}</div>
          {[
            { n: 1, icon: "👤", text: t("onboarding_1_text"), sub: isAdmin ? t("onboarding_1_sub_admin") : t("onboarding_1_sub_member") },
            { n: 2, icon: "⚔️", text: t("onboarding_2_text"), sub: t("onboarding_2_sub") },
            { n: 3, icon: "📣", text: t("onboarding_3_text"), sub: activeLeague?.invite_code ? t("onboarding_3_sub_code").replace("{code}", activeLeague.invite_code) : t("onboarding_3_sub_no_code") },
          ].map(({ n, icon, text, sub }) => (
            <div key={n} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--lime)", flexShrink: 0 }}>{n}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{icon} {text}</div>
                <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 2 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {groupId && ranked.map((p, i) => {
        const qb = [];
        if (i === 0) qb.push("👑");
        if (p.matches >= 5 && p.wins / p.matches >= 0.7) qb.push("🎯");
        if (p.matches >= 20) qb.push("⚡");
        if (toursOf(p) >= 3) qb.push("🏆");
        return (
          <div key={p.id} className="pl-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }} onClick={() => setSelected(p)}>
            <div className="pl-display" style={{ width: 22, fontSize: 22, color: ["var(--yellow)", "#cfd8d0", "#cd7f4d"][i] || "var(--mut)" }}>{i + 1}</div>
            <img src={playerAvatar(p.avatar_url, p.id)} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, fontSize: 12, color: "var(--mut)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={t("tab_games")}><Swords size={13} /> {gamesOf(p)}</span><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={t("tab_tournaments")}><Award size={13} /> {toursOf(p)}</span></span>
                {(() => { const lv = playerLevel(p.matches, p.rating); return <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: `color-mix(in srgb, ${lv.color} 15%, transparent)`, color: lv.color, border: `1px solid color-mix(in srgb, ${lv.color} 35%, transparent)` }}>{lv.label}</span>; })()}
                {qb.length > 0 && <span style={{ letterSpacing: 2 }}>{qb.join("")}</span>}
                {streaks[p.id] && <span style={{ color: "var(--coral)", fontWeight: 600 }}>🔥{streaks[p.id]}</span>}
              </div>
            </div>
            {p.contacts && Object.values(p.contacts).some(Boolean) && (
              <div style={{ fontSize: 10, color: "var(--lime)", flexShrink: 0 }}>📞</div>
            )}
            <ChevronRight size={14} style={{ color: "var(--mut)", flexShrink: 0 }} />
          </div>
        );
      })}

      {!groupId && (ranked.filter((p) => p.id !== profileId).length > 0 ? (
        <>
          <div className="pl-display" style={{ fontSize: 12, color: "var(--mut)", margin: "4px 2px 8px", letterSpacing: 1 }}>{t("played_together_label")}</div>
          {ranked.filter((p) => p.id !== profileId).map((p) => (
            <div key={p.id} className="pl-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", marginBottom: 8 }}>
              <img src={playerAvatar(p.avatar_url, p.id)} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "var(--mut)", display: "inline-flex", alignItems: "center", gap: 4 }}><Swords size={13} /> {p.matches}</div>
              </div>
            </div>
          ))}
        </>
      ) : (
        <EmptyState text={t("solo_friends_empty")} />
      ))}

      {groupId && (open ? (
        <div className="pl-card" style={{ padding: 14, marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontWeight: 600 }}>{t("add_player_form_title")}</span>
            <button className="pl-ghost" style={{ padding: "2px 8px" }} onClick={() => { setQuery(""); setOpen(false); }}><X size={16} /></button>
          </div>
          <input className="pl-input" style={{ padding: "10px 12px" }} placeholder={t("add_search_placeholder")} value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGuest()} autoFocus />
          {query.trim() && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {netPlayers.filter((p) => (p.name || "").toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6).map((p) => (
                <button key={p.id} disabled={busy} onClick={() => addExisting(p)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, cursor: "pointer", color: "var(--ink)", fontFamily: "'Outfit'", textAlign: "left" }}>
                  <img src={playerAvatar(p.avatar_url, p.id)} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  {p.registered && <span style={{ fontSize: 10, color: "var(--lime)", flexShrink: 0 }}>{t("account_badge")}</span>}
                </button>
              ))}
              <button className="pl-btn" disabled={busy} style={{ padding: 10, textAlign: "left" }} onClick={addGuest}>
                {t("add_guest_prefix")} «{query.trim()}»
              </button>
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 10, lineHeight: 1.4 }}>{t("add_player_hint")}</div>
        </div>
      ) : (
        <button className="pl-ghost" style={{ width: "100%", padding: 12, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 600 }} onClick={() => setOpen(true)}>
          <Users size={18} /> {t("add_player")}
        </button>
      ))}

      {extraPlayers.length > 0 && (
        <>
          <div className="pl-display" style={{ fontSize: 12, color: "var(--mut)", margin: "14px 2px 8px", letterSpacing: 1 }}>{t("played_together_label")}</div>
          {extraPlayers.map((p) => (
            <div key={p.id} className="pl-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", marginBottom: 8, cursor: "pointer" }} onClick={() => setSelected(p)}>
              <img src={playerAvatar(p.avatar_url, p.id)} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "var(--mut)" }}>{t("not_in_league")}</div>
              </div>
              {p.contacts && Object.values(p.contacts).some(Boolean) && (
                <div style={{ fontSize: 10, color: "var(--lime)", flexShrink: 0 }}>📞</div>
              )}
              <ChevronRight size={14} style={{ color: "var(--mut)", flexShrink: 0 }} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* -------------------- DeletePlayerModal ---------------------------------- */
function DeletePlayerModal({ player, onConfirm, onCancel }) {
  const [deleteGames, setDeleteGames] = useState(false);
  const [gameCount, setGameCount] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("game_slots").select("game_id").eq("profile_id", player.id)
      .then(({ data }) => setGameCount(new Set((data || []).map((s) => s.game_id)).size))
      .catch(() => setGameCount(0));
  }, [player.id]);

  const go = async () => {
    setBusy(true);
    try { await onConfirm(deleteGames); }
    catch (e) { alert("Не удалось удалить"); setBusy(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
      <div className="pl-card" style={{ padding: 20, width: "100%", maxWidth: 360 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{t("delete_player_prefix")} {player.name}?</div>
        <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 14 }}>
          {t("delete_player_sub")}
        </div>
        {gameCount === null && <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 12 }}>{t("checking_games")}</div>}
        {gameCount > 0 && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, cursor: "pointer" }}>
            <input type="checkbox" checked={deleteGames} onChange={(e) => setDeleteGames(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--coral)", flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>
              {t("delete_games_label_pre")} <strong>{gameCount} {t("delete_games_count_suffix")}</strong> {t("delete_games_label_post")}
            </span>
          </label>
        )}
        {gameCount === 0 && <div style={{ height: 4 }} />}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="pl-ghost" style={{ flex: 1, padding: 11 }} onClick={onCancel} disabled={busy}>{t("cancel")}</button>
          <button style={{ flex: 1, padding: 11, border: "none", borderRadius: 12, background: "var(--coral)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: (busy || gameCount === null) ? .6 : 1 }}
            onClick={go} disabled={busy || gameCount === null}>
            {busy ? t("deleting") : t("delete_btn")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- ClaimLinkButton ------------------------------------ */
function ClaimLinkButton({ claimCode }) {
  const [toast, setToast] = useState("");
  const link = `${window.location.origin}/r/${claimCode}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); }
    catch (e) {}
    setToast(t("copied"));
    setTimeout(() => setToast(""), 2200);
  };
  return (
    <div style={{ marginTop: 12, width: "100%" }}>
      <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 6, textAlign: "center" }}>
        {t("claim_link_label")}
      </div>
      <button onClick={copy} style={{
        width: "100%", padding: "10px 14px", background: "rgba(200,255,45,.08)",
        border: "1px solid rgba(200,255,45,.45)", borderRadius: 12, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 8, fontFamily: "'Outfit'", color: "var(--lime)", fontSize: 13, fontWeight: 600,
      }}>
        <Share2 size={15} />
        {toast || t("copy_link")}
      </button>
      <div style={{ fontSize: 10, color: "var(--mut)", marginTop: 5, textAlign: "center", wordBreak: "break-all" }}>
        {link}
      </div>
    </div>
  );
}

/* ----------------------------- PlayerDetail ------------------------------- */
function PlayerDetail({ groupId, player, players, close, onDelete, isAdmin, onAddToLeague, onEditProfile }) {
  const [hist, setHist] = useState(null);
  const [myId, setMyId] = useState(null);
  const [allMatches, setAllMatches] = useState(null);
  const [playerTours, setPlayerTours] = useState(null);
  const [rawTours, setRawTours] = useState(null);
  const [tourH2H, setTourH2H] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playerLeagues, setPlayerLeagues] = useState(null);
  const [localClaimCode, setLocalClaimCode] = useState(player.claim_code || null);
  const [genBusy, setGenBusy] = useState(false);
  const [showG, setShowG] = useState(false); // развернуть списки игр/турниров/лиг
  const [showT, setShowT] = useState(false);
  const [showL, setShowL] = useState(false);
  const isInLeague = players.some((p) => p.id === player.id);

  const generateClaimCode = async () => {
    setGenBusy(true);
    const code = crypto.randomUUID();
    await supabase.from("profiles").update({ claim_code: code }).eq("id", player.id);
    setLocalClaimCode(code);
    setGenBusy(false);
  };

  useEffect(() => {
    getRatingHistory(groupId, player.id).then(setHist).catch(() => setHist([player.rating]));

    // Определяем свой profile_id
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => { if (data) setMyId(data.id); });
    });

    // Загружаем матчи группы для статистики
    getStatMatches(groupId).then((data) => setAllMatches(data || []));

    // Лиги игрока
    supabase.from("group_members")
      .select("role, group:groups(id, name)")
      .eq("profile_id", player.id)
      .then(({ data }) => setPlayerLeagues((data || []).map((r) => ({ id: r.group.id, name: r.group.name, role: r.role }))));

    // Загружаем турниры игрока
    listTournaments(groupId).then((all) => {
      const finished = all.filter((tour) => tour.status === "finished");
      const participated = finished.filter((tour) =>
        (tour.players || []).some((p) => p.profile_id === player.id)
      );
      setRawTours(participated);
      const rows = participated.map((tour) => {
        const tPlayers = (tour.players || []).map((p) => ({ id: p.id, name: p.name }));
        // как на экране турнира: считаем только матчи реальных раундов (round_number > 0)
        const table = detailedStandings(tPlayers, (tour.matches || []).filter((m) => (m.round_number || 0) > 0));
        const myTp = (tour.players || []).find((p) => p.profile_id === player.id);
        const pos = table.findIndex((r) => r.id === myTp?.id);
        const row = table[pos] || {};
        return {
          id: tour.id,
          name: tour.name,
          position: pos + 1,
          total: table.length,
          points: row.points || 0,
          played: row.played || 0,
        };
      });
      setPlayerTours(rows);
    }).catch(() => setPlayerTours([]));
  }, [groupId, player.id]);

  // Турнирный H2H — пересчитываем когда оба (rawTours и myId) готовы
  useEffect(() => {
    if (!rawTours || !myId || myId === player.id) { setTourH2H(null); return; }
    let toWins = 0, toLosses = 0, toDraws = 0;
    let vsWins = 0, vsLosses = 0, vsDraws = 0;
    rawTours.forEach((t) => {
      const myTp = (t.players || []).find((p) => p.profile_id === myId);
      const theirTp = (t.players || []).find((p) => p.profile_id === player.id);
      if (!myTp || !theirTp) return;
      (t.matches || []).forEach((m) => {
        if (m.score_a == null) return; // незавершённый
        const myInA = (m.team_a || []).includes(myTp.id);
        const myInB = (m.team_b || []).includes(myTp.id);
        const thInA = (m.team_a || []).includes(theirTp.id);
        const thInB = (m.team_b || []).includes(theirTp.id);
        if (!myInA && !myInB) return;
        if (!thInA && !thInB) return;
        const together = (myInA && thInA) || (myInB && thInB);
        const myTeamWon = myInA ? m.score_a > m.score_b : m.score_b > m.score_a;
        const isDraw = m.score_a === m.score_b;
        if (together) { if (isDraw) toDraws++; else if (myTeamWon) toWins++; else toLosses++; }
        else          { if (isDraw) vsDraws++; else if (myTeamWon) vsWins++; else vsLosses++; }
      });
    });
    const toTotal = toWins + toLosses + toDraws;
    const vsTotal = vsWins + vsLosses + vsDraws;
    setTourH2H(toTotal + vsTotal > 0 ? { toWins, toLosses, toDraws, toTotal, vsWins, vsLosses, vsDraws, vsTotal } : null);
  }, [rawTours, myId, player.id]);

  const nameOf = (id) => players.find((p) => p.id === id)?.name || t("player_deleted");

  // Матчи, в которых участвуют оба (я + выбранный игрок)
  const withPlayer = !myId || !allMatches ? [] : allMatches.filter((m) => {
    const all = [...(m.team_a || []), ...(m.team_b || [])];
    return all.includes(myId) && all.includes(player.id);
  });

  // Разбиваем на "вместе" и "против"
  let toWins = 0, toLosses = 0, toDraws = 0; // together
  let vsWins = 0, vsLosses = 0, vsDraws = 0; // versus
  withPlayer.forEach((m) => {
    const myInA = (m.team_a || []).includes(myId);
    const thInA = (m.team_a || []).includes(player.id);
    const together = myInA === thInA;
    const myTeamWon = myInA ? m.sets_a > m.sets_b : m.sets_b > m.sets_a;
    const isDraw = m.sets_a === m.sets_b;
    if (together) {
      if (isDraw) toDraws++; else if (myTeamWon) toWins++; else toLosses++;
    } else {
      if (isDraw) vsDraws++; else if (myTeamWon) vsWins++; else vsLosses++;
    }
  });
  const toTotal = toWins + toLosses + toDraws;
  const vsTotal = vsWins + vsLosses + vsDraws;

  // Best partner (most wins when teamed together)
  const bestPartner = (() => {
    if (!allMatches) return null;
    const stats = {};
    allMatches.forEach((m) => {
      const pInA = (m.team_a || []).includes(player.id);
      const pInB = (m.team_b || []).includes(player.id);
      if (!pInA && !pInB) return;
      const teammates = pInA ? (m.team_a || []) : (m.team_b || []);
      const pWon = pInA ? m.sets_a > m.sets_b : m.sets_b > m.sets_a;
      const isDraw = m.sets_a === m.sets_b;
      teammates.forEach((tid) => {
        if (tid === player.id) return;
        if (!stats[tid]) stats[tid] = { w: 0, l: 0, d: 0 };
        if (isDraw) stats[tid].d++; else if (pWon) stats[tid].w++; else stats[tid].l++;
      });
    });
    let best = null, bestRate = -1;
    Object.entries(stats).forEach(([id, s]) => {
      const total = s.w + s.l + s.d;
      if (total < 2) return;
      const rate = s.w / total;
      if (rate > bestRate) { bestRate = rate; best = { id, w: s.w, l: s.l, d: s.d, total, rate }; }
    });
    return best;
  })();

  // Ачивки
  const badges = (() => {
    const result = [];
    const rankedAll = [...players].sort((a, b) => b.rating - a.rating);
    if (rankedAll.length > 0 && rankedAll[0].id === player.id)
      result.push({ id: "leader", icon: "👑", label: t("badge_leader"), title: t("badge_leader_title") });
    if (player.matches >= 5 && player.wins / player.matches >= 0.7)
      result.push({ id: "sniper", icon: "🎯", label: t("badge_sniper"), title: t("badge_sniper_title") });
    if (player.matches >= 20)
      result.push({ id: "veteran", icon: "⚡", label: t("badge_veteran"), title: t("badge_veteran_title") });
    if (hist && hist.length >= 4 && hist[hist.length - 1] > hist[hist.length - 2] && hist[hist.length - 2] > hist[hist.length - 3])
      result.push({ id: "rising", icon: "🔥", label: t("badge_rising"), title: t("badge_rising_title") });
    if (playerTours && playerTours.length >= 3)
      result.push({ id: "tourney", icon: "🏆", label: t("badge_tourney"), title: t("badge_tourney_title") });
    return result;
  })();

  const statRow = (label, w, d, l, total) => total === 0 ? null : (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, color: "#3ddc84" }}>{w}</div>
          <div style={{ fontSize: 10, color: "var(--mut)" }}>{t("stat_wins")}</div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, color: "var(--ink)" }}>{d}</div>
          <div style={{ fontSize: 10, color: "var(--mut)" }}>{t("stat_draws")}</div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, color: "var(--coral)" }}>{l}</div>
          <div style={{ fontSize: 10, color: "var(--mut)" }}>{t("stat_losses")}</div>
        </div>
        <div style={{ flex: 2, height: 6, borderRadius: 3, overflow: "hidden", background: "var(--surface2)", display: "flex" }}>
          {w > 0 && <div style={{ flex: w, background: "#3ddc84" }} />}
          {d > 0 && <div style={{ flex: d, background: "#7d9488" }} />}
          {l > 0 && <div style={{ flex: l, background: "var(--coral)" }} />}
        </div>
      </div>
    </div>
  );

  const myGames = (() => {
    let w = 0, l = 0, d = 0;
    (allMatches || []).forEach((m) => {
      const inA = (m.team_a || []).includes(player.id);
      const inB = (m.team_b || []).includes(player.id);
      if (!inA && !inB) return;
      if (m.sets_a === m.sets_b) { d++; return; }
      const won = inA ? m.sets_a > m.sets_b : m.sets_b > m.sets_a;
      if (won) w++; else l++;
    });
    return { w, l, d, total: w + l + d };
  })();
  const myTourStats = (() => {
    const list = playerTours || [];
    return {
      total: list.length,
      podium: list.filter((r) => r.position >= 1 && r.position <= 3).length,
      wins: list.filter((r) => r.position === 1).length,
    };
  })();
  const tileStat = (n, label, color) => (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, color }}>{n}</div>
      <div style={{ fontSize: 10, color: "var(--mut)", marginTop: 2 }}>{label}</div>
    </div>
  );

  // Все матчи игрока (для блока «Игры»), новые сверху.
  const playerMatches = (allMatches || [])
    .filter((m) => [...(m.team_a || []), ...(m.team_b || [])].includes(player.id))
    .sort((a, b) => (b.played_at || "").localeCompare(a.played_at || ""));

  // Кнопка «ещё N / свернуть» для списков длиннее 3.
  const moreBtn = (count, expanded, onToggle) => count > 3 && (
    <button className="pl-ghost" style={{ width: "100%", padding: "8px 0", marginTop: 8, fontSize: 12, color: "var(--mut)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }} onClick={onToggle}>
      {expanded ? <><ChevronUp size={13} /> {t("trn_collapse")}</> : <><ChevronDown size={13} /> {t("show_more")} {count - 3}</>}
    </button>
  );

  return (
    <div className="pl-pop">
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <button className="pl-ghost" style={{ padding: "6px 12px" }} onClick={close}>
          <ArrowLeft size={14} style={{ display: "inline", marginRight: 4 }} />{t("back")}
        </button>
        {onEditProfile && myId && myId === player.id && (
          <button className="pl-ghost" style={{ padding: "6px 12px", marginLeft: "auto", color: "var(--lime)", borderColor: "color-mix(in srgb, var(--lime) 35%, transparent)" }} onClick={onEditProfile}>
            {t("pc_title")}
          </button>
        )}
      </div>

      {/* Шапка игрока */}
      <div className="pl-card" style={{ padding: 18, marginBottom: 10, textAlign: "center" }}>
        <img src={playerAvatar(player.avatar_url, player.id)} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--line)", marginBottom: 8 }} />
        <div className="pl-display" style={{ fontSize: 24 }}>{player.name}</div>
        {badges.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 10 }}>
            {badges.map((b) => (
              <span key={b.id} title={b.title} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 10px", borderRadius: 20,
                background: "color-mix(in srgb, var(--lime) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--lime) 30%, transparent)",
                fontSize: 11, fontWeight: 600, color: "var(--lime)",
              }}>
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        )}
        {(() => { const lv = playerLevel(player.matches, player.rating); return (
          <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, background: `color-mix(in srgb, ${lv.color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${lv.color} 35%, transparent)`, color: lv.color, fontSize: 12, fontWeight: 700 }}>
            ⭐ {lv.label}
          </div>
        ); })()}
        <ContactLinks contacts={player.contacts} />
        {!player.user_id && (localClaimCode
          ? <ClaimLinkButton claimCode={localClaimCode} />
          : isAdmin && (
            <button onClick={generateClaimCode} disabled={genBusy}
              style={{ marginTop: 12, padding: "8px 16px", border: "1px solid rgba(200,255,45,.4)", borderRadius: 10, background: "rgba(200,255,45,.07)", color: "var(--lime)", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Outfit'" }}>
              <Share2 size={13} /> {genBusy ? t("creating") : t("create_claim_link")}
            </button>
          )
        )}
        {onAddToLeague && !isInLeague && (
          <button onClick={onAddToLeague}
            style={{ marginTop: 10, padding: "8px 16px", border: "none", borderRadius: 10, background: "var(--lime)", color: "#111", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Outfit'" }}>
            {t("add_to_league")}
          </button>
        )}
        {onDelete && isAdmin && myId && myId !== player.id && isInLeague && (
          <button onClick={() => setShowDeleteModal(true)}
            style={{ marginTop: 10, padding: "6px 14px", border: "1px solid rgba(255,106,82,.35)", borderRadius: 10, background: "none", color: "var(--coral)", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Trash2 size={12} /> {t("remove_from_league")}
          </button>
        )}
      </div>

      {/* Рейтинг + график */}
      <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <div className="pl-display" style={{ fontSize: 36, color: "var(--lime)" }}>{player.rating}</div>
          <div style={{ fontSize: 12, color: "var(--mut)" }}>{t("rating")}</div>
        </div>
        <LineChart values={hist || [player.rating]} />
      </div>

      {/* Плитки: игры и турниры */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div className="pl-card" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--mut)", marginBottom: 10 }}><Swords size={14} /> {t("tab_games")}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {tileStat(myGames.w, t("stat_wins"), "#3ddc84")}
            {tileStat(myGames.d, t("stat_draws"), "var(--ink)")}
            {tileStat(myGames.l, t("stat_losses"), "var(--coral)")}
          </div>
        </div>
        <div className="pl-card" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--mut)", marginBottom: 10 }}><Award size={14} /> {t("tab_tournaments")}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {tileStat(myTourStats.total, t("trn_stat_total"), "var(--ink)")}
            {tileStat(myTourStats.podium, t("trn_stat_podium"), "#ffd23f")}
            {tileStat(myTourStats.wins, t("trn_stat_wins"), "var(--lime)")}
          </div>
        </div>
      </div>

      {/* Лучший партнёр */}
      {bestPartner && (() => {
        const bp = players.find((p) => p.id === bestPartner.id);
        return (
          <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{t("best_partner")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={playerAvatar(bp?.avatar_url, bestPartner.id)} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{bp?.name || "?"}</div>
                <div style={{ fontSize: 12, color: "var(--mut)" }}>{bestPartner.w} {t("wins_short")} · {bestPartner.l} {t("losses_short")} · {bestPartner.total} {t("matches")}</div>
              </div>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, color: "var(--lime)", flexShrink: 0 }}>{Math.round(bestPartner.rate * 100)}%</div>
            </div>
          </div>
        );
      })()}

      {/* Статистика с этим игроком */}
      {myId && myId !== player.id && withPlayer.length > 0 && (
        <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{t("stat_with_matches_pre")} {withPlayer.length} {t("matches")}</div>
          {statRow(t("stat_same_team"), toWins, toDraws, toLosses, toTotal)}
          {statRow(t("stat_vs_each_other"), vsWins, vsDraws, vsLosses, vsTotal)}
        </div>
      )}

      {/* H2H в турнирах */}
      {tourH2H && (
        <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Trophy size={13} color="var(--lime)" />
            <div style={{ fontSize: 13, fontWeight: 600 }}>{t("tour_h2h_header")}</div>
          </div>
          {statRow(t("stat_same_team_tour"), tourH2H.toWins, tourH2H.toDraws, tourH2H.toLosses, tourH2H.toTotal)}
          {statRow(t("stat_vs_each_other_tour"), tourH2H.vsWins, tourH2H.vsDraws, tourH2H.vsLosses, tourH2H.vsTotal)}
        </div>
      )}

      {/* Последние совместные игры */}
      {myId && myId !== player.id && withPlayer.length > 0 && (
        <div className="pl-card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{t("recent_games_together")}</div>
          {withPlayer.slice(0, 5).map((m) => {
            const myInA = (m.team_a || []).includes(myId);
            const thInA = (m.team_a || []).includes(player.id);
            const together = myInA === thInA;
            const myTeamWon = myInA ? m.sets_a > m.sets_b : m.sets_b > m.sets_a;
            const isDraw = m.sets_a === m.sets_b;
            const result = isDraw ? t("result_draw") : myTeamWon ? t("result_win") : t("result_loss");
            const resultColor = isDraw ? "var(--mut)" : myTeamWon ? "#3ddc84" : "var(--coral)";
            const teamA = (m.team_a || []).map(nameOf).join(" & ");
            const teamB = (m.team_b || []).map(nameOf).join(" & ");
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: isDraw ? "var(--surface2)" : myTeamWon ? "rgba(61,220,132,.15)" : "rgba(255,106,82,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: resultColor, flexShrink: 0 }}>
                  {isDraw ? t("result_draw") : myTeamWon ? t("result_win") : t("result_loss")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--mut)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {teamA} <span style={{ color: "var(--line)" }}>vs</span> {teamB}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--mut)" }}>{together ? t("together") : t("versus")} · {fmtDate(m.played_at)}</div>
                </div>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{m.sets_a}:{m.sets_b}</div>
              </div>
            );
          })}
        </div>
      )}
      {/* Игры */}
      {playerMatches.length > 0 && (
        <div className="pl-card" style={{ padding: 14, marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{t("games_heading")} ({playerMatches.length})</div>
          {(showG ? playerMatches : playerMatches.slice(0, 3)).map((m) => {
            const inA = (m.team_a || []).includes(player.id);
            const draw = m.sets_a === m.sets_b;
            const won = inA ? m.sets_a > m.sets_b : m.sets_b > m.sets_a;
            const rc = draw ? "var(--mut)" : won ? "#3ddc84" : "var(--coral)";
            const teamA = (m.team_a || []).map(nameOf).join(" & ");
            const teamB = (m.team_b || []).map(nameOf).join(" & ");
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: draw ? "var(--surface2)" : won ? "rgba(61,220,132,.15)" : "rgba(255,106,82,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: rc, flexShrink: 0 }}>
                  {draw ? t("result_draw") : won ? t("result_win") : t("result_loss")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--mut)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamA} <span style={{ color: "var(--line)" }}>vs</span> {teamB}</div>
                  {m.played_at && <div style={{ fontSize: 10, color: "var(--mut)" }}>{fmtDate(m.played_at)}</div>}
                </div>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{m.sets_a}:{m.sets_b}</div>
              </div>
            );
          })}
          {moreBtn(playerMatches.length, showG, () => setShowG((v) => !v))}
        </div>
      )}
      {/* Турниры */}
      {playerTours && playerTours.length > 0 && (
        <div className="pl-card" style={{ padding: 14, marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            {t("tours_heading")} ({playerTours.length})
          </div>
          {(showT ? playerTours : playerTours.slice(0, 3)).map((tour) => (
            <div key={tour.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: tour.position === 1 ? "rgba(200,255,45,.12)" : "var(--surface2)", border: `1px solid ${tour.position === 1 ? "var(--lime)" : "var(--line)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 13, color: tour.position === 1 ? "var(--lime)" : tour.position <= 3 ? "var(--yellow)" : "var(--mut)" }}>{tour.position}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tour.name || t("fmt_americano_name")}</div>
                <div style={{ fontSize: 11, color: "var(--mut)" }}>{tour.played} {t("matches_abbr")} · {tour.points} {t("points_abbr")}</div>
              </div>
              <div style={{ fontSize: 11, color: "var(--mut)", flexShrink: 0 }}>{t("games_of")} {tour.total}</div>
            </div>
          ))}
          {moreBtn(playerTours.length, showT, () => setShowT((v) => !v))}
        </div>
      )}
      {/* Лиги игрока */}
      {playerLeagues && playerLeagues.length > 0 && (
        <div className="pl-card" style={{ padding: 14, marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{t("leagues_heading")} ({playerLeagues.length})</div>
          {(showL ? playerLeagues : playerLeagues.slice(0, 3)).map((lg) => (
            <div key={lg.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
              <Trophy size={13} color="var(--mut)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lg.name}</div>
              {lg.role !== "member" && <span style={{ fontSize: 10, color: "var(--lime)", flexShrink: 0, padding: "2px 6px", border: "1px solid rgba(200,255,45,.3)", borderRadius: 8 }}>{lg.role}</span>}
            </div>
          ))}
          {moreBtn(playerLeagues.length, showL, () => setShowL((v) => !v))}
        </div>
      )}

      {showDeleteModal && onDelete && (
        <DeletePlayerModal player={player} onConfirm={onDelete} onCancel={() => setShowDeleteModal(false)} />
      )}
    </div>
  );
}

/* --------------------------------- Games ---------------------------------- */
// Карточка игры в списке: состав (аватары команд) + счёт у сыгранных.
export function GameRow({ g, color, onOpen, flush, bare, label }) {
  const gslots = [...(g.slots || [])].sort((a, b) => ((a.team || "") + (a.position || "")).localeCompare((b.team || "") + (b.position || "")));
  const tA = gslots.filter(s => s.team === "A");
  const tB = gslots.filter(s => s.team === "B");
  const filled = gslots.filter(s => s.profile_id || s.guest_name).length;
  const has = (s) => !!(s && (s.profile_id || s.guest_name));
  const m = (g.matches || [])[0];
  const played = g.status === "played";
  const aWon = played && m && m.sets_a > m.sets_b;
  const bWon = played && m && m.sets_b > m.sets_a;
  const Slot = ({ s, ring }) => has(s)
    ? <Avatar name={s.profile?.name || s.guest_name} url={s.profile?.avatar_url} id={s.profile_id || s.guest_name} size={26} ring={ring} style={{ marginLeft: -6 }} />
    : <span style={{ width: 26, height: 26, borderRadius: "50%", border: "1.5px dashed var(--line)", background: "var(--surface2)", flexShrink: 0, display: "inline-block", marginLeft: -6, boxSizing: "border-box" }} />;
  const nm = (slots) => slots.filter(has).map(s => s.profile?.name || s.guest_name).join(" & ") || "—";
  const namesCss = { fontSize: 11.5, lineHeight: 1.25, textAlign: "center", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" };
  const Team = ({ a, b, ring, names, won }) => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{ display: "flex", paddingLeft: 6 }}><Slot s={a} ring={ring} /><Slot s={b} ring={ring} /></div>
      <div style={{ ...namesCss, color: won ? "var(--lime)" : "var(--mut)", fontWeight: won ? 700 : 500 }}>{names}</div>
    </div>
  );
  return (
    <div className={bare ? "" : "pl-card"} style={{ marginBottom: bare ? 0 : (flush ? 0 : 8), cursor: "pointer", padding: bare ? "10px 2px" : "12px 14px" }} onClick={onOpen}>
      {/* bare-режим (внутри плашки микс-сессии): без шапки, только составы и счёт. */}
      {!bare && (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Swords size={18} color={color} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title || "Padel"}</div>
          {g.starts_at && <div style={{ fontSize: 12, color: "var(--mut)" }}>{fmtDate(g.starts_at)}</div>}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "rgba(255,255,255,.06)", color, flexShrink: 0 }}>
          {played ? "✓" : `${filled}/4`}
        </span>
      </div>
      )}
      {bare && label && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mut)", letterSpacing: 0.5 }}>{label}</div>}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 10, marginTop: bare ? 6 : 11 }}>
        <Team a={tA[0]} b={tA[1]} ring="var(--lime)" names={nm(tA)} won={aWon} />
        <span style={{ fontFamily: "'Anton',sans-serif", fontSize: played ? 18 : 13, color: "var(--mut)", flexShrink: 0, minWidth: 30, textAlign: "center", paddingTop: 5 }}>
          {played && m ? <><span style={{ color: aWon ? "var(--lime)" : "var(--ink)" }}>{m.sets_a}</span><span style={{ color: "var(--mut)" }}>:</span><span style={{ color: bWon ? "var(--lime)" : "var(--ink)" }}>{m.sets_b}</span></> : "—"}
        </span>
        <Team a={tB[0]} b={tB[1]} ring="var(--coral)" names={nm(tB)} won={bWon} />
      </div>
      {/* Счёт по геймам внутри каждого сета (как было до унификации). */}
      {played && Array.isArray(m?.score_detail) && m.score_detail.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {m.score_detail.map((s, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: 0.3 }}>
              <span style={{ color: s.a > s.b ? "var(--lime)" : "var(--ink)" }}>{s.a}</span>
              <span style={{ color: "var(--mut)" }}>:</span>
              <span style={{ color: s.b > s.a ? "var(--lime)" : "var(--ink)" }}>{s.b}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Объединённая плашка микс-сессии: несколько под-игр одного выхода (тот же
// состав, разные расстановки). Внутри — каждая под-игра со своим счётом.
function MixGroupCard({ games, color, onOpenGame }) {
  const first = games[0];
  const when = first.starts_at || first.created_at;
  return (
    <div className="pl-card" style={{ padding: 0, overflow: "hidden" }}>
      <div onClick={() => onOpenGame(first)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
        <Shuffle size={18} color={color} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{first.title || t("mix_session_title")}</div>
          {when && <div style={{ fontSize: 12, color: "var(--mut)" }}>{fmtDate(when)}</div>}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "color-mix(in srgb, var(--lime) 14%, transparent)", color: "var(--lime)", flexShrink: 0 }}>
          {nGames(games.length)}
        </span>
      </div>
      <div style={{ padding: "2px 14px 8px" }}>
        {games.map((g, i) => (
          <div key={g.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
            <GameRow g={g} color={color} bare label={`${t("mix_game_label")} ${i + 1}`} onOpen={() => onOpenGame(g)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Games({ groupId, players, reloadLeaderboard, session, archiveNonce, bumpArchive, onLogin }) {
  const [games, setGames] = useState([]);
  const [mode, setMode] = useState("list");
  const [selId, setSelId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadGames = useCallback(async () => {
    setLoading(true);
    try { setGames(groupId ? await listGames(groupId) : await listMyGames()); } catch (e) { /* noop */ } finally { setLoading(false); }
  }, [groupId]);
  useEffect(() => { loadGames(); }, [loadGames, archiveNonce]);

  if (mode === "create")
    return <CreateGame groupId={groupId} players={players} back={() => setMode("list")} done={() => { setMode("list"); loadGames(); }} />;

  if (mode === "view") {
    const g = games.find((x) => x.id === selId);
    if (!g) { setMode("list"); return null; }
    return <GameCard game={g} groupId={groupId} back={() => setMode("list")} reloadGames={loadGames} reloadLeaderboard={reloadLeaderboard} bumpArchive={bumpArchive} />;
  }

  return (
    <div className="pl-pop">
      {!session && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "color-mix(in srgb, var(--lime) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 30%, transparent)", borderRadius: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 18 }}>🔐</div>
          <div style={{ flex: 1, fontSize: 13, color: "var(--mut)", lineHeight: 1.4 }}>{t("sign_in_to_create_games")}</div>
          <button className="pl-btn" style={{ padding: "7px 14px", fontSize: 12, flexShrink: 0 }} onClick={onLogin}>{t("sign_in")}</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {session && groupId && <button className="pl-btn" style={{ flex: 1, padding: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setMode("create")}>
          <PlusCircle size={18} /> {t("create_game")}
        </button>}
      </div>
      {loading && <div className="pl-card" style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>{t("loading")}</div>}
      {!loading && games.length === 0 && <EmptyState text={!session ? t("games_empty_guest") : (groupId ? t("games_empty_session") : t("solo_games_empty"))} />}
      {!loading && (() => {
        const upcoming = games.filter(g => g.status === "open" && (g.slots||[]).filter(s=>s.profile_id||s.guest_name).length < 4);
        const active   = games.filter(g => g.status === "open" && (g.slots||[]).filter(s=>s.profile_id||s.guest_name).length === 4);
        const played   = games.filter(g => g.status === "played");
        const section = (label, color, items) => items.length === 0 ? null : (
          <div key={label}>
            <div style={{ fontSize: 12, color: "var(--mut)", fontFamily:"'Anton',sans-serif", textTransform:"uppercase", letterSpacing:1, margin:"12px 2px 6px" }}>{label}</div>
            {items.map(g => <GameRow key={g.id} g={g} color={color} onOpen={() => { setSelId(g.id); setMode("view"); }} />)}
          </div>
        );
        return [
          section(t("upcoming_section"), "var(--mut)", upcoming),
          section(t("active_section"), "var(--lime)", active),
          // Сыгранные игры показываем только во вкладке «История».
          played.length > 0 && (
            <div key="hist-hint" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "10px 12px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--line)", fontSize: 12.5, color: "var(--mut)" }}>
              <History size={15} style={{ flexShrink: 0, color: "var(--lime)" }} /> {t("games_in_history")}
            </div>
          ),
        ];
      })()}
    </div>
  );
}

function SlotPicker({ value, players, taken, onChange, teamLabel }) {
  const [q, setQ] = useState("");
  const color = teamLabel === "A" ? "var(--lime)" : "var(--coral)";
  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="pl-display" style={{ width: 24, fontSize: 12, color }}>{teamLabel}</span>
        <div className="pl-slot" style={{ flex: 1, justifyContent: "space-between" }}>
          <span>{value.label}</span>
          <button style={{ padding: 4, border: "none", background: "none", color: "var(--mut)", cursor: "pointer" }} onClick={() => onChange(null)}><X size={14} /></button>
        </div>
      </div>
    );
  }
  const matches = q.trim()
    ? players.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()) && !taken.includes(p.id)).slice(0, 5)
    : [];
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="pl-display" style={{ width: 24, fontSize: 12, color }}>{teamLabel}</span>
        <input className="pl-input" style={{ padding: "9px 10px" }} placeholder={t("slot_search_placeholder")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {q.trim() && (
        <div style={{ marginTop: 6, marginLeft: 32, display: "flex", flexDirection: "column", gap: 4 }}>
          {matches.map((p) => (
            <button key={p.id} className="pl-ghost" style={{ padding: "8px 10px", textAlign: "left" }} onClick={() => { onChange({ profileId: p.id, label: p.name }); setQ(""); }}>{p.name}</button>
          ))}
          <button className="pl-btn" style={{ padding: "8px 10px", textAlign: "left" }} onClick={() => { onChange({ guestName: q.trim(), label: q.trim() + " " + t("guest_label") }); setQ(""); }}>{t("add_guest_prefix")}{q.trim()}</button>
          <div style={{ fontSize: 11, color: "var(--mut)", lineHeight: 1.4, padding: "2px 2px" }}>{t("add_guest_league_hint")}</div>
        </div>
      )}
    </div>
  );
}

// 4 слота игры: в пустые — поиск/добавление; у заполненных — перетаскивание
// (долгое нажатие → плитка за пальцем, обмен/перенос) и удаление свайпом влево.
// Жест обрабатывается на КОНТЕЙНЕРЕ с захватом указателя — поэтому pointerup
// всегда приходит сюда (плитка не зависает), а попадание ищем по ближайшей
// строке (надёжный обмен с первой попытки).
function GameSlots({ slots, setSlots, players, chosenIds }) {
  const ref = useRef(null);          // контейнер
  const rowRefs = useRef([]);        // все 4 слота (для поиска цели)
  const g = useRef({ mode: "idle", idx: -1, x0: 0, y0: 0, pid: null, timer: null });
  const [drag, setDrag] = useState(null);              // { idx, x, y }
  const [swipe, setSwipe] = useState({ idx: -1, dx: 0 });
  const setSlot = (i, v) => setSlots((s) => s.map((x, j) => (j === i ? v : x)));
  const MAX = 88, LONG = 260, TH = 8;
  const clearTimer = () => { if (g.current.timer) { clearTimeout(g.current.timer); g.current.timer = null; } };
  const release = () => { try { ref.current.releasePointerCapture(g.current.pid); } catch (_) {} };
  // Ближайший слот по вертикали (с горизонтальным допуском), кроме перетаскиваемого.
  const nearestIdx = (x, y, exclude) => {
    let best = -1, bestD = Infinity;
    rowRefs.current.forEach((el, i) => {
      if (!el || i === exclude) return;
      const r = el.getBoundingClientRect();
      if (x < r.left - 28 || x > r.right + 28) return;
      const cy = r.top + r.height / 2, d = Math.abs(y - cy);
      if (d <= r.height && d < bestD) { bestD = d; best = i; }
    });
    return best;
  };
  const beginDrag = () => { g.current.mode = "drag"; try { navigator.vibrate?.(12); } catch (_) {} setDrag({ idx: g.current.idx, x: g.current.x0, y: g.current.y0 }); };
  const down = (e) => {
    const rowEl = e.target.closest?.("[data-slot-idx]");
    if (!rowEl) return;                                 // пустой слот / поле ввода — не жест
    const idx = Number(rowEl.dataset.slotIdx);
    g.current = { mode: "pending", idx, x0: e.clientX, y0: e.clientY, pid: e.pointerId, timer: null };
    try { ref.current.setPointerCapture(e.pointerId); } catch (_) {}
    clearTimer();
    g.current.timer = setTimeout(() => { if (g.current.mode === "pending") beginDrag(); }, LONG);
  };
  const move = (e) => {
    if (g.current.mode === "idle") return;
    const dX = e.clientX - g.current.x0, dY = e.clientY - g.current.y0;
    if (g.current.mode === "pending") {
      if (Math.abs(dY) > Math.abs(dX) && Math.abs(dY) > 6) { clearTimer(); g.current.mode = "idle"; release(); return; } // вертикаль → скролл
      if (dX < -TH) { clearTimer(); g.current.mode = "swipe"; }
      else if (dX > TH) { clearTimer(); g.current.mode = "idle"; release(); return; }
      else return;
    }
    if (g.current.mode === "swipe") setSwipe({ idx: g.current.idx, dx: Math.max(-MAX, Math.min(0, dX)) });
    else if (g.current.mode === "drag") setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
  };
  const finish = (e) => {
    clearTimer();
    const m = g.current.mode, idx = g.current.idx;
    g.current.mode = "idle";
    release();
    if (m === "drag") {
      const tgt = nearestIdx(e.clientX, e.clientY, idx);
      if (tgt >= 0) setSlots((prev) => { const n = [...prev]; const t = n[tgt]; n[tgt] = n[idx]; n[idx] = t; return n; });
      setDrag(null);                                    // не нашли цель → плитка возвращается на место
    } else if (m === "swipe") {
      const del = swipe.dx <= -MAX * 0.55;
      setSwipe({ idx: -1, dx: 0 });
      if (del) setSlot(idx, null);
    }
  };
  const active = drag || swipe.idx >= 0;
  return (
    <div ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}
      style={{ touchAction: active ? "none" : "pan-y" }}>
      {[0, 1, 2, 3].map((i) => {
        const v = slots[i];
        const team = i < 2 ? "A" : "B";
        const ring = i < 2 ? "var(--lime)" : "var(--coral)";
        if (!v) {
          return (
            <div key={i} ref={(el) => (rowRefs.current[i] = el)}>
              <SlotPicker value={null} players={players} taken={chosenIds} teamLabel={team} onChange={(val) => setSlot(i, val)} />
            </div>
          );
        }
        const dx = swipe.idx === i ? swipe.dx : 0;
        return (
          <div key={i} data-slot-idx={i} ref={(el) => (rowRefs.current[i] = el)}
            style={{ position: "relative", marginBottom: 8, borderRadius: 12, overflow: "hidden", background: "var(--coral)", opacity: drag?.idx === i ? 0.3 : 1 }}>
            <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: MAX, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Trash2 size={18} /></div>
            <div style={{ transform: `translateX(${dx}px)`, transition: (swipe.idx === i && g.current.mode === "swipe") ? "none" : "transform .2s ease", display: "flex", alignItems: "center", gap: 8, background: "var(--surface)" }}>
              <span className="pl-display" style={{ width: 24, fontSize: 12, color: ring, flexShrink: 0 }}>{team}</span>
              <div className="pl-slot" style={{ flex: 1, gap: 8 }}>
                <GripVertical size={16} style={{ color: "var(--mut)", flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.label}</span>
              </div>
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 2, lineHeight: 1.4 }}>{t("slots_dnd_hint")}</div>
      {drag && slots[drag.idx] && (
        <div style={{ position: "fixed", left: drag.x, top: drag.y, transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 300, padding: "8px 12px", borderRadius: 12, background: "var(--surface)", border: "1.5px solid var(--lime)", boxShadow: "0 8px 24px rgba(0,0,0,.4)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
          {slots[drag.idx].label}
        </div>
      )}
    </div>
  );
}

function CreateGame({ groupId, players, back, done }) {
  const [step, setStep] = useState("info"); // "info" | "players"
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [day, setDay] = useState(() => nowLocalDT().slice(0, 10));
  const [time, setTime] = useState(() => nowLocalDT().slice(11, 16));
  const date = day ? `${day}T${time || "00:00"}` : "";
  const [place, setPlace] = useState("");
  const [slots, setSlots] = useState([null, null, null, null]);
  const [busy, setBusy] = useState(false);
  const chosenIds = slots.filter((v) => v && v.profileId).map((v) => v.profileId);
  const filled = slots.filter((v) => v && (v.profileId || v.guestName)).length;

  // Автоназвание = место (если указано) или пусто. Дата/время НЕ дублируются
  // в названии — они и так показываются отдельной строкой в плашке/карточке.
  useEffect(() => {
    if (titleEdited) return;
    setTitle(place.trim());
  }, [place, titleEdited]);

  const create = async () => {
    setBusy(true);
    // ISO с таймзоной — чтобы введённое локальное время совпадало с показанным.
    let startsAtIso = null;
    try { if (date) startsAtIso = new Date(date).toISOString(); } catch (e) { startsAtIso = null; }
    try { await createGame(groupId, { title: title.trim() || null, startsAt: startsAtIso, place, slots }); done(); }
    catch (e) { alert("Не удалось создать игру"); setBusy(false); }
  };

  const stepBadge = (txt) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--lime)", marginBottom: 10 }}>{txt}</div>
  );

  // ── Шаг 1: когда / где / название ─────────────────────────────────────────
  if (step === "info") {
    return (
      <div className="pl-pop">
        <button className="pl-ghost" style={{ padding: "6px 12px", marginBottom: 12 }} onClick={back}>← {t("back")}</button>
        {stepBadge(t("game_step1"))}
        <div className="pl-card" style={{ padding: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 6 }}>{t("game_when_label")}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="date" className="pl-input" style={{ padding: "10px 12px", flex: 3 }} value={day} onChange={(e) => setDay(e.target.value)} />
              <input type="time" className="pl-input" style={{ padding: "10px 12px", flex: 2 }} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 6 }}>{t("game_where_label")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MapPin size={18} color="var(--mut)" />
              <input className="pl-input" style={{ padding: "10px 12px" }} placeholder={t("court_club_placeholder")} value={place} onChange={(e) => setPlace(e.target.value)} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 6 }}>{t("game_name_label")}</div>
            <input className="pl-input" style={{ padding: "10px 12px" }} placeholder={t("game_name_placeholder")} value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleEdited(true); }} />
          </div>
        </div>
        <button className="pl-btn" style={{ width: "100%", padding: 14, fontSize: 16 }} disabled={!day} onClick={() => setStep("players")}>{t("game_next")}</button>
      </div>
    );
  }

  // ── Шаг 2: игроки ─────────────────────────────────────────────────────────
  return (
    <div className="pl-pop">
      <button className="pl-ghost" style={{ padding: "6px 12px", marginBottom: 12 }} onClick={() => setStep("info")}>← {t("back")}</button>
      {stepBadge(t("game_step2"))}
      <div className="pl-card" style={{ padding: "12px 14px", marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{title || t("game_default_name")}</div>
        <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 2, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {date && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Calendar size={12} /> {fmtDate(date)}</span>}
          {place.trim() && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {place.trim()}</span>}
        </div>
      </div>
      <div className="pl-card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
          <span>{t("slots_label")}</span><span>{filled}/4</span>
        </div>
        <GameSlots slots={slots} setSlots={setSlots} players={players} chosenIds={chosenIds} />
        <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 6, lineHeight: 1.4 }}>{t("game_slots_hint")}</div>
      </div>
      <button className="pl-btn" style={{ width: "100%", padding: 14, fontSize: 16 }} disabled={busy} onClick={create}>{busy ? t("creating_game") : t("create_and_get_link")}</button>
    </div>
  );
}
// Микс команд для «сыграть ещё»: 4 игрока, drag & drop для обмена местами.
function RematchMix({ players, onCreate, onCancel, busy }) {
  const [arr, setArr] = useState(players);
  const refs = useRef([]);
  const [drag, setDrag] = useState(null); // { idx, x, y }
  const start = (idx) => (e) => { setDrag({ idx, x: e.clientX, y: e.clientY }); try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (_) {} };
  const move = (e) => { if (drag) setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY }); };
  const end = (e) => {
    if (!drag) return;
    let tgt = -1;
    refs.current.forEach((el, i) => { if (!el) return; const r = el.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) tgt = i; });
    if (tgt >= 0 && tgt !== drag.idx) setArr((prev) => { const n = [...prev]; const t = n[tgt]; n[tgt] = n[drag.idx]; n[drag.idx] = t; return n; });
    setDrag(null);
  };
  const Chip = ({ idx, ring }) => {
    const p = arr[idx];
    return (
      <div ref={(el) => (refs.current[idx] = el)} onPointerDown={start(idx)}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 12, background: "var(--surface2)", border: `1.5px solid ${ring}`, cursor: "grab", touchAction: "none", userSelect: "none", minWidth: 0, opacity: drag?.idx === idx ? .25 : 1 }}>
        <span style={{ flexShrink: 0, display: "flex" }}><Avatar url={p.avatar_url} id={p.profile_id || p.guest_name} name={p.name} size={28} /></span>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
      </div>
    );
  };
  return (
    <div onPointerMove={move} onPointerUp={end} onPointerCancel={end} style={{ touchAction: drag ? "none" : "auto" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--lime)", letterSpacing: 1, textAlign: "center" }}>A</div>
          <Chip idx={0} ring="var(--lime)" /><Chip idx={1} ring="var(--lime)" />
        </div>
        <div style={{ display: "flex", alignItems: "center", color: "var(--mut)", fontWeight: 700, fontSize: 12 }}>vs</div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--coral)", letterSpacing: 1, textAlign: "center" }}>B</div>
          <Chip idx={2} ring="var(--coral)" /><Chip idx={3} ring="var(--coral)" />
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--mut)", textAlign: "center", marginTop: 8 }}>{t("mix_hint")}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="pl-ghost" style={{ padding: "10px 14px" }} onClick={onCancel}>{t("cancel")}</button>
        <button className="pl-btn" style={{ flex: 1, padding: 10 }} disabled={busy} onClick={() => onCreate(arr)}>{busy ? t("creating_game") : t("mix_create")}</button>
      </div>
      {drag && (
        <div style={{ position: "fixed", left: drag.x, top: drag.y, transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 300, padding: "8px 10px", borderRadius: 12, background: "var(--surface)", border: "1.5px solid var(--lime)", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
          <Avatar url={arr[drag.idx].avatar_url} id={arr[drag.idx].profile_id || arr[drag.idx].guest_name} name={arr[drag.idx].name} size={28} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{arr[drag.idx].name}</span>
        </div>
      )}
    </div>
  );
}

// Один корт внутри страницы (микс-)сессии: сыгранная — просмотр, открытая
// с полным составом — ввод счёта прямо здесь.
function GameCourtBlock({ game, index, total, reloadSession, reloadLeaderboard, bumpArchive }) {
  const slots = [...(game.slots || [])].sort((a, b) => (a.team + a.position).localeCompare(b.team + b.position));
  const nameOf = (s) => s.profile?.name || s.guest_name;
  const avatarOf = (s) => s.profile_id ? playerAvatar(s.profile?.avatar_url, s.profile_id) : null;
  const slotsA = slots.filter((s) => s.team === "A");
  const slotsB = slots.filter((s) => s.team === "B");
  const filled = slots.filter((s) => s.profile_id || s.guest_name).length;
  const played = game.status === "played";
  const match = (game.matches || [])[0];
  const del = async () => {
    if (!confirm(t("delete_game_confirm"))) return;
    await deleteGame(game.id).catch(() => {});
    bumpArchive && bumpArchive();
    await reloadSession();
  };
  return (
    <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="pl-display" style={{ fontSize: 15 }}>{total > 1 ? `${t("mix_game_label")} ${index + 1}` : (game.title || "Padel")}</span>
        {game.starts_at && <span style={{ fontSize: 12, color: "var(--mut)", display: "inline-flex", alignItems: "center", gap: 4 }}><Calendar size={12} />{fmtDate(game.starts_at)}</span>}
        <button className="pl-ghost" style={{ marginLeft: "auto", padding: "5px 8px", color: "var(--coral)", border: "1px solid rgba(255,106,82,.3)" }} onClick={del} title="Удалить"><Trash2 size={13} /></button>
      </div>
      {played ? (
        <CourtView courtNumber={index + 1} mode="sets"
          teamA={slotsA.map(nameOf)} teamB={slotsB.map(nameOf)}
          teamAvatarsA={slotsA.map(avatarOf)} teamAvatarsB={slotsB.map(avatarOf)}
          scoreA={match?.sets_a ?? null} scoreB={match?.sets_b ?? null}
          scoreDetail={match?.score_detail || null} editable={false} />
      ) : filled === 4 ? (
        <CourtView courtNumber={index + 1} mode="sets" editable
          teamA={slotsA.map(nameOf)} teamB={slotsB.map(nameOf)}
          teamAvatarsA={slotsA.map(avatarOf)} teamAvatarsB={slotsB.map(avatarOf)}
          onSave={async (a, b, detail) => { await submitResult(game.id, a, b, detail); await reloadSession(); reloadLeaderboard && reloadLeaderboard(); }} />
      ) : (
        <>
          <CourtView courtNumber={index + 1}
            teamA={slotsA.map(nameOf)} teamB={slotsB.map(nameOf)}
            teamAvatarsA={slotsA.map(avatarOf)} teamAvatarsB={slotsB.map(avatarOf)}
            editable={false} />
          <div style={{ textAlign: "center", color: "var(--mut)", fontSize: 12, marginTop: 6 }}>{filled}/4 — {t("waiting_via_link")}</div>
        </>
      )}
    </div>
  );
}

function GameCard({ game, groupId, back, reloadGames, reloadLeaderboard, bumpArchive }) {
  const [mix, setMix] = useState(false);
  const [mixBusy, setMixBusy] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [toast, setToast] = useState("");
  // Страница (микс-)сессии: все игры одной группы (mix_group_id || id).
  const mixKey = game.mix_group_id || game.id;
  const [session, setSession] = useState(null);
  const loadSession = useCallback(async () => {
    try {
      const all = groupId ? await listGames(groupId) : await listMyGames();
      const grp = (all || []).filter((g) => (g.mix_group_id || g.id) === mixKey)
        .sort((a, b) => new Date(a.created_at || a.starts_at || 0) - new Date(b.created_at || b.starts_at || 0));
      setSession(grp);
    } catch (e) { setSession([game]); }
  }, [groupId, mixKey, game]);
  useEffect(() => { if (game.status === "played") loadSession(); }, [loadSession, game.status]);
  // Если из сессии удалили все игры — выходим назад (к списку/Истории).
  useEffect(() => { if (session && session.length === 0) back && back(); }, [session, back]);
  const slots = [...(game.slots || [])].sort((a, b) => (a.team + a.position).localeCompare(b.team + b.position));
  const nameOf = (s) => s.profile?.name || s.guest_name;
  const avatarOf = (s) => s.profile_id ? playerAvatar(s.profile?.avatar_url, s.profile_id) : null;
  const filled = slots.filter((s) => s.profile_id || s.guest_name).length;
  const slotsA = slots.filter((s) => s.team === "A");
  const slotsB = slots.filter((s) => s.team === "B");

  const share = async () => {
    const url = linkFor(game.invite_code);
    const text = `${t("game_share_text")}${game.title ? ` «${game.title}»` : ""}! ${t("game_share_join")}: ${url} (${t("code_label")} ${game.invite_code})`;
    try { if (navigator.share) { await navigator.share({ title: "PadelPack", text, url }); return; } } catch (e) {}
    try { await navigator.clipboard.writeText(text); setToast(t("copied")); setTimeout(() => setToast(""), 1600); } catch (e) { setToast("Скопируй вручную"); }
  };

  // «Сыграть ещё»: создаём новую игру с теми же игроками в выбранной расстановке.
  const createMix = async (arr) => {
    if (!groupId) return;
    setMixBusy(true);
    try {
      const newSlots = arr.map((p) => (p.profile_id ? { profileId: p.profile_id } : { guestName: p.guest_name }));
      // Связываем под-игры микса: общий mix_group_id = id исходной игры (или её группы).
      await createGame(groupId, { title: game.title || null, startsAt: new Date().toISOString(), slots: newSlots, mixGroupId: mixKey });
      setMix(false); setMixBusy(false);
      bumpArchive && bumpArchive();
      reloadGames && reloadGames();
      await loadSession(); // новая игра появляется ниже на той же странице (ввод счёта inline)
    } catch (e) { alert("Не удалось создать игру"); setMixBusy(false); }
  };

  if (game.status === "played") {
    const list = session || [game];
    const last = list[list.length - 1];
    const lastSlots = [...(last.slots || [])].sort((a, b) => (a.team + a.position).localeCompare(b.team + b.position));
    const lastFilled = lastSlots.filter((s) => s.profile_id || s.guest_name).length;
    // Микс предлагаем только когда последняя игра уже сыграна (иначе плодим пустые).
    const canMix = groupId && last.status === "played" && lastFilled === 4;
    const reloadSession = async () => { await loadSession(); reloadGames && reloadGames(); };
    return (
      <div className="pl-pop">
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {back && <button className="pl-ghost" style={{ padding: "6px 12px" }} onClick={back}>{t("to_list")}</button>}
        </div>
        {list.length > 1 && (
          <div className="pl-display" style={{ fontSize: 18, margin: "0 2px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <Shuffle size={18} color="var(--lime)" /> {last.title || t("mix_session_title")} · {nGames(list.length)}
          </div>
        )}
        {list.map((g, i) => (
          <GameCourtBlock key={g.id} game={g} index={i} total={list.length}
            reloadSession={reloadSession} reloadLeaderboard={reloadLeaderboard} bumpArchive={bumpArchive} />
        ))}
        {canMix && (
          <div className="pl-card" style={{ padding: 14, marginTop: 4 }}>
            {!mix ? (
              <button className="pl-ghost" style={{ width: "100%", padding: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--lime)", borderColor: "color-mix(in srgb, var(--lime) 35%, transparent)", fontWeight: 600 }} onClick={() => setMix(true)}>
                <Shuffle size={16} /> {t("mix_again")}
              </button>
            ) : (
              <RematchMix
                players={lastSlots.map((s) => ({ name: nameOf(s), profile_id: s.profile_id, guest_name: s.guest_name, avatar_url: s.profile?.avatar_url }))}
                busy={mixBusy}
                onCancel={() => setMix(false)}
                onCreate={createMix} />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pl-pop">
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {back && <button className="pl-ghost" style={{ padding: "6px 12px" }} onClick={back}>{t("to_list")}</button>}
        <button className="pl-ghost" style={{ padding: "6px 10px", color: "var(--coral)", border: "1px solid rgba(255,106,82,.3)", marginLeft: "auto" }} onClick={async () => { if (!confirm(t("delete_game_confirm"))) return; await deleteGame(game.id); bumpArchive && bumpArchive(); reloadGames && reloadGames(); back && back(); }} title="Удалить"><Trash2 size={14} /></button>
      </div>
      <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="pl-display" style={{ fontSize: 18 }}>{game.title || "PadelPack"}</div>
          {(game.starts_at || game.place) && (
            <div style={{ fontSize: 12, color: "var(--mut)", display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
              {game.starts_at && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} />{fmtDate(game.starts_at)}</span>}
              {game.place && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} />{game.place}</span>}
            </div>
          )}
        </div>
        <button className="pl-btn" style={{ padding: "8px 12px", display: "flex", gap: 6, alignItems: "center" }} onClick={() => setShowShare((v) => !v)}><Share2 size={15} /> {t("share_btn")}</button>
      </div>

      {showShare && (
        <div className="pl-pop" style={{ marginTop: 12 }}>
          <div className="pl-codebox">{game.invite_code}</div>
          <div style={{ fontSize: 12, color: "var(--mut)", margin: "8px 0 4px", wordBreak: "break-all" }}>{linkFor(game.invite_code)}</div>
          <button className="pl-btn" style={{ width: "100%", padding: 12, marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={share}>
            <Copy size={16} /> {toast || t("share_invite")}
          </button>
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {slots.map((s, i) => (
          <div key={i} className="pl-slot">
            <span className="pl-display" style={{ fontSize: 11, color: s.team === "A" ? "var(--lime)" : "var(--coral)", width: 30 }}>{s.team}</span>
            <span style={{ flex: 1, color: nameOf(s) ? "var(--ink)" : "var(--mut)" }}>{nameOf(s) || t("slot_free")}</span>
            {nameOf(s) && <Check size={15} color="var(--lime)" />}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        {filled === 4 ? (
          <CourtView courtNumber={1} mode="sets" editable
            teamA={slotsA.map(nameOf)} teamB={slotsB.map(nameOf)}
            teamAvatarsA={slotsA.map(avatarOf)} teamAvatarsB={slotsB.map(avatarOf)}
            onSave={async (a, b, detail) => { await submitResult(game.id, a, b, detail); await Promise.all([reloadGames(), reloadLeaderboard()]); }} />
        ) : (
          <>
            <CourtView courtNumber={1}
              teamA={slotsA.map(nameOf)} teamB={slotsB.map(nameOf)}
              teamAvatarsA={slotsA.map(avatarOf)} teamAvatarsB={slotsB.map(avatarOf)}
              editable={false} />
            <div style={{ textAlign: "center", color: "var(--mut)", fontSize: 12, marginTop: 6 }}>{filled}/4 — {t("waiting_via_link")}</div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

function EnterScore({ gameId, reloadGames, reloadLeaderboard }) {
  const [sA, setSA] = useState(0), [sB, setSB] = useState(0), [busy, setBusy] = useState(false);
  const valid = sA !== sB;
  const record = async () => {
    if (!valid) return;
    setBusy(true);
    try { await submitResult(gameId, sA, sB); await Promise.all([reloadGames(), reloadLeaderboard()]); }
    catch (e) { alert("Не удалось записать результат"); setBusy(false); }
  };
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center" }}>
        <Step label={t("sets_a_label")} v={sA} set={setSA} />
        <span className="pl-display" style={{ fontSize: 20 }}>:</span>
        <Step label={t("sets_b_label")} v={sB} set={setSB} />
      </div>
      <button className="pl-btn" style={{ width: "100%", padding: 12, marginTop: 12 }} disabled={!valid || busy} onClick={record}>{busy ? t("recording") : t("record_score")}</button>
    </div>
  );
}

/* ------------------------------- HistoryView ------------------------------ */
// Свайп влево по карточке → раскрывается красная зона с корзиной → удаление.
function SwipeToDelete({ onDelete, children }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0), startY = useRef(0), active = useRef(false), busy = useRef(false);
  const MAX = 88;
  const down = (e) => { if (busy.current) return; startX.current = e.clientX; startY.current = e.clientY; active.current = true; setDragging(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} };
  const move = (e) => {
    if (!active.current) return;
    const dX = e.clientX - startX.current, dY = e.clientY - startY.current;
    if (dx === 0 && Math.abs(dY) > Math.abs(dX)) { active.current = false; setDragging(false); return; } // вертикальный скролл
    setDx(Math.max(-MAX, Math.min(0, dX)));
  };
  const up = async () => {
    if (!active.current) return; active.current = false; setDragging(false);
    if (dx <= -MAX * 0.55) {
      setDx(-MAX); busy.current = true;
      try { await onDelete(); } finally { busy.current = false; }
      setDx(0);
    } else setDx(0);
  };
  return (
    <div style={{ position: "relative", marginBottom: 8, borderRadius: 16, overflow: "hidden", background: "var(--coral)" }}>
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: MAX, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <Trash2 size={20} />
      </div>
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? "none" : "transform .22s ease", touchAction: "pan-y" }}>
        {children}
      </div>
    </div>
  );
}

function HistoryView({ groupId, players, profileId, isGroupMember, archiveNonce, bumpArchive }) {
  const [games, setGames] = useState(null);  // сыгранные игры
  const [tours, setTours] = useState([]);     // завершённые турниры
  const [sel, setSel] = useState(null);       // { type: 'tour' | 'game', data }
  const [swipeHint, setSwipeHint] = useState(() => { try { return !localStorage.getItem("pp_swipe_hint"); } catch (e) { return true; } });
  const dismissHint = () => { try { localStorage.setItem("pp_swipe_hint", "1"); } catch (e) {} setSwipeHint(false); };
  const [filter, setFilter] = useState("all"); // all | games | tours

  const load = useCallback(async () => {
    try { const g = groupId ? await listGames(groupId) : await listMyGames(); setGames((g || []).filter((x) => x.status === "played")); }
    catch (e) { setGames([]); }
    try { const all = groupId ? await listTournaments(groupId) : await listMyTournaments(); setTours((all || []).filter((tr) => tr.status === "finished")); }
    catch (e) { setTours([]); }
  }, [groupId]);
  useEffect(() => { if (!sel) load(); }, [load, sel, archiveNonce]);

  // Проваливание в результаты — те же экраны, что на вкладках Игры/Турниры (там и удаление).
  if (sel?.type === "tour") return <TournamentView id={sel.data.id} players={players} back={() => setSel(null)} isGroupMember={isGroupMember} currentProfileId={profileId} onArchiveChange={bumpArchive} />;
  if (sel?.type === "game") return <GameCard game={sel.data} groupId={groupId} back={() => setSel(null)} reloadGames={load} reloadLeaderboard={() => {}} bumpArchive={bumpArchive} />;

  const head = (txt, color = "var(--mut)") => <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color, textTransform: "uppercase", margin: "14px 2px 8px", paddingLeft: 4 }}>{txt}</div>;

  if (games === null) return <div className="pl-card pl-pop" style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>{t("loading")}</div>;
  if (games.length === 0 && tours.length === 0) return <EmptyState className="pl-card pl-pop" variant="clock" text={t("history_empty")} />;

  return (
    <div className="pl-pop">
      <style>{trCss}</style>
      {/* Фильтр: Все / Игры / Турниры — всегда виден сверху. */}
      <div style={{ display: "flex", gap: 4, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: 3, marginBottom: 12 }}>
        {[["all", t("filter_all")], ["games", t("filter_games")], ["tours", t("filter_tours")]].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            flex: 1, border: "none", borderRadius: 9, padding: "8px 0", cursor: "pointer",
            fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 700,
            background: filter === key ? "var(--lime)" : "transparent",
            color: filter === key ? "var(--lime-fg)" : "var(--mut)",
            transition: "background .12s, color .12s",
          }}>{label}</button>
        ))}
      </div>
      {isGroupMember && swipeHint && (games.length > 0 || tours.length > 0) && (
        <div onClick={dismissHint} style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 12px", padding: "9px 12px", borderRadius: 12, background: "color-mix(in srgb, var(--coral) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--coral) 30%, transparent)", fontSize: 12.5, color: "var(--mut)", cursor: "pointer" }}>
          <span style={{ color: "var(--coral)", fontSize: 18, fontWeight: 800, lineHeight: 1 }}>←</span> {t("swipe_hint")} <X size={14} style={{ marginLeft: "auto", color: "var(--mut)", flexShrink: 0 }} />
        </div>
      )}
      {filter === "games" && games.length === 0 && <EmptyState text={t("history_no_games")} />}
      {filter === "tours" && tours.length === 0 && <EmptyState text={t("history_no_tours")} />}
      {filter !== "games" && tours.length > 0 && head(t("tours_history_heading"), "var(--yellow)")}
      {filter !== "games" && tours.map((tour) => {
        const card = <TournamentCard trn={tour} color="var(--yellow)" flush={isGroupMember} onClick={() => setSel({ type: "tour", data: tour })} />;
        return isGroupMember
          ? <SwipeToDelete key={tour.id} onDelete={async () => { if (!confirm(t("trn_delete_confirm"))) return; await deleteTournament(tour.id).catch(() => {}); bumpArchive?.(); load(); }}>{card}</SwipeToDelete>
          : <div key={tour.id}>{card}</div>;
      })}

      {filter !== "tours" && games.length > 0 && head(t("games_history_heading"))}
      {filter !== "tours" && (() => {
        // Группируем по миксу: ключ = mix_group_id || id. Группа ≥2 → объединённая плашка.
        const byKey = new Map();
        games.forEach((g) => { const k = g.mix_group_id || g.id; const a = byKey.get(k) || []; a.push(g); byKey.set(k, a); });
        const seen = new Set();
        const order = [];
        games.forEach((g) => { const k = g.mix_group_id || g.id; if (!seen.has(k)) { seen.add(k); order.push(k); } });
        return order.map((k) => {
          const grp = byKey.get(k);
          if (grp.length >= 2) {
            const ordered = [...grp].sort((a, b) => new Date(a.created_at || a.starts_at || 0) - new Date(b.created_at || b.starts_at || 0));
            const card = <MixGroupCard games={ordered} color="#7d9488" onOpenGame={(g) => setSel({ type: "game", data: g })} />;
            return isGroupMember
              ? <SwipeToDelete key={"mix-" + k} onDelete={async () => { if (!confirm(t("mix_delete_confirm").replace("{n}", ordered.length))) return; for (const gg of ordered) await deleteGame(gg.id).catch(() => {}); bumpArchive?.(); load(); }}>{card}</SwipeToDelete>
              : <div key={"mix-" + k}>{card}</div>;
          }
          const g = grp[0];
          const card = <GameRow g={g} color="#7d9488" flush={isGroupMember} onOpen={() => setSel({ type: "game", data: g })} />;
          return isGroupMember
            ? <SwipeToDelete key={g.id} onDelete={async () => { if (!confirm(t("delete_game_confirm"))) return; await deleteGame(g.id).catch(() => {}); bumpArchive?.(); load(); }}>{card}</SwipeToDelete>
            : <div key={g.id}>{card}</div>;
        });
      })()}
    </div>
  );
}
