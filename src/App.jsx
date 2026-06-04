// App.jsx — корень приложения.
// Показывает приложение лиги сразу. Сверху панель: «Войти» для гостей,
// имя + «Выйти» для авторизованных. Ссылка-приглашение /j/CODE открывает
// экран гостя без логина.
import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import LoginScreen from "./components/LoginScreen";
import GuestJoin from "./components/GuestJoin";
import PadelLeague from "./PadelLeague";
import { LogIn } from "lucide-react";

// Имя твоего Telegram-бота без @ (для кнопки входа через Telegram).
const BOT_NAME = "padel_league_bot";

function getInviteCode() {
  const m = window.location.pathname.match(/^\/j\/([A-Za-z0-9]{4})$/);
  return m ? m[1].toUpperCase() : null;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const inviteCode = getInviteCode();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (window.location.hash.includes("access_token")) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) setShowLogin(false); // после успешного входа закрываем экран логина
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
  }, [session]);

  // Гость по ссылке-приглашению — без логина.
  if (inviteCode) return <GuestJoin code={inviteCode} />;

  // Явно открыли экран входа (по кнопке «Войти»).
  if (showLogin && !session) {
    return <LoginScreen botName={BOT_NAME} onSuccess={() => setShowLogin(false)} />;
  }

  // Основной экран: приложение лиги + верхняя панель со входом/профилем.
  return (
    <div style={{ minHeight: "100vh", background: "#0a1612" }}>
      <TopBar
        session={session}
        name={profile?.name}
        onLogin={() => setShowLogin(true)}
        onSignOut={() => supabase.auth.signOut()}
      />
      <PadelLeague />
    </div>
  );
}

function TopBar({ session, name, onLogin, onSignOut }) {
  const base = {
    border: "1px solid #22382c", borderRadius: 10, padding: "6px 12px",
    fontSize: 13, cursor: "pointer", fontFamily: "'Outfit',sans-serif",
  };
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px", borderBottom: "1px solid #22382c",
      background: "rgba(10,22,18,.92)", position: "sticky", top: 0, zIndex: 40,
      fontFamily: "'Outfit',sans-serif",
    }}>
      <span style={{ color: "#eef3ee", fontSize: 14, fontWeight: 600 }}>
        {session ? `Привет, ${name || "игрок"}` : "Падел · Лига"}
      </span>
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
