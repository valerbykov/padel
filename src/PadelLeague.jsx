// PadelLeague.jsx — основной экран на реальных данных Supabase.
import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "./lib/supabase";
import BackButton from "./components/BackButton";
import { getLeaderboard, addMember, removeMember, createGame, listGames, submitResult, linkFor, deleteGame, createLeague, joinLeague, getGroupCounts, getGroupProfiles, listMyGames, listMyHistoryMatches, getPlayedWith, getLeagueablePlayers, addExistingMember, getBoardMatches, getStatMatches, getHistoryMatches, updateGameCourtName, notifyGameCreated, setMemberRole, hidePartner, getProfileNames } from "./lib/padelApi";
import { WEB_BASE } from "./lib/platform";
import { CardSkeleton } from "./components/Skeleton";
import { bustCache, cachePeek } from "./lib/cache";
import { getRatingHistory } from "./lib/statsApi";
import { listTournaments, listMyTournaments } from "./lib/tournamentApi";
import { t, nGames } from "./lib/i18n";
import { standings, detailedStandings } from "./lib/americano";
import StandingsTable from "./components/StandingsTable";
import Fab from "./components/Fab";
import { Trophy, Swords, History, Users, UserPlus, Share2, Check, X, RefreshCw, Copy, PlusCircle, ChevronUp, ChevronDown, ChevronRight, Calendar, MapPin, TrendingUp, LogIn, Award, Phone, Mail, ArrowLeft, Trash2, KeyRound, Shuffle, GripVertical, HelpCircle, UserCheck, ShieldCheck, EyeOff, Star, User, Search } from "lucide-react";
import Tournaments, { TournamentView, TournamentCard, CopyDialog, css as trCss } from "./components/Tournaments";
import { copyTournament } from "./lib/tournamentApi";
import { deleteTournament } from "./lib/tournamentApi";
import CourtView from "./components/CourtView";
import EmptyState from "./components/EmptyState";
import Avatar from "./components/Avatar";
import LeagueLogo from "./components/LeagueLogo";
import Analytics from "./components/Analytics";
import { dogAvatar, playerAvatar, DOG_COUNT, avatarFallback } from "./lib/avatar";

// Текущая дата-время в формате datetime-local (YYYY-MM-DDTHH:MM) с учётом таймзоны.
const nowLocalDT = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

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
.plsk{background:var(--surface2);border-radius:8px;animation:plsk 1.2s ease-in-out infinite;}@keyframes plsk{0%,100%{opacity:.45}50%{opacity:.85}}
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

export default function PadelLeague({ groupId, session, profileId, leagues = [], leaguesReady = true, activeLeague = null, isAdmin = false, onLeagueChange, onLeagueCreated, theme = "dark", lang = "ru", onThemeToggle, onLangChange, onLogin, onOpenLanding, onEditProfile, openSelfStatsNonce = 0, openAnalyticsNonce = 0, openEvent = null }) {
  const [tab, setTab] = useState(session ? "board" : "welcome");
  // Повторный тап по активной вкладке должен возвращать к её корню (закрыть
  // открытую детализацию). Меняем navNonce → key вкладки → ремоунт → сброс.
  const [navNonce, setNavNonce] = useState(0);
  const goTab = useCallback((x) => { setNavNonce((n) => (x === tab ? n + 1 : n)); setTab(x); }, [tab]);
  const [players, setPlayers] = useState([]);
  const [lbLoaded, setLbLoaded] = useState(false);
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
    finally { if (seq === lbSeq.current) setLbLoaded(true); }
  }, [groupId, leaguesReady, leagues]);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);
  // при смене лиги — снова показать скелетон, пока грузятся её друзья
  useEffect(() => { setLbLoaded(false); }, [groupId]);

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
  useEffect(() => { if (openAnalyticsNonce > 0) setTab("board"); }, [openAnalyticsNonce]);
  // Открытие игры/турнира из уведомления (колокольчик): переключаем вкладку,
  // сам объект открывает Games/Tournaments через проп openReq.
  useEffect(() => {
    if (!openEvent?.nonce) return;
    if (openEvent.kind === "tour") setTab("tournaments");
    else if (openEvent.kind === "game") setTab("games");
    else if (openEvent.kind === "post") setTab("board"); // объявление: лига уже переключена App'ом
  }, [openEvent]);

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

        {tab === "welcome" && !session && <WelcomeScreen onLogin={onLogin} onBrowseGames={() => goTab("games")} onBrowseTournaments={() => goTab("tournaments")} onOpenLanding={onOpenLanding} theme={theme} lang={lang} onThemeToggle={onThemeToggle} onLangChange={onLangChange} />}
        {tab === "board" && (session ? <Board key={navNonce} groupId={groupId} players={players} loading={!lbLoaded} reload={loadLeaderboard} profileId={profileId} bumpArchive={bumpArchive} isAdmin={isAdmin} leagues={leagues} activeLeague={activeLeague} onLeagueChange={onLeagueChange} onLeagueCreated={onLeagueCreated} onEditProfile={onEditProfile} selfStatsNonce={openSelfStatsNonce} analyticsNonce={openAnalyticsNonce} /> : <GateScreen />)}
        {tab === "games" && <Games key={navNonce} groupId={groupId} players={players} profileId={profileId} reloadLeaderboard={loadLeaderboard} session={session} archiveNonce={archiveNonce} bumpArchive={bumpArchive} onLogin={onLogin} canCreate={isAdmin || !!activeLeague?.members_can_create} openReq={openEvent?.kind === "game" ? openEvent : null} />}
        {tab === "tournaments" && <Tournaments key={navNonce} groupId={groupId} players={players} profileId={profileId} bumpArchive={bumpArchive} session={session} onLogin={onLogin} isAdmin={isAdmin} canCreate={isAdmin || !!activeLeague?.members_can_create} membersCanCreate={!!activeLeague?.members_can_create} openReq={openEvent?.kind === "tour" ? openEvent : null} />}
        {tab === "history" && (session ? <HistoryView key={navNonce} groupId={groupId} players={players} profileId={profileId} isGroupMember={!!groupId} archiveNonce={archiveNonce} bumpArchive={bumpArchive} /> : <GateScreen />)}
      </div>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--topbar-bg)", borderTop: "1px solid var(--line)", backdropFilter: "blur(8px)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ maxWidth: 460, margin: "0 auto", display: "flex" }}>
          {!session && <button className={`pl-tab ${tab === "welcome" ? "on" : ""}`} onClick={() => goTab("welcome")}><LogIn size={20} strokeWidth={tab === "welcome" ? 2.6 : 2} />{t("tab_start")}</button>}
          {session && <button className={`pl-tab ${tab === "board" ? "on" : ""}`} onClick={() => goTab("board")}><Users size={20} strokeWidth={tab === "board" ? 2.6 : 2} />{t("tab_friends")}</button>}
          <button className={`pl-tab ${tab === "games" ? "on" : ""}`} onClick={() => goTab("games")}><Swords size={20} strokeWidth={tab === "games" ? 2.6 : 2} />{t("tab_games")}</button>
          <button className={`pl-tab ${tab === "tournaments" ? "on" : ""}`} onClick={() => goTab("tournaments")}><Trophy size={20} strokeWidth={tab === "tournaments" ? 2.6 : 2} />{t("tab_tournaments")}</button>
          {session && <button className={`pl-tab ${tab === "history" ? "on" : ""}`} onClick={() => goTab("history")}><History size={20} strokeWidth={tab === "history" ? 2.6 : 2} />{t("tab_history")}</button>}
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
  // 4 случайные собаки из 15 (как игроки на корте). Считаем один раз на маунте —
  // выбор стабилен между ререндерами (без мерцания). Картинки прекэшируются PWA,
  // так что на быстродействие это не влияет — грузятся те же 4 файла из кэша.
  const [heroDogs] = useState(() => {
    const nums = Array.from({ length: DOG_COUNT }, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
    return nums.slice(0, 4).map((n) => `dog-${String(n).padStart(2, "0")}`);
  });
  // Карточки = «что делать дальше» (онбординг), а не повтор витрины с лендинга.
  const features = [
    { icon: "🏆", title: t("feat_board_title"), sub: t("feat_board_sub") },   // создать/вступить в лигу
    { icon: "🔗", title: t("feat_stats_title"), sub: t("feat_stats_sub") },   // игры по ссылке
    { icon: "🎖️", title: t("feat_tour_title"), sub: t("feat_tour_sub") },     // уровни и ачивки
    { icon: "🏅", title: t("feat_pwa_title"), sub: t("feat_pwa_sub") },       // турниры
  ];
  return (
    <div className="pl-pop">
      {/* Hero — логотип теперь в топбаре; здесь крупный двухчастный слоган. */}
      <div style={{ textAlign: "center", padding: "26px 0 22px" }}>
        {/* «Стая» — брендовые собаки-игроки, чтобы было понятно, про какую стаю речь. */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          {heroDogs.map((d, i) => (
            <img key={d} src={`/avatars/${d}.webp`} alt="" loading="lazy" decoding="async"
              style={{ width: 54, height: 54, borderRadius: "50%", objectFit: "cover", border: "2.5px solid var(--bg)", marginLeft: i ? -15 : 0, boxShadow: "0 4px 14px -6px rgba(0,0,0,.55)", background: "var(--surface)", position: "relative", zIndex: i }} />
          ))}
        </div>
        {(() => {
          const [a, b] = t("tagline").split(" · ");
          const cap = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);
          return (
            <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 30, lineHeight: 1.18, letterSpacing: "-0.5px", maxWidth: 340, margin: "0 auto" }}>
              <span style={{ color: "var(--lime)" }}>{cap(a)}</span>
              {b && <><span style={{ color: "var(--mut)", fontWeight: 500 }}> ·</span><span style={{ color: "var(--ink)", display: "block" }}>{cap(b)}</span></>}
            </div>
          );
        })()}
        <div style={{ fontSize: 14, color: "var(--mut)", lineHeight: 1.6, maxWidth: 270, margin: "14px auto 0" }}>
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
// Двунаправленный свайп строки доски: влево раскрывает «Убрать», вправо —
// «Организатор» (если доступно). Действие — ТАПОМ по раскрытой кнопке, не
// авто-коммитом: случайный край-свайп ничего не делает. Тап по строке без свайпа
// открывает карточку игрока. Если действий нет — обычная строка без свайпа.
function SwipeRow({ onRemove, onOrganize, organizerActive, onTap, leftLabel, leftIcon, children }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0), startY = useRef(0), startDx = useRef(0), active = useRef(false), moved = useRef(false), snapped = useRef(0);
  const LEFT = onRemove ? 104 : 0;
  const RIGHT = onOrganize ? 104 : 0;
  if (!LEFT && !RIGHT) return <div style={{ marginBottom: 8 }} onClick={onTap}>{children}</div>;
  const down = (e) => { startX.current = e.clientX; startY.current = e.clientY; startDx.current = snapped.current; active.current = true; moved.current = false; setDragging(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} };
  const move = (e) => {
    if (!active.current) return;
    const dX = e.clientX - startX.current, dY = e.clientY - startY.current;
    if (startDx.current === 0 && !moved.current && Math.abs(dY) > Math.abs(dX) && Math.abs(dY) > 6) { active.current = false; setDragging(false); return; }
    if (Math.abs(dX) > 4) moved.current = true;
    setDx(Math.max(-LEFT, Math.min(RIGHT, startDx.current + dX)));
  };
  const up = () => {
    if (!active.current) return; active.current = false; setDragging(false);
    setDx((cur) => { const tgt = (LEFT && cur <= -LEFT * 0.45) ? -LEFT : (RIGHT && cur >= RIGHT * 0.45 ? RIGHT : 0); snapped.current = tgt; return tgt; });
  };
  // Клик по строке. После setPointerCapture клик приходит на саму обёртку (а не на
  // карточку), поэтому открываем карточку игрока ИМЕННО здесь: драг — игнор,
  // раскрытая строка — закрыть, чистый тап — onTap.
  const click = () => {
    if (moved.current) { moved.current = false; return; }
    if (snapped.current !== 0) { snapped.current = 0; setDx(0); return; }
    onTap && onTap();
  };
  const actBtn = { position: "absolute", top: 0, bottom: 0, width: 104, border: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontSize: 11, fontWeight: 700 };
  return (
    <div style={{ position: "relative", marginBottom: 8, borderRadius: 18, overflow: "hidden" }}>
      {RIGHT > 0 && (
        <button type="button" onClick={() => { snapped.current = 0; setDx(0); onOrganize(); }} style={{ ...actBtn, left: 0, background: "var(--lime)", color: "var(--lime-fg)" }}>
          <ShieldCheck size={16} /> {organizerActive ? t("unset_organizer_short") : t("set_organizer_short")}
        </button>
      )}
      {LEFT > 0 && (
        <button type="button" onClick={() => { snapped.current = 0; setDx(0); onRemove(); }} style={{ ...actBtn, right: 0, background: "var(--coral)", color: "#fff" }}>
          {leftIcon || <Trash2 size={16} />} {leftLabel || t("remove_btn")}
        </button>
      )}
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={click}
        style={{ position: "relative", transform: `translateX(${dx}px)`, transition: dragging ? "none" : "transform .2s ease", touchAction: "pan-y" }}>
        {children}
      </div>
    </div>
  );
}

