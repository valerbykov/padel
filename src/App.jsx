// App.jsx — корень приложения.
// Показывает приложение лиги сразу. Сверху панель: «Войти» для гостей,
// имя + «Выйти» для авторизованных. Определяет группы пользователя (leagues)
// и прокидывает активную лигу в PadelLeague. Ссылка /j/CODE открывает экран гостя.
import React, { useEffect, useState, useCallback, lazy } from "react";
import { supabase } from "./lib/supabase";
import { handleAuthCallbackUrl, handleYandexCallback } from "./lib/auth";
import Avatar from "./components/Avatar";
import LeagueSwitcher from "./components/LeagueSwitcher"; // глобальный переключатель лиги в топбаре
import { LogIn, Sun, Moon } from "lucide-react";
import { getMyLeagues } from "./lib/padelApi";
import { t, setLang, LANGS, LANG_LABELS, currentLang } from "./lib/i18n";

// Ленивые чанки: тяжёлые и маршрутные экраны грузятся по требованию.
const PadelLeague      = lazy(() => import("./PadelLeague"));
const LoginScreen      = lazy(() => import("./components/LoginScreen"));
const ProfileEditor    = lazy(() => import("./components/ProfileEditor"));
const LeagueSetup      = lazy(() => import("./components/LeagueSetup"));
const LeaguePublicPage = lazy(() => import("./components/LeaguePublicPage"));
const GuestJoin        = lazy(() => import("./components/GuestJoin"));
const TournamentJoin   = lazy(() => import("./components/TournamentJoin"));
const ClaimProfile     = lazy(() => import("./components/ClaimProfile"));

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

function getLeaguePublicCode() {
  const m = window.location.pathname.match(/^\/l\/([A-Za-z0-9]{6})$/i);
  return m ? m[1].toUpperCase() : null;
}

