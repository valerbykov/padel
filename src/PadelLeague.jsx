// PadelLeague.jsx — основной экран на реальных данных Supabase.
import React, { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
const LeagueSetup = lazy(() => import("./components/LeagueSetup"));
import { createPortal } from "react-dom";
import { registerBack } from "./lib/backstack";
import { supabase } from "./lib/supabase";
import BackButton from "./components/BackButton";
import { getLeaderboard, addMember, removeMember, createGame, listGames, submitResult, linkFor, deleteGame, createLeague, joinLeague, createDemoLeague, joinSlot, clearGameSlot, startGame, getGroupCounts, getGroupProfiles, listMyGames, listMyHistoryMatches, getPlayedWith, getLeagueablePlayers, addExistingMember, getBoardMatches, getStatMatches, getHistoryMatches, updateGameCourtName, notifyGameCreated, setMemberRole, hidePartner, getProfileNames, getMyDeltas } from "./lib/padelApi";
import { WEB_BASE } from "./lib/platform";
import { CardSkeleton } from "./components/Skeleton";
import { bustCache, cachePeek } from "./lib/cache";
import { getRatingHistory, getWeekDeltas } from "./lib/statsApi";
import { listTournaments, listMyTournaments } from "./lib/tournamentApi";
import { t, nGames, currentLang , dateLocale} from "./lib/i18n";
import { standings, detailedStandings } from "./lib/americano";
import StandingsTable from "./components/StandingsTable";
import Fab from "./components/Fab";
import { Trophy, Swords, History, Users, UserPlus, Share2, Check, X, RefreshCw, Copy, PlusCircle, ChevronUp, ChevronDown, ChevronRight, Calendar, MapPin, TrendingUp, LogIn, Award, Phone, Mail, ArrowLeft, Trash2, KeyRound, Shuffle, GripVertical, HelpCircle, UserCheck, ShieldCheck, EyeOff, Star, User, Search, Pencil, Send, MessageCircle } from "lucide-react";
import Tournaments, { TournamentView, TournamentCard, CopyDialog, css as trCss } from "./components/Tournaments";
import DateTimePicker from "./components/DateTimePicker";
import { confirmDialog, showToast } from "./components/ui-dialogs";
import { copyTournament } from "./lib/tournamentApi";
import { deleteTournament } from "./lib/tournamentApi";
import CourtView from "./components/CourtView";
import EmptyState from "./components/EmptyState";
import Avatar from "./components/Avatar";
import LeagueLogo from "./components/LeagueLogo";
import InviteCard from "./components/InviteCard";
import Analytics from "./components/Analytics";
import { dogAvatar, playerAvatar, avatarFallback, DOG_COUNT , avatarBg, avatarOnLoad} from "./lib/avatar";

// Текущая дата-время в формате datetime-local (YYYY-MM-DDTHH:MM) с учётом таймзоны.
// Округляем к сетке 5 минут (00:01 → 00:00), секунды в 0: степпер времени шагает
// по 5 мин, поэтому дефолт должен быть «ровным», а не текущей произвольной минутой.
const nowLocalDT = () => { const d = new Date(); d.setSeconds(0, 0); d.setMinutes(Math.round(d.getMinutes() / 5) * 5); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

const fmtDate = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(dateLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
body{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;--lime-fg:#0a1612;--topbar-bg:rgba(10,22,18,.92);--yellow:#ffd23f;--border:var(--line);--card:var(--surface);--fg:var(--ink);background:var(--bg);color:var(--ink);}
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
.demo-arrow{display:inline-block;animation:demoArrow 2.2s ease-in-out infinite;}
@keyframes demoArrow{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
.demo-peek{position:relative;}
.demo-peek::after{content:"";position:absolute;left:0;right:0;bottom:0;height:34px;border-radius:0 0 13px 13px;background:linear-gradient(180deg,transparent,var(--surface));pointer-events:none;}
@media(prefers-reduced-motion:reduce){.demo-arrow{animation:none}}
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

// График рейтинга: период (месяц / 3 мес / всё), рецессивная сетка с осью,
// метка пика и акцент на текущей точке. rows = [{ r, at }] по возрастанию даты.
function RatingChart({ rows }) {
  const [period, setPeriod] = useState("all"); // 'm' | '3m' | 'all'
  const all = rows || [];
  const cutoff = period === "m" ? Date.now() - 30 * 864e5 : period === "3m" ? Date.now() - 91 * 864e5 : 0;
  let pts0 = cutoff ? all.filter((p) => new Date(p.at).getTime() >= cutoff) : all;
  // «Всё время» начинается со стартовых 1000; период — с последней точки до среза,
  // чтобы линия не начиналась «из воздуха».
  if (!cutoff) pts0 = [{ r: 1000, at: null }, ...pts0];
  else {
    const before = all.filter((p) => new Date(p.at).getTime() < cutoff);
    pts0 = [before.length ? before[before.length - 1] : { r: 1000, at: null }, ...pts0];
  }
  const seg = (
    <div style={{ display: "flex", gap: 3, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 11, padding: 3, marginBottom: 10 }}>
      {[["m", t("period_month")], ["3m", t("period_3m")], ["all", t("period_all")]].map(([k, label]) => (
        <button key={k} onClick={() => setPeriod(k)}
          style={{ flex: 1, border: "none", background: period === k ? "var(--lime)" : "none", color: period === k ? "var(--lime-fg)" : "var(--mut)", padding: "6px 0", borderRadius: 8, cursor: "pointer", fontFamily: "'Outfit'", fontWeight: 700, fontSize: 12 }}>
          {label}
        </button>
      ))}
    </div>
  );
  if (pts0.length < 2)
    return <>{seg}<div style={{ color: "var(--mut)", fontSize: 13, textAlign: "center", padding: "26px 0" }}>{t("chart_empty")}</div></>;
  const values = pts0.map((p) => p.r);
  const w = 360, h = 150, padL = 36, padR = 10, top = 22, bottom = 26;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const x = (i) => padL + (i * (w - padL - padR)) / (values.length - 1);
  const y = (v) => top + (h - top - bottom) - ((v - min) / span) * (h - top - bottom);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  // Пик — максимальный рейтинг периода (метку не рисуем, если пик = текущая точка).
  const peakI = values.indexOf(max);
  const lastI = values.length - 1;
  // Сетка: 3 «красивых» уровня.
  const grid = [max, (max + min) / 2, min].map((v) => Math.round(v));
  const fd = (iso) => { try { return new Date(iso).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" }); } catch (e) { return ""; } };
  const firstAt = pts0.find((p) => p.at)?.at;
  return (
    <>
      {seg}
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
        <defs><linearGradient id="plg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: "var(--lime)", stopOpacity: 0.28 }} /><stop offset="100%" style={{ stopColor: "var(--lime)", stopOpacity: 0 }} /></linearGradient></defs>
        {grid.map((v, gi) => (
          <g key={gi}>
            <line x1={padL} y1={y(v)} x2={w - padR} y2={y(v)} style={{ stroke: "var(--line)" }} strokeWidth="1" />
            <text x={padL - 6} y={y(v) + 3} fontSize="9" textAnchor="end" style={{ fill: "var(--mut)" }} fontFamily="'Outfit',sans-serif">{v}</text>
          </g>
        ))}
        <polygon points={`${x(0)},${y(min)} ${pts} ${x(lastI)},${y(min)}`} fill="url(#plg)" />
        <polyline points={pts} fill="none" strokeWidth="2" style={{ stroke: "var(--lime)" }} strokeLinejoin="round" strokeLinecap="round" />
        {peakI !== lastI && values[peakI] > values[lastI] && (
          <g>
            <circle cx={x(peakI)} cy={y(values[peakI])} r="3" strokeWidth="2" style={{ fill: "var(--surface)", stroke: "var(--yellow)" }} />
            <text x={Math.min(Math.max(x(peakI), padL + 24), w - padR - 24)} y={y(values[peakI]) - 8} fontSize="9.5" fontWeight="700" textAnchor="middle" style={{ fill: "var(--yellow)" }} fontFamily="'Outfit',sans-serif">{t("chart_peak")} {values[peakI]}</text>
          </g>
        )}
        <circle cx={x(lastI)} cy={y(values[lastI])} r="4" strokeWidth="2" style={{ fill: "var(--lime)", stroke: "var(--surface)" }} />
        {firstAt && <text x={padL} y={h - 8} fontSize="9" style={{ fill: "var(--mut)" }} fontFamily="'Outfit',sans-serif">{fd(firstAt)}</text>}
        <text x={w - padR} y={h - 8} fontSize="9" textAnchor="end" style={{ fill: "var(--mut)" }} fontFamily="'Outfit',sans-serif">{fd(new Date().toISOString())}</text>
      </svg>
    </>
  );
}

// Контакты: иконки-ссылки
// Звания «стаи» — расшифровка числового рейтинга. Цвет звания един везде:
// чип в шапке статистики, чип в строке таблицы, прогресс до следующего звания.
// Эмодзи — только у крайних званий, середина лестницы текстом.
const TIERS = [
  { key: "tier_leader",   min: 1350, color: "#ff9f2d",       emoji: "🐺" },
  { key: "tier_predator", min: 1200, color: "var(--yellow)" },
  { key: "tier_hunter",   min: 1100, color: "var(--lime)" },
  { key: "tier_player",   min: 1000, color: "#4db8e8" },
  { key: "tier_trainee",  min: 900,  color: "#a9bfb2" },
  { key: "tier_puppy",    min: -Infinity, color: "var(--mut)", emoji: "🐶" },
];
// Защитно: у игроков вне лиги («Играли вместе») rating отсутствует — NaN не должен ронять UI.
const tierOf = (r) => TIERS.find((tr) => (Number(r) || 0) >= tr.min) || TIERS[TIERS.length - 1];
const tierAbove = (r) => { const i = TIERS.findIndex((tr) => (Number(r) || 0) >= tr.min); return i > 0 ? TIERS[i - 1] : null; };

function TierChip({ rating, compact = false }) {
  const tr = tierOf(rating);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: compact ? 9.5 : 10.5, fontWeight: 800,
      padding: compact ? "1px 7px" : "3px 9px", borderRadius: 999, flexShrink: 0, whiteSpace: "nowrap",
      background: `color-mix(in srgb, ${tr.color} 13%, transparent)`, color: tr.color,
      border: `1px solid color-mix(in srgb, ${tr.color} 35%, transparent)` }}>
      {tr.emoji ? tr.emoji + " " : ""}{t(compact ? tr.key + "_short" : tr.key)}
    </span>
  );
}

// Контакты: компактные круглые иконки — встраиваются в шапку карточки игрока
// (под строкой места в лиге), не разрывая композицию.
function ContactLinks({ contacts = {} }) {
  if (!contacts || !Object.values(contacts).some(Boolean)) return null;
  const links = [
    contacts.telegram && { href: `https://t.me/${contacts.telegram.replace(/^@/, "")}`, icon: Send, color: "#4db8e8", label: "Telegram" },
    contacts.whatsapp && { href: `https://wa.me/${contacts.whatsapp.replace(/\D/g, "")}`, icon: MessageCircle, color: "#25d366", label: "WhatsApp" },
    contacts.email    && { href: `mailto:${contacts.email}`, icon: Mail, color: "var(--mut)", label: "Email" },
    contacts.phone    && { href: `tel:${contacts.phone}`, icon: Phone, color: "var(--mut)", label: "Phone" },
  ].filter(Boolean);
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
      {links.map((l) => {
        const Ico = l.icon;
        return (
          <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.label} title={l.label}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 28, height: 28, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: `color-mix(in srgb, ${l.color} 14%, transparent)`, color: l.color, textDecoration: "none" }}>
            <Ico size={14} />
          </a>
        );
      })}
    </div>
  );
}

/* --------------------------------- root ----------------------------------- */

