// App.jsx — корень приложения.
// Показывает приложение лиги сразу. Сверху панель: «Войти» для гостей,
// имя + «Выйти» для авторизованных. Определяет группы пользователя (leagues)
// и прокидывает активную лигу в PadelLeague. Ссылка /j/CODE открывает экран гостя.
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./lib/supabase";
import LoginScreen from "./components/LoginScreen";
import GuestJoin from "./components/GuestJoin";
import TournamentJoin from "./components/TournamentJoin";
import ClaimProfile from "./components/ClaimProfile";
import PadelLeague from "./PadelLeague";
import ProfileEditor from "./components/ProfileEditor";
import LeagueSetup from "./components/LeagueSetup";
import { LogIn } from "lucide-react";
import { getMyLeagues } from "./lib/padelApi";

const BOT_NAME = "padel_league_bot"; // имя твоего Telegram-бота без @

function getInviteCode() {
  const m = window.location.pathname.match(/^\/j\/([A-Za-z0-9]{4})$/);
  return m ? m[1].toUpperCase() : null;
}

function getTournamentCode() {
  const m = window.location.pathname.match(/^\/t\/([A-Za-z0-9]{4})$/);
  return m ? m[1].toUpperCase() : null;
}

function getClaimCode() {
  const m = window.location.pathname.match(/^\/r\/([0-9a-f-]{36})$/i);
  return m ? m[1].toLowerCase() : null;
}

export default function App() {
  const [session,      setSession]      = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [leagues,      setLeagues]      = useState(null);   // null = загружается
  const [activeLeague, setActiveLeague] = useState(null);   // { id, name, invite_code, role }
  const [showLogin,    setShowLogin]    = useState(false);
  const [showProfile,  setShowProfile]  = useState(false);
  const [pNonce,       setPNonce]       = useState(0);

  const inviteCode    = getInviteCode();
  const tournamentCode = getTournamentCode();
  const claimCode     = getClaimCode();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (window.location.hash.includes("access_token")) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) setShowLogin(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Профиль текущего пользователя.
  useEffect(() => {
    let active = true;
    if (!session) { setProfile(null); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (active) setProfile(data);
    })();
    return () => { active = false; };
  }, [session, pNonce]);

  // Загрузить список лиг пользователя.
  const loadLeagues = useCallback(async (pid) => {
    if (!pid) { setLeagues([]); setActiveLeague(null); return; }
    try {
      const list = await getMyLeagues(pid);
      setLeagues(list);
      setActiveLeague((prev) => {
        // Если уже выбрана лига и она ещё есть — оставляем.
        if (prev && list.find((l) => l.id === prev.id)) return prev;
        return list[0] || null;
      });
    } catch { setLeagues([]); setActiveLeague(null); }
  }, []);

  useEffect(() => {
    if (!profile) { setLeagues(null); setActiveLeague(null); return; }
    loadLeagues(profile.id);
  }, [profile, loadLeagues]);

  // Когда пользователь создал/вступил в лигу из LeagueSetup.
  const handleLeagueDone = useCallback((league) => {
    setLeagues((prev) => [...(prev || []), league]);
    setActiveLeague(league);
  }, []);

  // Смена активной лиги из dropdown.
  const handleLeagueChange = useCallback((leagueId) => {
    setActiveLeague((prev) => leagues?.find((l) => l.id === leagueId) || prev);
  }, [leagues]);

  const isAdmin = !!(activeLeague && (activeLeague.role === "owner" || activeLeague.role === "admin"));

  // Гость по ссылке-приглашению — без логина.
  if (inviteCode)    return <GuestJoin code={inviteCode} botName={BOT_NAME} />;
  if (tournamentCode) return <TournamentJoin code={tournamentCode} botName={BOT_NAME} />;
  if (claimCode)     return <ClaimProfile code={claimCode} botName={BOT_NAME} />;

  // Явно открыли экран входа.
  if (showLogin && !session)
    return <LoginScreen botName={BOT_NAME} onSuccess={() => setShowLogin(false)} />;

  if (showProfile && session)
    return <ProfileEditor onClose={() => setShowProfile(false)} onSaved={() => setPNonce((n) => n + 1)} />;

  // Залогинен, профиль загружен, но ни одной лиги нет.
  if (session && profile && leagues !== null && leagues.length === 0)
    return (
      <div style={{ minHeight: "100vh", background: "#0a1612" }}>
        <TopBar
          session={session} name={profile?.name} avatarUrl={profile?.avatar_url}
          onLogin={() => setShowLogin(true)}
          onProfile={() => setShowProfile(true)}
          onSignOut={() => supabase.auth.signOut()}
        />
        <LeagueSetup onDone={handleLeagueDone} />
      </div>
    );

  return (
    <div style={{ minHeight: "100vh", background: "#0a1612" }}>
      <TopBar
        session={session}
        name={profile?.name}
        avatarUrl={profile?.avatar_url}
        onLogin={() => setShowLogin(true)}
        onProfile={() => setShowProfile(true)}
        onSignOut={() => supabase.auth.signOut()}
      />
      <PadelLeague
        groupId={activeLeague?.id ?? null}
        session={session}
        profileId={profile?.id}
        leagues={leagues || []}
        activeLeague={activeLeague}
        isAdmin={isAdmin}
        onLeagueChange={handleLeagueChange}
        onLeagueCreated={handleLeagueDone}
      />
    </div>
  );
}

function TopBar({ session, name, avatarUrl, onLogin, onProfile, onSignOut }) {
  const base = { border: "1px solid #22382c", borderRadius: 10, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontFamily: "'Outfit',sans-serif" };
  const initials = (name || "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px", borderBottom: "1px solid #22382c",
      background: "rgba(10,22,18,.92)", position: "sticky", top: 0, zIndex: 60,
      fontFamily: "'Outfit',sans-serif",
    }}>
      {session ? (
        <button onClick={onProfile} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: "#eef3ee", padding: 0 }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: "1px solid #2a4a3a" }} />
            : <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#16291f", border: "1px solid #22382c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#c8ff2d" }}>{initials}</span>}
          <span style={{ fontSize: 14, fontWeight: 600 }}>{name || "Профиль"}</span>
        </button>
      ) : (
        <span style={{ color: "#eef3ee", fontSize: 14, fontWeight: 600 }}>Падел · Лига</span>
      )}
      {session ? (
        <button onClick={onSignOut} style={{ ...base, background: "#16291f", color: "#7d9488" }}>Выйти</button>
      ) : (
        <button onClick={onLogin} style={{ ...base, background: "#c8ff2d", color: "#0a1612", border: "none", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <LogIn size={15} /> Войти
        </button>
      )}
    </div>
  );
}