export default function App({ initialShowLogin = false }) {
  const [session,      setSession]      = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [leagues,      setLeagues]      = useState(null);   // null = загружается
  const [activeLeague, setActiveLeague] = useState(null);   // { id, name, invite_code, role }
  // initialShowLogin — гость пришёл с лендинга через «Войти» (см. Root.jsx).
  const [showLogin,    setShowLogin]    = useState(initialShowLogin);
  const [showProfile,  setShowProfile]  = useState(false);
  const [pNonce,       setPNonce]       = useState(0);
  const [theme,        setTheme]        = useState(() => localStorage.getItem("plTheme") || "dark");
  const [lang,         setLangState]    = useState(() => localStorage.getItem("plLang") || "ru");
  const handleLangChange = useCallback((l) => { setLang(l); setLangState(l); }, []);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall,   setShowInstall]   = useState(false);
  const [statsNonce, setStatsNonce] = useState(0); // открыть свой профиль игрока из кабинета
  // «Подробнее о PadelPack» → полноэкранный лендинг (статическая маркетинговая страница).
  const openLanding = useCallback(() => { window.location.href = "/landing.html"; }, []);

  // Нативный статус-бар (Android/iOS). На Android env(safe-area-inset-top) для
  // строки состояния = 0, поэтому CSS-отступ не помогает — говорим системе НЕ
  // накладывать статус-бар на webview (контент встаёт под ним) и задаём цвет/стиль
  // иконок под тему. Доступ рантаймом — на вебе плагина нет, эффект тихо ничего не делает.
  useEffect(() => {
    const Cap = window.Capacitor;
    const SB = Cap?.Plugins?.StatusBar;
    if (!SB) return;
    const dark = theme !== "light";
    if (Cap.getPlatform && Cap.getPlatform() === "android") {
      SB.setOverlaysWebView({ overlay: false }).catch(() => {});
    }
    SB.setStyle({ style: dark ? "DARK" : "LIGHT" }).catch(() => {}); // DARK = светлые иконки (для тёмного фона)
    SB.setBackgroundColor({ color: dark ? "#0a1612" : "#ffffff" }).catch(() => {});
  }, [theme]);

  // PWA install prompt (Android/Desktop Chrome)
  useEffect(() => {
    if (localStorage.getItem("plInstallDismissed")) return;
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setShowInstall(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null); setShowInstall(false);
  };

  const dismissInstall = () => {
    localStorage.setItem("plInstallDismissed", "1");
    setShowInstall(false);
  };

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("plTheme", next);
      return next;
    });
  }, []);

  const inviteCode       = getInviteCode();
  const tournamentCode  = getTournamentCode();
  const claimCode       = getClaimCode();
  const leaguePublicCode = getLeaguePublicCode();

  // ?join=CODE — автозаполнение формы вступления в лигу
  const [pendingJoin, setPendingJoin] = useState(() => {
    const p = new URLSearchParams(window.location.search).get("join")?.toUpperCase();
    if (p) window.history.replaceState({}, "", window.location.pathname);
    return p || null;
  });

  // Возврат после входа по deep link в нативной обёртке (Capacitor).
  // На вебе window.Capacitor отсутствует — эффект ничего не делает.
  useEffect(() => {
    const CapApp = window.Capacitor?.Plugins?.App;
    if (!CapApp) return;
    let sub;
    const res = CapApp.addListener("appUrlOpen", async ({ url }) => {
      if (url) { if (!(await handleYandexCallback(url))) await handleAuthCallbackUrl(url); }
    });
    // Capacitor 8: addListener может вернуть handle напрямую ИЛИ Promise<handle>
    if (res && typeof res.then === "function") res.then((h) => { sub = h; });
    else sub = res;
    return () => { sub?.remove?.(); };
  }, []);

  useEffect(() => {
    (async () => {
      await handleYandexCallback().catch(() => {}); // возврат с Яндекса (?code=...) поднимет сессию
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (window.location.hash.includes("access_token")) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Supabase повторно шлёт это событие при фокусе вкладки / refresh токена.
      // Если сессия по сути та же — не пересоздаём state, иначе профиль и весь
      // каскад загрузок (лиги/лидерборд/турниры/игры/матчи) перезапускаются и
      // плодят дубли запросов (видно в Network как два одинаковых запроса).
      setSession((prev) => {
        if (prev && s && prev.access_token === s.access_token && prev.user?.id === s.user?.id) return prev;
        return s;
      });
      if (s) setShowLogin(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Профиль текущего пользователя.
  useEffect(() => {
    let active = true;
    if (!session) { setProfile(null); return; }
    (async () => {
      const user = session.user;            // уже есть из getSession — без лишнего getUser()
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

  // Публичная страница лиги — без логина.
  if (leaguePublicCode) return <LeaguePublicPage code={leaguePublicCode} />;

  // Гость по ссылке-приглашению — без логина.
  if (inviteCode)    return <GuestJoin code={inviteCode} botName={BOT_NAME} />;
  if (tournamentCode) return <TournamentJoin code={tournamentCode} botName={BOT_NAME} />;
  if (claimCode)     return <ClaimProfile code={claimCode} botName={BOT_NAME} />;

  // Явно открыли экран входа.
  if (showLogin && !session)
    return <LoginScreen botName={BOT_NAME} onSuccess={() => setShowLogin(false)} onBack={() => setShowLogin(false)} theme={theme} lang={lang} onThemeToggle={toggleTheme} onLangChange={handleLangChange} />;

  if (showProfile && session)
    return <ProfileEditor onClose={() => setShowProfile(false)} onSaved={() => setPNonce((n) => n + 1)} theme={theme}
      lang={lang} onThemeToggle={toggleTheme} onLangChange={handleLangChange}
      onOpenStats={() => { setShowProfile(false); setStatsNonce((n) => n + 1); }} />;

  // Переход по ?join=CODE — показываем экран вступления с предзаполненным кодом.
  if (pendingJoin && session && profile && leagues !== null) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <TopBar
          session={session} name={profile?.name} avatarUrl={profile?.avatar_url}
          onLogin={() => setShowLogin(true)}
          onProfile={() => setShowProfile(true)}
          onSignOut={() => supabase.auth.signOut()}
          theme={theme} onThemeToggle={toggleTheme}
          lang={lang} onLangChange={handleLangChange}
          leagues={leagues || []} activeLeague={activeLeague} isAdmin={isAdmin}
          onLeagueChange={handleLeagueChange} onLeagueCreated={handleLeagueDone}
        />
        <LeagueSetup
          onDone={(league) => { setPendingJoin(null); handleLeagueDone(league); }}
          onCancel={() => setPendingJoin(null)}
          initialMode="join"
          initialCode={pendingJoin}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <TopBar
        session={session}
        name={profile?.name}
        avatarUrl={profile?.avatar_url}
        onLogin={() => setShowLogin(true)}
        onProfile={() => setShowProfile(true)}
        onSignOut={() => supabase.auth.signOut()}
        theme={theme}
        onThemeToggle={toggleTheme}
        lang={lang}
        onLangChange={handleLangChange}
        leagues={leagues || []}
        activeLeague={activeLeague}
        isAdmin={isAdmin}
        onLeagueChange={handleLeagueChange}
        onLeagueCreated={handleLeagueDone}
      />
      {showInstall && (
        <div style={{
          position: "fixed", bottom: 74, left: 12, right: 12, zIndex: 90,
          background: "var(--surface)", borderRadius: 16, padding: "12px 14px",
          border: "1px solid color-mix(in srgb, var(--lime) 35%, transparent)",
          boxShadow: "0 4px 24px rgba(0,0,0,.55)",
          display: "flex", alignItems: "center", gap: 12,
          animation: "pop .3s both", fontFamily: "'Outfit',sans-serif",
        }}>
          <div style={{ fontSize: 28, flexShrink: 0 }}>📲</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{t("install_app")}</div>
            <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 2 }}>{t("install_sub")}</div>
          </div>
          <button onClick={handleInstall} style={{
            background: "var(--lime)", color: "var(--lime-fg)", border: "none",
            borderRadius: 10, padding: "7px 14px", fontWeight: 700, fontSize: 13,
            cursor: "pointer", flexShrink: 0, fontFamily: "'Outfit',sans-serif",
          }}>{t("install_btn")}</button>
          <button onClick={dismissInstall} style={{
            background: "none", border: "none", color: "var(--mut)",
            cursor: "pointer", fontSize: 18, padding: "0 2px", flexShrink: 0,
          }}>✕</button>
        </div>
      )}
      <PadelLeague
        groupId={activeLeague?.id ?? null}
        session={session}
        profileId={profile?.id}
        leagues={leagues || []}
        leaguesReady={leagues !== null}
        activeLeague={activeLeague}
        isAdmin={isAdmin}
        onLeagueChange={handleLeagueChange}
        onLeagueCreated={handleLeagueDone}
        theme={theme}
        lang={lang}
        onThemeToggle={toggleTheme}
        onLangChange={handleLangChange}
        onLogin={() => setShowLogin(true)}
        onOpenLanding={openLanding}
        onEditProfile={() => setShowProfile(true)}
        openSelfStatsNonce={statsNonce}
      />
    </div>
  );
}

function TopBar({ session, name, avatarUrl, onLogin, onProfile, onSignOut, theme, onThemeToggle, lang = "ru", onLangChange, leagues = [], activeLeague = null, isAdmin = false, onLeagueChange, onLeagueCreated }) {
  const base = { border: "1px solid var(--line)", borderRadius: 11, padding: "7px 12px", fontSize: 13, cursor: "pointer", fontFamily: "'Outfit',sans-serif", transition: "transform .12s, filter .15s, background .15s" };
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px", paddingTop: "max(10px, env(safe-area-inset-top))",
      borderBottom: "1px solid var(--line)",
      background: "var(--topbar-bg)", position: "sticky", top: 0, zIndex: 60,
      fontFamily: "'Outfit',sans-serif", backdropFilter: "blur(10px)",
    }}>
      {/* Лёгкий hover/active без переезда на CSS-файл */}
      <style>{`.tb-btn:hover{filter:brightness(1.07)}.tb-btn:active{transform:translateY(1px)}.tb-profile:hover{background:var(--surface2)}`}</style>
      {/* СЛЕВА: глобальный переключатель лиги (действует на все вкладки). У гостя — пусто. */}
      <div style={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}>
        {session && <LeagueSwitcher leagues={leagues} activeLeague={activeLeague} isAdmin={isAdmin} onLeagueChange={onLeagueChange} onLeagueCreated={onLeagueCreated} />}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* lang + theme — единая группа-сегмент */}
        <div style={{ display: "flex", gap: 4, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: 3 }}>
          <button className="tb-btn" onClick={() => { const o = ["ru","en","es"]; onLangChange?.(o[(o.indexOf(lang) + 1) % o.length]); }}
            title="RU / EN / ES"
            style={{ border: "none", background: "none", color: "var(--ink)", padding: "5px 9px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, borderRadius: 9, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
            {lang.toUpperCase()} <span style={{ color: "var(--mut)", fontWeight: 400, fontSize: 13 }}>↻</span>
          </button>
          <button className="tb-btn" onClick={onThemeToggle} aria-label={t("aria_theme")} title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            style={{ border: "none", background: "none", color: "var(--mut)", display: "flex", alignItems: "center", padding: "5px 8px", borderRadius: 9, cursor: "pointer" }}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
        {/* СПРАВА: профиль (только иконка) для залогиненного, иначе «Войти» */}
        {session ? (
          <button onClick={onProfile} className="tb-profile" aria-label={name || "Профиль"} title={name || "Профиль"}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid transparent", borderRadius: 999, cursor: "pointer", padding: 2, transition: "background .15s" }}>
            <Avatar url={avatarUrl} name={name} size={32} />
          </button>
        ) : (
          <button className="tb-btn" onClick={onLogin} style={{ ...base, background: "var(--lime)", color: "var(--lime-fg)", border: "none", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <LogIn size={15} /> {t("sign_in")}
          </button>
        )}
      </div>
    </div>
  );
}