export default function PadelLeague({ groupId, session, profileId, leagues = [], leaguesReady = true, activeLeague = null, isAdmin = false, onLeagueChange, onLeagueCreated, theme = "dark", lang = "ru", onThemeToggle, onLangChange, onLogin, onOpenLanding, onEditProfile, openSelfStatsNonce = 0, openAnalyticsNonce = 0, openEvent = null, profileNonce = 0 }) {
  const [tab, setTab] = useState(session ? "board" : "welcome");
  // Повторный тап по активной вкладке должен возвращать к её корню (закрыть
  // открытую детализацию). Меняем navNonce → key вкладки → ремоунт → сброс.
  const [navNonce, setNavNonce] = useState(0);
  // Карточка игрока, открытая из экрана турнира (там нет своего оверлея PlayerDetail —
  // TournamentView в Tournaments.jsx, откуда PadelLeague недоступен из-за цикла).
  const [tourPlayer, setTourPlayer] = useState(null);
  const goTab = useCallback((x) => { setNavNonce((n) => (x === tab ? n + 1 : n)); setTab(x); }, [tab]);
  // Смена активной лиги (переключение/удаление в свитчере) возвращает на «Друзья»
  // и ремоунтит вкладки (сброс открытых экранов). Тап по пушу из другой лиги
  // не пострадает: эффект openEvent объявлен ниже и переопределит вкладку.
  const prevGroupRef = useRef(groupId);
  useEffect(() => {
    if (prevGroupRef.current === groupId) return;
    prevGroupRef.current = groupId;
    if (session) { setTab("board"); setNavNonce((n) => n + 1); }
  }, [groupId, session]);
  // Логаут внутри игры/турнира: сессия ушла — сбрасываем навигацию, иначе
  // остаёшься на открытом экране игры/турнира. Ремоунт вкладок (navNonce)
  // чистит их внутреннее состояние (выбранная игра/турнир), + закрываем оверлеи.
  const prevSessionRef = useRef(!!session);
  useEffect(() => {
    const has = !!session;
    if (prevSessionRef.current && !has) {
      setTab("welcome");
      setNavNonce((n) => n + 1);
      setTourPlayer(null);
    }
    prevSessionRef.current = has;
  }, [session]);
  const [players, setPlayers] = useState([]);
  // Карточка игрока, открытая из экрана турнира (объявляем ПОСЛЕ players —
  // useCallback читает players в зависимостях, иначе TDZ и белый экран).
  const openTourPlayer = useCallback((id) => { const f = (players || []).find((p) => p.id === id); if (f) setTourPlayer(f); }, [players]);
  useEffect(() => { if (tourPlayer) return registerBack(() => setTourPlayer(null)); }, [tourPlayer]);
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

  // profileNonce меняется при сохранении профиля (смена аватара/имени) — перечитываем
  // лидерборд, чтобы новое фото попало в карточки игроков и таблицу.
  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard, profileNonce]);
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
        {tab === "board" && (session ? <Board key={navNonce} groupId={groupId} players={players} loading={!lbLoaded} reload={loadLeaderboard} profileId={profileId} bumpArchive={bumpArchive} isAdmin={isAdmin} leagues={leagues} leaguesReady={leaguesReady} activeLeague={activeLeague} onLeagueChange={onLeagueChange} onLeagueCreated={onLeagueCreated} onEditProfile={onEditProfile} selfStatsNonce={openSelfStatsNonce} analyticsNonce={openAnalyticsNonce} /> : <GateScreen />)}
        {tab === "games" && <Games key={navNonce} groupId={groupId} players={players} profileId={profileId} reloadLeaderboard={loadLeaderboard} session={session} archiveNonce={archiveNonce} bumpArchive={bumpArchive} onLogin={onLogin} isAdmin={isAdmin} canCreate={isAdmin || !!activeLeague?.members_can_create} openReq={openEvent?.kind === "game" ? openEvent : null} theme={theme} />}
        {tab === "tournaments" && <Tournaments key={navNonce} groupId={groupId} players={players} profileId={profileId} bumpArchive={bumpArchive} session={session} onLogin={onLogin} isAdmin={isAdmin} canCreate={isAdmin || !!activeLeague?.members_can_create} membersCanCreate={!!activeLeague?.members_can_create} openReq={openEvent?.kind === "tour" ? openEvent : null} onOpenPlayer={openTourPlayer} />}
        {tab === "history" && (session ? <HistoryView key={navNonce} groupId={groupId} players={players} profileId={profileId} isGroupMember={!!groupId} isAdmin={isAdmin} archiveNonce={archiveNonce} bumpArchive={bumpArchive} onOpenPlayer={openTourPlayer} /> : <GateScreen />)}
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
      {tourPlayer && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "var(--bg)", color: "var(--ink)", overflowY: "auto" }}>
          <div style={{ maxWidth: 460, margin: "0 auto", padding: "calc(14px + env(safe-area-inset-top)) 16px calc(20px + env(safe-area-inset-bottom))" }}>
            <PlayerDetail key={tourPlayer.id} groupId={groupId} player={tourPlayer} players={players} close={() => setTourPlayer(null)} onOpenPlayer={(id) => { const f = (players || []).find((p) => p.id === id); setTourPlayer(f || null); }} />
          </div>
        </div>, document.body)}
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
  // Собаки подиума — случайные из 15 при каждом заходе (как раньше верхний ряд);
  // выбор один раз на маунт, чтобы не мигали при ререндерах.
  const [podDogs] = useState(() => {
    const nums = Array.from({ length: DOG_COUNT }, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
    return nums.slice(0, 3).map((n) => `dog-${String(n).padStart(2, "0")}`);
  });
  // Три ёмкие карточки: демо теперь продаёт живой подиум ниже, а не текст.
  const features = [
    { icon: "🏆", title: t("w_f1_t"), sub: t("w_f1_d") },   // создай/вступи
    { icon: "🔗", title: t("w_f2_t"), sub: t("w_f2_d") },   // ссылки, LIVE, напоминания
    { icon: "📸", title: t("w_f3_t"), sub: t("w_f3_d") },   // рейтинг, звания, карточки
  ];
  return (
    <div className="pl-pop">
      {/* Hero — слоган сразу сверху; «стаю» показывает подиум ниже (вариант A). */}
      <div style={{ textAlign: "center", padding: "24px 0 18px" }}>
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

      {/* Живой мини-подиум: продукт виден до входа; собаки — те же, что в демо-стае */}
      <div className="pl-card" style={{ padding: "14px 12px 0", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12 }}>
          {[
            { n: 2, img: podDogs[1], nm: t("w_pn2"), size: 42, pad: 10, col: "#cfd8d0" },
            { n: 1, img: podDogs[0], nm: t("w_pn1"), size: 52, pad: 15, col: "var(--yellow)" },
            { n: 3, img: podDogs[2], nm: t("w_pn3"), size: 42, pad: 6, col: "#cd7f4d" },
          ].map((c) => (
            <div key={c.n} style={{ textAlign: "center", minWidth: 0 }}>
              <img src={`/avatars/${c.img}.webp`} alt="" loading="lazy" decoding="async"
                style={{ width: c.size, height: c.size, borderRadius: "50%", objectFit: "cover", border: `3px solid ${c.col}`, background: "var(--surface)" }} />
              <div style={{ fontSize: c.n === 1 ? 12 : 11, fontWeight: c.n === 1 ? 700 : 600, marginTop: 3 }}>{c.nm}{c.n === 1 ? " · 1204" : ""}</div>
              {c.n === 1 && (
                <div style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 20, background: "color-mix(in srgb, #ff9f2d 18%, transparent)", color: "#ff9f2d", display: "inline-block", marginTop: 2 }}>{t("tier_leader")}</div>
              )}
              <div style={{ background: c.n === 1 ? "color-mix(in srgb, var(--yellow) 18%, var(--surface2))" : "var(--surface2)", borderRadius: "8px 8px 0 0", padding: `${c.pad}px 16px`, fontWeight: 800, color: c.col, marginTop: 4 }}>{c.n}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--mut)", marginBottom: 14 }}>{t("w_pod_hint")}</div>

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
      {RIGHT > 0 && dx > 0 && (
        <button type="button" onClick={() => { snapped.current = 0; setDx(0); onOrganize(); }} style={{ ...actBtn, left: 0, background: "var(--lime)", color: "var(--lime-fg)" }}>
          <ShieldCheck size={16} /> {organizerActive ? t("unset_organizer_short") : t("set_organizer_short")}
        </button>
      )}
      {LEFT > 0 && dx < 0 && (
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

function Board({ groupId, players, loading = false, reload, profileId, bumpArchive, isAdmin, leagues, leaguesReady = true, activeLeague, onLeagueChange, onLeagueCreated, onEditProfile, selfStatsNonce = 0, analyticsNonce = 0 }) {
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
  const [showCreateLeague, setShowCreateLeague] = useState(false); // оверлей LeagueSetup (CTA демо-плашки)
  const [newLeagueName, setNewLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [leagueBusy, setLeagueBusy] = useState(false);
  const [leagueErr, setLeagueErr] = useState("");
  const ranked = [...players].sort((a, b) => b.rating - a.rating);
  const [memberQuery, setMemberQuery] = useState("");
  // Пилюля «Ты сейчас»: во всю ширину в своём месте списка; когда прилипла к низу
  // (position:sticky сработал и она встала рядом с FAB) — плавно уступает ему угол.
  // Определяем «прилипание» сентинелом сразу после пилюли: он ниже вьюпорта → pinned.
  const [youPinned, setYouPinned] = useState(true);
  const youIoRef = useRef(null);
  const youSentinelRef = useCallback((el) => {
    if (youIoRef.current) { youIoRef.current.disconnect(); youIoRef.current = null; }
    if (el && typeof IntersectionObserver !== "undefined") {
      // -200px ≈ отступ FAB (74) + высота FAB (56) + высота пилюли (56) + зазор:
      // расширяемся только когда пилюля в потоке поднялась ВЫШЕ зоны FAB, иначе
      // в переходной полосе полноширинная пилюля наезжала бы на кнопку.
      youIoRef.current = new IntersectionObserver(([e]) => setYouPinned(!e.isIntersecting), { rootMargin: "0px 0px -200px 0px" });
      youIoRef.current.observe(el);
    }
  }, []);

  // Недельные тренды рейтинга (↑/↓ у строк и в планке «Ты сейчас») — фоном, не блокируют.
  const [weekDeltas, setWeekDeltas] = useState({});
  useEffect(() => {
    if (!groupId) { setWeekDeltas({}); return; }
    let alive = true;
    getWeekDeltas(groupId).then((m) => { if (alive) setWeekDeltas(m); }).catch(() => {});
    return () => { alive = false; };
  }, [groupId, players.length]);

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
    catch (e) { showToast(t("err_add_player")); }
    finally { setBusy(false); }
  };

  // Создать нового гостя по введённому имени (контакты заполняются в профиле).
  const addGuest = async () => {
    const n = query.trim();
    if (!n || busy) return;
    setBusy(true);
    try { await addMember(groupId, n, {}); setQuery(""); reload(); }
    catch (e) { showToast(t("err_add_player")); }
    finally { setBusy(false); }
  };

  if (showStats) return <Analytics groupId={groupId} players={players} profileId={profileId} onBack={() => setShowStats(false)} onOpenPlayer={(p) => { setShowStats(false); setSelected(p); }} />;

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

  // Демо-стая из пустого состояния: раньше кнопка была только в LeagueSetup,
  // до которого пользователь без лиги (в т.ч. давно зарегистрированный) не добирался.
  const handleDemoLeague = async () => {
    if (leagueBusy) return;
    setLeagueBusy(true); setLeagueErr("");
    try {
      const lg = await createDemoLeague(currentLang);
      onLeagueCreated && onLeagueCreated(lg);
    } catch (e) { setLeagueErr(e.message || t("err_generic")); }
    finally { setLeagueBusy(false); }
  };

  // Демо-лига: персональная песочница — инвайт-карту не показываем (вместо неё
  // демо-плашка с CTA «создай свою лигу»). pp_demo_gid — подстраховка, если
  // is_demo ещё не доехал из кэша лиг.
  const isDemoLeague = !!groupId && (activeLeague?.is_demo || (() => { try { return localStorage.getItem("pp_demo_gid") === groupId; } catch (e) { return false; } })());

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
      {/* Без лиги — подсказка + вход в демо-стаю (создание/вступление — в переключателе в шапке).
          Только когда список лиг ДОГРУЖЕН: иначе карточка мигает при каждом логине. */}
      {leaguesReady && (!leagues || leagues.length === 0) && (
        <div className="pl-pop" style={{ marginBottom: 12 }}>
          {/* Демо-лига — герой пустого экрана: живой тизер таблицы + крупный CTA,
              чтобы новичок её не пропустил. Создать/вступить — спокойные ссылки ниже. */}
          <div style={{ borderRadius: 20, padding: "16px 15px 15px", position: "relative", overflow: "hidden",
            background: "linear-gradient(180deg, color-mix(in srgb, var(--lime) 12%, var(--surface)) 0%, var(--surface) 60%)",
            border: "1px solid color-mix(in srgb, var(--lime) 38%, transparent)",
            boxShadow: "0 0 0 4px color-mix(in srgb, var(--lime) 7%, transparent)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--lime)" }}>🐕 {t("demo_hero_eyebrow")}</span>
            <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2, margin: "8px 0 3px", letterSpacing: -0.2 }}>{t("demo_hero_title")}</div>
            <div style={{ fontSize: 12, color: "var(--mut)", margin: "0 0 13px", lineHeight: 1.4 }}>{t("demo_hero_desc")}</div>

            <div className="demo-peek" aria-hidden="true" style={{ borderRadius: 13, background: "color-mix(in srgb, var(--bg) 55%, var(--surface))", border: "1px solid var(--line)", padding: 6, display: "flex", flexDirection: "column", gap: 3 }}>
              {[
                { r: "1", n: "Rex", p: 1248, lead: true },
                { r: "2", n: "Bruno", p: 1176, lead: false },
                { r: "3", n: "Luna", p: 1090, lead: false },
              ].map((d) => (
                <div key={d.r} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", borderRadius: 9, background: d.lead ? "color-mix(in srgb, var(--lime) 10%, transparent)" : "transparent" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: d.lead ? "var(--lime)" : "var(--mut)", width: 14, textAlign: "center" }}>{d.r}</span>
                  <img src={dogAvatar(d.n)} alt="" style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, objectFit: "cover", border: "1px solid var(--line)" }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.n}</span>
                    <span style={{ display: "block", fontSize: 10, color: "var(--mut)" }}>{t(tierOf(d.p).key)}</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--lime)" }}>{d.p}</span>
                </div>
              ))}
            </div>

            <button disabled={leagueBusy} onClick={handleDemoLeague}
              style={{ width: "100%", marginTop: 13, padding: "13px 0", border: "none", borderRadius: 13, background: "var(--lime)", color: "var(--lime-fg)", fontSize: 15, fontWeight: 800, fontFamily: "'Outfit',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer", boxShadow: "0 8px 22px -8px color-mix(in srgb, var(--lime) 65%, transparent)" }}>
              🐕 {leagueBusy ? t("creating") : t("demo_hero_cta")} {!leagueBusy && <span className="demo-arrow">→</span>}
            </button>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => setShowCreateLeague("create")}
                style={{ flex: 1, padding: "11px 8px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>{t("demo_create_own")}</button>
              <button onClick={() => setShowCreateLeague("join")}
                style={{ flex: 1, padding: "11px 8px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>{t("demo_alt_join")}</button>
            </div>
            {leagueErr && <div style={{ fontSize: 12, color: "var(--coral)", marginTop: 8, textAlign: "center" }}>{leagueErr}</div>}
          </div>
        </div>
      )}

      {/* Единая инвайт-карта (код + копировать/поделиться/QR) — общий компонент
          с «Управлением лигой». #4: видна только тем, кто может приглашать. */}
      {activeLeague?.invite_code && !isDemoLeague && (isAdmin || activeLeague?.members_can_add) && (
        <InviteCard compact code={activeLeague.invite_code} leagueName={activeLeague.name} logoUrl={activeLeague.logo_url} style={{ marginBottom: 14 }} />
      )}

      {/* Онбординг «Начни свою лигу» — только когда лидерборд догружен и пуст,
          а не в момент загрузки (заглушка мигала на старте у всех). */}
      {groupId && !loading && ranked.length === 0 && (
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
      {/* Демо-плашка: пунктир = «песочница». CTA ведёт в создание настоящей лиги. */}
      {isDemoLeague && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", marginBottom: 12, background: "color-mix(in srgb, var(--lime) 8%, transparent)", border: "1px dashed color-mix(in srgb, var(--lime) 45%, transparent)", borderRadius: 14 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🐕</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{t("demo_banner_title")}</div>
            <div style={{ fontSize: 10.5, color: "var(--mut)" }}>{t("demo_banner_sub")}</div>
          </div>
          <button onClick={() => setShowCreateLeague("create")}
            style={{ flexShrink: 0, background: "var(--lime)", color: "var(--lime-fg)", fontSize: 11, fontWeight: 800, border: "none", borderRadius: 9, padding: "7px 11px", cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
            {t("demo_create_own")}
          </button>
        </div>
      )}
      {/* Портал в body: fixed внутри .pl-pop (transform) считался бы от предка. */}
      {showCreateLeague && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "var(--bg)", overflowY: "auto" }}>
          <Suspense fallback={null}>
            <LeagueSetup initialMode={typeof showCreateLeague === "string" ? showCreateLeague : "create"}
              onDone={(lg) => { setShowCreateLeague(false); onLeagueCreated && onLeagueCreated(lg); }}
              onCancel={() => setShowCreateLeague(false)} />
          </Suspense>
        </div>,
        document.body
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
      {/* Пьедестал топ-3: лидер в центре крупнее; тап открывает карточку игрока.
          При активном поиске прячем — все совпадения показываются строками. */}
      {groupId && !memberQuery.trim() && ranked.length >= 3 && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 12 }}>
          {[ranked[1], ranked[0], ranked[2]].map((p, idx) => {
            const isFirst = idx === 1;
            const place = isFirst ? 1 : idx === 0 ? 2 : 3;
            const ring = isFirst ? "var(--yellow)" : place === 2 ? "#cfd8d0" : "#cd7f4d";
            return (
              <div key={p.id} onClick={() => setSelected(p)} className="pl-card"
                style={{ flex: isFirst ? 1.15 : 1, textAlign: "center", padding: isFirst ? "13px 6px 11px" : "11px 6px 9px", cursor: "pointer", minWidth: 0,
                  // Своя плитка подсвечивается как своя строка в списке; иначе у лидера — золотая рамка.
                  border: p.id === profileId ? "1.5px solid color-mix(in srgb, var(--lime) 60%, transparent)"
                    : isFirst ? "1px solid color-mix(in srgb, var(--yellow) 35%, transparent)" : undefined,
                  background: p.id === profileId ? "color-mix(in srgb, var(--lime) 8%, transparent)" : undefined }}>
                {isFirst && <div style={{ fontSize: 15, lineHeight: 1, marginBottom: 4 }}>👑</div>}
                <img src={playerAvatar(p.avatar_url, p.id)} onError={avatarFallback(p.id)} onLoad={avatarOnLoad} alt=""
                  style={{ ...avatarBg(p.id), width: isFirst ? 58 : 48, height: isFirst ? 58 : 48, borderRadius: "50%", objectFit: "cover", border: `${isFirst ? 3 : 2.5}px solid ${ring}`, margin: "0 auto", display: "block" }} />
                {/* Статус тем же языком, что в строках: ⭐/🛡/✓/гость. Имя — до двух строк. */}
                <div style={{ fontSize: isFirst ? 12.5 : 11.5, fontWeight: isFirst ? 800 : 700, marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, minWidth: 0 }}>
                  <span style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.25, wordBreak: "break-word" }}>{p.name}</span>
                  {p.role === "owner"
                    ? <Star size={12} style={{ color: "var(--yellow)", flexShrink: 0 }} aria-label={t("role_owner")} />
                    : p.role === "admin"
                      ? <ShieldCheck size={12} style={{ color: "var(--yellow)", flexShrink: 0 }} aria-label={t("role_organizer")} />
                      : p.user_id
                        ? <UserCheck size={12} style={{ color: "var(--lime)", flexShrink: 0 }} aria-label={t("account_badge")} />
                        : <User size={11} style={{ color: "var(--mut)", flexShrink: 0 }} aria-label={t("guest_tag")} />}
                </div>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: isFirst ? 17 : 14, color: ring, marginTop: 2, lineHeight: 1 }}>{p.rating}</div>
                <div style={{ fontSize: 10, color: "var(--mut)", marginTop: 2 }}>{p.id === profileId ? t("fr_you") : isFirst ? t("podium_leader") : t("podium_place").replace("{n}", String(place))}</div>
              </div>
            );
          })}
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
        const searching = !!memberQuery.trim();
        if (searching && !p.name.toLowerCase().includes(memberQuery.trim().toLowerCase())) return null;
        if (!searching && ranked.length >= 3 && i < 3) return null; // топ-3 на пьедестале
        // Ачивки-эмодзи: максимум три, серия — с числом.
        const qb = [];
        if ((streaks[p.id] || 0) >= 3) qb.push(`🔥${streaks[p.id]}`);
        if (i === 0) qb.push("🥇");
        if (p.matches >= 5 && p.wins / p.matches >= 0.7) qb.push("🎯");
        if (p.matches >= 20) qb.push("⚡");
        if (toursOf(p) >= 3) qb.push("🏆");
        const badges = qb.slice(0, 3);
        const wd = weekDeltas[p.id] || 0;
        const canRemove = isAdmin && p.role !== "owner" && p.id !== profileId;
        const canOrg = activeLeague?.role === "owner" && p.user_id && p.role !== "owner" && p.id !== profileId;
        return (
          <SwipeRow key={p.id}
            onRemove={canRemove ? async () => { await removeMember(groupId, p.id); reload(); } : null}
            onOrganize={canOrg ? async () => { await setMemberRole(groupId, p.id, p.role === "admin" ? "member" : "admin"); reload(); } : null}
            organizerActive={p.role === "admin"} onTap={() => setSelected(p)}>
          <div className="pl-card" style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", cursor: "pointer", border: p.id === profileId ? "1.5px solid color-mix(in srgb, var(--lime) 60%, transparent)" : undefined, background: p.id === profileId ? "color-mix(in srgb, var(--lime) 8%, transparent)" : undefined }}>
            <div className="pl-display" style={{ width: 22, fontSize: 16, color: ["var(--yellow)", "#cfd8d0", "#cd7f4d"][i] || "var(--mut)", textAlign: "center", flexShrink: 0 }}>{i + 1}</div>
            <img src={playerAvatar(p.avatar_url, p.id)} onError={avatarFallback(p.id)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(p.id), width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0 }} />
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
                {p.id === profileId && <span style={{ fontSize: 9.5, color: "var(--lime-fg)", background: "var(--lime)", borderRadius: 6, padding: "1px 6px", fontWeight: 800, flexShrink: 0 }}>{t("fr_you")}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7, fontSize: 12, color: "var(--mut)", marginTop: 2 }}>
                <TierChip rating={p.rating} compact />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={t("tab_games")}><Swords size={13} /> {gamesOf(p)}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={t("tab_tournaments")}><Trophy size={13} /> {toursOf(p)}</span>
                </span>
                {badges.length > 0 && <span style={{ letterSpacing: 1, marginLeft: "auto" }}>{badges.join(" ")}</span>}
              </div>
            </div>
            {/* Рейтинг + недельный тренд вместо шеврона: главный сюжет таблицы */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 16, color: "var(--lime)", lineHeight: 1 }}>{p.rating}</div>
              {wd !== 0
                ? <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3, color: wd > 0 ? "var(--lime)" : "var(--coral)" }}>{wd > 0 ? "↑" : "↓"} {Math.abs(wd)}</div>
                : <div style={{ fontSize: 10, marginTop: 3, color: "var(--mut)", opacity: .55 }}>—</div>}
            </div>
          </div>
          </SwipeRow>
        );
      })}

      {/* Планка «Ты сейчас»: место, рейтинг, тренд и мостик к цели; тап — своя карточка */}
      {groupId && !memberQuery.trim() && (() => {
        const meIdx = ranked.findIndex((p) => p.id === profileId);
        if (meIdx < 0 || ranked.length < 2) return null;
        const me = ranked[meIdx];
        const d = weekDeltas[me.id] || 0;
        const gap = meIdx > 0 ? ranked[meIdx - 1].rating - me.rating : me.rating - ranked[1].rating;
        return (
          <>
          <div onClick={() => setSelected(me)}
            // Пилюля в пару к FAB: та же высота (56), полное скругление, общая тень,
            // низ выровнен по низу FAB. Угол уступает только в прилипшем состоянии
            // (youPinned) и только когда FAB виден; в потоке — во всю ширину.
            style={{ position: "sticky", bottom: "calc(env(safe-area-inset-bottom, 0px) + 74px)", zIndex: 5, marginTop: 10,
              marginRight: youPinned && (isAdmin || activeLeague?.members_can_add) ? 68 : 0,
              transition: "margin-right .25s ease",
              height: 56, boxSizing: "border-box",
              background: "var(--surface2)", border: "1px solid color-mix(in srgb, var(--lime) 35%, transparent)", borderRadius: 999,
              padding: "8px 18px", display: "flex", flexDirection: "column", justifyContent: "center", cursor: "pointer",
              boxShadow: "0 6px 22px -6px rgba(0,0,0,.55)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, fontFamily: "'Outfit',sans-serif", flexShrink: 0 }}>#{meIdx + 1} · {me.rating}</span>
              {d !== 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: d > 0 ? "var(--lime)" : "var(--coral)", flexShrink: 0 }}>{d > 0 ? "↑" : "↓"} {Math.abs(d)}</span>}
              <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "var(--lime)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {meIdx === 0 ? t("fr_gap_lead").replace("{n}", String(gap)) : t("fr_to_place").replace("{p}", String(meIdx)).replace("{n}", String(gap))} →
              </span>
            </div>
            <div style={{ fontSize: 9.5, color: "var(--mut)", marginTop: 1 }}>{t("fr_pos_hint")}</div>
          </div>
          {/* Сентинел: пока он ниже вьюпорта — пилюля прилипла (pinned) */}
          <div ref={youSentinelRef} style={{ height: 1 }} />
          </>
        );
      })()}

      {!groupId && (() => {
        const friends = ranked.filter((p) => p.id !== profileId && !hiddenIds.has(p.id));
        return friends.length > 0 ? (
        <>
          <div className="pl-display" style={{ fontSize: 12, color: "var(--mut)", margin: "4px 2px 8px", letterSpacing: 1 }}>{t("played_together_label")}</div>
          {friends.map((p) => (
            <SwipeRow key={p.id} onRemove={() => hidePlayer(p)} onTap={() => setSelected(p)}
              leftLabel={t("hide_btn")} leftIcon={<EyeOff size={16} />}>
            <div className="pl-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer" }}>
              <img src={playerAvatar(p.avatar_url, p.id)} onError={avatarFallback(p.id)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(p.id), width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  {p.is_registered && <ShieldCheck size={14} title={t("registered_badge")} style={{ color: "var(--lime)", flexShrink: 0 }} />}
                </div>
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
                    <img src={playerAvatar(p.avatar_url, p.id)} onError={avatarFallback(p.id)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(p.id), width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
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
              <img src={playerAvatar(p.avatar_url, p.id)} onError={avatarFallback(p.id)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(p.id), width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
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
    catch (e) { showToast(t("err_delete")); setBusy(false); }
  };

  // Портал в body: внутри .pl-pop (анимация transform) fixed-оверлей считается
  // от предка, а не от вьюпорта — диалог «уезжал» вглубь длинной страницы.
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", fontFamily: "'Outfit',sans-serif" }}>
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
    </div>,
    document.body
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
        <img src={avatarUrl} onError={avatarFallback(bp?.id || name)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(bp?.id || name), width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{name || "?"}</div>
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
  const [showTiers, setShowTiers] = useState(false); // легенда званий («?» у чипа)
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
    getRatingHistory(groupId, player.id).then(setHist).catch(() => setHist([]));

    // Определяем свой profile_id
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => { if (data) setMyId(data.id); });
    });

    // Загружаем матчи группы для статистики
    getStatMatches(groupId).then((data) => setAllMatches(data || []));

    // Лиги игрока (RLS отдаёт только общие с текущим пользователем лиги; свои — все).
    // Лёгкий вариант: рейтинг и игры едут тем же запросом, место не считаем.
    supabase.from("group_members")
      .select("role, rating, matches_played, group:groups(id, name, logo_url)")
      .eq("profile_id", player.id)
      .then(({ data }) => setPlayerLeagues((data || []).map((r) => ({
        id: r.group.id, name: r.group.name, logo: r.group.logo_url || null,
        role: r.role, rating: r.rating, matches: r.matches_played,
      }))));

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

  // Единый проход по ВСЕМ матчам игрока (игры + турнирные): напарники, соперники
  // (для «немезиды»), скальп (сильнейший побеждённый) и турнирные В/Н/П для кольца.
  // Разница в играх — по геймам (score_detail, как раньше), в турнирах — по очкам.
  const peopleStats = (() => {
    const mates = {}, opps = {};
    let scalp = null;
    const tourWLD = { w: 0, d: 0, l: 0 };
    const feedMate = (key, id, name, my) => {
      if (!mates[key]) mates[key] = { id, name, w: 0, l: 0, d: 0, diff: 0 };
      mates[key].diff += my;
      if (my === 0) mates[key].d++; else if (my > 0) mates[key].w++; else mates[key].l++;
    };
    const feedOpp = (key, id, name, won, draw) => {
      if (!opps[key]) opps[key] = { id, name, w: 0, l: 0, d: 0 };
      if (draw) opps[key].d++; else if (won) opps[key].w++; else opps[key].l++;
    };
    const considerScalp = (pid, won) => {
      if (!won || !pid) return;
      const p = players.find((x) => x.id === pid);
      if (p && p.id !== player.id && (!scalp || p.rating > scalp.rating)) scalp = p;
    };
    (allMatches || []).forEach((m) => {
      const inA = (m.team_a || []).includes(player.id);
      const inB = (m.team_b || []).includes(player.id);
      if (!inA && !inB) return;
      let myG;
      if (Array.isArray(m.score_detail) && m.score_detail.length > 0) {
        const ga = m.score_detail.reduce((s, x) => s + (x.a || 0), 0);
        const gb = m.score_detail.reduce((s, x) => s + (x.b || 0), 0);
        myG = ga - gb;
      } else {
        myG = (m.sets_a || 0) - (m.sets_b || 0);
      }
      const my = inA ? myG : -myG;
      const draw = m.sets_a === m.sets_b;
      const won = !draw && (inA ? m.sets_a > m.sets_b : m.sets_b > m.sets_a);
      (inA ? m.team_a : m.team_b).forEach((tid) => { if (tid && tid !== player.id) feedMate(String(tid), tid, nameOf(tid), my); });
      (inA ? m.team_b : m.team_a).forEach((oid) => { if (!oid) return; feedOpp(String(oid), oid, nameOf(oid), won, draw); considerScalp(oid, won); });
    });
    (rawTours || []).forEach((tour) => {
      const myTp = (tour.players || []).find((p) => p.profile_id === player.id);
      if (!myTp) return;
      const byTpId = {};
      (tour.players || []).forEach((p) => { byTpId[p.id] = p; });
      (tour.matches || []).forEach((m) => {
        if (m.score_a == null || (m.round_number || 0) <= 0) return;
        const inA = (m.team_a || []).includes(myTp.id);
        const inB = (m.team_b || []).includes(myTp.id);
        if (!inA && !inB) return;
        const my = inA ? m.score_a - m.score_b : m.score_b - m.score_a;
        const draw = my === 0, won = my > 0;
        if (draw) tourWLD.d++; else if (won) tourWLD.w++; else tourWLD.l++;
        (inA ? m.team_a : m.team_b).forEach((tid) => {
          if (tid === myTp.id) return;
          const tp = byTpId[tid]; if (!tp) return;
          feedMate(tp.profile_id ? String(tp.profile_id) : "g:" + (tp.name || tid), tp.profile_id || null, tp.name || "?", my);
        });
        (inA ? m.team_b : m.team_a).forEach((tid) => {
          const tp = byTpId[tid]; if (!tp) return;
          feedOpp(tp.profile_id ? String(tp.profile_id) : "g:" + (tp.name || tid), tp.profile_id || null, tp.name || "?", won, draw);
          considerScalp(tp.profile_id, won);
        });
      });
    });
    // Немезида: ≥3 личных встреч и отрицательный баланс; берём худший.
    const nemesis = Object.values(opps)
      .filter((o) => o.w + o.l >= 3 && o.l > o.w)
      .sort((a, b) => (a.w - a.l) - (b.w - b.l) || b.l - a.l)[0] || null;
    return { partner: pickBestPartner(Object.values(mates)), nemesis, scalp, tourWLD };
  })();

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

  // Место в лиге и перцентиль («лучше X% игроков») — для строки под именем.
  const ranked = [...players].sort((a, b) => b.rating - a.rating);
  const rank = ranked.findIndex((p) => p.id === player.id); // -1 = не в лиге
  const betterPct = rank >= 0 && ranked.length > 1
    ? Math.round(((ranked.length - 1 - rank) / (ranked.length - 1)) * 100) : null;

  // Ачивки с прогрессом: on = открыта, prog 0..1 — насколько близко, progLabel — подпись.
  const achList = (() => {
    const leaderOk = ranked.length > 0 && ranked[0].id === player.id;
    const wr = player.matches > 0 ? player.wins / player.matches : 0;
    const toursN = (playerTours || []).length;
    const ofL = (a, b) => t("ach_of").replace("{a}", String(Math.min(a, b))).replace("{b}", String(b));
    return [
      { icon: "🥇", label: t("badge_leader"),  rule: t("badge_leader_title"),  on: leaderOk,
        prog: leaderOk ? 1 : (ranked[0] ? Math.min(player.rating / ranked[0].rating, 1) : 0), progLabel: rank >= 0 ? `#${rank + 1}` : "" },
      { icon: "🎯", label: t("badge_sniper"),  rule: t("badge_sniper_title"),  on: player.matches >= 5 && wr >= 0.7,
        prog: Math.min(player.matches / 5, 1) * Math.min(wr / 0.7, 1), progLabel: `${Math.round(wr * 100)}%` },
      { icon: "⚡", label: t("badge_veteran"), rule: t("badge_veteran_title"), on: player.matches >= 20,
        prog: Math.min(player.matches / 20, 1), progLabel: ofL(player.matches, 20) },
      { icon: "🔥", label: t("badge_rising"),  rule: t("badge_rising_title"),  on: winStreak >= 3,
        prog: Math.min(winStreak / 3, 1), progLabel: ofL(winStreak, 3) },
      { icon: "🏆", label: t("badge_tourney"), rule: t("badge_tourney_title"), on: (playerTours || []).length >= 3,
        prog: Math.min(toursN / 3, 1), progLabel: ofL(toursN, 3) },
    ];
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
          {d > 0 && <div style={{ flex: d, background: "var(--mut)" }} />}
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
  // Винрейт по ВСЕМ матчам (игры + турнирные) — для KPI-кольца.
  const combinedWLD = {
    w: myGames.w + peopleStats.tourWLD.w,
    d: myGames.d + peopleStats.tourWLD.d,
    l: myGames.l + peopleStats.tourWLD.l,
  };
  const combinedTotal = combinedWLD.w + combinedWLD.d + combinedWLD.l;
  const winPct = combinedTotal > 0 ? Math.round((combinedWLD.w / combinedTotal) * 100) : null;

  // Недельная дельта рейтинга — чип в шапке.
  const weekDelta = (() => {
    if (!hist || hist.length === 0) return 0;
    const weekAgo = Date.now() - 7 * 864e5;
    const recent = hist.filter((p) => new Date(p.at).getTime() >= weekAgo);
    if (recent.length === 0) return 0;
    const before = hist.filter((p) => new Date(p.at).getTime() < weekAgo);
    return recent[recent.length - 1].r - (before.length ? before[before.length - 1].r : 1000);
  })();

  // Рекордная серия побед (по играм, исторический максимум).
  const streakRec = (() => {
    if (!allMatches) return 0;
    const rows = allMatches
      .filter((m) => [...(m.team_a || []), ...(m.team_b || [])].includes(player.id))
      .sort((a, b) => (a.played_at || "").localeCompare(b.played_at || ""));
    let cur = 0, max = 0;
    rows.forEach((m) => {
      if (m.sets_a === m.sets_b) { cur = 0; return; }
      const won = (m.team_a || []).includes(player.id) ? m.sets_a > m.sets_b : m.sets_b > m.sets_a;
      if (won) { cur++; if (cur > max) max = cur; } else cur = 0;
    });
    return max;
  })();

  // Все матчи игрока, новые сверху.
  const playerMatches = (allMatches || [])
    .filter((m) => [...(m.team_a || []), ...(m.team_b || [])].includes(player.id))
    .sort((a, b) => (b.played_at || "").localeCompare(a.played_at || ""));

  // Лента формы: игры (В/Н/П) и турниры (место) одной хронологией; старые → новые.
  const formEvents = (() => {
    const evs = playerMatches.map((m) => {
      const inA = (m.team_a || []).includes(player.id);
      const draw = m.sets_a === m.sets_b;
      const won = !draw && (inA ? m.sets_a > m.sets_b : m.sets_b > m.sets_a);
      return { type: "game", at: m.played_at || "", won, draw,
        hint: `${(m.team_a || []).map(nameOf).join(" & ")} ${m.sets_a}:${m.sets_b} ${(m.team_b || []).map(nameOf).join(" & ")}${m.played_at ? " · " + fmtDate(m.played_at) : ""}` };
    });
    (playerTours || []).forEach((tr) => evs.push({ type: "tour", at: tr.date || "", pos: tr.position, total: tr.total,
      hint: `${tr.name || t("fmt_americano_name")} · ${tr.position}/${tr.total}` }));
    return evs.sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, 10).reverse();
  })();

  // Рекорды по месяцам: дельта = последний рейтинг месяца − последний прошлого (или 1000).
  const monthRecs = (() => {
    if (!hist || hist.length === 0) return null;
    const months = [];
    hist.forEach((p) => {
      const k = (p.at || "").slice(0, 7);
      if (!k) return;
      if (!months.length || months[months.length - 1].key !== k) months.push({ key: k, last: p.r });
      else months[months.length - 1].last = p.r;
    });
    if (!months.length) return null;
    const rows = months.map((m, i) => ({ key: m.key, delta: m.last - (i === 0 ? 1000 : months[i - 1].last) }));
    const best = [...rows].sort((a, b) => b.delta - a.delta)[0];
    const worst = [...rows].sort((a, b) => a.delta - b.delta)[0];
    const label = (k) => { try { return new Date(k + "-01").toLocaleDateString(dateLocale(), { month: "long", year: "numeric" }); } catch (e) { return k; } };
    return {
      best: { ...best, label: label(best.key) },
      worst: rows.length > 1 && worst.key !== best.key ? { ...worst, label: label(worst.key) } : null,
    };
  })();

  // Средняя «цена победы» из истории — для оценок «≈ N побед» (цель и звание).
  const avgWin = (() => {
    const wd = (hist || []).map((p, i) => p.r - (i === 0 ? 1000 : hist[i - 1].r)).filter((d) => d > 0);
    return wd.length ? wd.reduce((s, d) => s + d, 0) / wd.length : 10;
  })();

  // Цель (своя карточка): разрыв до соседа сверху + оценка в победных матчах
  // (турнирные победы тоже двигают рейтинг).
  const goal = (() => {
    if (rank < 0 || !ranked.length) return null;
    if (rank === 0) return { leader: true, gap: ranked.length > 1 ? player.rating - ranked[1].rating : 0 };
    const ahead = ranked[rank - 1];
    const gap = ahead.rating - player.rating;
    return { leader: false, ahead, gap, est: Math.max(1, Math.ceil(gap / avgWin)) };
  })();

  // Кнопка «ещё N / свернуть» для списков длиннее 3.
  const moreBtn = (count, expanded, onToggle) => count > 3 && (
    <button className="pl-ghost" style={{ width: "100%", padding: "8px 0", marginTop: 8, fontSize: 12, color: "var(--mut)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }} onClick={onToggle}>
      {expanded ? <><ChevronUp size={13} /> {t("trn_collapse")}</> : <><ChevronDown size={13} /> {t("show_more")} {count - 3}</>}
    </button>
  );

  // Действия админа — единый ряд компактных кнопок. Недоступные не прячем,
  // а засериваем с причиной (title/aria): ряд стабилен и предсказуем.
  const showAddToLeague = !!onAddToLeague && !isInLeague;
  const adminRow = isInLeague && !!myId && myId !== player.id;
  const rowBtns = [];
  if (adminRow && !!onSetRole && isOwner && player.role !== "owner")
    rowBtns.push({ key: "org", Icon: ShieldCheck, tint: "var(--yellow)",
      label: player.role === "admin" ? t("unset_organizer_short") : t("set_organizer_short"),
      disabled: !player.user_id, hint: !player.user_id ? t("org_needs_account") : null,
      onClick: () => onSetRole(player.role === "admin" ? "member" : "admin") });
  if (adminRow && isAdmin && !localClaimCode)
    rowBtns.push({ key: "claim", Icon: Share2, tint: "var(--lime)",
      label: genBusy ? t("creating") : t("btn_claim_short"),
      disabled: !!player.user_id || genBusy, hint: player.user_id ? t("claim_has_account") : null,
      onClick: generateClaimCode });
  if (adminRow && isAdmin && !!onDelete)
    rowBtns.push({ key: "del", Icon: Trash2, tint: "var(--coral)",
      label: t("btn_remove_short"), disabled: false, hint: null,
      onClick: () => setShowDeleteModal(true) });
  const showClaimLink = !player.user_id && !!localClaimCode;
  const hasActions = showAddToLeague || rowBtns.length > 0 || showClaimLink;

  return (
    <div className="pl-pop">
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <BackButton onClick={close} />
      </div>

      {/* Шапка-герой: аватар (свой → личный кабинет по тапу), имя, место в лиге,
          рейтинг с недельной дельтой; ниже — контакты, действия и график. */}
      <div className="pl-card" style={{ padding: 16, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {(() => {
            const self = !!onEditProfile && !!myId && myId === player.id;
            const av = (
              <span style={{ position: "relative", display: "inline-block", flexShrink: 0 }}>
                <img src={playerAvatar(player.avatar_url, player.id)} onError={avatarFallback(player.id)} onLoad={avatarOnLoad} alt=""
                  style={{ ...avatarBg(player.id), width: 54, height: 54, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--lime)", display: "block" }} />
                {self && (
                  <span style={{ position: "absolute", right: -3, bottom: -3, width: 19, height: 19, borderRadius: "50%", background: "var(--lime)", color: "var(--lime-fg)", border: "2px solid var(--surface)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Pencil size={9} strokeWidth={2.5} />
                  </span>
                )}
              </span>
            );
            return self
              ? <button onClick={onEditProfile} aria-label={t("pc_title")} title={t("pc_title")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>{av}</button>
              : av;
          })()}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="pl-display" style={{ fontSize: 19, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.name}</div>
            {player.rating != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <TierChip rating={player.rating} />
                <button type="button" onClick={() => setShowTiers((s) => !s)} aria-label={t("tier_ladder_title")} title={t("tier_ladder_title")}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", border: "1px solid var(--line)", background: showTiers ? "var(--surface2)" : "none", color: "var(--mut)", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                  <HelpCircle size={11} />
                </button>
                {rank >= 0 && (
                  <span style={{ fontSize: 11.5, color: "var(--mut)" }}>
                    {t("rank_in_league").replace("{n}", String(rank + 1))}{betterPct ? ` · ${t("better_than").replace("{p}", String(betterPct))}` : ""}
                  </span>
                )}
              </div>
            )}
            <ContactLinks contacts={player.contacts} />
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div className="pl-display" style={{ fontSize: 27, color: "var(--lime)", lineHeight: 1 }}>{player.rating}</div>
            {weekDelta !== 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 10.5, fontWeight: 700, marginTop: 3, color: weekDelta > 0 ? "var(--lime)" : "var(--coral)" }}>
                {weekDelta > 0 ? <ChevronUp size={11} /> : <ChevronDown size={11} />}{weekDelta > 0 ? "+" : ""}{weekDelta} {t("wk_suffix")}
              </div>
            )}
          </div>
        </div>

        {/* Легенда званий — лестница с диапазонами + механика ELO в двух строках */}
        {showTiers && (
          <div style={{ marginTop: 10, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "var(--ink)", marginBottom: 4 }}>{t("tier_ladder_title")}</div>
            <div style={{ fontSize: 11, color: "var(--mut)", lineHeight: 1.5, marginBottom: 9 }}>{t("tier_help")}</div>
            {TIERS.map((tr, i) => (
              <div key={tr.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <TierChip rating={tr.min === -Infinity ? 0 : tr.min} />
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--mut)" }}>
                  {i === 0 ? `${tr.min}+` : tr.min === -Infinity ? t("tier_upto").replace("{n}", String(TIERS[i - 1].min)) : `${tr.min}–${TIERS[i - 1].min - 1}`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Прогресс до следующего звания (своя карточка) — вторая цель рядом с местом в лиге */}
        {myId === player.id && (() => {
          const cur = tierOf(player.rating), next = tierAbove(player.rating);
          if (!next) return null;
          const lo = cur.min === -Infinity ? next.min - 200 : cur.min;
          const prog = Math.max(0.04, Math.min((player.rating - lo) / (next.min - lo), 1));
          const gap = next.min - player.rating;
          return (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", fontSize: 10.5, color: "var(--mut)", marginBottom: 5, gap: 8, flexWrap: "wrap" }}>
                <span>{t("tier_next").replace("{t}", t(next.key)).replace("{n}", String(gap))}</span>
                <span style={{ marginLeft: "auto" }}>{t("tier_wins_est").replace("{n}", String(Math.max(1, Math.ceil(gap / avgWin))))}</span>
              </div>
              <div style={{ height: 6, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                <span style={{ display: "block", width: `${Math.round(prog * 100)}%`, height: "100%", background: next.color, borderRadius: 4 }} />
              </div>
            </div>
          );
        })()}

        {/* График рейтинга с периодами — в той же карточке */}
        <div style={{ marginTop: 14 }}>
          <RatingChart rows={hist || []} />
        </div>

        {/* Действия админа — вспомогательная зона ПОД графиком: один ряд равных
            кнопок (иконка + короткая подпись), недоступные засерены с причиной. */}
        {hasActions && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
            {showAddToLeague && (
              <button onClick={onAddToLeague}
                style={{ padding: "10px 14px", border: "none", borderRadius: 12, background: "var(--lime)", color: "var(--lime-fg)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit'" }}>
                {t("add_to_league")}
              </button>
            )}
            {rowBtns.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${rowBtns.length}, 1fr)`, gap: 7 }}>
                {rowBtns.map((b) => (
                  <button key={b.key} onClick={b.disabled ? undefined : b.onClick} disabled={b.disabled}
                    title={b.hint || b.label} aria-label={b.hint ? `${b.label} — ${b.hint}` : b.label}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "9px 4px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface2)", cursor: b.disabled ? "default" : "pointer", fontFamily: "'Outfit'", opacity: b.disabled ? 0.4 : 1 }}>
                    <b.Icon size={15} style={{ color: b.tint }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{b.label}</span>
                  </button>
                ))}
              </div>
            )}
            {showClaimLink && <ClaimLinkButton claimCode={localClaimCode} />}
          </div>
        )}
      </div>

      {/* KPI: винрейт по всем матчам (игры + турниры), текущая серия, рекорд серии */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div className="pl-card" style={{ padding: "12px 8px", textAlign: "center" }}>
          {(() => { const C = 2 * Math.PI * 26; return (
            <svg viewBox="0 0 64 64" style={{ width: 58, height: 58 }} role="img" aria-label={`${winPct === null ? "—" : winPct + "%"} ${t("kpi_winrate")}`}>
              <circle cx="32" cy="32" r="26" fill="none" strokeWidth="7" style={{ stroke: "var(--surface2)" }} />
              {winPct !== null && winPct > 0 && <circle cx="32" cy="32" r="26" fill="none" strokeWidth="7" strokeLinecap="round" style={{ stroke: "var(--lime)" }} strokeDasharray={`${(C * winPct) / 100} ${C}`} transform="rotate(-90 32 32)" />}
              <text x="32" y="37" fontSize="15" fontWeight="800" textAnchor="middle" style={{ fill: "var(--ink)" }} fontFamily="'Outfit',sans-serif">{winPct === null ? "—" : winPct + "%"}</text>
            </svg>
          ); })()}
          <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 2 }}>{t("kpi_winrate")}</div>
        </div>
        <div className="pl-card" style={{ padding: 12, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
          <div className="pl-display" style={{ fontSize: 24, color: winStreak > 0 ? "var(--lime)" : "var(--mut)" }}>{winStreak}</div>
          <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 3 }}>{t("kpi_streak_now")}</div>
          <div style={{ fontSize: 9.5, color: "var(--mut)", opacity: .7, marginTop: 3 }}>{t("kpi_now")}</div>
        </div>
        <div className="pl-card" style={{ padding: 12, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
          <div className="pl-display" style={{ fontSize: 24, color: streakRec > 0 ? "var(--yellow)" : "var(--mut)" }}>{streakRec}</div>
          <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 3 }}>{t("kpi_streak_rec")}</div>
        </div>
      </div>

      {/* Форма: последние 10 событий — игры (квадрат В/Н/П) и турниры (круг с местом) */}
      {formEvents.length > 0 && (
        <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{t("stat_form")}</div>
            <div style={{ fontSize: 11, color: "var(--mut)" }}>{t("stat_last10")}</div>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {formEvents.map((ev, i) => {
              if (ev.type === "tour") {
                const c = ev.pos === 1 ? "var(--yellow)" : ev.pos === 2 ? "#cfd8d0" : ev.pos === 3 ? "#cd7f4d" : "var(--mut)";
                return (
                  <span key={"f" + i} title={ev.hint}
                    style={{ width: 28, height: 28, borderRadius: "50%", background: `color-mix(in srgb, ${c} 16%, transparent)`, border: `1.5px solid color-mix(in srgb, ${c} 55%, transparent)`, color: c, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, fontFamily: "'Outfit',sans-serif", flexShrink: 0 }}>
                    {ev.pos}
                  </span>
                );
              }
              const c = ev.draw ? "var(--mut)" : ev.won ? "#3ddc84" : "var(--coral)";
              return (
                <span key={"f" + i} title={ev.hint}
                  style={{ width: 28, height: 28, borderRadius: 8, background: `color-mix(in srgb, ${c} 16%, transparent)`, border: `1.5px solid color-mix(in srgb, ${c} 55%, transparent)`, color: c, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, fontFamily: "'Outfit',sans-serif", flexShrink: 0 }}>
                  {ev.draw ? t("result_draw") : ev.won ? t("result_win") : t("result_loss")}
                </span>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, color: "var(--mut)" }}>{t("form_legend_game")} · {t("form_legend_tour")}</span>
            <span style={{ fontSize: 9, color: "var(--mut)" }}>{t("recency_hint")}</span>
          </div>
        </div>
      )}

      {/* Люди: лучший напарник (игры + турниры) и неудобный соперник */}
      {peopleStats.partner && (() => {
        const bp = peopleStats.partner;
        const p = players.find((x) => x.id === bp.id);
        return <PartnerCard key="bp-all" label={t("best_partner_all")} bp={bp} name={p?.name || bp.name || nameMap[bp.id] || "?"} avatarUrl={playerAvatar(p?.avatar_url, bp.id || bp.name)} help={t("best_partner_help_all")} onOpen={p ? () => onOpenPlayer(p) : undefined} />;
      })()}
      {peopleStats.nemesis && (() => {
        const nm = peopleStats.nemesis;
        const p = players.find((x) => x.id === nm.id);
        const total = nm.w + nm.l + nm.d;
        return (
          <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
            {/* Заголовок в шапке плитки — как у «лучшего напарника», имя не обрезается */}
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{t("nemesis_label")}</div>
            <div onClick={p ? () => onOpenPlayer(p) : undefined} style={{ display: "flex", alignItems: "center", gap: 10, cursor: p ? "pointer" : "default" }}>
              <img src={playerAvatar(p?.avatar_url, nm.id || nm.name)} onError={avatarFallback(nm.id || nm.name)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(nm.id || nm.name), width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p?.name || nm.name || "?"}</div>
                <div style={{ fontSize: 12, color: "var(--mut)" }}>{t("nemesis_against").replace("{w}", String(nm.w)).replace("{n}", String(total))}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, lineHeight: 1.1, color: "var(--coral)" }}>{nm.w}–{nm.l}</div>
                <div style={{ fontSize: 10, color: "var(--mut)" }}>{t("vs_meetings")}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Цель (только своя карточка) + личные рекорды */}
      {((goal && myId === player.id) || monthRecs || peopleStats.scalp) && (
        <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
          {goal && myId === player.id && (
            <div style={{ marginBottom: (monthRecs || peopleStats.scalp) ? 14 : 0 }}>
              <div style={{ fontSize: 11, color: "var(--mut)", fontWeight: 700, letterSpacing: .3, textTransform: "uppercase", marginBottom: 7 }}>{t("goal_heading")}</div>
              {goal.leader ? (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{t("goal_leader").replace("{n}", String(goal.gap))}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--mut)" }}>{t("goal_defend")}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--surface2)", borderRadius: 5, marginTop: 8, overflow: "hidden" }}>
                    <span style={{ display: "block", width: "100%", height: "100%", background: "var(--lime)" }} />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{t("goal_to").replace("{p}", String(rank)).replace("{n}", String(goal.gap))}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--mut)" }}>{t("goal_ahead").replace("{name}", goal.ahead.name).replace("{r}", String(goal.ahead.rating))}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--surface2)", borderRadius: 5, marginTop: 8, overflow: "hidden" }}>
                    <span style={{ display: "block", width: `${Math.max(8, Math.min(100 - goal.gap, 96))}%`, height: "100%", background: "var(--lime)", borderRadius: 5 }} />
                  </div>
                  <div style={{ display: "flex", marginTop: 5, fontSize: 9.5, color: "var(--mut)", gap: 8, flexWrap: "wrap" }}>
                    <span>{t("goal_you").replace("{r}", String(player.rating))}</span>
                    <span style={{ marginLeft: "auto" }}>{t("goal_est").replace("{n}", String(goal.est))}</span>
                  </div>
                </>
              )}
            </div>
          )}
          {(monthRecs || peopleStats.scalp) && (
            <>
              <div style={{ fontSize: 11, color: "var(--mut)", fontWeight: 700, letterSpacing: .3, textTransform: "uppercase", marginBottom: 8 }}>{t("rec_heading")}</div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${[monthRecs && monthRecs.best, monthRecs && monthRecs.worst, peopleStats.scalp].filter(Boolean).length}, 1fr)`, gap: 8 }}>
                {monthRecs && (
                  <div style={{ background: "var(--surface2)", borderRadius: 13, padding: "10px 6px", textAlign: "center" }}>
                    <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 16, color: "var(--lime)" }}>{monthRecs.best.delta > 0 ? "+" : ""}{monthRecs.best.delta}</div>
                    <div style={{ fontSize: 9.5, color: "var(--mut)", marginTop: 3, lineHeight: 1.3 }}>{t("rec_best_month")}<br />{monthRecs.best.label}</div>
                  </div>
                )}
                {monthRecs && monthRecs.worst && (
                  <div style={{ background: "var(--surface2)", borderRadius: 13, padding: "10px 6px", textAlign: "center" }}>
                    <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 16, color: "var(--coral)" }}>{monthRecs.worst.delta > 0 ? "+" : ""}{monthRecs.worst.delta}</div>
                    <div style={{ fontSize: 9.5, color: "var(--mut)", marginTop: 3, lineHeight: 1.3 }}>{t("rec_worst_month")}<br />{monthRecs.worst.label}</div>
                  </div>
                )}
                {peopleStats.scalp && (
                  <div style={{ background: "var(--surface2)", borderRadius: 13, padding: "10px 6px", textAlign: "center" }} title={peopleStats.scalp.name}>
                    <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 16, color: "var(--yellow)" }}>{peopleStats.scalp.rating}</div>
                    <div style={{ fontSize: 9.5, color: "var(--mut)", marginTop: 3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("rec_scalp")}<br />{peopleStats.scalp.name}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Достижения: открытые + прогресс к остальным; «?» — легенда правил */}
      <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{t("ach_heading")}</div>
          <span style={{ fontSize: 11, color: "var(--mut)" }}>{t("ach_of").replace("{a}", String(achList.filter((a) => a.on).length)).replace("{b}", String(achList.length))}</span>
          <button type="button" onClick={() => setShowAch((s) => !s)} aria-label={t("ach_help")} title={t("ach_help")}
            style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", border: "1px solid var(--line)", background: showAch ? "var(--surface2)" : "none", color: "var(--mut)", cursor: "pointer", padding: 0, flexShrink: 0 }}>
            <HelpCircle size={12} />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
          {achList.map((a) => (
            <div key={a.label} title={`${a.label} — ${a.rule}`}
              style={{ background: "var(--surface2)", borderRadius: 12, padding: "9px 3px", textAlign: "center", border: a.on ? "1px solid color-mix(in srgb, var(--lime) 30%, transparent)" : "1px solid transparent", opacity: a.on ? 1 : .78 }}>
              <div style={{ fontSize: 17, filter: a.on ? "none" : "grayscale(1)" }}>{a.icon}</div>
              <div style={{ fontSize: 8.5, fontWeight: 700, marginTop: 4, color: a.on ? "var(--ink)" : "var(--mut)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.label}</div>
              {!a.on && (
                <>
                  <div style={{ height: 3, background: "var(--line)", borderRadius: 2, marginTop: 5, overflow: "hidden" }}>
                    <span style={{ display: "block", width: `${Math.round(Math.min(a.prog, 1) * 100)}%`, height: "100%", background: "var(--mut)" }} />
                  </div>
                  <div style={{ fontSize: 8, color: "var(--mut)", marginTop: 2 }}>{a.progLabel}</div>
                </>
              )}
            </div>
          ))}
        </div>
        {showAch && (
          <div style={{ marginTop: 10, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 6, fontSize: 12 }}>{t("ach_legend_title")}</div>
            {achList.map((a) => (
              <div key={a.label} style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4, fontSize: 11.5, lineHeight: 1.4, color: "var(--mut)" }}>
                <span style={{ fontSize: 13, flexShrink: 0, width: 16, textAlign: "center" }}>{a.icon}</span>
                <span><b style={{ color: "var(--ink)", fontWeight: 700 }}>{a.label}</b> — {a.rule}</span>
              </div>
            ))}
          </div>
        )}
      </div>

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
      {/* Лиги игрока: лого/монограмма, рейтинг · место · игры, иконка роли (как в списке друзей) */}
      {playerLeagues && playerLeagues.length > 0 && (
        <div className="pl-card" style={{ padding: 14, marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t("leagues_heading")} ({playerLeagues.length})</div>
          {(showL ? playerLeagues : playerLeagues.slice(0, 3)).map((lg, i) => {
            const mono = ["var(--lime)", "var(--yellow)", "#4db8e8", "var(--coral)"][i % 4];
            return (
              <div key={lg.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
                {lg.logo
                  ? <img src={lg.logo} alt="" style={{ width: 38, height: 38, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
                  : <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, background: `color-mix(in srgb, ${mono} 13%, transparent)`, color: mono }}>{(lg.name || "?").trim().charAt(0).toUpperCase()}</span>}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lg.name}</div>
                  {(lg.rating != null || lg.matches != null) && (
                    <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 1 }}>
                      {lg.rating != null && <span style={{ color: "var(--lime)", fontWeight: 700 }}>{lg.rating}</span>}
                      {lg.matches != null && <span>{lg.rating != null ? " · " : ""}{lg.matches} {t("matches")}</span>}
                    </div>
                  )}
                </div>
                {lg.role === "owner"
                  ? <Star size={15} style={{ color: "var(--yellow)", flexShrink: 0 }} aria-label={t("role_owner")} title={t("role_owner")} />
                  : lg.role === "admin"
                    ? <ShieldCheck size={15} style={{ color: "var(--yellow)", flexShrink: 0 }} aria-label={t("role_organizer")} title={t("role_organizer")} />
                    : null}
              </div>
            );
          })}
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
// Hero «Ближайшая игра»: обратный отсчёт, состав и действие в одной карточке
// наверху вкладки — зеркало пуш-напоминаний, но всегда на виду.
function GameHero({ g, me, onOpen, onTake }) {
  const slots = [...(g.slots || [])].sort((a, b) => ((a.team || "") + (a.position || "")).localeCompare((b.team || "") + (b.position || "")));
  const filled = slots.filter((s) => s.profile_id || s.guest_name).length;
  const meIn = meInGame(g, me);
  const hasFree = filled < 4;
  const mins = g.starts_at ? Math.round((new Date(g.starts_at).getTime() - Date.now()) / 60000) : null;
  const cd = mins != null && mins > 0
    ? (mins >= 60
        ? t("hero_in_hm").replace("{h}", String(Math.floor(mins / 60))).replace("{m}", String(mins % 60))
        : t("hero_in_m").replace("{m}", String(mins)))
    : null;
  const canTake = !!me && hasFree && !meIn;
  return (
    <div onClick={onOpen} style={{ border: "1.5px solid color-mix(in srgb, var(--lime) 45%, transparent)", background: "linear-gradient(160deg, color-mix(in srgb, var(--lime) 10%, var(--surface)), var(--surface))", borderRadius: 18, padding: "14px 14px 13px", marginBottom: 10, cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: "var(--lime)", textTransform: "uppercase" }}>{t("hero_next_game")}</span>
        {g.starts_at && <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--mut)" }}>{fmtDate(g.starts_at)}</span>}
      </div>
      <div style={{ fontWeight: 700, fontSize: 16, margin: "7px 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title || g.place || "Padel"}</div>
      <div style={{ fontSize: 12, color: "var(--mut)" }}>
        {cd}{cd && g.place && g.place !== (g.title || g.place) ? " · " : ""}{g.place && g.place !== (g.title || g.place) ? g.place : ""}
      </div>
      <div style={{ display: "flex", alignItems: "center", marginTop: 11 }}>
        <div style={{ display: "flex", paddingLeft: 10 }}>
          {slots.map((s, i) => (s.profile_id || s.guest_name)
            ? <Avatar key={i} name={s.profile?.name || s.guest_name} url={s.profile?.avatar_url} id={s.profile_id || s.guest_name} size={34} style={{ marginLeft: -10 }} />
            : <span key={i} style={{ width: 34, height: 34, borderRadius: "50%", border: "1.5px dashed var(--line)", background: "var(--surface2)", marginLeft: -10, boxSizing: "border-box", flexShrink: 0 }} />)}
        </div>
        <span style={{ fontSize: 11.5, color: "var(--mut)", marginLeft: 10 }}>{filled}/4</span>
        <button onClick={(e) => { e.stopPropagation(); canTake ? onTake() : onOpen(); }}
          style={{ marginLeft: "auto", flexShrink: 0, border: "none", borderRadius: 11, padding: "9px 14px", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 12.5, cursor: "pointer", background: "var(--lime)", color: "var(--lime-fg)" }}>
          {canTake ? t("hero_take_slot") : t("hero_open")}
        </button>
      </div>
    </div>
  );
}

export function GameRow({ g, color, onOpen, flush, bare, label, me = null, onTake = null, delta = null, showMeBadge = true }) {
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
  const Slot = ({ s, ring }) => {
    const isMe = !!me && has(s) && s.profile_id === me;
    const sz = isMe ? avSize + 12 : avSize;
    return has(s)
      ? <Avatar name={s.profile?.name || s.guest_name} url={s.profile?.avatar_url} id={s.profile_id || s.guest_name} size={sz} ring={ring} style={{ marginLeft: -12, position: "relative", zIndex: isMe ? 2 : 1 }} />
      : <span style={{ width: avSize, height: avSize, borderRadius: "50%", border: "1.5px dashed var(--line)", background: "var(--surface2)", flexShrink: 0, display: "inline-block", marginLeft: -12, boxSizing: "border-box" }} />;
  };
  const nm = (slots) => slots.filter(has).map(s => s.profile?.name || s.guest_name).join(" & ") || "—";
  const namesCss = { fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", fontSize: 11.5, lineHeight: 1.25, textAlign: "center", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" };
  const Team = ({ a, b, ring, names, won }) => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{ display: "flex", paddingLeft: 12 }}><Slot s={a} ring={ring} /><Slot s={b} ring={ring} /></div>
      <div style={{ ...namesCss, color: won ? "var(--lime)" : "var(--mut)", fontWeight: won ? 700 : 500 }}>{names}</div>
    </div>
  );
  return (
    <div className={bare ? "" : "pl-card"} style={{ marginBottom: bare ? 0 : (flush ? 0 : 8), cursor: "pointer", padding: bare ? "10px 2px" : "12px 14px", border: (mine && !bare) ? "1.5px solid color-mix(in srgb, var(--lime) 60%, transparent)" : undefined, background: (mine && !bare) ? "color-mix(in srgb, var(--lime) 8%, transparent)" : undefined }} onClick={onOpen}>
      {/* bare-режим (внутри плашки микс-сессии): без шапки, только составы и счёт. */}
      {!bare && (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Swords size={24} color={color} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title || "Padel"}</span>
            {mine && showMeBadge && <MeBadge />}
          </div>
          {g.starts_at && <div style={{ fontSize: 12, color: "var(--mut)" }}>{fmtDate(g.starts_at)}</div>}
        </div>
        {/* У сыгранной с известной моей дельтой — бейдж ±N вместо галочки */}
        {played && delta != null ? (
          <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 20, flexShrink: 0,
            background: delta > 0 ? "color-mix(in srgb, var(--lime) 15%, transparent)" : delta < 0 ? "color-mix(in srgb, var(--coral) 14%, transparent)" : "rgba(255,255,255,.06)",
            color: delta > 0 ? "var(--lime)" : delta < 0 ? "var(--coral)" : "var(--mut)" }}>
            {delta > 0 ? `+${delta}` : String(delta)}
          </span>
        ) : (
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: g.status === "live" ? "color-mix(in srgb, var(--coral) 15%, transparent)" : "rgba(255,255,255,.06)", color: played ? "var(--mut)" : g.status === "live" ? "var(--coral)" : color, flexShrink: 0 }}>
          {played ? "✓" : g.status === "live"
            ? `● LIVE${g.started_at ? " · " + t("game_live_min").replace("{n}", String(Math.max(0, Math.floor((Date.now() - new Date(g.started_at).getTime()) / 60000)))) : ""}`
            : `${filled}/4`}
        </span>
        )}
        {onTake && (
          <button onClick={(e) => { e.stopPropagation(); onTake(); }}
            style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 999, border: "1px solid color-mix(in srgb, var(--lime) 40%, transparent)", background: "color-mix(in srgb, var(--lime) 14%, transparent)", color: "var(--lime)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
            {t("pub_take_slot")}
          </button>
        )}
      </div>
      )}
      {bare && label && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mut)", letterSpacing: 0.5 }}>{label}</div>}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 10, marginTop: bare ? 6 : 11 }}>
        <Team a={tA[0]} b={tA[1]} ring="var(--lime)" names={nm(tA)} won={aWon} />
        <span style={{ fontFamily: "'Anton',sans-serif", fontSize: played ? 32 : 13, color: "var(--mut)", flexShrink: 0, minWidth: 44, textAlign: "center", paddingTop: 10 }}>
          {played && m ? <><span style={{ color: aWon ? "var(--lime)" : "var(--ink)" }}>{m.sets_a}</span><span style={{ color: "var(--mut)" }}>:</span><span style={{ color: bWon ? "var(--coral)" : "var(--ink)" }}>{m.sets_b}</span></> : "—"}
        </span>
        <Team a={tB[0]} b={tB[1]} ring="var(--coral)" names={nm(tB)} won={bWon} />
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
function MixGroupCard({ games, color, onOpenGame, me = null, delta = null, showMeBadge = true }) {
  const first = games[0];
  const mine = !!me && games.some((g) => meInGame(g, me));
  const when = first.starts_at || first.created_at;
  return (
    <div className="pl-card" style={{ padding: 0, overflow: "hidden", border: mine ? "1.5px solid color-mix(in srgb, var(--lime) 60%, transparent)" : undefined, background: mine ? "color-mix(in srgb, var(--lime) 8%, transparent)" : undefined }}>
      <div onClick={() => onOpenGame(first)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
        <Shuffle size={18} color={color} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{first.title || t("mix_session_title")}</span>
            {mine && showMeBadge && <MeBadge />}
          </div>
          {when && <div style={{ fontSize: 12, color: "var(--mut)" }}>{fmtDate(when)}</div>}
        </div>
        {/* Суммарная дельта фокус-игрока по под-играм сессии */}
        {delta != null && (
          <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 20, flexShrink: 0,
            background: delta > 0 ? "color-mix(in srgb, var(--lime) 15%, transparent)" : delta < 0 ? "color-mix(in srgb, var(--coral) 14%, transparent)" : "rgba(255,255,255,.06)",
            color: delta > 0 ? "var(--lime)" : delta < 0 ? "var(--coral)" : "var(--mut)" }}>
            {delta > 0 ? `+${delta}` : String(delta)}
          </span>
        )}
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

function Games({ groupId, players, profileId, reloadLeaderboard, session, archiveNonce, bumpArchive, onLogin, isAdmin = false, canCreate = false, openReq = null, theme = "dark" }) {
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
    return <CreateGame groupId={groupId} players={players} profileId={profileId} back={() => setMode("list")}
      done={async (g) => { await loadGames(); if (g?.id) { setSelId(g.id); setMode("view"); } else setMode("list"); }} />;

  if (mode === "view") {
    const g = games.find((x) => x.id === selId);
    if (!g) { setMode("list"); return null; }
    return <GameCard game={g} groupId={groupId} profileId={profileId} isAdmin={isAdmin} back={() => setMode("list")} reloadGames={loadGames} reloadLeaderboard={reloadLeaderboard} bumpArchive={bumpArchive} players={players} />;
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
      {!loading && games.length === 0 && <EmptyState variant="run" theme={theme} text={!session ? t("games_empty_guest") : (groupId ? t("games_empty_session") : t("solo_games_empty"))} />}
      {!loading && (() => {
        const upcoming = games.filter(g => g.status === "open" && (g.slots||[]).filter(s=>s.profile_id||s.guest_name).length < 4);
        const active   = games.filter(g => g.status === "open" && (g.slots||[]).filter(s=>s.profile_id||s.guest_name).length === 4);
        const liveNow  = games.filter(g => g.status === "live");
        const played   = games.filter(g => g.status === "played");
        // «Занять» одним тапом из списка/hero: первый свободный слот — себе.
        const takeFirstFree = async (g) => {
          const free = (g.slots || []).find((s) => !s.profile_id && !s.guest_name);
          if (!free || !profileId) return;
          try { await joinSlot(g.id, { team: free.team, position: free.position }, { profileId }); } catch (e) {}
          loadGames();
        };
        const canTakeRow = (g) => !!profileId && g.status === "open" && !meInGame(g, profileId) &&
          (g.slots || []).some((s) => !s.profile_id && !s.guest_name);
        // Hero — ближайшая по времени открытая игра (не старше 6 часов от старта).
        const hero = [...upcoming, ...active]
          .filter((g) => g.starts_at)
          .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
          .find((g) => new Date(g.starts_at).getTime() > Date.now() - 6 * 3600e3) || null;
        const section = (label, color, items, del, take) => items.length === 0 ? null : (
          <div key={label}>
            <div style={{ fontSize: 12, color: "var(--mut)", fontFamily:"'Anton',sans-serif", textTransform:"uppercase", letterSpacing:1, margin:"12px 2px 6px" }}>{label}</div>
            {items.map(g => {
              const row = <GameRow key={g.id} g={g} color={color} me={profileId} flush={!!del} onOpen={() => { setSelId(g.id); setMode("view"); }}
                onTake={take && canTakeRow(g) ? () => takeFirstFree(g) : null} />;
              return del
                ? <SwipeToDelete key={g.id} onDelete={async () => { if (!(await confirmDialog({ title: t("delete_game_confirm"), message: t("delete_game_msg"), confirmLabel: t("delete_btn") }))) return; await deleteGame(g.id).catch(() => {}); loadGames(); bumpArchive?.(); }}>{row}</SwipeToDelete>
                : row;
            })}
          </div>
        );
        return [
          (games.length > 0 && upcoming.length === 0 && active.length === 0 && liveNow.length === 0) ? <EmptyState key="na" variant="run" theme={theme} text={t("games_no_active")} /> : null,
          hero && <GameHero key="hero" g={hero} me={profileId} onOpen={() => { setSelId(hero.id); setMode("view"); }} onTake={() => takeFirstFree(hero)} />,
          section(t("live_section"), "var(--coral)", liveNow, false, false),
          section(t("upcoming_section"), "var(--mut)", upcoming.filter((g) => g !== hero), canCreate, true),
          section(t("active_section"), "var(--lime)", active.filter((g) => g !== hero), canCreate, false),
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
    try { const g = await createGame(groupId, { title: title.trim() || null, startsAt: startsAtIso, place, slots, hostId: profileId || null }); notifyGameCreated(g?.id); creatingRef.current = false; done(g); }
    catch (e) { showToast(t("err_create_game")); setBusy(false); creatingRef.current = false; }
  };

  const stepBadge = (txt) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--lime)", marginBottom: 10 }}>{txt}</div>
  );

  // ── Единственный шаг: когда / где / название. Состав добирается на экране
  //    игры (карусель лиги / гость / «Занять» / ссылка) — один инструмент.
  {
    return (
      <div className="pl-pop">
        <BackButton onClick={back} style={{ marginBottom: 12 }} />
        <div className="pl-card" style={{ padding: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          <DateTimePicker day={day} time={time} onDay={setDay} onTime={setTime} />
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
        <button className="pl-btn" style={{ width: "100%", padding: 14, fontSize: 16 }} disabled={!day || busy} onClick={create}>{busy ? t("creating_game") : t("create_and_get_link")}</button>
      </div>
    );
  }
}
// Панель «Кто играет?»: раскрывается прямо под слотом (без шторки) — корт и
// остальные слоты остаются на экране. «Я сам» — первый чип карусели; поиск
// находит игрока лиги или добавляет гостя по имени.
function PickPlayerPanel({ slotLabel, players = [], takenIds = [], meId = null, onPick, onClose }) {
  const [q, setQ] = useState("");
  const free = (players || []).filter((p) => !takenIds.includes(p.id) && p.id !== meId);
  const me = (!!meId && !takenIds.includes(meId)) ? (players || []).find((p) => p.id === meId) : null;
  const matches = q.trim()
    ? free.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : [];
  return (
    <div className="pl-pop" style={{ border: "1px solid color-mix(in srgb, var(--lime) 35%, var(--line))", borderRadius: 12, background: "var(--surface2)", padding: "10px 10px 11px", boxShadow: "0 8px 24px -14px rgba(0,0,0,.6)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--ink)" }}>{t("pick_title")}{slotLabel ? <span style={{ color: "var(--mut)", fontWeight: 600 }}> · {slotLabel}</span> : null}</div>
        <button onClick={onClose} aria-label="✕" style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--mut)", cursor: "pointer", padding: "2px 4px", display: "flex" }}><X size={14} /></button>
      </div>
      {/* Карусель: «Я сам» первым (если ещё не в игре), дальше свободные игроки лиги */}
      {!q.trim() && (me || free.length > 0) && (
        <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", WebkitOverflowScrolling: "touch", WebkitMaskImage: "linear-gradient(90deg,#000 94%,transparent)", maskImage: "linear-gradient(90deg,#000 94%,transparent)" }}>
          {me && (
            <button className="pl-ghost" onClick={() => onPick({ profileId: me.id, name: me.name })}
              style={{ flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 7, padding: "5px 12px 5px 5px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, borderColor: "color-mix(in srgb, var(--lime) 45%, transparent)", color: "var(--lime)" }}>
              <img src={playerAvatar(me.avatar_url, me.id)} onError={avatarFallback(me.id)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(me.id), width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} /> {t("pick_me")}
            </button>
          )}
          {free.slice(0, 24).map((p) => (
            <button key={p.id} className="pl-ghost" onClick={() => onPick({ profileId: p.id, name: p.name })}
              style={{ flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 7, padding: "5px 12px 5px 5px", borderRadius: 999, fontSize: 12.5 }}>
              <img src={playerAvatar(p.avatar_url, p.id)} onError={avatarFallback(p.id)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(p.id), width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} /> {p.name}
            </button>
          ))}
        </div>
      )}
      <input className="pl-input" style={{ padding: "10px 12px", marginTop: 8 }} placeholder={t("pick_ph")} value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim() && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {matches.map((p) => (
            <button key={p.id} className="pl-ghost" style={{ padding: "9px 10px", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }} onClick={() => onPick({ profileId: p.id, name: p.name })}>
              <img src={playerAvatar(p.avatar_url, p.id)} onError={avatarFallback(p.id)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(p.id), width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} /> {p.name}
            </button>
          ))}
          <button className="pl-btn" style={{ padding: "9px 10px", textAlign: "left" }} onClick={() => onPick({ guestName: q.trim() })}>{t("add_guest_prefix")}{q.trim()}</button>
          <div style={{ fontSize: 11, color: "var(--mut)", lineHeight: 1.4, padding: "2px 2px" }}>{t("add_guest_league_hint")}</div>
        </div>
      )}
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
      {drag && createPortal(
        // Портал в body: иначе position:fixed считается от трансформированного
        // предка (анимация карточки) и призрак улетает в угол.
        <div style={{ position: "fixed", left: drag.x, top: drag.y, transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 300, padding: "8px 10px", borderRadius: 12, background: "var(--surface)", border: "1.5px solid var(--lime)", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
          <Avatar url={arr[drag.idx].avatar_url} id={arr[drag.idx].profile_id || arr[drag.idx].guest_name} name={arr[drag.idx].name} size={28} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{arr[drag.idx].name}</span>
        </div>,
        document.body
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
    if (!(await confirmDialog({ title: t("delete_game_confirm"), message: t("delete_game_msg"), confirmLabel: t("delete_btn") }))) return;
    await deleteGame(game.id).catch(() => {});
    bumpArchive && bumpArchive();
    await reloadSession();
  };
  return (
    <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="pl-display" style={{ fontSize: 15, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{total > 1 ? `${t("mix_game_label")} ${index + 1}` : (game.title || "Padel")}</span>
        {game.starts_at && <span style={{ fontSize: 12, color: "var(--mut)", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}><Calendar size={12} />{fmtDate(game.starts_at)}</span>}
        <button className="pl-ghost" style={{ marginLeft: "auto", padding: "5px 8px", color: "var(--coral)", border: "1px solid rgba(255,106,82,.3)", flexShrink: 0 }} onClick={del} title={t("delete_btn")}><Trash2 size={13} /></button>
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

function GameCard({ game, groupId, profileId = null, isAdmin = false, back, reloadGames, reloadLeaderboard, bumpArchive, players = [] }) {
  const [mix, setMix] = useState(false);
  const [prof, setProf] = useState(null);  // карточка игрока из состава (только просмотр)
  const onOpenPlayer = (id) => { const f = players.find((p) => p.id === id); if (f) setProf(f); };
  useEffect(() => { if (prof) return registerBack(() => setProf(null)); }, [prof]);   // «назад» → закрыть карточку игрока
  useEffect(() => { if (back) return registerBack(back); }, [back]);                   // «назад» → к списку игр
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
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinErr, setJoinErr] = useState("");
  const meInGameHere = !!profileId && slots.some((s) => s.profile_id === profileId);
  // Красный крестик: хост убирает любого из состава, игрок — себя.
  // Только до старта: после «Начать игру» состав зафиксирован (слоты не
  // доукомплектовать, а счёт требует всех четверых).
  const canClear = (s) => game.status === "open" && !!profileId &&
    (game.host_id === profileId || (s.profile_id && s.profile_id === profileId));
  const clearSlot = async (s) => {
    if (joinBusy) return;
    setJoinBusy(true); setJoinErr("");
    try { await clearGameSlot(s.id); await reloadGames(); }
    catch (e) { setJoinErr(t("err_generic")); }
    finally { setJoinBusy(false); }
  };
  // «Добавить» (друг из лиги, гость или «Я сам») — любой участник лиги,
  // как в лобби турнира. Панель выбора раскрывается прямо под слотом.
  const canAddOthers = game.status === "open" && !!profileId;
  const [pickSlot, setPickSlot] = useState(null); // слот, под которым раскрыта панель
  const addToSlot = async (entry) => {
    const s = pickSlot;
    setPickSlot(null);
    if (!s || joinBusy) return;
    setJoinBusy(true); setJoinErr("");
    try {
      await joinSlot(game.id, { team: s.team, position: s.position }, entry.profileId ? { profileId: entry.profileId } : { name: entry.guestName });
      await reloadGames();
    } catch (e) { setJoinErr(t("err_slot_taken")); }
    finally { setJoinBusy(false); }
  };
  // «Начать игру» — любой из состава, хост игры или организатор лиги (иначе
  // игра, где организатора нет в составе, зависала бы: счёт заперт до старта).
  // Кнопка видна всегда (open), активна только с полным кортом.
  const [startBusy, setStartBusy] = useState(false);
  const mayStart = game.status === "open" && !!profileId && (meInGameHere || game.host_id === profileId || isAdmin);
  const canStart = mayStart && filled === 4;
  const doStart = async () => {
    if (startBusy) return;
    setStartBusy(true);
    try { await startGame(game.id); await reloadGames(); } catch (e) { /* гонка — просто перечитаем */ await reloadGames(); }
    finally { setStartBusy(false); }
  };
  // LIVE: минуты с старта, тикают раз в минуту.
  const [, setLiveTick] = useState(0);
  useEffect(() => {
    if (game.status !== "live") return;
    const id = setInterval(() => setLiveTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, [game.status]);
  const liveMin = game.started_at ? Math.max(0, Math.floor((Date.now() - new Date(game.started_at).getTime()) / 60000)) : 0;
  const slotsA = slots.filter((s) => s.team === "A");
  const slotsB = slots.filter((s) => s.team === "B");
  // #3: кто создал игру (host_id) — резолвим по составу лиги.
  const creatorName = game.host_id ? ((players || []).find((p) => p.id === game.host_id)?.name || null) : null;

  const share = async () => {
    const url = linkFor(game.invite_code);
    const text = `${t("game_share_text")}${game.title ? ` «${game.title}»` : ""}! ${t("game_share_join")}: ${url} (${t("code_label")} ${game.invite_code})`;
    try { if (navigator.share) { await navigator.share({ title: "PadelPack", text, url }); return; } } catch (e) {}
    try { await navigator.clipboard.writeText(text); setToast(t("copied")); setTimeout(() => setToast(""), 1600); } catch (e) { setToast(t("copy_manual")); }
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
    } catch (e) { showToast(t("err_create_game")); setMixBusy(false); mixRef.current = false; }
  };

  // Карточка-картинка результата: canvas → PNG → системный шеринг.
  const [cardBusy, setCardBusy] = useState(false);
  const slotTeams = (g) => {
    const gslots = [...(g.slots || [])].sort((a, b) => (a.team + a.position).localeCompare(b.team + b.position));
    const team = (tm) => gslots.filter((s) => s.team === tm)
      .map((s) => ({ name: s.profile?.name || s.guest_name || "?", avatar_url: s.profile?.avatar_url, id: s.profile_id || s.guest_name }));
    return { teamA: team("A"), teamB: team("B") };
  };
  // Карточка всей микс-сессии: хроника игр (пары, счёт, победители цветом).
  const shareMixCard = async (list) => {
    if (cardBusy) return;
    setCardBusy(true);
    try {
      const playedList = list.filter((g) => g.status === "played" && (g.matches || [])[0]);
      if (!playedList.length) return;
      const gamesData = playedList.map((g) => {
        const m = g.matches[0];
        return { ...slotTeams(g), setsA: m.sets_a, setsB: m.sets_b, scoreDetail: m.score_detail };
      });
      const lastM = playedList[playedList.length - 1].matches[0];
      const dateStr = (() => { try { return new Date(lastM.played_at || playedList[0].starts_at || Date.now()).toLocaleDateString(dateLocale(), { day: "numeric", month: "long" }); } catch (e) { return ""; } })();
      const { renderMixCard, shareCanvas } = await import("./lib/shareCard");
      const canvas = await renderMixCard({ dateStr, games: gamesData });
      await shareCanvas(canvas, "padelpack-mix.png");
    } catch (e) { /* шеринг отменён/не поддержан — молча */ }
    finally { setCardBusy(false); }
  };
  const shareResultCard = async (g) => {
    const m = (g.matches || [])[0];
    if (!m || cardBusy) return;
    setCardBusy(true);
    try {
      const { teamA, teamB } = slotTeams(g);
      const dateStr = (() => { try { return new Date(m.played_at || g.starts_at || g.created_at).toLocaleDateString(dateLocale(), { day: "numeric", month: "long" }); } catch (e) { return ""; } })();
      const { renderGameCard, shareCanvas } = await import("./lib/shareCard");
      const canvas = await renderGameCard({
        title: g.title || g.place || "", dateStr,
        teamA, teamB,
        setsA: m.sets_a, setsB: m.sets_b, scoreDetail: m.score_detail,
      });
      await shareCanvas(canvas, "padelpack-result.png");
    } catch (e) { /* шеринг отменён/не поддержан — молча */ }
    finally { setCardBusy(false); }
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
        {last.status === "played" && lastFilled === 4 && (last.matches || [])[0] && (
          <button className="pl-btn" disabled={cardBusy} onClick={() => list.length > 1 ? shareMixCard(list) : shareResultCard(last)}
            style={{ width: "100%", padding: 13, fontSize: 14.5, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            📸 {cardBusy ? t("sc_making") : list.length > 1 ? t("sc_share_mix") : t("sc_share_game")}
          </button>
        )}
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
        <button className="pl-ghost" style={{ padding: "6px 10px", color: "var(--coral)", border: "1px solid rgba(255,106,82,.3)", marginLeft: "auto" }} onClick={async () => { if (!(await confirmDialog({ title: t("delete_game_confirm"), message: t("delete_game_msg"), confirmLabel: t("delete_btn") }))) return; await deleteGame(game.id); bumpArchive && bumpArchive(); reloadGames && reloadGames(); back && back(); }} title={t("delete_btn")}><Trash2 size={14} /></button>
      </div>
      <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {game.status === "live" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: "color-mix(in srgb, var(--coral) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--coral) 40%, transparent)", color: "var(--coral)", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--coral)" }} /> LIVE
              </span>
            )}
            <div className="pl-display" style={{ fontSize: 18, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.title || "PadelPack"}</div>
          </div>
          {game.status === "live" && game.started_at && (
            <div style={{ fontSize: 12, color: "var(--coral)", fontWeight: 700, marginTop: 2 }}>{t("game_live_min").replace("{n}", String(liveMin))}</div>
          )}
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
        <button className="pl-btn" style={{ padding: "8px 12px", display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }} onClick={share}><Share2 size={15} /> {toast || t("share_btn")}</button>
      </div>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {slots.map((s, i) => {
          const free = !nameOf(s);
          const picking = pickSlot && (pickSlot.id ? pickSlot.id === s.id : pickSlot === s);
          return (
            <React.Fragment key={s.id || i}>
              <div className="pl-slot" style={picking ? { borderColor: "color-mix(in srgb, var(--lime) 45%, transparent)" } : undefined}>
                <span className="pl-display" style={{ fontSize: 11, color: s.team === "A" ? "var(--lime)" : "var(--coral)", width: 30 }}>{s.team}</span>
                <span style={{ flex: 1, color: free ? "var(--mut)" : "var(--ink)" }}>{free ? t("slot_free") : nameOf(s)}</span>
                {/* Убрать из состава: хост — любого, игрок — себя */}
                {!free && canClear(s) && (
                  <button onClick={() => clearSlot(s)} disabled={joinBusy} aria-label={t("delete_btn")} title={t("delete_btn")}
                    style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: "none", background: "color-mix(in srgb, var(--coral) 16%, transparent)", color: "var(--coral)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: joinBusy ? .6 : 1 }}>
                    <X size={14} />
                  </button>
                )}
                {/* Свободный слот: одна кнопка «Добавить» — панель с «Я сам», лигой и гостем */}
                {free && canAddOthers && !picking && (
                  <button onClick={() => setPickSlot(s)} disabled={joinBusy}
                    style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 999, border: "1px solid color-mix(in srgb, var(--lime) 40%, transparent)", background: "color-mix(in srgb, var(--lime) 14%, transparent)", color: "var(--lime)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif", opacity: joinBusy ? .6 : 1 }}>
                    <UserPlus size={12} /> {t("slot_add")}
                  </button>
                )}
              </div>
              {/* Панель добора — прямо под своим слотом, открыта максимум одна */}
              {picking && (
                <PickPlayerPanel slotLabel={`${s.team}${s.position}`} players={players}
                  takenIds={slots.map((x) => x.profile_id).filter(Boolean)} meId={profileId}
                  onPick={addToSlot} onClose={() => setPickSlot(null)} />
              )}
            </React.Fragment>
          );
        })}
        {joinErr && <div style={{ fontSize: 12, color: "var(--coral)", textAlign: "center" }}>{joinErr}</div>}
      </div>

      {/* Фиксация момента старта: кнопка видна всегда, активируется при 4/4 */}
      {mayStart && (
        <div style={{ marginTop: 12, padding: "14px 14px 12px", background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 14, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "var(--mut)" }}>{t("slots_label")} {filled}/4 · {canStart ? t("game_all_here") : t("game_start_wait")}</div>
          <button onClick={doStart} disabled={startBusy || !canStart}
            style={{ marginTop: 9, display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 13, border: "none", background: "var(--lime)", color: "var(--lime-fg)", fontSize: 15, fontWeight: 800, cursor: canStart ? "pointer" : "not-allowed", fontFamily: "'Outfit',sans-serif", opacity: startBusy ? .6 : 1, filter: canStart ? "none" : "grayscale(.6) brightness(.7)" }}>
            ▶ {t("game_start")}
          </button>
          <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 7, opacity: .8 }}>{t("game_start_hint")}</div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {filled === 4 ? (
          /* Счёт открывается только после «Начать игру»: до старта табло серое,
             сеты не тыкаются — иначе результат записывали в несыгранную игру. */
          <CourtView courtNumber={1} mode="sets" editable={game.status === "live"} courtName={game.court_name} onRenameCourt={groupId ? (name) => updateGameCourtName(game.id, name).then(reloadGames).catch(() => {}) : undefined}
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
    // До порога захвата не двигаем: дёрганый transform при тапе глотает click на iOS.
    if (captured.current) setDx(Math.max(-MAX, Math.min(hi, dX)));
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
    <div style={{ position: "relative", marginBottom: 8, borderRadius: 18, overflow: "hidden", background: dx > 0 ? "var(--lime)" : dx < 0 ? "var(--coral)" : "transparent" }}>
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
  useEffect(() => registerBack(onClose), [onClose]);
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
    catch (e) { showToast(t("err_create_game")); setBusy(false); }
  };
  const lab = { fontSize: 10.5, fontWeight: 800, color: "var(--mut)", textTransform: "uppercase", letterSpacing: .7, margin: "16px 2px 7px" };
  const roster = [["A", 1], ["A", 2], ["B", 1], ["B", 2]]
    .map(([tm, pos]) => (src.slots || []).find((x) => x.team === tm && x.position === pos))
    .filter((sl) => sl && (sl.profile_id || sl.guest_name));
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", overflowY: "auto" }} onClick={onClose}>
      <div className="pl-card" style={{ width: "100%", maxWidth: 344, padding: "20px 18px 18px", margin: "20px 0" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 38, height: 38, borderRadius: 13, background: "color-mix(in srgb, var(--lime) 15%, transparent)", color: "var(--lime)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid color-mix(in srgb, var(--lime) 30%, transparent)" }}><Copy size={18} /></span>
          <div><div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)" }}>{t("copy_game_title")}</div><div style={{ fontSize: 11.5, color: "var(--mut)" }}>{t("copy_game_sub")}</div></div>
        </div>
        {roster.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 15, padding: "9px 12px", background: "var(--surface2)", borderRadius: 14 }}>
            <div style={{ display: "flex" }}>
              {roster.map((sl, i) => (
                <span key={i} style={{ width: 28, height: 28, borderRadius: "50%", marginLeft: i ? -8 : 0, border: "2px solid var(--surface)", overflow: "hidden", flexShrink: 0, background: "#243b2e" }}>
                  <img src={playerAvatar(sl.profile?.avatar_url, sl.profile_id || sl.guest_name)} onError={avatarFallback(sl.profile_id || sl.guest_name)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(sl.profile_id || sl.guest_name), width: "100%", height: "100%", objectFit: "cover" }} />
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--mut)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{roster.map((sl) => (sl.profile?.name || sl.guest_name || "").split(" ")[0]).join(", ")}</div>
          </div>
        )}
        <div style={lab}>{t("trn_copy_name_label")}</div>
        <input className="pl-input" style={{ padding: "13px 14px", fontWeight: 600 }} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <DateTimePicker day={day} time={time} onDay={setDay} onTime={setTime} />
        <div style={lab}>{t("court_club_placeholder")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 13, padding: "0 14px" }}>
          <MapPin size={15} style={{ color: "var(--lime)", flexShrink: 0 }} />
          <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder={t("court_club_placeholder")} style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--ink)", fontFamily: "'Outfit',sans-serif", fontSize: 15, fontWeight: 600, padding: "13px 0" }} />
        </div>
        <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
          <button className="pl-ghost" style={{ flex: "0 0 34%", padding: 13 }} onClick={onClose} disabled={busy}>{t("cancel")}</button>
          <button className="pl-btn" style={{ flex: 1, padding: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }} onClick={go} disabled={busy}><Copy size={15} /> {busy ? t("creating") : t("trn_copy_btn")}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function HistoryView({ groupId, players, profileId, isGroupMember, isAdmin = false, archiveNonce, bumpArchive, onOpenPlayer }) {
  const [games, setGames] = useState(null);  // сыгранные игры
  const [tours, setTours] = useState([]);     // завершённые турниры
  const [copyTour, setCopyTour] = useState(null);
  const [copyGame, setCopyGame] = useState(null);
  const [sel, setSel] = useState(null);       // { type: 'tour' | 'game', data }
  const [swipeHint, setSwipeHint] = useState(() => { try { return !localStorage.getItem("pp_swipe_hint"); } catch (e) { return true; } });
  const dismissHint = () => { try { localStorage.setItem("pp_swipe_hint", "1"); } catch (e) {} setSwipeHint(false); };
  const [filter, setFilter] = useState("all"); // all | games | tours
  const [monthOff, setMonthOff] = useState(0);     // 0 = текущий месяц, -1 = прошлый…
  const [pFilter, setPFilter] = useState(null);    // «чья история»: id игрока из карусели (я — первый)
  const [deltaRows, setDeltaRows] = useState([]);  // rating_changes фокус-игрока (бейджи ±N и Δ месяца)
  const focusId = pFilter || profileId;            // чьи дельты и В–П показываем

  const load = useCallback(async () => {
    try { const g = groupId ? await listGames(groupId) : await listMyGames(); setGames((g || []).filter((x) => x.status === "played")); }
    catch (e) { setGames([]); }
    try { const all = groupId ? await listTournaments(groupId) : await listMyTournaments(); setTours((all || []).filter((tr) => tr.status === "finished")); }
    catch (e) { setTours([]); }
  }, [groupId]);
  useEffect(() => { if (!sel) load(); }, [load, sel, archiveNonce]);
  // Дельты — отдельно: перезагружаются при смене фокус-игрока из карусели.
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const rows = groupId && focusId ? await getMyDeltas(groupId, focusId) : []; if (alive) setDeltaRows(rows); }
      catch (e) { if (alive) setDeltaRows([]); }
    })();
    return () => { alive = false; };
  }, [groupId, focusId, archiveNonce]);

  // Проваливание в результаты — те же экраны, что на вкладках Игры/Турниры (там и удаление).
  if (sel?.type === "tour") return <TournamentView id={sel.data.id} players={players} back={() => setSel(null)} isGroupMember={isGroupMember} currentProfileId={profileId} onArchiveChange={bumpArchive} onOpenPlayer={onOpenPlayer} />;
  if (sel?.type === "game") return <GameCard game={sel.data} groupId={groupId} profileId={profileId} isAdmin={isAdmin} back={() => setSel(null)} reloadGames={load} reloadLeaderboard={() => {}} bumpArchive={bumpArchive} players={players} />;

  const gameDate = (g) => new Date(g.matches?.[0]?.played_at || g.starts_at || g.created_at || 0);
  const tourDate = (tr) => new Date(tr.starts_at || tr.created_at || 0);
  // Окно выбранного месяца (‹ › в сводке фильтрует и цифры, и ленту).
  const nowD = new Date();
  const mStart = new Date(nowD.getFullYear(), nowD.getMonth() + monthOff, 1);
  const mEnd = new Date(nowD.getFullYear(), nowD.getMonth() + monthOff + 1, 1);
  const inMonth = (d) => d >= mStart && d < mEnd;
  const monthLabel = mStart.toLocaleDateString(dateLocale(), { month: "long", ...(mStart.getFullYear() !== nowD.getFullYear() ? { year: "numeric" } : {}) });

  const pInTour = (tr) => !pFilter || (tr.players || []).some((pl) => pl.profile_id === pFilter);
  const pInGame = (g) => !pFilter || (g.slots || []).some((s) => s.profile_id === pFilter);
  // Подсветка участия: «не мои» события в ленте приглушаются.
  const mineTour = (tr) => !profileId || (tr.players || []).some((pl) => pl.profile_id === profileId);
  const mGames = games === null ? [] : games.filter((g) => inMonth(gameDate(g)));
  const mTours = tours.filter((tr) => inMonth(tourDate(tr)));
  const vTours = mTours.filter(pInTour);
  const vGames = mGames.filter(pInGame);

  // Дельты фокус-игрока: у обычных матчей ключ match_id, у турнирных — tournament_match_id.
  // Бейджи ±N на карточках — только когда игрок явно выбран в карусели
  // (без выбора непонятно, «чья» дельта); сводка месяца по умолчанию — моя.
  const deltaMap = new Map((deltaRows || []).map((r) => [r.match_id || r.tournament_match_id, r.delta]));
  const gDelta = (g) => { if (!pFilter) return null; const id = g.matches?.[0]?.id; return id != null && deltaMap.has(id) ? deltaMap.get(id) : null; };
  const trDelta = (tr) => {
    if (!pFilter) return null;
    let sum = 0, found = false;
    (tr.matches || []).forEach((m) => { if (deltaMap.has(m.id)) { sum += deltaMap.get(m.id); found = true; } });
    return found ? sum : null;
  };

  // Сводка месяца: игры/турниры лиги + В–П и Δ рейтинга фокус-игрока.
  const myWL = (() => {
    let w = 0, l = 0;
    mGames.forEach((g) => {
      if (!focusId) return;
      const m = g.matches?.[0]; if (!m || m.sets_a === m.sets_b) return;
      const fTeam = (g.slots || []).find((s) => s.profile_id === focusId)?.team;
      if (!fTeam) return;
      const won = fTeam === "A" ? m.sets_a > m.sets_b : m.sets_b > m.sets_a;
      won ? w++ : l++;
    });
    return { w, l };
  })();
  // Δ месяца — только по событиям, видимым в Истории: обычные матчи и матчи
  // ЗАВЕРШЁННЫХ турниров. Раунды активного турнира уже двигают рейтинг, но его
  // плитки в ленте ещё нет — без этого фильтра сводка «не бьётся» с карточками.
  const finishedTrMatchIds = new Set(tours.flatMap((tr) => (tr.matches || []).map((m) => m.id)));
  const myMonthDelta = (deltaRows || []).reduce((s, r) => {
    if (!inMonth(new Date(r.created_at))) return s;
    if (r.tournament_match_id && !finishedTrMatchIds.has(r.tournament_match_id)) return s;
    return s + (r.delta || 0);
  }, 0);

  if (games === null) return <div className="pl-pop"><CardSkeleton count={4} /></div>;
  if (games.length === 0 && tours.length === 0) return <EmptyState className="pl-card pl-pop" variant="clock" text={t("history_empty")} />;

  // Лента: игры (с группировкой миксов) и турниры вперемешку, по датам.
  const events = [];
  if (filter !== "games") vTours.forEach((tour) => events.push({ key: "t" + tour.id, date: tourDate(tour), kind: "tour", tour }));
  if (filter !== "tours") {
    const byKey = new Map();
    vGames.forEach((g) => { const k = g.mix_group_id || g.id; const a = byKey.get(k) || []; a.push(g); byKey.set(k, a); });
    [...byKey.entries()].forEach(([k, grp]) => {
      if (grp.length >= 2) {
        const ordered = [...grp].sort((a, b) => new Date(a.created_at || a.starts_at || 0) - new Date(b.created_at || b.starts_at || 0));
        events.push({ key: "mix-" + k, date: gameDate(ordered[ordered.length - 1]), kind: "mix", games: ordered });
      } else {
        events.push({ key: grp[0].id, date: gameDate(grp[0]), kind: "game", game: grp[0] });
      }
    });
  }
  events.sort((a, b) => b.date - a.date);

  const dayLabel = (d) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    const diff = Math.round((today - day) / 86400000);
    if (diff === 0) return t("hist_today");
    if (diff === 1) return t("hist_yesterday");
    return day.toLocaleDateString(dateLocale(), { day: "numeric", month: "long" });
  };

  const renderEvent = (ev) => {
    if (ev.kind === "tour") {
      const tour = ev.tour;
      const mine = !profileId || mineTour(tour);
      const card = <TournamentCard trn={tour} color="var(--yellow)" me={profileId} placeFor={focusId} showMeBadge={!pFilter || pFilter === profileId} myDelta={trDelta(tour)} flush={isGroupMember} onClick={() => setSel({ type: "tour", data: tour })} />;
      const inner = isGroupMember
        ? <SwipeToDelete onCopy={groupId ? () => setCopyTour(tour) : null} onDelete={async () => { if (!(await confirmDialog({ title: t("trn_delete_confirm"), message: t("trn_delete_msg"), confirmLabel: t("delete_btn") }))) return; await deleteTournament(tour.id).catch(() => {}); bumpArchive?.(); load(); }}>{card}</SwipeToDelete>
        : card;
      return <div key={ev.key} style={mine || pFilter ? undefined : { opacity: 0.55 }}>{inner}</div>;
    }
    if (ev.kind === "mix") {
      const ordered = ev.games;
      const mine = !profileId || ordered.some((gg) => meInGame(gg, profileId));
      const mixDelta = (() => {
        let sum = 0, found = false;
        ordered.forEach((gg) => { const d0 = gDelta(gg); if (d0 != null) { sum += d0; found = true; } });
        return found ? sum : null;
      })();
      const card = <MixGroupCard games={ordered} color="var(--mut)" me={profileId} showMeBadge={!pFilter || pFilter === profileId} delta={mixDelta} onOpenGame={(g) => setSel({ type: "game", data: g })} />;
      const inner = isGroupMember
        ? <SwipeToDelete onDelete={async () => { if (!(await confirmDialog({ title: t("mix_delete_confirm").replace("{n}", ordered.length), message: t("mix_delete_msg"), confirmLabel: t("delete_btn") }))) return; for (const gg of ordered) await deleteGame(gg.id).catch(() => {}); bumpArchive?.(); load(); }}>{card}</SwipeToDelete>
        : card;
      return <div key={ev.key} style={mine || pFilter ? undefined : { opacity: 0.55 }}>{inner}</div>;
    }
    const g = ev.game;
    const mine = !profileId || meInGame(g, profileId);
    const card = <GameRow g={g} color="var(--mut)" me={profileId} showMeBadge={!pFilter || pFilter === profileId} delta={gDelta(g)} flush={isGroupMember} onOpen={() => setSel({ type: "game", data: g })} />;
    const inner = isGroupMember
      ? <SwipeToDelete onCopy={groupId ? () => setCopyGame(g) : null} onDelete={async () => { if (!(await confirmDialog({ title: t("delete_game_confirm"), message: t("delete_game_msg"), confirmLabel: t("delete_btn") }))) return; await deleteGame(g.id).catch(() => {}); bumpArchive?.(); load(); }}>{card}</SwipeToDelete>
      : card;
    return <div key={ev.key} style={mine || pFilter ? undefined : { opacity: 0.55 }}>{inner}</div>;
  };

  const meRow = profileId ? (players || []).find((p) => p.id === profileId) : null;
  const rosterOthers = (players || []).filter((p) => p.id !== profileId);

  return (
    <div className="pl-pop">
      <style>{trCss}</style>
      {/* Фильтр видов: Все / Игры / Турниры. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, display: "flex", gap: 4, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: 3 }}>
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
      </div>

      {/* Сводка месяца с листалкой ‹ › — заодно фильтр периода для ленты. */}
      <div className="pl-card" style={{ display: "flex", alignItems: "center", padding: "11px 8px", marginBottom: 10 }}>
        <button onClick={() => setMonthOff((v) => v - 1)} aria-label="‹"
          style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--mut)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>‹</button>
        <div style={{ flex: 1, display: "flex", textAlign: "center" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 19 }}>{mGames.length}</div>
            <div style={{ fontSize: 10, color: "var(--mut)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("hist_games_lbl")} · {monthLabel}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0, borderLeft: "1px solid var(--line)" }}>
            <div style={{ fontWeight: 800, fontSize: 19 }}>{mTours.length}</div>
            <div style={{ fontSize: 10, color: "var(--mut)" }}>{t("hist_tours_lbl")}</div>
          </div>
          {profileId && (
            <div style={{ flex: 1, minWidth: 0, borderLeft: "1px solid var(--line)" }}>
              <div style={{ fontWeight: 800, fontSize: 19, color: myWL.w >= myWL.l ? "var(--lime)" : "var(--coral)" }}>{myWL.w}–{myWL.l}</div>
              <div style={{ fontSize: 10, color: "var(--mut)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{focusId === profileId ? t("hist_wl_lbl") : t("hist_wl_of").replace("{name}", ((players || []).find((p) => p.id === focusId)?.name || "").split(" ")[0])}</div>
            </div>
          )}
          {profileId && (
            <div style={{ flex: 1, minWidth: 0, borderLeft: "1px solid var(--line)" }}>
              <div style={{ fontWeight: 800, fontSize: 19, color: myMonthDelta > 0 ? "var(--lime)" : myMonthDelta < 0 ? "var(--coral)" : "var(--ink)" }}>{myMonthDelta > 0 ? `+${myMonthDelta}` : myMonthDelta}</div>
              <div style={{ fontSize: 10, color: "var(--mut)" }}>{t("hist_rating_lbl")}</div>
            </div>
          )}
        </div>
        <button onClick={() => setMonthOff((v) => Math.min(0, v + 1))} disabled={monthOff === 0} aria-label="›"
          style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--mut)", cursor: monthOff === 0 ? "default" : "pointer", fontSize: 13, lineHeight: 1, opacity: monthOff === 0 ? .35 : 1 }}>›</button>
      </div>

      {/* «Чья история»: я — первым, тап по игроку — его матчи, его В–П и дельты. */}
      {(players || []).length > 1 && (
        <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "2px 0 6px", marginBottom: 6, scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {[...(meRow ? [meRow] : []), ...rosterOthers].slice(0, 17).map((p) => {
            const isMe = p.id === profileId;
            const on = pFilter === p.id;
            return (
              <button key={p.id} onClick={() => setPFilter((v) => v === p.id ? null : p.id)} title={p.name} aria-pressed={on}
                style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", padding: 0, cursor: "pointer", background: "var(--surface2)", position: "relative",
                  border: on ? `2px solid ${isMe ? "var(--lime)" : "var(--coral)"}` : "2px solid var(--line)", opacity: pFilter && !on ? .5 : 1 }}>
                <img src={playerAvatar(p.avatar_url, p.id)} onError={avatarFallback(p.id)} onLoad={avatarOnLoad} alt="" style={{ ...avatarBg(p.id), width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                {on && (
                  <span style={{ position: "absolute", right: -3, bottom: -3, width: 14, height: 14, borderRadius: "50%", background: isMe ? "var(--lime)" : "var(--coral)", color: "var(--lime-fg)", fontSize: 8.5, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {isGroupMember && swipeHint && (games.length > 0 || tours.length > 0) && (
        <div onClick={dismissHint} style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 12px", padding: "9px 12px", borderRadius: 12, background: "color-mix(in srgb, var(--coral) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--coral) 30%, transparent)", fontSize: 12.5, color: "var(--mut)", cursor: "pointer" }}>
          <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1, flexShrink: 0 }}><span style={{ color: "var(--coral)" }}>←</span><span style={{ color: "var(--lime)" }}>→</span></span> {t("swipe_hint")} <X size={14} style={{ marginLeft: "auto", color: "var(--mut)", flexShrink: 0 }} />
        </div>
      )}

      {events.length === 0 && <EmptyState text={pFilter ? t("history_no_mine") : t("hist_month_empty")} />}
      {(() => {
        const out = [];
        let lastDay = null;
        events.forEach((ev) => {
          const dk = new Date(ev.date); dk.setHours(0, 0, 0, 0);
          const key = dk.getTime();
          if (key !== lastDay) {
            lastDay = key;
            out.push(<div key={"d" + key} style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "var(--mut)", textTransform: "uppercase", margin: "14px 2px 8px", paddingLeft: 4 }}>{dayLabel(ev.date)}</div>);
          }
          out.push(renderEvent(ev));
        });
        return out;
      })()}
      {copyTour && <CopyDialog src={copyTour} groupId={groupId} profileId={profileId} onClose={() => setCopyTour(null)} onCopied={() => { setCopyTour(null); bumpArchive?.(); showToast(t("copy_tour_done")); }} />}
      {copyGame && <GameCopyDialog src={copyGame} groupId={groupId} profileId={profileId} onClose={() => setCopyGame(null)} onCopied={() => { setCopyGame(null); bumpArchive?.(); showToast(t("copy_game_done")); }} />}
    </div>
  );
}
