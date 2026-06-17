// PadelLeague.jsx — основной экран на реальных данных Supabase.
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { getLeaderboard, addMember, removeMember, createGame, listGames, submitResult, linkFor, deleteGame, createLeague, joinLeague } from "./lib/padelApi";
import { getRatingHistory } from "./lib/statsApi";
import { listTournaments } from "./lib/tournamentApi";
import { t } from "./lib/i18n";
import { standings, detailedStandings } from "./lib/americano";
import StandingsTable from "./components/StandingsTable";
import { Trophy, Swords, History, Users, Share2, Check, X, RefreshCw, Copy, PlusCircle, ChevronUp, ChevronDown, ChevronRight, Calendar, MapPin, TrendingUp, LogIn, Award, Phone, Mail, ArrowLeft, Trash2 } from "lucide-react";
import Tournaments, { TournamentView } from "./components/Tournaments";
import CourtView from "./components/CourtView";
import EmptyState from "./components/EmptyState";
import Logo from "./components/Logo";

const DOG_COUNT = 15;
const dogAvatar = (idOrName) => {
  if (!idOrName) return null;
  const hash = [...String(idOrName)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return `/avatars/dog-${String((hash % DOG_COUNT) + 1).padStart(2, "0")}.png`;
};
const playerAvatar = (url, idOrName) => url || dogAvatar(idOrName);

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
.pl-display{font-family:'Anton',sans-serif;letter-spacing:.5px;text-transform:uppercase;}
.pl-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;}
.pl-btn{background:var(--lime);color:var(--lime-fg);font-weight:700;border:none;border-radius:14px;cursor:pointer;transition:transform .12s,filter .12s;}
.pl-btn:active{transform:scale(.97);}.pl-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.pl-ghost{background:var(--surface2);color:var(--ink);border:1px solid var(--line);border-radius:14px;cursor:pointer;}
.pl-input,.pl-select{background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:'Outfit';outline:none;width:100%;}
.pl-input:focus,.pl-select:focus{border-color:var(--lime);}
.pl-tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;color:var(--mut);cursor:pointer;font-size:11px;font-weight:600;padding:8px 0;}
.pl-tab.on{color:var(--lime);}
.pl-pop{animation:pop .35s cubic-bezier(.2,.8,.2,1) both;}
@keyframes pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.pl-codebox{font-family:'Anton';letter-spacing:6px;font-size:30px;color:var(--lime);text-align:center;background:var(--surface2);border:1px dashed var(--line);border-radius:14px;padding:12px;}
.pl-slot{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--surface2);border:1px solid var(--line);}
@media(max-width:400px){
  .pl-card{border-radius:14px;}
  .pl-display{letter-spacing:.3px;}
  .pl-codebox{font-size:24px;letter-spacing:4px;}
  .pl-tab{font-size:10px;padding:6px 0;}
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
export default function PadelLeague({ groupId, session, profileId, leagues = [], activeLeague = null, isAdmin = false, onLeagueChange, onLeagueCreated, theme = "dark", lang = "ru", onThemeToggle, onLangChange, onLogin }) {
  const [tab, setTab] = useState(session ? "board" : "welcome");
  const [players, setPlayers] = useState([]);
  const [archiveNonce, setArchiveNonce] = useState(0);
  const bumpArchive = useCallback(() => setArchiveNonce((n) => n + 1), []);

  const loadLeaderboard = useCallback(async () => {
    if (!groupId) return;
    try { setPlayers(await getLeaderboard(groupId)); } catch (e) { /* noop */ }
  }, [groupId]);

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

  const titles = { board: t("tab_friends"), games: t("tab_games"), history: t("tab_history"), tournaments: t("tab_tournaments") };

  return (
    <div className={`pl-root${theme === "light" ? " pl-light" : ""}`}>
      <style>{css}</style>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "20px 16px 88px" }}>
        <header style={{ marginBottom: 18 }}>
          <div style={{ color: "var(--lime)", fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>{t("league_title")}</div>
          <h1 className="pl-display" style={{ fontSize: 30, lineHeight: 1, marginTop: 2, color: "var(--ink)" }}>{titles[tab]}</h1>
        </header>

        {session && !groupId && (
          <div className="pl-card" style={{ padding: "14px 16px", marginBottom: 12, borderColor: "rgba(200,255,45,.3)" }}>
            <div style={{ fontWeight: 600, color: "var(--lime)", marginBottom: 4 }}>{t("not_in_league_title")}</div>
            <div style={{ fontSize: 13, color: "var(--mut)" }}>{t("not_in_league_sub")}</div>
          </div>
        )}

        {tab === "welcome" && !session && <WelcomeScreen onLogin={onLogin} onBrowseGames={() => setTab("games")} onBrowseTournaments={() => setTab("tournaments")} theme={theme} lang={lang} onThemeToggle={onThemeToggle} onLangChange={onLangChange} />}
        {tab === "board" && (session ? <Board groupId={groupId} players={players} reload={loadLeaderboard} profileId={profileId} bumpArchive={bumpArchive} isAdmin={isAdmin} leagues={leagues} activeLeague={activeLeague} onLeagueChange={onLeagueChange} onLeagueCreated={onLeagueCreated} /> : <GateScreen />)}
        {tab === "games" && <Games groupId={groupId} players={players} reloadLeaderboard={loadLeaderboard} session={session} archiveNonce={archiveNonce} bumpArchive={bumpArchive} onLogin={onLogin} />}
        {tab === "tournaments" && <Tournaments groupId={groupId} players={players} profileId={profileId} bumpArchive={bumpArchive} session={session} onLogin={onLogin} />}
        {tab === "history" && (session ? <HistoryView groupId={groupId} players={players} profileId={profileId} isGroupMember={!!groupId} archiveNonce={archiveNonce} bumpArchive={bumpArchive} /> : <GateScreen />)}
      </div>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--topbar-bg)", borderTop: "1px solid var(--line)", backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 460, margin: "0 auto", display: "flex" }}>
          {!session && <button className={`pl-tab ${tab === "welcome" ? "on" : ""}`} onClick={() => setTab("welcome")}><LogIn size={20} />{t("tab_start")}</button>}
          {session && <button className={`pl-tab ${tab === "board" ? "on" : ""}`} onClick={() => setTab("board")}><Trophy size={20} />{t("tab_friends")}</button>}
          <button className={`pl-tab ${tab === "games" ? "on" : ""}`} onClick={() => setTab("games")}><Swords size={20} />{t("tab_games")}</button>
          <button className={`pl-tab ${tab === "tournaments" ? "on" : ""}`} onClick={() => setTab("tournaments")}><Award size={20} />{t("tab_tournaments")}</button>
          {session && <button className={`pl-tab ${tab === "history" ? "on" : ""}`} onClick={() => setTab("history")}><History size={20} />{t("tab_history")}</button>}
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
function WelcomeScreen({ onLogin, onBrowseGames, onBrowseTournaments, theme = "dark", lang = "ru", onThemeToggle, onLangChange }) {
  const features = [
    { icon: "🏆", title: t("feat_board_title"), sub: t("feat_board_sub") },
    { icon: "📊", title: t("feat_stats_title"), sub: t("feat_stats_sub") },
    { icon: "🎾", title: t("feat_tour_title"), sub: t("feat_tour_sub") },
    { icon: "📲", title: t("feat_pwa_title"), sub: t("feat_pwa_sub") },
  ];
  return (
    <div className="pl-pop">
      {/* Hero */}
      <div style={{ textAlign: "center", padding: "28px 0 22px" }}>
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

      {/* Lang + theme controls */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 18, flexWrap: "wrap" }}>
        {["ru", "en", "es"].map((l) => (
          <button key={l} onClick={() => onLangChange?.(l)} style={{
            border: `1px solid ${lang === l ? "color-mix(in srgb, var(--lime) 40%, transparent)" : "var(--line)"}`,
            borderRadius: 10, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
            background: lang === l ? "color-mix(in srgb, var(--lime) 18%, transparent)" : "var(--surface2)",
            color: lang === l ? "var(--lime)" : "var(--mut)", fontFamily: "'Outfit',sans-serif",
          }}>{l.toUpperCase()}</button>
        ))}
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
function Board({ groupId, players, reload, profileId, bumpArchive, isAdmin, leagues, activeLeague, onLeagueChange, onLeagueCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState({ whatsapp: "", telegram: "", email: "", phone: "" });
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tourCounts, setTourCounts] = useState({});
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

  useEffect(() => {
    let active = true;
    const memberIds = new Set(players.map((p) => p.id));
    Promise.all([
      listTournaments(groupId),
      supabase.from("matches").select("team_a, team_b, sets_a, sets_b, played_at").eq("group_id", groupId).order("played_at", { ascending: true }).limit(500),
    ]).then(async ([tours, { data: matchRows }]) => {
      if (!active) return;
      // tourCounts
      const counts = {};
      tours.filter((tour) => tour.status === "finished").forEach((tour) => {
        (tour.players || []).forEach((p) => {
          if (p.profile_id) counts[p.profile_id] = (counts[p.profile_id] || 0) + 1;
        });
      });
      setTourCounts(counts);
      // Win streaks: traverse matches newest-first per player
      const rows = (matchRows || []);
      const sk = {};
      const memberIds = [...new Set(rows.flatMap((m) => [...(m.team_a || []), ...(m.team_b || [])]))];
      memberIds.forEach((id) => {
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
        const { data: profiles } = await supabase
          .from("profiles").select("id, name, avatar_url, contacts, claim_code, user_id")
          .in("id", [...extraIds]);
        if (active) setExtraPlayers((profiles || []).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        if (active) setExtraPlayers([]);
      }
    }).catch(() => { if (active) { setTourCounts({}); setExtraPlayers([]); } });
    return () => { active = false; };
  }, [groupId, players]);

  const resetForm = () => { setName(""); setContacts({ whatsapp: "", telegram: "", email: "", phone: "" }); };

  const add = async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try { await addMember(groupId, n, contacts); resetForm(); setOpen(false); reload(); }
    catch (e) { alert("Не удалось добавить игрока"); }
    finally { setBusy(false); }
  };

  if (selected) return (
    <PlayerDetail groupId={groupId} player={selected} players={players} close={() => setSelected(null)}
      isAdmin={isAdmin}
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
      {/* Переключатель лиг */}
      {leagues && leagues.length > 0 && (
        <div style={{ marginBottom: 12, position: "relative" }}>
          <button
            onClick={() => { setShowLeagueMenu((v) => !v); setShowNewLeague(false); setLeagueErr(""); }}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, cursor: "pointer", color: "var(--ink)", fontFamily: "'Outfit'", fontSize: 14 }}>
            <span style={{ fontWeight: 600 }}>{activeLeague?.name || "Лига"}</span>
            <span style={{ color: "var(--mut)", fontSize: 11 }}>{isAdmin ? t("league_admin") : t("league_member")} {showLeagueMenu ? "▲" : "▼"}</span>
          </button>

          {showLeagueMenu && (
            <div className="pl-pop" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, zIndex: 30, overflow: "hidden" }}>
              {leagues.map((lg) => (
                <button key={lg.id} onClick={() => { onLeagueChange && onLeagueChange(lg.id); setShowLeagueMenu(false); }}
                  style={{ width: "100%", padding: "11px 14px", textAlign: "left", background: lg.id === activeLeague?.id ? "var(--surface2)" : "none", border: "none", color: lg.id === activeLeague?.id ? "var(--lime)" : "var(--ink)", fontFamily: "'Outfit'", fontSize: 14, cursor: "pointer", display: "block" }}>
                  {lg.name}
                  {lg.role !== "member" && <span style={{ fontSize: 10, color: "var(--mut)", marginLeft: 6 }}>{lg.role}</span>}
                </button>
              ))}
              <div style={{ borderTop: "1px solid var(--line)", display: "flex" }}>
                <button onClick={() => { setShowNewLeague("create"); setShowLeagueMenu(false); setLeagueErr(""); }}
                  style={{ flex: 1, padding: "10px 0", background: "none", border: "none", color: "var(--lime)", fontSize: 13, cursor: "pointer", fontFamily: "'Outfit'" }}>{t("league_create")}</button>
                <button onClick={() => { setShowNewLeague("join"); setShowLeagueMenu(false); setLeagueErr(""); }}
                  style={{ flex: 1, padding: "10px 0", background: "none", border: "none", color: "var(--mut)", fontSize: 13, cursor: "pointer", fontFamily: "'Outfit'" }}>{t("league_join_code")}</button>
              </div>
            </div>
          )}

          {/* Инлайн-форма создания/вступления */}
          {showNewLeague && (
            <div className="pl-card pl-pop" style={{ padding: 14, marginTop: 6 }}>
              {showNewLeague === "create" ? (
                <>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{t("league_new_title")}</div>
                  <input className="pl-input" style={{ padding: "9px 12px", marginBottom: 8 }} placeholder={t("league_name_placeholder")} value={newLeagueName} onChange={(e) => setNewLeagueName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateLeague()} autoFocus />
                  {leagueErr && <div style={{ fontSize: 12, color: "var(--coral)", marginBottom: 6 }}>{leagueErr}</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="pl-btn" style={{ flex: 1, padding: 10 }} disabled={leagueBusy || !newLeagueName.trim()} onClick={handleCreateLeague}>{leagueBusy ? t("creating") : t("league_create")}</button>
                    <button className="pl-ghost" style={{ padding: "0 12px" }} onClick={() => { setShowNewLeague(false); setLeagueErr(""); }}><X size={14} /></button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{t("league_join_title")}</div>
                  <input className="pl-input" style={{ padding: "9px 12px", marginBottom: 8, textTransform: "uppercase", letterSpacing: 3, textAlign: "center" }} placeholder="XXXXXX" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && handleJoinLeague()} autoFocus />
                  {leagueErr && <div style={{ fontSize: 12, color: "var(--coral)", marginBottom: 6 }}>{leagueErr}</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="pl-btn" style={{ flex: 1, padding: 10 }} disabled={leagueBusy || joinCode.length < 4} onClick={handleJoinLeague}>{leagueBusy ? t("creating") : t("league_join_btn")}</button>
                    <button className="pl-ghost" style={{ padding: "0 12px" }} onClick={() => { setShowNewLeague(false); setLeagueErr(""); }}><X size={14} /></button>
                  </div>
                </>
              )}
            </div>
          )}
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

      {ranked.length === 0 && (
        <div className="pl-card" style={{ padding: 20, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t("onboarding_title")}</div>
          {[
            { n: 1, icon: "👤", text: t("onboarding_1_text"), sub: isAdmin ? t("onboarding_1_sub_admin") : t("onboarding_1_sub_member") },
            { n: 2, icon: "🎾", text: t("onboarding_2_text"), sub: t("onboarding_2_sub") },
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
      {ranked.map((p, i) => {
        const qb = [];
        if (i === 0) qb.push("👑");
        if (p.matches >= 5 && p.wins / p.matches >= 0.7) qb.push("🎯");
        if (p.matches >= 20) qb.push("⚡");
        if ((tourCounts[p.id] || 0) >= 3) qb.push("🏆");
        return (
          <div key={p.id} className="pl-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }} onClick={() => setSelected(p)}>
            <div className="pl-display" style={{ width: 22, fontSize: 22, color: ["var(--yellow)", "#cfd8d0", "#cd7f4d"][i] || "var(--mut)" }}>{i + 1}</div>
            <img src={playerAvatar(p.avatar_url, p.id)} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, fontSize: 12, color: "var(--mut)" }}>
                <span>{p.matches} {t("matches")} · {tourCounts[p.id] || 0} {t("tournaments")}</span>
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

      {open ? (
        <div className="pl-card" style={{ padding: 14, marginTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>{t("add_player_form_title")}</div>
          <input className="pl-input" style={{ padding: "10px 12px", marginBottom: 8 }} placeholder={t("player_name_placeholder")} value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} autoFocus />
          <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 6 }}>{t("contacts_optional")}</div>
          {[
            { key: "whatsapp", placeholder: "WhatsApp (+7…)" },
            { key: "telegram", placeholder: "Telegram (@username)" },
            { key: "email",    placeholder: "Email" },
            { key: "phone",    placeholder: "Телефон" },
          ].map(({ key, placeholder }) => (
            <input key={key} className="pl-input" style={{ padding: "8px 12px", marginBottom: 6 }} placeholder={placeholder}
              value={contacts[key]} onChange={(e) => setContacts(c => ({ ...c, [key]: e.target.value }))} />
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="pl-btn" style={{ flex: 1, padding: 11 }} disabled={!name.trim() || busy} onClick={add}>{busy ? t("adding") : t("add_player_btn")}</button>
            <button className="pl-ghost" style={{ padding: "0 14px" }} onClick={() => { resetForm(); setOpen(false); }}><X size={16} /></button>
          </div>
        </div>
      ) : (
        <button className="pl-ghost" style={{ width: "100%", padding: 12, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 600 }} onClick={() => setOpen(true)}>
          <Users size={18} /> {t("add_player")}
        </button>
      )}

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
function PlayerDetail({ groupId, player, players, close, onDelete, isAdmin, onAddToLeague }) {
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
    supabase.from("matches")
      .select("id, team_a, team_b, sets_a, sets_b, played_at")
      .eq("group_id", groupId)
      .order("played_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setAllMatches(data || []));

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
        const table = detailedStandings(tPlayers, tour.matches || []);
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
          <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 22, color: "#3ddc84" }}>{w}</div>
          <div style={{ fontSize: 10, color: "var(--mut)" }}>{t("stat_wins")}</div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 22, color: "var(--ink)" }}>{d}</div>
          <div style={{ fontSize: 10, color: "var(--mut)" }}>{t("stat_draws")}</div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 22, color: "var(--coral)" }}>{l}</div>
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

  return (
    <div className="pl-pop">
      <button className="pl-ghost" style={{ padding: "6px 12px", marginBottom: 12 }} onClick={close}>
        <ArrowLeft size={14} style={{ display: "inline", marginRight: 4 }} />{t("back")}
      </button>

      {/* Шапка игрока */}
      <div className="pl-card" style={{ padding: 18, marginBottom: 10, textAlign: "center" }}>
        <img src={playerAvatar(player.avatar_url, player.id)} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--line)", marginBottom: 8 }} />
        <div className="pl-display" style={{ fontSize: 24 }}>{player.name}</div>
        <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 4 }}>{player.matches} {t("matches")} · {player.wins} {t("stat_wins")}</div>
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
              <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 22, color: "var(--lime)", flexShrink: 0 }}>{Math.round(bestPartner.rate * 100)}%</div>
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
                <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 14, flexShrink: 0 }}>{m.sets_a}:{m.sets_b}</div>
              </div>
            );
          })}
        </div>
      )}
      {/* Турниры */}
      {playerTours && playerTours.length > 0 && (
        <div className="pl-card" style={{ padding: 14, marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            {t("tours_heading")} ({playerTours.length})
          </div>
          {playerTours.map((tour) => (
            <div key={tour.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: tour.position === 1 ? "rgba(200,255,45,.12)" : "var(--surface2)", border: `1px solid ${tour.position === 1 ? "var(--lime)" : "var(--line)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontFamily: "'Anton',sans-serif", fontSize: 13, color: tour.position === 1 ? "var(--lime)" : tour.position <= 3 ? "var(--yellow)" : "var(--mut)" }}>{tour.position}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tour.name || t("fmt_americano_name")}</div>
                <div style={{ fontSize: 11, color: "var(--mut)" }}>{tour.played} {t("matches_abbr")} · {tour.points} {t("points_abbr")}</div>
              </div>
              <div style={{ fontSize: 11, color: "var(--mut)", flexShrink: 0 }}>{t("games_of")} {tour.total}</div>
            </div>
          ))}
        </div>
      )}
      {/* Лиги игрока */}
      {playerLeagues && playerLeagues.length > 0 && (
        <div className="pl-card" style={{ padding: 14, marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{t("leagues_heading")} ({playerLeagues.length})</div>
          {playerLeagues.map((lg) => (
            <div key={lg.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
              <Trophy size={13} color="var(--mut)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lg.name}</div>
              {lg.role !== "member" && <span style={{ fontSize: 10, color: "var(--lime)", flexShrink: 0, padding: "2px 6px", border: "1px solid rgba(200,255,45,.3)", borderRadius: 8 }}>{lg.role}</span>}
            </div>
          ))}
        </div>
      )}

      {showDeleteModal && onDelete && (
        <DeletePlayerModal player={player} onConfirm={onDelete} onCancel={() => setShowDeleteModal(false)} />
      )}
    </div>
  );
}

/* --------------------------------- Games ---------------------------------- */
function Games({ groupId, players, reloadLeaderboard, session, archiveNonce, bumpArchive, onLogin }) {
  const [games, setGames] = useState([]);
  const [mode, setMode] = useState("list");
  const [selId, setSelId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadGames = useCallback(async () => {
    setLoading(true);
    try { setGames(await listGames(groupId)); } catch (e) { /* noop */ } finally { setLoading(false); }
  }, [groupId]);
  useEffect(() => { loadGames(); }, [loadGames, archiveNonce]);

  if (mode === "create")
    return <CreateGame groupId={groupId} players={players} back={() => setMode("list")} done={() => { setMode("list"); loadGames(); }} />;

  if (mode === "view") {
    const g = games.find((x) => x.id === selId);
    if (!g) { setMode("list"); return null; }
    return <GameCard game={g} back={() => setMode("list")} reloadGames={loadGames} reloadLeaderboard={reloadLeaderboard} bumpArchive={bumpArchive} />;
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
        {session && <button className="pl-btn" style={{ flex: 1, padding: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setMode("create")}>
          <PlusCircle size={18} /> {t("create_game")}
        </button>}
        <button className="pl-ghost" style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 600 }} onClick={loadGames}>
          <RefreshCw size={16} />
        </button>
      </div>
      {loading && <div className="pl-card" style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>{t("loading")}</div>}
      {!loading && games.length === 0 && <EmptyState text={session ? t("games_empty_session") : t("games_empty_guest")} />}
      {!loading && (() => {
        const upcoming = games.filter(g => g.status === "open" && (g.slots||[]).filter(s=>s.profile_id||s.guest_name).length < 4);
        const active   = games.filter(g => g.status === "open" && (g.slots||[]).filter(s=>s.profile_id||s.guest_name).length === 4);
        const played   = games.filter(g => g.status === "played");
        const section = (label, color, items) => items.length === 0 ? null : (
          <div key={label}>
            <div style={{ fontSize: 12, color: "var(--mut)", fontFamily:"'Anton',sans-serif", textTransform:"uppercase", letterSpacing:1, margin:"12px 2px 6px" }}>{label}</div>
            {items.map(g => {
              const filled = (g.slots||[]).filter(s=>s.profile_id||s.guest_name).length;
              return (
                <div key={g.id} className="pl-card" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "12px 14px" }} onClick={() => { setSelId(g.id); setMode("view"); }}>
                  <Swords size={18} color={color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.title || "Padel"}</div>
                    <div style={{ fontSize: 12, color: "var(--mut)" }}>{g.starts_at ? fmtDate(g.starts_at) + " · " : ""}{filled}/4</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "rgba(255,255,255,.06)", color, flexShrink:0 }}>
                    {g.status === "played" ? "✓" : `${filled}/4`}
                  </span>
                </div>
              );
            })}
          </div>
        );
        return [
          section(t("upcoming_section"), "var(--mut)", upcoming),
          section(t("active_section"), "var(--lime)", active),
          section(t("played_section"), "#7d9488", played),
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
        </div>
      )}
    </div>
  );
}

function CreateGame({ groupId, players, back, done }) {
  const [title, setTitle] = useState(""), [date, setDate] = useState(""), [place, setPlace] = useState("");
  const [slots, setSlots] = useState([null, null, null, null]);
  const [busy, setBusy] = useState(false);
  const chosenIds = slots.filter((v) => v && v.profileId).map((v) => v.profileId);
  const setSlot = (i, v) => setSlots((s) => s.map((x, j) => (j === i ? v : x)));

  const create = async () => {
    setBusy(true);
    try { await createGame(groupId, { title, startsAt: date || null, place, slots }); done(); }
    catch (e) { alert("Не удалось создать игру"); setBusy(false); }
  };

  return (
    <div className="pl-pop">
      <button className="pl-ghost" style={{ padding: "6px 12px", marginBottom: 12 }} onClick={back}>← {t("back")}</button>
      <div className="pl-card" style={{ padding: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <input className="pl-input" style={{ padding: "10px 12px" }} placeholder={t("game_name_placeholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Calendar size={18} color="var(--mut)" />
          <input type="datetime-local" className="pl-input" style={{ padding: "9px 12px" }} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MapPin size={18} color="var(--mut)" />
          <input className="pl-input" style={{ padding: "10px 12px" }} placeholder={t("court_club_placeholder")} value={place} onChange={(e) => setPlace(e.target.value)} />
        </div>
      </div>
      <div className="pl-card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 10 }}>{t("slots_label")}</div>
        {[0, 1, 2, 3].map((i) => (
          <SlotPicker key={i} value={slots[i]} players={players} taken={chosenIds}
            onChange={(v) => setSlot(i, v)} teamLabel={i < 2 ? "A" : "B"} />
        ))}
      </div>
      <button className="pl-btn" style={{ width: "100%", padding: 14, fontSize: 16 }} disabled={busy} onClick={create}>{busy ? t("creating_game") : t("create_and_get_link")}</button>
    </div>
  );
}

function GameCard({ game, back, reloadGames, reloadLeaderboard, bumpArchive }) {
  const [showShare, setShowShare] = useState(false);
  const [toast, setToast] = useState("");
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

  if (game.status === "played") {
    const match = (game.matches || [])[0];
    return (
      <div className="pl-pop">
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {back && <button className="pl-ghost" style={{ padding: "6px 12px" }} onClick={back}>{t("to_list")}</button>}
        <button className="pl-ghost" style={{ padding: "6px 10px", color: "var(--coral)", border: "1px solid rgba(255,106,82,.3)", marginLeft: "auto" }} onClick={async () => { if (!confirm(t("delete_game_confirm"))) return; await deleteGame(game.id); bumpArchive && bumpArchive(); reloadGames && reloadGames(); back && back(); }} title="Удалить"><Trash2 size={14} /></button>
      </div>
        <div className="pl-card" style={{ padding: 14 }}>
          <div className="pl-display" style={{ fontSize: 18 }}>{game.title || "Padel"} · {t("game_played_label")}</div>
          <div style={{ marginTop: 10 }}>
            <CourtView courtNumber={1} mode="sets"
              teamA={slotsA.map(nameOf)} teamB={slotsB.map(nameOf)}
              teamAvatarsA={slotsA.map(avatarOf)} teamAvatarsB={slotsB.map(avatarOf)}
              scoreA={match?.sets_a ?? null} scoreB={match?.sets_b ?? null}
              scoreDetail={match?.score_detail || null}
              editable={false} />
          </div>
        </div>
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
function HistoryView({ groupId, players, profileId, isGroupMember, archiveNonce, bumpArchive }) {
  const [matches, setMatches] = useState(null);
  const [tours, setTours] = useState([]);
  const [sel, setSel] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (sel) return;
    (async () => {
      const { data } = await supabase.from("matches")
        .select("id, team_a, team_b, sets_a, sets_b, score_detail, played_at")
        .eq("group_id", groupId).order("played_at", { ascending: false }).limit(30);
      setMatches(data || []);
      try { const all = await listTournaments(groupId); setTours(all.filter((tour) => tour.status === "finished")); }
      catch (e) { setTours([]); }
    })();
  }, [groupId, sel, archiveNonce]);

  if (sel) return <TournamentView id={sel.id} players={players} back={() => setSel(null)} isGroupMember={isGroupMember} currentProfileId={profileId} />;

  const nameOf = (id) => players.find((p) => p.id === id)?.name || t("player_deleted");
  const avatarOf = (id) => { const gp = players.find((p) => p.id === id); return gp ? playerAvatar(gp.avatar_url, id) : null; };
  const head = (txt) => <div className="pl-display" style={{ fontSize: 13, color: "var(--mut)", margin: "10px 2px 8px" }}>{txt}</div>;

  if (matches === null) return <div className="pl-card pl-pop" style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>{t("loading")}</div>;
  if (matches.length === 0 && tours.length === 0) return <EmptyState className="pl-card pl-pop" text={t("history_empty")} />;

  return (
    <div className="pl-pop">
      {tours.length > 0 && head(t("tours_history_heading"))}
      {tours.map((tour) => {
        const table = standings((tour.players || []).map((p) => ({ id: p.id, name: p.name })), tour.matches || []);
        const w = table[0];
        return (
          <div key={tour.id} className="pl-card" style={{ padding: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setSel(tour)}>
            <Trophy size={18} color="var(--yellow)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tour.name || t("fmt_americano_name")}</div>
              <div style={{ fontSize: 12, color: "var(--mut)" }}>{w ? `${t("winner_label")}: ${w.name} · ${w.points} ${t("points_abbr")}` : "-"}</div>
            </div>
            <span style={{ fontSize: 16, color: "var(--lime)", flexShrink: 0 }}>→</span>
          </div>
        );
      })}

      {matches.length > 0 && head(t("games_history_heading"))}
      {matches.map((m) => {
        const aWon = m.sets_a > m.sets_b;
        const rawDetail = m.score_detail;
        const detail = (() => {
          if (!rawDetail) return null;
          if (Array.isArray(rawDetail) && rawDetail.length > 0) return rawDetail;
          try { const p = typeof rawDetail === "string" ? JSON.parse(rawDetail) : rawDetail; return Array.isArray(p) && p.length > 0 ? p : null; }
          catch (e) { return null; }
        })();
        const isExpanded = expanded === m.id;
        return (
          <div key={m.id} className="pl-card" style={{ padding: 12, marginBottom: 8, cursor: detail ? "pointer" : "default" }}
            onClick={() => detail && setExpanded(isExpanded ? null : m.id)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {(m.team_a || []).map((id) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    {avatarOf(id) && <img src={avatarOf(id)} alt="" style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, fontWeight: aWon ? 700 : 400, color: aWon ? "var(--lime)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(id)}</span>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "center", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div className="pl-display" style={{ fontSize: 22 }}>{m.sets_a}:{m.sets_b}</div>
                {detail && <div style={{ fontSize: 10, color: "var(--lime)" }}>{isExpanded ? "▲" : "▼"}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                {(m.team_b || []).map((id) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 13, fontWeight: !aWon ? 700 : 400, color: !aWon ? "var(--lime)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(id)}</span>
                    {avatarOf(id) && <img src={avatarOf(id)} alt="" style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
              {isGroupMember && (
                <button style={{ flexShrink: 0, padding: 8, border: "1px solid rgba(255,106,82,.2)", borderRadius: 8, background: "none", color: "rgba(255,106,82,.5)", cursor: "pointer", alignSelf: "center" }}
                  onClick={(e) => { e.stopPropagation(); if (!confirm(t("delete_match_confirm"))) return; supabase.from("matches").delete().eq("id", m.id).then(() => { setMatches((prev) => prev.filter((x) => x.id !== m.id)); bumpArchive && bumpArchive(); }); }}
                  title="Удалить"><Trash2 size={14} /></button>
              )}
            </div>
            {isExpanded && detail && (
              <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 8, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {detail.map((s, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 52 }}>
                    <div style={{ fontSize: 10, color: "var(--mut)" }}>{t("set_label")} {i + 1}</div>
                    <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 18, color: s.a > s.b ? "var(--lime)" : s.b > s.a ? "var(--coral)" : "var(--ink)" }}>
                      {s.a}<span style={{ color: "var(--mut)", fontSize: 14 }}>:</span>{s.b}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