function PlayerRowSkeleton({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="pl-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 8, opacity: i === count - 1 ? 0.6 : 1 }}>
          <div style={{ width: 22, flexShrink: 0 }} />
          <div className="plsk" style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, animationDelay: `${i * 0.08}s` }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="plsk" style={{ width: "55%", height: 13, marginBottom: 8, animationDelay: `${i * 0.08 + 0.05}s` }} />
            <div className="plsk" style={{ width: "35%", height: 10, animationDelay: `${i * 0.08 + 0.1}s` }} />
          </div>
          <div className="plsk" style={{ width: 38, height: 16, flexShrink: 0, animationDelay: `${i * 0.08 + 0.15}s` }} />
        </div>
      ))}
    </>
  );
}

function Board({ groupId, players, loading = false, reload, profileId, bumpArchive, isAdmin, leagues, activeLeague, onLeagueChange, onLeagueCreated, onEditProfile, selfStatsNonce = 0, analyticsNonce = 0 }) {
  const [open, setOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);  // дашборд аналитики лиги
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
  const [hiddenIds, setHiddenIds] = useState(() => new Set()); // #4: оптимистично скрытые из «Играли вместе»
  const [showLeagueMenu, setShowLeagueMenu] = useState(false);
  const [showNewLeague, setShowNewLeague] = useState(false); // "create" | "join" | false
  const [newLeagueName, setNewLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [leagueBusy, setLeagueBusy] = useState(false);
  const [leagueErr, setLeagueErr] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [publicLinkCopied, setPublicLinkCopied] = useState(false);
  const ranked = [...players].sort((a, b) => b.rating - a.rating);
  const [memberQuery, setMemberQuery] = useState("");

  // #4: совсем скрыть игрока из «Играли вместе». Оптимистично прячем строку, пишем в
  // аккаунт (hide_partner) и перечитываем список (played_with уже без скрытого).
  const hidePlayer = async (p) => {
    setHiddenIds((prev) => new Set(prev).add(p.id));
    try { await hidePartner(p.id); reload(); }
    catch (e) { setHiddenIds((prev) => { const n = new Set(prev); n.delete(p.id); return n; }); }
  };

  // «Моя статистика» из кабинета: открываем карточку текущего игрока, когда счётчик меняется.
  const lastStatsNonce = useRef(0);
  useEffect(() => {
    if (selfStatsNonce > 0 && selfStatsNonce !== lastStatsNonce.current && players.length) {
      const self = players.find((p) => p.id === profileId);
      if (self) { lastStatsNonce.current = selfStatsNonce; setSelected(self); }
    }
  }, [selfStatsNonce, players, profileId]);

  const lastAnalyticsNonce = useRef(0);
  useEffect(() => {
    if (analyticsNonce > 0 && analyticsNonce !== lastAnalyticsNonce.current) {
      lastAnalyticsNonce.current = analyticsNonce; setShowStats(true);
    }
  }, [analyticsNonce]);

  const gamesOf = (p) => srv ? (srv.games[p.id] ?? 0) : (matchCounts[p.id] || p.matches || 0);
  const toursOf = (p) => srv ? (srv.tours[p.id] ?? 0) : (tourCounts[p.id] || tourCountsByName[(p.name || "").trim().toLowerCase()] || 0);

  useEffect(() => {
    let active = true;
    if (!groupId) { setSrv(null); setExtraPlayers([]); setTourCounts({}); setTourCountsByName({}); setMatchCounts({}); setStreaks({}); return () => { active = false; }; }
    // Быстрый путь: app_bootstrap уже посчитал стрики и «не-участников» на сервере
    // (bstats:<gid>) — пропускаем listTournaments + getBoardMatches (до 500 строк).
    // Прайму доверяем 10 минут; любые мутации всё равно делают bustCache().
    const primed = cachePeek("bstats:" + groupId);
    if (primed && primed.at && Date.now() - primed.at < 600000) {
      setStreaks(primed.streaks || {});
      setExtraPlayers(primed.extra || []);
      setTourCounts({}); setTourCountsByName({}); setMatchCounts({});
      getGroupCounts(groupId).then((c) => { if (active) setSrv(c); }).catch(() => { if (active) setSrv(null); });
      return () => { active = false; };
    }
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
    catch (e) { alert(t("err_add_player")); }
    finally { setBusy(false); }
  };

  // Создать нового гостя по введённому имени (контакты заполняются в профиле).
  const addGuest = async () => {
    const n = query.trim();
    if (!n || busy) return;
    setBusy(true);
    try { await addMember(groupId, n, {}); setQuery(""); reload(); }
    catch (e) { alert(t("err_add_player")); }
    finally { setBusy(false); }
  };

  if (showStats) return <Analytics groupId={groupId} players={players} onBack={() => setShowStats(false)} onOpenPlayer={(p) => { setShowStats(false); setSelected(p); }} />;

  if (selected) return (
    <PlayerDetail key={selected.id} groupId={groupId} player={selected} players={players} close={() => setSelected(null)} onOpenPlayer={setSelected}
      isAdmin={isAdmin} onEditProfile={onEditProfile}
      onAddToLeague={isAdmin ? async () => {
        await supabase.from("group_members").insert({ group_id: groupId, profile_id: selected.id, rating: 1000 });
        bustCache(); // #4: список друзей перестраивается сразу
        reload();
        setSelected(null);
      } : undefined}
      onDelete={isAdmin ? async () => {
        // Убираем только из лиги (членство). История игр/турниров сохраняется,
        // игрока можно вернуть. Игры/турниры удаляются отдельно и осознанно.
        await removeMember(groupId, selected.id);
        reload();
        setSelected(null);
      } : undefined}
      isOwner={activeLeague?.role === "owner"}
      onSetRole={activeLeague?.role === "owner" ? async (role) => {
        await setMemberRole(groupId, selected.id, role);
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
    const url = `${WEB_BASE}/l/${activeLeague.invite_code}`;
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
    } catch (e) { setLeagueErr(e.message || t("err_generic")); }
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
      if (msg.includes("league_not_found")) setLeagueErr(t("err_league_not_found"));
      else if (msg.includes("already_member")) setLeagueErr(t("err_already_member"));
      else setLeagueErr(msg || t("err_generic"));
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

      {/* Компактная плашка: логотип лиги + код приглашения + копировать/поделиться.
          #4: видна только тем, кто может приглашать в лигу (владелец/организатор
          или когда включено «участники могут добавлять»). */}
      {activeLeague?.invite_code && (isAdmin || activeLeague?.members_can_add) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "8px 10px 8px 8px", background: "color-mix(in srgb, var(--lime) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 35%, transparent)", borderRadius: 14, fontFamily: "'Outfit',sans-serif" }}>
          <LeagueLogo url={activeLeague.logo_url} name={activeLeague.name} size={38} radius={12} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: "var(--mut)", lineHeight: 1 }}>{t("league_invite_label")}</div>
            <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 22, letterSpacing: 3, color: "var(--lime)", lineHeight: 1.15 }}>{activeLeague.invite_code}</div>
          </div>
          <button onClick={copyInvite} title={t("copy_code")} aria-label={t("copy_code")} style={{ flexShrink: 0, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--lime) 18%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 35%, transparent)", borderRadius: 11, color: "var(--lime)", cursor: "pointer" }}>
            {inviteCopied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button onClick={copyPublicLink} title={t("league_page")} aria-label={t("league_page")} style={{ flexShrink: 0, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--lime) 18%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 35%, transparent)", borderRadius: 11, color: "var(--lime)", cursor: "pointer" }}>
            {publicLinkCopied ? <Check size={16} /> : <Share2 size={16} />}
          </button>
        </div>
      )}

      {groupId && ranked.length === 0 && (
        <div className="pl-card" style={{ padding: 20, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t("onboarding_title")}</div>
          {[
            { n: 1, icon: "👤", text: t("onboarding_1_text"), sub: isAdmin ? t("onboarding_1_sub_admin") : t("onboarding_1_sub_member") },
            { n: 2, icon: "⚔️", text: t("onboarding_2_text"), sub: t("onboarding_2_sub") },
            { n: 3, icon: "📣", text: t("onboarding_3_text"), sub: (activeLeague?.invite_code && (isAdmin || activeLeague?.members_can_add)) ? t("onboarding_3_sub_code").replace("{code}", activeLeague.invite_code) : t("onboarding_3_sub_no_code") },
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
      {/* #3: Аналитика лиги — верхний блок-плитка над списком друзей (раньше был значок в шапке). */}
      {groupId && ranked.length > 0 && (
        <div className="pl-card" onClick={() => setShowStats(true)}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", marginBottom: 12, cursor: "pointer", background: "color-mix(in srgb, var(--lime) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 30%, transparent)" }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: "color-mix(in srgb, var(--lime) 16%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={19} style={{ color: "var(--lime)" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink)" }}>{t("an_open")}</div>
            <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 1 }}>{t("an_tile_sub")}</div>
          </div>
          <ChevronRight size={18} style={{ color: "var(--lime)", flexShrink: 0 }} />
        </div>
      )}
      {groupId && ranked.length > 4 && (
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--mut)" }} />
          <input className="pl-input" style={{ paddingLeft: 34 }} placeholder={t("search_members")} value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} />
        </div>
      )}
      {groupId && loading && ranked.length === 0 && <PlayerRowSkeleton count={5} />}
      {groupId && ranked.map((p, i) => {
        if (memberQuery.trim() && !p.name.toLowerCase().includes(memberQuery.trim().toLowerCase())) return null;
        const qb = [];
        if (i === 0) qb.push("🥇");
        if (p.matches >= 5 && p.wins / p.matches >= 0.7) qb.push("🎯");
        if (p.matches >= 20) qb.push("⚡");
        if (toursOf(p) >= 3) qb.push("🏆");
        if ((streaks[p.id] || 0) >= 3) qb.push("🔥"); // «На подъёме» — 3+ победы подряд
        const canRemove = isAdmin && p.role !== "owner" && p.id !== profileId;
        const canOrg = activeLeague?.role === "owner" && p.user_id && p.role !== "owner" && p.id !== profileId;
        return (
          <SwipeRow key={p.id}
            onRemove={canRemove ? async () => { await removeMember(groupId, p.id); reload(); } : null}
            onOrganize={canOrg ? async () => { await setMemberRole(groupId, p.id, p.role === "admin" ? "member" : "admin"); reload(); } : null}
            organizerActive={p.role === "admin"} onTap={() => setSelected(p)}>
          <div className="pl-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", border: p.id === profileId ? "1.5px solid color-mix(in srgb, var(--lime) 60%, transparent)" : undefined, background: p.id === profileId ? "color-mix(in srgb, var(--lime) 8%, transparent)" : undefined }}>
            <div className="pl-display" style={{ width: 22, fontSize: 22, color: ["var(--yellow)", "#cfd8d0", "#cd7f4d"][i] || "var(--mut)" }}>{i + 1}</div>
            <img src={playerAvatar(p.avatar_url, p.id)} onError={avatarFallback(p.id)} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                {p.role === "owner"
                  ? <Star size={14} style={{ color: "var(--yellow)", flexShrink: 0 }} aria-label={t("role_owner")} />
                  : p.role === "admin"
                    ? <ShieldCheck size={14} style={{ color: "var(--yellow)", flexShrink: 0 }} aria-label={t("role_organizer")} />
                    : p.user_id
                      ? <UserCheck size={14} style={{ color: "var(--lime)", flexShrink: 0 }} aria-label={t("account_badge")} />
                      : <User size={13} style={{ color: "var(--mut)", flexShrink: 0 }} aria-label={t("guest_tag")} />}
              </div>
              {/* #5: статистика (слева) отделена от бейджей уровня/ачивок (справа). */}
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, fontSize: 12, color: "var(--mut)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={t("tab_games")}><Swords size={13} /> {gamesOf(p)}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={t("tab_tournaments")}><Trophy size={13} /> {toursOf(p)}</span>
                </span>
                {qb.length > 0 && <span style={{ letterSpacing: 2, marginLeft: "auto" }}>{qb.join("")}</span>}
              </div>
            </div>
            <ChevronRight size={14} style={{ color: "var(--mut)", flexShrink: 0 }} />
          </div>
          </SwipeRow>
        );
      })}

      {!groupId && (() => {
        const friends = ranked.filter((p) => p.id !== profileId && !hiddenIds.has(p.id));
        return friends.length > 0 ? (
        <>
          <div className="pl-display" style={{ fontSize: 12, color: "var(--mut)", margin: "4px 2px 8px", letterSpacing: 1 }}>{t("played_together_label")}</div>
          {friends.map((p) => (
            <SwipeRow key={p.id} onRemove={() => hidePlayer(p)} onTap={() => setSelected(p)}
              leftLabel={t("hide_btn")} leftIcon={<EyeOff size={16} />}>
            <div className="pl-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer" }}>
              <img src={playerAvatar(p.avatar_url, p.id)} onError={avatarFallback(p.id)} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "var(--mut)", display: "inline-flex", alignItems: "center", gap: 4 }}><Swords size={13} /> {p.matches}</div>
              </div>
              <ChevronRight size={14} style={{ color: "var(--mut)", flexShrink: 0 }} />
            </div>
            </SwipeRow>
          ))}
        </>
      ) : (
        <EmptyState text={t("solo_friends_empty")} />
      ); })()}

      {groupId && (isAdmin || activeLeague?.members_can_add) && <Fab label={t("add_player_form_title")} icon={<User size={24} />} onClick={() => setOpen(true)} />}
      {/* Форма добавления — модалка-лист (портал в body), всегда видна, даже при длинном списке. */}
      {groupId && open && createPortal(
        <div onClick={() => { setQuery(""); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: "'Outfit',sans-serif" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "20px 20px 0 0", padding: 16, paddingBottom: "max(16px, env(safe-area-inset-bottom))", boxShadow: "0 -8px 40px rgba(0,0,0,.5)", maxHeight: "85vh", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>{t("add_player_form_title")}</span>
              <button className="pl-ghost" style={{ padding: "2px 8px" }} onClick={() => { setQuery(""); setOpen(false); }}><X size={16} /></button>
            </div>
            <input className="pl-input" style={{ padding: "10px 12px" }} placeholder={t("add_search_placeholder")} value={query}
              onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGuest()} autoFocus />
            {query.trim() && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {netPlayers.filter((p) => (p.name || "").toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6).map((p) => (
                  <button key={p.id} disabled={busy} onClick={() => addExisting(p)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, cursor: "pointer", color: "var(--ink)", fontFamily: "'Outfit'", textAlign: "left" }}>
                    <img src={playerAvatar(p.avatar_url, p.id)} onError={avatarFallback(p.id)} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
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
        </div>,
        document.body
      )}

      {extraPlayers.length > 0 && (
        <>
          <div className="pl-display" style={{ fontSize: 12, color: "var(--mut)", margin: "14px 2px 8px", letterSpacing: 1 }}>{t("played_together_label")}</div>
          {extraPlayers.map((p) => (
            <div key={p.id} className="pl-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", marginBottom: 8, cursor: "pointer" }} onClick={() => setSelected(p)}>
              <img src={playerAvatar(p.avatar_url, p.id)} onError={avatarFallback(p.id)} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "var(--mut)" }}>{t("not_in_league")}</div>
              </div>
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
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    try { await onConfirm(); }
    catch (e) { alert(t("err_delete")); setBusy(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
      <div className="pl-card" style={{ padding: 20, width: "100%", maxWidth: 360 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{t("remove_from_league")}: {player.name}?</div>
        <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 16 }}>
          {t("remove_from_league_sub")}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="pl-ghost" style={{ flex: 1, padding: 11 }} onClick={onCancel} disabled={busy}>{t("cancel")}</button>
          <button style={{ flex: 1, padding: 11, border: "none", borderRadius: 12, background: "var(--coral)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: busy ? .6 : 1 }}
            onClick={go} disabled={busy}>
            {busy ? t("deleting") : t("remove_btn")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- ClaimLinkButton ------------------------------------ */
function ClaimLinkButton({ claimCode }) {
  const [toast, setToast] = useState("");
  const link = `${WEB_BASE}/r/${claimCode}`;
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

// Лучший партнёр — средневзвешенная методика. Чтобы пара удачных матчей не
// перебивала долгую совместную историю, ранжируем по СГЛАЖЕННОЙ суммарной разнице:
//   score = сумма разницы (сетов в играх / очков в турнирах) / (матчи + K).
// K сглаживает малую выборку → даёт вес объёму. Порог — минимум 2 матча вместе.
// Тай-брейк при равном score: больше совместных матчей, затем больше побед.
const PARTNER_K = 3;
function pickBestPartner(list) {
  let best = null;
  for (const s of list) {
    const total = s.w + s.l + s.d;
    if (total < 2) continue;
    const score = s.diff / (total + PARTNER_K);
    const cand = { ...s, total, avg: s.diff / total, rate: s.w / total, score };
    if (!best || score > best.score ||
        (score === best.score && (total > best.total || (total === best.total && s.w > best.w)))) {
      best = cand;
    }
  }
  return best;
}

// Карточка «лучший партнёр» с раскрывающейся подсказкой «?» (прозрачно объясняет
// алгоритм). Подсказка раскрывается ВНУТРИ карточки (не выпадашкой), чтобы текст
// не выходил за экран. Текст контекстный: для игр про геймы, для турниров про очки.
function PartnerCard({ label, bp, name, avatarUrl, help, onOpen }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "var(--mut)" }}>{label}</span>
        <button type="button" onClick={() => setShowHelp((s) => !s)} aria-label="?"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--mut)", cursor: "pointer", padding: 0, flexShrink: 0 }}>
          <HelpCircle size={12} />
        </button>
      </div>
      {showHelp && (
        <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--mut)", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px", marginBottom: 10 }}>{help}</div>
      )}
      <div onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 10, cursor: onOpen ? "pointer" : "default" }}>
        <img src={avatarUrl} onError={avatarFallback(bp?.id || name)} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{name || "?"}</div>
          <div style={{ fontSize: 12, color: "var(--mut)" }}>{bp.w} {t("wins_short")} · {bp.l} {t("losses_short")} · {bp.total} {t("matches")}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, lineHeight: 1.1, color: bp.score >= 0 ? "var(--lime)" : "var(--coral)" }}>{bp.score > 0 ? "+" : ""}{bp.score.toFixed(1)}</div>
          <div style={{ fontSize: 10, color: "var(--mut)" }}>{t("partner_index")}</div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- PlayerDetail ------------------------------- */
function PlayerDetail({ groupId, player, players, close, onDelete, isAdmin, isOwner, onAddToLeague, onEditProfile, onSetRole, onOpenPlayer }) {
  const [hist, setHist] = useState(null);
  const [myId, setMyId] = useState(null);
  const [allMatches, setAllMatches] = useState(null);
  const [nameMap, setNameMap] = useState({}); // id→имя для участников вне текущего ростера лиги
  const [playerTours, setPlayerTours] = useState(null);
  const [rawTours, setRawTours] = useState(null);
  const [tourH2H, setTourH2H] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playerLeagues, setPlayerLeagues] = useState(null);
  const [localClaimCode, setLocalClaimCode] = useState(player.claim_code || null);
  const [genBusy, setGenBusy] = useState(false);
  const [showL, setShowL] = useState(false); // развернуть список лиг
  const [showAch, setShowAch] = useState(false); // легенда ачивок («?»)
  const isInLeague = players.some((p) => p.id === player.id);

  const generateClaimCode = async () => {
    setGenBusy(true);
    // Серверная генерация: только админ/владелец, только для гостя, идемпотентно.
    // (Раньше прямой update profiles тихо падал у не-супер-админов.)
    try {
      const { data } = await supabase.rpc("ensure_claim_code", { p_profile_id: player.id });
      if (data) setLocalClaimCode(data);
    } catch (_) {}
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
          date: tour.starts_at || tour.created_at || null,
        };
      });
      // по дате — свежие первыми (для «последних 10» в статистике)
      rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
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

  // Подтягиваем имена участников, которых нет в текущем ростере лиги (например,
  // удалённых ИЗ ЛИГИ — их профиль не удаляется, имя всё равно показываем).
  useEffect(() => {
    if (!allMatches) return;
    const ids = new Set();
    allMatches.forEach((m) => [...(m.team_a || []), ...(m.team_b || [])].forEach((id) => id && ids.add(id)));
    const missing = [...ids].filter((id) => !players.some((p) => p.id === id) && !nameMap[id]);
    if (missing.length === 0) return;
    getProfileNames(missing).then((data) => {
      if (!data || !data.length) return;
      setNameMap((prev) => { const n = { ...prev }; data.forEach((r) => { n[r.id] = r.name; }); return n; });
    }).catch(() => {});
  }, [allMatches, players]);

  // Имя по id: ростер лиги → подтянутые профили → нейтральный прочерк (без «Удалён»).
  const nameOf = (id) => players.find((p) => p.id === id)?.name || nameMap[id] || "—";

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
      // Разница ПО ГЕЙМАМ (точнее, чем по сетам). Режим «sets» → сумма геймов по
      // сетам из score_detail; режимы «free»/«sum» детального счёта не пишут, но там
      // sets_a/sets_b и есть сам счёт — берём его напрямую.
      let myG;
      if (Array.isArray(m.score_detail) && m.score_detail.length > 0) {
        const ga = m.score_detail.reduce((s, x) => s + (x.a || 0), 0);
        const gb = m.score_detail.reduce((s, x) => s + (x.b || 0), 0);
        myG = ga - gb;
      } else {
        myG = (m.sets_a || 0) - (m.sets_b || 0);
      }
      const my = pInA ? myG : -myG;
      teammates.forEach((tid) => {
        if (tid === player.id) return;
        if (!stats[tid]) stats[tid] = { id: tid, w: 0, l: 0, d: 0, diff: 0 };
        stats[tid].diff += my;
        if (my === 0) stats[tid].d++; else if (my > 0) stats[tid].w++; else stats[tid].l++;
      });
    });
    return pickBestPartner(Object.values(stats));
  })();

  // Best partner в ТУРНИРАХ (по матчам завершённых турниров игрока, rawTours).
  // team_a/team_b хранят id участников турнира (tp.id) → маппим к профилю/имени.
  const bestPartnerTour = (() => {
    if (!rawTours || rawTours.length === 0) return null;
    const stats = {}; // ключ: profile_id || ("g:"+имя)
    rawTours.forEach((tour) => {
      const myTp = (tour.players || []).find((p) => p.profile_id === player.id);
      if (!myTp) return;
      const byTpId = {};
      (tour.players || []).forEach((p) => { byTpId[p.id] = p; });
      (tour.matches || []).forEach((m) => {
        if (m.score_a == null) return;
        const inA = (m.team_a || []).includes(myTp.id);
        const inB = (m.team_b || []).includes(myTp.id);
        if (!inA && !inB) return;
        const mates = inA ? (m.team_a || []) : (m.team_b || []);
        const my = inA ? (m.score_a - m.score_b) : (m.score_b - m.score_a); // разница очков (как в американо)
        mates.forEach((tid) => {
          if (tid === myTp.id) return;
          const tp = byTpId[tid];
          if (!tp) return;
          const key = tp.profile_id || ("g:" + (tp.name || tid));
          if (!stats[key]) stats[key] = { id: tp.profile_id || null, name: tp.name || "?", w: 0, l: 0, d: 0, diff: 0 };
          stats[key].diff += my;
          if (my === 0) stats[key].d++; else if (my > 0) stats[key].w++; else stats[key].l++;
        });
      });
    });
    return pickBestPartner(Object.values(stats));
  })();

  // «Лучший партнёр» вынесен в модульный компонент PartnerCard (с подсказкой «?»).

  // Текущая серия побед игрока (для ачивки «На подъёме») — по последним матчам лиги.
  // Считаем так же, как streaks в списке друзей: подряд идущие победы с конца, ничья/поражение рвут.
  const winStreak = (() => {
    if (!allMatches) return 0;
    const rows = allMatches
      .filter((m) => [...(m.team_a || []), ...(m.team_b || [])].includes(player.id))
      .sort((a, b) => (a.played_at || "").localeCompare(b.played_at || ""));
    let s = 0;
    for (let idx = rows.length - 1; idx >= 0; idx--) {
      const m = rows[idx];
      if (m.sets_a === m.sets_b) break;
      const won = (m.team_a || []).includes(player.id) ? m.sets_a > m.sets_b : m.sets_b > m.sets_a;
      if (won) s++; else break;
    }
    return s;
  })();

  // Ачивки
  const badges = (() => {
    const result = [];
    const rankedAll = [...players].sort((a, b) => b.rating - a.rating);
    if (rankedAll.length > 0 && rankedAll[0].id === player.id)
      result.push({ id: "leader", icon: "🥇", label: t("badge_leader"), title: t("badge_leader_title") });
    if (player.matches >= 5 && player.wins / player.matches >= 0.7)
      result.push({ id: "sniper", icon: "🎯", label: t("badge_sniper"), title: t("badge_sniper_title") });
    if (player.matches >= 20)
      result.push({ id: "veteran", icon: "⚡", label: t("badge_veteran"), title: t("badge_veteran_title") });
    if (winStreak >= 3)
      result.push({ id: "rising", icon: "🔥", label: t("badge_rising"), title: t("badge_rising_title") });
    if (playerTours && playerTours.length >= 3)
      result.push({ id: "tourney", icon: "🏆", label: t("badge_tourney"), title: t("badge_tourney_title") });
    return result;
  })();

  // Все ачивки с правилами — для подсказки-легенды по «?» (показываем и те, которых пока нет).
  const ALL_ACH = [
    { icon: "🥇", label: t("badge_leader"),  rule: t("badge_leader_title") },
    { icon: "🎯", label: t("badge_sniper"),  rule: t("badge_sniper_title") },
    { icon: "⚡", label: t("badge_veteran"), rule: t("badge_veteran_title") },
    { icon: "🔥", label: t("badge_rising"),  rule: t("badge_rising_title") },
    { icon: "🏆", label: t("badge_tourney"), rule: t("badge_tourney_title") },
  ];

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

  // #5: действия игрока — отдельный блок под бейджами (раньше были вперемешку).
  const showGenClaim   = !player.user_id && !localClaimCode && isAdmin;
  const showClaimLink  = !player.user_id && !!localClaimCode;
  const showAddToLeague = !!onAddToLeague && !isInLeague;
  const showDelete     = !!onDelete && isAdmin && !!myId && myId !== player.id && isInLeague;
  const showSetRole    = !!onSetRole && isOwner && !!player.user_id && player.role !== "owner" && myId !== player.id && isInLeague;
  const hasCompactAction = showAddToLeague || showSetRole || showGenClaim || showDelete;
  const hasActions = hasCompactAction || showClaimLink;

  return (
    <div className="pl-pop">
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <BackButton onClick={close} />
        {onEditProfile && myId && myId === player.id && (
          <button className="pl-ghost" style={{ padding: "6px 12px", marginLeft: "auto", color: "var(--lime)", borderColor: "color-mix(in srgb, var(--lime) 35%, transparent)" }} onClick={onEditProfile}>
            {t("pc_title")}
          </button>
        )}
      </div>

      {/* Шапка игрока */}
      <div className="pl-card" style={{ padding: 18, marginBottom: 10, textAlign: "center" }}>
        <img src={playerAvatar(player.avatar_url, player.id)} onError={avatarFallback(player.id)} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--line)", marginBottom: 8 }} />
        <div className="pl-display" style={{ fontSize: 24 }}>{player.name}</div>
        {/* Ачивки + «?» с легендой правил (работает и на тач, в отличие от hover-подсказки). */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", alignItems: "center", marginTop: 10 }}>
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
          <button type="button" onClick={() => setShowAch((s) => !s)} aria-label={t("ach_help")} title={t("ach_help")}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", border: "1px solid var(--line)", background: showAch ? "var(--surface2)" : "none", color: "var(--mut)", cursor: "pointer", padding: 0, flexShrink: 0 }}>
            <HelpCircle size={12} />
          </button>
        </div>
        {showAch && (
          <div style={{ marginTop: 8, textAlign: "left", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 6, fontSize: 12 }}>{t("ach_legend_title")}</div>
            {ALL_ACH.map((a) => (
              <div key={a.label} style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4, fontSize: 11.5, lineHeight: 1.4, color: "var(--mut)" }}>
                <span style={{ fontSize: 13, flexShrink: 0, width: 16, textAlign: "center" }}>{a.icon}</span>
                <span><b style={{ color: "var(--ink)", fontWeight: 700 }}>{a.label}</b> — {a.rule}</span>
              </div>
            ))}
          </div>
        )}
        <ContactLinks contacts={player.contacts} />

        {/* #5: действия отделены от бейджей — разделитель + сгруппированный блок кнопок. */}
        {hasActions && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            {hasCompactAction && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {showAddToLeague && (
                  <button onClick={onAddToLeague}
                    style={{ padding: "8px 16px", border: "none", borderRadius: 10, background: "var(--lime)", color: "var(--lime-fg)", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Outfit'" }}>
                    {t("add_to_league")}
                  </button>
                )}
                {showSetRole && (
                  <button onClick={() => onSetRole(player.role === "admin" ? "member" : "admin")}
                    style={{ padding: "8px 14px", border: "1px solid color-mix(in srgb, var(--lime) 40%, transparent)", borderRadius: 10, background: "none", color: "var(--lime)", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Outfit'" }}>
                    <ShieldCheck size={12} /> {player.role === "admin" ? t("unset_organizer") : t("set_organizer")}
                  </button>
                )}
                {showGenClaim && (
                  <button onClick={generateClaimCode} disabled={genBusy}
                    style={{ padding: "8px 16px", border: "1px solid rgba(200,255,45,.4)", borderRadius: 10, background: "rgba(200,255,45,.07)", color: "var(--lime)", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Outfit'" }}>
                    <Share2 size={13} /> {genBusy ? t("creating") : t("create_claim_link")}
                  </button>
                )}
                {showDelete && (
                  <button onClick={() => setShowDeleteModal(true)}
                    style={{ padding: "8px 14px", border: "1px solid rgba(255,106,82,.35)", borderRadius: 10, background: "none", color: "var(--coral)", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Outfit'" }}>
                    <Trash2 size={12} /> {t("remove_from_league")}
                  </button>
                )}
              </div>
            )}
            {showClaimLink && <ClaimLinkButton claimCode={localClaimCode} />}
          </div>
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--mut)", marginBottom: 10 }}><Trophy size={14} /> {t("tab_tournaments")}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {tileStat(myTourStats.total, t("trn_stat_total"), "var(--ink)")}
            {tileStat(myTourStats.podium, t("trn_stat_podium"), "#ffd23f")}
            {tileStat(myTourStats.wins, t("trn_stat_wins"), "var(--lime)")}
          </div>
        </div>
      </div>

      {/* Лучший партнёр — отдельно по играм и по турнирам */}
      {bestPartner && (() => {
        const bp = players.find((p) => p.id === bestPartner.id);
        return <PartnerCard key="bp-games" label={t("best_partner_games")} bp={bestPartner} name={bp?.name || nameMap[bestPartner.id] || "?"} avatarUrl={playerAvatar(bp?.avatar_url, bestPartner.id)} help={t("best_partner_help_games")} onOpen={bp ? () => onOpenPlayer(bp) : undefined} />;
      })()}
      {bestPartnerTour && (() => {
        const tp = players.find((p) => p.id === bestPartnerTour.id);
        return <PartnerCard key="bp-tour" label={t("best_partner_tour")} bp={bestPartnerTour} name={bestPartnerTour.name} avatarUrl={playerAvatar(tp?.avatar_url, bestPartnerTour.id || bestPartnerTour.name)} help={t("best_partner_help_tour")} onOpen={tp ? () => onOpenPlayer(tp) : undefined} />;
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
      {/* Игры — «форма» за последние 10: кружок В / Н / П */}
      {playerMatches.length > 0 && (
        <div className="pl-card" style={{ padding: 14, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Swords size={14} /> {t("games_heading")}</div>
            <div style={{ fontSize: 11, color: "var(--mut)" }}>{t("stat_last10")}</div>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {playerMatches.slice(0, 10).reverse().map((m) => {
              const inA = (m.team_a || []).includes(player.id);
              const draw = m.sets_a === m.sets_b;
              const won = inA ? m.sets_a > m.sets_b : m.sets_b > m.sets_a;
              const c = draw ? "var(--mut)" : won ? "#3ddc84" : "var(--coral)";
              return (
                <span key={m.id} title={`${(m.team_a || []).map(nameOf).join(" & ")} ${m.sets_a}:${m.sets_b} ${(m.team_b || []).map(nameOf).join(" & ")}${m.played_at ? " · " + fmtDate(m.played_at) : ""}`}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: `color-mix(in srgb, ${c} 16%, transparent)`, border: `1.5px solid color-mix(in srgb, ${c} 55%, transparent)`, color: c, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, fontFamily: "'Outfit',sans-serif", flexShrink: 0 }}>
                  {draw ? t("result_draw") : won ? t("result_win") : t("result_loss")}
                </span>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 7 }}>
            <span style={{ fontSize: 9, color: "var(--mut)" }}>{t("recency_hint")}</span>
          </div>
        </div>
      )}
      {/* Турниры — последние 10: кружок = занятое место */}
      {playerTours && playerTours.length > 0 && (
        <div className="pl-card" style={{ padding: 14, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Trophy size={14} /> {t("tours_heading")}</div>
            <div style={{ fontSize: 11, color: "var(--mut)" }}>{t("stat_last10")}</div>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {playerTours.slice(0, 10).reverse().map((tour) => {
              const pos = tour.position;
              const c = pos === 1 ? "var(--yellow)" : pos === 2 ? "#cfd8d0" : pos === 3 ? "#cd7f4d" : "var(--mut)";
              return (
                <span key={tour.id} title={`${tour.name || t("fmt_americano_name")} · ${pos}/${tour.total}`}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: `color-mix(in srgb, ${c} 16%, transparent)`, border: `1.5px solid color-mix(in srgb, ${c} 55%, transparent)`, color: c, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, fontFamily: "'Outfit',sans-serif", flexShrink: 0 }}>
                  {pos}
                </span>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 7 }}>
            <span style={{ fontSize: 9, color: "var(--mut)" }}>{t("recency_hint")}</span>
          </div>
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
// Участвует ли текущий пользователь (me = его profile.id) в игре — по слотам.
const meInGame = (g, me) => !!me && (g?.slots || []).some((s) => s.profile_id === me);
// Бейдж «Вы» — лаймовая пилюля для карточек, где играет текущий пользователь.
function MeBadge({ style }) {
  return <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, padding: "2px 7px", borderRadius: 20, background: "color-mix(in srgb, var(--lime) 18%, transparent)", color: "var(--lime)", flexShrink: 0, textTransform: "uppercase", ...style }}>{t("you_badge")}</span>;
}
export function GameRow({ g, color, onOpen, flush, bare, label, me = null }) {
  const mine = meInGame(g, me);
  const gslots = [...(g.slots || [])].sort((a, b) => ((a.team || "") + (a.position || "")).localeCompare((b.team || "") + (b.position || "")));
  const tA = gslots.filter(s => s.team === "A");
  const tB = gslots.filter(s => s.team === "B");
  const filled = gslots.filter(s => s.profile_id || s.guest_name).length;
  const has = (s) => !!(s && (s.profile_id || s.guest_name));
  const m = (g.matches || [])[0];
  const played = g.status === "played";
  const avSize = 38;
  const aWon = played && m && m.sets_a > m.sets_b;
  const bWon = played && m && m.sets_b > m.sets_a;
  const Slot = ({ s, ring }) => has(s)
    ? <Avatar name={s.profile?.name || s.guest_name} url={s.profile?.avatar_url} id={s.profile_id || s.guest_name} size={avSize} ring={ring} style={{ marginLeft: -12 }} />
    : <span style={{ width: avSize, height: avSize, borderRadius: "50%", border: "1.5px dashed var(--line)", background: "var(--surface2)", flexShrink: 0, display: "inline-block", marginLeft: -12, boxSizing: "border-box" }} />;
  const nm = (slots) => slots.filter(has).map(s => s.profile?.name || s.guest_name).join(" & ") || "—";
  // Состав с выделением имени текущего пользователя (жирным + лаймовое подчёркивание).
  const renderNames = (slots) => {
    const arr = slots.filter(has);
    if (!arr.length) return "—";
    const out = [];
    arr.forEach((sp, i) => {
      if (i > 0) out.push(<span key={"s" + i} style={{ fontWeight: 400 }}> & </span>);
      const isMe = !!me && sp.profile_id === me;
      const label = sp.profile?.name || sp.guest_name;
      out.push(isMe
        ? <span key={i} style={{ fontWeight: 700, textDecoration: "underline", textDecorationColor: "var(--lime)", textUnderlineOffset: 2 }}>{label}</span>
        : <span key={i}>{label}</span>);
    });
    return out;
  };
  const namesCss = { fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", fontSize: 11.5, lineHeight: 1.25, textAlign: "center", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" };
  const Team = ({ a, b, ring, names, won }) => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{ display: "flex", paddingLeft: 12 }}><Slot s={a} ring={ring} /><Slot s={b} ring={ring} /></div>
      <div style={{ ...namesCss, color: won ? "var(--lime)" : "var(--mut)", fontWeight: won ? 700 : 500 }}>{names}</div>
    </div>
  );
  return (
    <div className={bare ? "" : "pl-card"} style={{ marginBottom: bare ? 0 : (flush ? 0 : 8), cursor: "pointer", padding: bare ? "10px 2px" : "12px 14px", boxShadow: (mine && !bare) ? "inset 3px 0 0 var(--lime)" : undefined }} onClick={onOpen}>
      {/* bare-режим (внутри плашки микс-сессии): без шапки, только составы и счёт. */}
      {!bare && (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Swords size={24} color={color} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title || "Padel"}</span>
            {mine && <MeBadge />}
          </div>
          {g.starts_at && <div style={{ fontSize: 12, color: "var(--mut)" }}>{fmtDate(g.starts_at)}</div>}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "rgba(255,255,255,.06)", color: played ? "var(--mut)" : color, flexShrink: 0 }}>
          {played ? "✓" : `${filled}/4`}
        </span>
      </div>
      )}
      {bare && label && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mut)", letterSpacing: 0.5 }}>{label}</div>}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 10, marginTop: bare ? 6 : 11 }}>
        <Team a={tA[0]} b={tA[1]} ring="var(--lime)" names={renderNames(tA)} won={aWon} />
        <span style={{ fontFamily: "'Anton',sans-serif", fontSize: played ? 32 : 13, color: "var(--mut)", flexShrink: 0, minWidth: 44, textAlign: "center", paddingTop: 10 }}>
          {played && m ? <><span style={{ color: aWon ? "var(--lime)" : "var(--ink)" }}>{m.sets_a}</span><span style={{ color: "var(--mut)" }}>:</span><span style={{ color: bWon ? "var(--coral)" : "var(--ink)" }}>{m.sets_b}</span></> : "—"}
        </span>
        <Team a={tB[0]} b={tB[1]} ring="var(--coral)" names={renderNames(tB)} won={bWon} />
      </div>
      {/* Счёт по геймам внутри каждого сета (как было до унификации). */}
      {played && Array.isArray(m?.score_detail) && m.score_detail.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {m.score_detail.map((s, i) => (
            <span key={i} style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: 0.3 }}>
              <span style={{ color: s.a > s.b ? "var(--lime)" : "var(--mut)" }}>{s.a}</span>
              <span style={{ color: "var(--mut)" }}>:</span>
              <span style={{ color: s.b > s.a ? "var(--coral)" : "var(--mut)" }}>{s.b}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Объединённая плашка микс-сессии: несколько под-игр одного выхода (тот же
// состав, разные расстановки). Внутри — каждая под-игра со своим счётом.
function MixGroupCard({ games, color, onOpenGame, me = null }) {
  const first = games[0];
  const mine = !!me && games.some((g) => meInGame(g, me));
  const when = first.starts_at || first.created_at;
  return (
    <div className="pl-card" style={{ padding: 0, overflow: "hidden", boxShadow: mine ? "inset 3px 0 0 var(--lime)" : undefined }}>
      <div onClick={() => onOpenGame(first)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
        <Shuffle size={18} color={color} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{first.title || t("mix_session_title")}</span>
            {mine && <MeBadge />}
          </div>
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

function Games({ groupId, players, profileId, reloadLeaderboard, session, archiveNonce, bumpArchive, onLogin, canCreate = false, openReq = null }) {
  const [games, setGames] = useState([]);
  const [mode, setMode] = useState("list");
  const [selId, setSelId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadGames = useCallback(async () => {
    setLoading(true);
    try { setGames(groupId ? await listGames(groupId) : await listMyGames()); } catch (e) { /* noop */ } finally { setLoading(false); }
  }, [groupId]);
  useEffect(() => { loadGames(); }, [loadGames, archiveNonce]);

  // Открытие конкретной игры из уведомления: ждём загрузки списка, один раз на nonce.
  const openedReqRef = useRef(0);
  useEffect(() => {
    if (!openReq?.id || loading || openReq.nonce === openedReqRef.current) return;
    openedReqRef.current = openReq.nonce;
    if (games.some((g) => g.id === openReq.id)) { setSelId(openReq.id); setMode("view"); }
  }, [openReq, loading, games]);

  if (mode === "create")
    return <CreateGame groupId={groupId} players={players} profileId={profileId} back={() => setMode("list")} done={() => { setMode("list"); loadGames(); }} />;

  if (mode === "view") {
    const g = games.find((x) => x.id === selId);
    if (!g) { setMode("list"); return null; }
    return <GameCard game={g} groupId={groupId} profileId={profileId} back={() => setMode("list")} reloadGames={loadGames} reloadLeaderboard={reloadLeaderboard} bumpArchive={bumpArchive} players={players} />;
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
      {session && groupId && canCreate && <Fab label={t("create_game")} icon={<Swords size={24} />} onClick={() => setMode("create")} />}
      {loading && <CardSkeleton count={4} />}
      {!loading && games.length === 0 && <EmptyState text={!session ? t("games_empty_guest") : (groupId ? t("games_empty_session") : t("solo_games_empty"))} />}
      {!loading && (() => {
        const upcoming = games.filter(g => g.status === "open" && (g.slots||[]).filter(s=>s.profile_id||s.guest_name).length < 4);
        const active   = games.filter(g => g.status === "open" && (g.slots||[]).filter(s=>s.profile_id||s.guest_name).length === 4);
        const played   = games.filter(g => g.status === "played");
        const section = (label, color, items, del) => items.length === 0 ? null : (
          <div key={label}>
            <div style={{ fontSize: 12, color: "var(--mut)", fontFamily:"'Anton',sans-serif", textTransform:"uppercase", letterSpacing:1, margin:"12px 2px 6px" }}>{label}</div>
            {items.map(g => {
              const row = <GameRow key={g.id} g={g} color={color} me={profileId} flush={!!del} onOpen={() => { setSelId(g.id); setMode("view"); }} />;
              return del
                ? <SwipeToDelete key={g.id} onDelete={async () => { if (!confirm(t("delete_game_confirm"))) return; await deleteGame(g.id).catch(() => {}); loadGames(); bumpArchive?.(); }}>{row}</SwipeToDelete>
                : row;
            })}
          </div>
        );
        return [
          (games.length > 0 && upcoming.length === 0 && active.length === 0) ? <EmptyState key="na" text={t("games_no_active")} /> : null,
          section(t("upcoming_section"), "var(--mut)", upcoming, canCreate),
          section(t("active_section"), "var(--lime)", active, canCreate),
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
          <button aria-label={t("delete_btn")} onClick={() => onChange(null)} style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", border: "none", background: "color-mix(in srgb, var(--coral) 16%, transparent)", color: "var(--coral)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
        </div>
      </div>
    );
  }
  const matches = q.trim()
    ? players.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()) && !taken.includes(p.id)).slice(0, 6)
    : [];
  const suggestions = (players || []).filter((p) => !taken.includes(p.id)).slice(0, 12);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="pl-display" style={{ width: 24, fontSize: 12, color }}>{teamLabel}</span>
        <input className="pl-input" style={{ padding: "9px 10px" }} placeholder={t("slot_search_placeholder")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {q.trim() ? (
        <div style={{ marginTop: 6, marginLeft: 32, display: "flex", flexDirection: "column", gap: 4 }}>
          {matches.map((p) => (
            <button key={p.id} className="pl-ghost" style={{ padding: "8px 10px", textAlign: "left" }} onClick={() => { onChange({ profileId: p.id, label: p.name }); setQ(""); }}>{p.name}</button>
          ))}
          <button className="pl-btn" style={{ padding: "8px 10px", textAlign: "left" }} onClick={() => { onChange({ guestName: q.trim(), label: q.trim() + " " + t("guest_label") }); setQ(""); }}>{t("add_guest_prefix")}{q.trim()}</button>
          <div style={{ fontSize: 11, color: "var(--mut)", lineHeight: 1.4, padding: "2px 2px" }}>{t("add_guest_league_hint")}</div>
        </div>
      ) : (
        suggestions.length > 0 && (
          <div style={{ marginTop: 6, marginLeft: 32 }}>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", WebkitOverflowScrolling: "touch", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent)", maskImage: "linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent)" }}>
              {suggestions.map((p) => (
                <button key={p.id} className="pl-ghost" onClick={() => onChange({ profileId: p.id, label: p.name })}
                  style={{ flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 7, padding: "6px 12px 6px 6px", borderRadius: 999, fontSize: 13 }}>
                  <Avatar name={p.name} id={p.id} size={22} /> {p.name}
                </button>
              ))}
            </div>
          </div>
        )
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
      // сдвинулись раньше long-press → это скролл/тап, не перетаскивание
      if (Math.abs(dX) > TH || Math.abs(dY) > TH) { clearTimer(); g.current.mode = "idle"; release(); }
      return;
    }
    if (g.current.mode === "drag") setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
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
    }
  };
  const active = !!drag;
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
        return (
          <div key={i} data-slot-idx={i} ref={(el) => (rowRefs.current[i] = el)}
            style={{ marginBottom: 8, opacity: drag?.idx === i ? 0.3 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="pl-display" style={{ width: 24, fontSize: 12, color: ring, flexShrink: 0 }}>{team}</span>
              <div className="pl-slot" style={{ flex: 1, gap: 8 }}>
                <GripVertical size={16} style={{ color: "var(--mut)", flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.label}</span>
              </div>
              <button aria-label={t("delete_btn")} onPointerDown={(e) => e.stopPropagation()} onClick={() => setSlot(i, null)}
                style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", border: "none", background: "color-mix(in srgb, var(--coral) 16%, transparent)", color: "var(--coral)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 2, lineHeight: 1.4 }}>{t("slots_dnd_hint")}</div>
      {drag && slots[drag.idx] && createPortal(
        <div style={{ position: "fixed", left: drag.x, top: drag.y, transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 300, padding: "8px 12px", borderRadius: 12, background: "var(--surface)", border: "1.5px solid var(--lime)", boxShadow: "0 8px 24px rgba(0,0,0,.4)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
          {slots[drag.idx].label}
        </div>,
        document.body
      )}
    </div>
  );
}

function CreateGame({ groupId, players, profileId, back, done }) {
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

  const creatingRef = useRef(false);
  const create = async () => {
    if (creatingRef.current) return;   // защита от двойного тапа → дубль игры
    creatingRef.current = true;
    setBusy(true);
    // ISO с таймзоной — чтобы введённое локальное время совпадало с показанным.
    let startsAtIso = null;
    try { if (date) startsAtIso = new Date(date).toISOString(); } catch (e) { startsAtIso = null; }
    try { const g = await createGame(groupId, { title: title.trim() || null, startsAt: startsAtIso, place, slots, hostId: profileId || null }); notifyGameCreated(g?.id); creatingRef.current = false; done(); }
    catch (e) { alert(t("err_create_game")); setBusy(false); creatingRef.current = false; }
  };

  const stepBadge = (txt) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--lime)", marginBottom: 10 }}>{txt}</div>
  );

  // ── Шаг 1: когда / где / название ─────────────────────────────────────────
  if (step === "info") {
    return (
      <div className="pl-pop">
        <BackButton onClick={back} style={{ marginBottom: 12 }} />
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
      <BackButton onClick={() => setStep("info")} style={{ marginBottom: 12 }} />
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
  const wrap = useRef(null);              // контейнер — на него вешаем pointer capture
  const pid = useRef(null);
  const [drag, setDrag] = useState(null); // { idx, x, y }
  // Захват указателя на контейнере: браузер не «уводит» жест в скролл,
  // поэтому призрак не улетает от пальца (как в GameSlots).
  const start = (idx) => (e) => {
    pid.current = e.pointerId;
    try { wrap.current.setPointerCapture(e.pointerId); } catch (_) {}
    setDrag({ idx, x: e.clientX, y: e.clientY });
  };
  const move = (e) => { if (drag) setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY }); };
  const end = (e) => {
    try { wrap.current.releasePointerCapture(pid.current); } catch (_) {}
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
    <div ref={wrap} onPointerMove={move} onPointerUp={end} onPointerCancel={end} style={{ touchAction: drag ? "none" : "auto" }}>
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
function GameCourtBlock({ game, index, total, groupId, reloadSession, reloadLeaderboard, bumpArchive, onOpenPlayer }) {
  const slots = [...(game.slots || [])].sort((a, b) => (a.team + a.position).localeCompare(b.team + b.position));
  const nameOf = (s) => s.profile?.name || s.guest_name;
  const avatarOf = (s) => s.profile_id ? playerAvatar(s.profile?.avatar_url, s.profile_id) : null;
  const slotsA = slots.filter((s) => s.team === "A");
  const slotsB = slots.filter((s) => s.team === "B");
  const filled = slots.filter((s) => s.profile_id || s.guest_name).length;
  const played = game.status === "played";
  const match = (game.matches || [])[0];
  // Переименование корта — только в лиге (court_name возвращается в выборке лиги).
  const renameCourt = groupId ? (name) => updateGameCourtName(game.id, name).then(reloadSession).catch(() => {}) : undefined;
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
        <button className="pl-ghost" style={{ marginLeft: "auto", padding: "5px 8px", color: "var(--coral)", border: "1px solid rgba(255,106,82,.3)" }} onClick={del} title={t("delete_btn")}><Trash2 size={13} /></button>
      </div>
      {played ? (
        <CourtView courtNumber={index + 1} mode="sets" courtName={game.court_name} onRenameCourt={renameCourt}
          teamA={slotsA.map(nameOf)} teamB={slotsB.map(nameOf)}
          teamAvatarsA={slotsA.map(avatarOf)} teamAvatarsB={slotsB.map(avatarOf)}
          teamIdsA={slotsA.map((s) => s.profile_id)} teamIdsB={slotsB.map((s) => s.profile_id)} onOpenPlayer={onOpenPlayer}
          scoreA={match?.sets_a ?? null} scoreB={match?.sets_b ?? null}
          scoreDetail={match?.score_detail || null} editable={false} />
      ) : filled === 4 ? (
        <CourtView courtNumber={index + 1} mode="sets" editable courtName={game.court_name} onRenameCourt={renameCourt}
          teamA={slotsA.map(nameOf)} teamB={slotsB.map(nameOf)}
          teamAvatarsA={slotsA.map(avatarOf)} teamAvatarsB={slotsB.map(avatarOf)}
          teamIdsA={slotsA.map((s) => s.profile_id)} teamIdsB={slotsB.map((s) => s.profile_id)} onOpenPlayer={onOpenPlayer}
          onSave={async (a, b, detail) => { await submitResult(game.id, a, b, detail); await reloadSession(); reloadLeaderboard && reloadLeaderboard(); }} />
      ) : (
        <>
          <CourtView courtNumber={index + 1} courtName={game.court_name} onRenameCourt={renameCourt}
            teamA={slotsA.map(nameOf)} teamB={slotsB.map(nameOf)}
            teamAvatarsA={slotsA.map(avatarOf)} teamAvatarsB={slotsB.map(avatarOf)}
          teamIdsA={slotsA.map((s) => s.profile_id)} teamIdsB={slotsB.map((s) => s.profile_id)} onOpenPlayer={onOpenPlayer}
            editable={false} />
          <div style={{ textAlign: "center", color: "var(--mut)", fontSize: 12, marginTop: 6 }}>{filled}/4 — {t("waiting_via_link")}</div>
        </>
      )}
    </div>
  );
}

function GameCard({ game, groupId, profileId = null, back, reloadGames, reloadLeaderboard, bumpArchive, players = [] }) {
  const [mix, setMix] = useState(false);
  const [prof, setProf] = useState(null);  // карточка игрока из состава (только просмотр)
  const onOpenPlayer = (id) => { const f = players.find((p) => p.id === id); if (f) setProf(f); };
  const [mixBusy, setMixBusy] = useState(false);
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
  // #3: кто создал игру (host_id) — резолвим по составу лиги.
  const creatorName = game.host_id ? ((players || []).find((p) => p.id === game.host_id)?.name || null) : null;

  const share = async () => {
    const url = linkFor(game.invite_code);
    const text = `${t("game_share_text")}${game.title ? ` «${game.title}»` : ""}! ${t("game_share_join")}: ${url} (${t("code_label")} ${game.invite_code})`;
    try { if (navigator.share) { await navigator.share({ title: "PadelPack", text, url }); return; } } catch (e) {}
    try { await navigator.clipboard.writeText(text); setToast(t("copied")); setTimeout(() => setToast(""), 1600); } catch (e) { setToast("Скопируй вручную"); }
  };

  // «Сыграть ещё»: создаём новую игру с теми же игроками в выбранной расстановке.
  const mixRef = useRef(false);
  const createMix = async (arr) => {
    if (!groupId) return;
    if (mixRef.current) return;   // защита от двойного тапа
    mixRef.current = true;
    setMixBusy(true);
    try {
      const newSlots = arr.map((p) => (p.profile_id ? { profileId: p.profile_id } : { guestName: p.guest_name }));
      // Связываем под-игры микса: общий mix_group_id = id исходной игры (или её группы).
      await createGame(groupId, { title: game.title || null, startsAt: new Date().toISOString(), slots: newSlots, mixGroupId: mixKey, hostId: profileId || null });
      setMix(false); setMixBusy(false); mixRef.current = false;
      bumpArchive && bumpArchive();
      reloadGames && reloadGames();
      await loadSession(); // новая игра появляется ниже на той же странице (ввод счёта inline)
    } catch (e) { alert(t("err_create_game")); setMixBusy(false); mixRef.current = false; }
  };

  if (prof) return <PlayerDetail key={prof.id} groupId={groupId} player={prof} players={players} close={() => setProf(null)} onOpenPlayer={setProf} />;

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
          {back && <BackButton onClick={back} label={t("to_list")} />}
        </div>
        {list.length > 1 && (
          <div className="pl-display" style={{ fontSize: 18, margin: "0 2px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <Shuffle size={18} color="var(--lime)" /> {last.title || t("mix_session_title")} · {nGames(list.length)}
          </div>
        )}
        {list.map((g, i) => (
          <GameCourtBlock key={g.id} game={g} index={i} total={list.length} groupId={groupId}
            reloadSession={reloadSession} reloadLeaderboard={reloadLeaderboard} bumpArchive={bumpArchive} onOpenPlayer={onOpenPlayer} />
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
        {back && <BackButton onClick={back} label={t("to_list")} />}
        <button className="pl-ghost" style={{ padding: "6px 10px", color: "var(--coral)", border: "1px solid rgba(255,106,82,.3)", marginLeft: "auto" }} onClick={async () => { if (!confirm(t("delete_game_confirm"))) return; await deleteGame(game.id); bumpArchive && bumpArchive(); reloadGames && reloadGames(); back && back(); }} title={t("delete_btn")}><Trash2 size={14} /></button>
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
          {creatorName && (
            <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 4 }}>
              {t("created_by_label")}: <span style={{ color: "var(--ink)", fontWeight: 600 }}>{creatorName}</span>
            </div>
          )}
        </div>
        <button className="pl-btn" style={{ padding: "8px 12px", display: "flex", gap: 6, alignItems: "center" }} onClick={share}><Share2 size={15} /> {toast || t("share_btn")}</button>
      </div>

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
          <CourtView courtNumber={1} mode="sets" editable courtName={game.court_name} onRenameCourt={groupId ? (name) => updateGameCourtName(game.id, name).then(reloadGames).catch(() => {}) : undefined}
            teamA={slotsA.map(nameOf)} teamB={slotsB.map(nameOf)}
            teamAvatarsA={slotsA.map(avatarOf)} teamAvatarsB={slotsB.map(avatarOf)}
          teamIdsA={slotsA.map((s) => s.profile_id)} teamIdsB={slotsB.map((s) => s.profile_id)} onOpenPlayer={onOpenPlayer}
            onSave={async (a, b, detail) => { await submitResult(game.id, a, b, detail); await Promise.all([reloadGames(), reloadLeaderboard()]); }} />
        ) : (
          <>
            <CourtView courtNumber={1} courtName={game.court_name} onRenameCourt={groupId ? (name) => updateGameCourtName(game.id, name).then(reloadGames).catch(() => {}) : undefined}
              teamA={slotsA.map(nameOf)} teamB={slotsB.map(nameOf)}
              teamAvatarsA={slotsA.map(avatarOf)} teamAvatarsB={slotsB.map(avatarOf)}
          teamIdsA={slotsA.map((s) => s.profile_id)} teamIdsB={slotsB.map((s) => s.profile_id)} onOpenPlayer={onOpenPlayer}
              editable={false} />
            <div style={{ textAlign: "center", color: "var(--mut)", fontSize: 12, marginTop: 6 }}>{filled}/4 — {t("waiting_via_link")}</div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

/* ------------------------------- HistoryView ------------------------------ */
// Свайп влево по карточке → раскрывается красная зона с корзиной → удаление.
function SwipeToDelete({ onDelete, onCopy, children }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0), startY = useRef(0), active = useRef(false), busy = useRef(false), captured = useRef(false), pid = useRef(null);
  const MAX = 88;
  // Захват указателя откладываем до реального горизонтального свайпа: иначе на десктопе
  // setPointerCapture на pointerdown перехватывает click, и он не доходит до карточки (мышь «не кликает»).
  const down = (e) => { if (busy.current) return; startX.current = e.clientX; startY.current = e.clientY; active.current = true; captured.current = false; pid.current = e.pointerId; setDragging(true); };
  const move = (e) => {
    if (!active.current) return;
    const dX = e.clientX - startX.current, dY = e.clientY - startY.current;
    if (dx === 0 && Math.abs(dY) > Math.abs(dX)) { active.current = false; setDragging(false); return; } // вертикальный скролл
    if (!captured.current && Math.abs(dX) > 6) { try { e.currentTarget.setPointerCapture(pid.current); } catch (_) {} captured.current = true; }
    const hi = onCopy ? MAX : 0;   // вправо (копировать) — только если есть onCopy
    setDx(Math.max(-MAX, Math.min(hi, dX)));
  };
  const up = async () => {
    if (!active.current) return; active.current = false; setDragging(false);
    if (dx <= -MAX * 0.55) {
      setDx(-MAX); busy.current = true;
      try { await onDelete(); } finally { busy.current = false; }
      setDx(0);
    } else if (onCopy && dx >= MAX * 0.55) {
      setDx(MAX); busy.current = true;
      try { await onCopy(); } finally { busy.current = false; }
      setDx(0);
    } else setDx(0);
  };
  return (
    <div style={{ position: "relative", marginBottom: 8, borderRadius: 18, overflow: "hidden", background: dx > 0 ? "var(--lime)" : "var(--coral)" }}>
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: MAX, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <Trash2 size={20} />
      </div>
      {onCopy && (
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: MAX, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lime-fg)" }}>
          <Copy size={20} />
        </div>
      )}
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? "none" : "transform .22s ease", touchAction: "pan-y", background: "var(--surface)" }}>
        {children}
      </div>
    </div>
  );
}

function GameCopyDialog({ src, groupId, profileId = null, onClose, onCopied }) {
  const [name, setName] = useState(src.title ? `${src.title} ${t("trn_copy_suffix")}` : "");
  const [day, setDay] = useState(() => nowLocalDT().slice(0, 10));
  const [time, setTime] = useState(() => nowLocalDT().slice(11, 16));
  const [place, setPlace] = useState(src.place || "");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (busy) return;
    setBusy(true);
    let startsAtIso = null;
    try { const d = day ? `${day}T${time || "00:00"}` : ""; if (d) startsAtIso = new Date(d).toISOString(); } catch (e) { startsAtIso = null; }
    const layout = [["A", 1], ["A", 2], ["B", 1], ["B", 2]];
    const slots = layout.map(([tm, pos]) => { const sl = (src.slots || []).find((x) => x.team === tm && x.position === pos); return sl?.profile_id ? { profileId: sl.profile_id } : (sl?.guest_name ? { guestName: sl.guest_name } : null); });
    try { const gm = await createGame(groupId, { title: name.trim() || null, startsAt: startsAtIso, place, slots, hostId: profileId || null }); onCopied(gm?.id); }
    catch (e) { alert(t("err_create_game")); setBusy(false); }
  };
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }} onClick={onClose}>
      <div className="pl-card" style={{ width: "100%", maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{t("copy_game_title")}</div>
        <input className="pl-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
          <input className="pl-input" type="date" value={day} onChange={(e) => setDay(e.target.value)} style={{ flex: 1 }} />
          <input className="pl-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 120 }} />
        </div>
        <input className="pl-input" placeholder={t("court_club_placeholder")} value={place} onChange={(e) => setPlace(e.target.value)} style={{ marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="pl-ghost" style={{ flex: 1, padding: 11 }} onClick={onClose} disabled={busy}>{t("cancel")}</button>
          <button className="pl-btn" style={{ flex: 1, padding: 11 }} onClick={go} disabled={busy}>{busy ? t("creating") : t("trn_copy_btn")}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function HistoryView({ groupId, players, profileId, isGroupMember, archiveNonce, bumpArchive }) {
  const [games, setGames] = useState(null);  // сыгранные игры
  const [tours, setTours] = useState([]);     // завершённые турниры
  const [copyTour, setCopyTour] = useState(null);
  const [copyGame, setCopyGame] = useState(null);
  const [sel, setSel] = useState(null);       // { type: 'tour' | 'game', data }
  const [swipeHint, setSwipeHint] = useState(() => { try { return !localStorage.getItem("pp_swipe_hint"); } catch (e) { return true; } });
  const dismissHint = () => { try { localStorage.setItem("pp_swipe_hint", "1"); } catch (e) {} setSwipeHint(false); };
  const [filter, setFilter] = useState("all"); // all | games | tours
  const [mineOnly, setMineOnly] = useState(false); // «Только мои» — фильтр по участию текущего игрока

  const load = useCallback(async () => {
    try { const g = groupId ? await listGames(groupId) : await listMyGames(); setGames((g || []).filter((x) => x.status === "played")); }
    catch (e) { setGames([]); }
    try { const all = groupId ? await listTournaments(groupId) : await listMyTournaments(); setTours((all || []).filter((tr) => tr.status === "finished")); }
    catch (e) { setTours([]); }
  }, [groupId]);
  useEffect(() => { if (!sel) load(); }, [load, sel, archiveNonce]);

  // Проваливание в результаты — те же экраны, что на вкладках Игры/Турниры (там и удаление).
  if (sel?.type === "tour") return <TournamentView id={sel.data.id} players={players} back={() => setSel(null)} isGroupMember={isGroupMember} currentProfileId={profileId} onArchiveChange={bumpArchive} />;
  if (sel?.type === "game") return <GameCard game={sel.data} groupId={groupId} profileId={profileId} back={() => setSel(null)} reloadGames={load} reloadLeaderboard={() => {}} bumpArchive={bumpArchive} players={players} />;

  const mineTour = (tr) => !profileId || (tr.players || []).some((pl) => pl.profile_id === profileId);
  const mineGame = (g) => !profileId || meInGame(g, profileId);
  const vTours = mineOnly ? tours.filter(mineTour) : tours;
  const vGames = mineOnly ? games.filter(mineGame) : games;
  const head = (txt, color = "var(--mut)") => <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color, textTransform: "uppercase", margin: "14px 2px 8px", paddingLeft: 4 }}>{txt}</div>;

  if (games === null) return <div className="pl-pop"><CardSkeleton count={4} /></div>;
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
      {profileId && (
        <button onClick={() => setMineOnly((v) => !v)} aria-pressed={mineOnly} style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12, padding: "7px 12px", borderRadius: 999, cursor: "pointer",
          fontFamily: "'Outfit',sans-serif", fontSize: 12.5, fontWeight: 700,
          border: mineOnly ? "1px solid color-mix(in srgb, var(--lime) 55%, transparent)" : "1px solid var(--line)",
          background: mineOnly ? "color-mix(in srgb, var(--lime) 14%, transparent)" : "var(--surface2)",
          color: mineOnly ? "var(--lime)" : "var(--mut)",
        }}>
          <UserCheck size={14} /> {t("only_mine")}
        </button>
      )}
      {isGroupMember && swipeHint && (games.length > 0 || tours.length > 0) && (
        <div onClick={dismissHint} style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 12px", padding: "9px 12px", borderRadius: 12, background: "color-mix(in srgb, var(--coral) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--coral) 30%, transparent)", fontSize: 12.5, color: "var(--mut)", cursor: "pointer" }}>
          <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1, flexShrink: 0 }}><span style={{ color: "var(--coral)" }}>←</span><span style={{ color: "var(--lime)" }}>→</span></span> {t("swipe_hint")} <X size={14} style={{ marginLeft: "auto", color: "var(--mut)", flexShrink: 0 }} />
        </div>
      )}
      {filter === "games" && vGames.length === 0 && !mineOnly && <EmptyState text={t("history_no_games")} />}
      {filter === "tours" && vTours.length === 0 && !mineOnly && <EmptyState text={t("history_no_tours")} />}
      {mineOnly && vTours.length === 0 && vGames.length === 0 && <EmptyState text={t("history_no_mine")} />}
      {filter !== "games" && vTours.length > 0 && head(t("tours_history_heading"), "var(--yellow)")}
      {filter !== "games" && vTours.map((tour) => {
        const mine = !profileId || (tour.players || []).some((pl) => pl.profile_id === profileId);
        const card = <TournamentCard trn={tour} color="var(--yellow)" me={profileId} flush={isGroupMember} onClick={() => setSel({ type: "tour", data: tour })} />;
        const inner = isGroupMember
          ? <SwipeToDelete onCopy={groupId ? () => setCopyTour(tour) : null} onDelete={async () => { if (!confirm(t("trn_delete_confirm"))) return; await deleteTournament(tour.id).catch(() => {}); bumpArchive?.(); load(); }}>{card}</SwipeToDelete>
          : card;
        return <div key={tour.id} style={mine ? undefined : { opacity: 0.55 }}>{inner}</div>;
      })}

      {filter !== "tours" && vGames.length > 0 && head(t("games_history_heading"))}
      {filter !== "tours" && (() => {
        // Группируем по миксу: ключ = mix_group_id || id. Группа ≥2 → объединённая плашка.
        const byKey = new Map();
        vGames.forEach((g) => { const k = g.mix_group_id || g.id; const a = byKey.get(k) || []; a.push(g); byKey.set(k, a); });
        const seen = new Set();
        const order = [];
        vGames.forEach((g) => { const k = g.mix_group_id || g.id; if (!seen.has(k)) { seen.add(k); order.push(k); } });
        return order.map((k) => {
          const grp = byKey.get(k);
          if (grp.length >= 2) {
            const ordered = [...grp].sort((a, b) => new Date(a.created_at || a.starts_at || 0) - new Date(b.created_at || b.starts_at || 0));
            const mine = !profileId || ordered.some((gg) => meInGame(gg, profileId));
            const card = <MixGroupCard games={ordered} color="#7d9488" me={profileId} onOpenGame={(g) => setSel({ type: "game", data: g })} />;
            const inner = isGroupMember
              ? <SwipeToDelete onDelete={async () => { if (!confirm(t("mix_delete_confirm").replace("{n}", ordered.length))) return; for (const gg of ordered) await deleteGame(gg.id).catch(() => {}); bumpArchive?.(); load(); }}>{card}</SwipeToDelete>
              : card;
            return <div key={"mix-" + k} style={mine ? undefined : { opacity: 0.55 }}>{inner}</div>;
          }
          const g = grp[0];
          const mine = !profileId || meInGame(g, profileId);
          const card = <GameRow g={g} color="#7d9488" me={profileId} flush={isGroupMember} onOpen={() => setSel({ type: "game", data: g })} />;
          const inner = isGroupMember
            ? <SwipeToDelete onCopy={groupId ? () => setCopyGame(g) : null} onDelete={async () => { if (!confirm(t("delete_game_confirm"))) return; await deleteGame(g.id).catch(() => {}); bumpArchive?.(); load(); }}>{card}</SwipeToDelete>
            : card;
          return <div key={g.id} style={mine ? undefined : { opacity: 0.55 }}>{inner}</div>;
        });
      })()}
      {copyTour && <CopyDialog src={copyTour} groupId={groupId} profileId={profileId} onClose={() => setCopyTour(null)} onCopied={() => { setCopyTour(null); bumpArchive?.(); }} />}
      {copyGame && <GameCopyDialog src={copyGame} groupId={groupId} profileId={profileId} onClose={() => setCopyGame(null)} onCopied={() => { setCopyGame(null); bumpArchive?.(); }} />}
    </div>
  );
}
