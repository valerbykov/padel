// App.jsx — корень приложения.
// Показывает приложение лиги сразу. Сверху панель: «Войти» для гостей,
// имя + «Выйти» для авторизованных. Определяет группы пользователя (leagues)
// и прокидывает активную лигу в PadelLeague. Ссылка /j/CODE открывает экран гостя.
import React, { useEffect, useState, useCallback, useRef, lazy } from "react";
import { supabase } from "./lib/supabase";
import { handleAuthCallbackUrl, handleYandexCallback } from "./lib/auth";
import Avatar from "./components/Avatar";
import Logo from "./components/Logo"; // текстовый логотип в топбаре для гостя
import LeagueSwitcher from "./components/LeagueSwitcher"; // глобальный переключатель лиги в топбаре
import { LogIn, Sun, Moon } from "lucide-react";
import { getMyLeagues } from "./lib/padelApi";
import { t, setLang, applyLang, LANGS, LANG_LABELS, currentLang } from "./lib/i18n";
import { detectCountry, langFromCountry } from "./lib/region";
import { getNotifPrefs, registerPush } from "./lib/notifications";

// Быстрый синхронный guess языка для самого первого рендера (до ответа гео):
// кэш страны → язык браузера → ru (историчный дефолт, основной рынок). Не сохраняется —
// авторитетным становится гео-определение в эффекте ниже.
function guessLangSync() {
  try { const cc = localStorage.getItem("pp_country"); const l = cc && langFromCountry(cc); if (l) return l; } catch (e) { /* ignore */ }
  const nav = (navigator.language || "").slice(0, 2).toLowerCase();
  if (nav === "es") return "es";
  if (nav === "en") return "en";
  return "ru";
}

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
  const [lang,         setLangState]    = useState(() => {
    const saved = localStorage.getItem("plLang");
    if (saved) return saved;
    const g = guessLangSync();
    applyLang(g); // активируем guess для первого рендера, без записи (гео уточнит ниже)
    return g;
  });
  const handleLangChange = useCallback((l) => { setLang(l); setLangState(l); }, []);

  // Первый заход (язык ещё не выбран): определяем по стране через гео-API и сохраняем.
  // RU/СНГ-ru → ru, Испания/ЛатАм → es, остальное → en. Возвращающиеся юзеры (plLang
  // уже есть) сюда не попадают — их выбор не трогаем.
  useEffect(() => {
    if (localStorage.getItem("plLang")) return;
    let alive = true;
    (async () => {
      let cc = null;
      try { cc = await detectCountry(); } catch (e) { /* ignore */ }
      if (!alive) return;
      handleLangChange(langFromCountry(cc) || guessLangSync()); // setLang сохранит plLang
    })();
    return () => { alive = false; };
  }, [handleLangChange]);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall,   setShowInstall]   = useState(false);
  const [statsNonce, setStatsNonce] = useState(0); // открыть свой профиль игрока из кабинета
  const [analyticsNonce, setAnalyticsNonce] = useState(0); // открыть аналитику лиги из шапки
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

  // Universal/App Links: https://padelpack.app/{l|j|t|r}/CODE, открытые в нативной обёртке,
  // прилетают как событие appUrlOpen (webview грузит свой bundle, а не внешний URL),
  // поэтому путь достаём вручную и «навешиваем» на роутер (getLeaguePublicCode и т.п.
  // читают window.location.pathname при рендере). routeNonce форсит перерендер.
  const [routeNonce, setRouteNonce] = useState(0);
  const routeFromUrl = (url) => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      if (host === "padelpack.app" && /^\/(l|j|t|r)\/[^/]+/i.test(u.pathname)) {
        window.history.replaceState({}, "", u.pathname + u.search);
        setRouteNonce((n) => n + 1);
        return true;
      }
    } catch (_) {}
    return false;
  };

  // Возврат после входа по deep link + входящие app links в нативной обёртке (Capacitor).
  // На вебе window.Capacitor отсутствует — эффект ничего не делает.
  useEffect(() => {
    const CapApp = window.Capacitor?.Plugins?.App;
    if (!CapApp) return;
    let sub;
    // холодный старт по ссылке: разбираем URL запуска
    CapApp.getLaunchUrl?.().then((r) => { if (r?.url) routeFromUrl(r.url); }).catch(() => {});
    const res = CapApp.addListener("appUrlOpen", async ({ url }) => {
      if (!url) return;
      if (routeFromUrl(url)) return;                                          // app link на лигу/игру/турнир
      if (!(await handleYandexCallback(url))) await handleAuthCallbackUrl(url); // иначе — auth-callback
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

  // Push-напоминания: при наличии сессии в нативке регистрируем/обновляем FCM-токен,
  // если у пользователя включены уведомления. Веб/PWA — эффект тихо ничего не делает.
  useEffect(() => {
    if (!session || !window.Capacitor?.isNativePlatform?.()) return;
    let alive = true;
    (async () => {
      try { const { enabled } = await getNotifPrefs(); if (alive && enabled) await registerPush(); }
      catch (e) { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [session]);

  // Отметка ПОСЛЕДНЕГО ЗАХОДА в приложение (не логина) — один раз за сессию,
  // отдельным изолированным эффектом. ВАЖНО: НЕ внутри профильного эффекта и
  // БЕЗ `.catch()` прямо на билдере supabase — у него нет метода .catch (это
  // thenable), поэтому `supabase.rpc(...).catch()` бросает синхронный TypeError
  // и рушит загрузку профиля/лиг. Правильно — await внутри try/catch.
  const seenRef = useRef(false);
  useEffect(() => {
    if (!session || seenRef.current) return;
    seenRef.current = true;
    (async () => { try { await supabase.rpc("touch_last_seen"); } catch (e) { /* тихо игнорируем */ } })();
  }, [session]);

  // Загрузить список лиг пользователя.
  const loadLeagues = useCallback(async (pid) => {
    if (!pid) { setLeagues([]); setActiveLeague(null); return; }
    try {
      const list = await getMyLeagues(pid);
      setLeagues(list);
      setActiveLeague((prev) => {
        // Если уже выбрана лига и она ещё есть — оставляем.
        if (prev && list.find((l) => l.id === prev.id)) return prev;
        // Иначе восстанавливаем последнюю выбранную (запомненную) лигу, иначе первую.
        const savedId = localStorage.getItem("plActiveLeague");
        return list.find((l) => l.id === savedId) || list[0] || null;
      });
    } catch { setLeagues([]); setActiveLeague(null); }
  }, []);

  useEffect(() => {
    if (!profile) { setLeagues(null); setActiveLeague(null); return; }
    loadLeagues(profile.id);
  }, [profile, loadLeagues]);

  // Запоминаем последнюю активную лигу, чтобы она не слетала после обновления страницы.
  useEffect(() => {
    if (activeLeague?.id) localStorage.setItem("plActiveLeague", activeLeague.id);
  }, [activeLeague?.id]);

  // Когда пользователь создал/вступил в лигу из LeagueSetup.
  const handleLeagueDone = useCallback((league) => {
    setLeagues((prev) => [...(prev || []), league]);
    setActiveLeague(league);
  }, []);

  // Смена активной лиги из dropdown.
  const handleLeagueChange = useCallback((leagueId) => {
    setActiveLeague((prev) => leagues?.find((l) => l.id === leagueId) || prev);
  }, [leagues]);

  // Лигу отредактировали в окне управления (имя/логотип/телеграм) — мёржим.
  const handleLeagueUpdated = useCallback((lg) => {
    if (!lg?.id) return;
    setLeagues((prev) => (prev || []).map((l) => (l.id === lg.id ? { ...l, ...lg } : l)));
    setActiveLeague((prev) => (prev && prev.id === lg.id ? { ...prev, ...lg } : prev));
  }, []);

  const isAdmin = !!(activeLeague && (activeLeague.role === "owner" || activeLeague.role === "admin"));

  // #7: ЛК теперь всплывающее окно (ProfileEditor сам портелится в body), а не
  // отдельный полноэкранный маршрут — рендерим поверх приложения там, где есть топбар.
  const profileModal = (showProfile && session) ? (
    <ProfileEditor onClose={() => setShowProfile(false)} onSaved={() => setPNonce((n) => n + 1)} theme={theme}
      lang={lang} onThemeToggle={toggleTheme} onLangChange={handleLangChange}
      onOpenStats={() => { setShowProfile(false); setStatsNonce((n) => n + 1); }} />
  ) : null;

  // Публичная страница лиги — без логина.
  if (leaguePublicCode) return <LeaguePublicPage code={leaguePublicCode} />;

  // Гость по ссылке-приглашению — без логина.
  if (inviteCode)    return <GuestJoin code={inviteCode} botName={BOT_NAME} />;
  if (tournamentCode) return <TournamentJoin code={tournamentCode} botName={BOT_NAME} />;
  if (claimCode)     return <ClaimProfile code={claimCode} botName={BOT_NAME} />;

  // Явно открыли экран входа.
  if (showLogin && !session)
    return <LoginScreen botName={BOT_NAME} onSuccess={() => setShowLogin(false)} onBack={() => setShowLogin(false)} theme={theme} lang={lang} onThemeToggle={toggleTheme} onLangChange={handleLangChange} />;

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
          onLeagueUpdated={handleLeagueUpdated}
        />
        <LeagueSetup
          onDone={(league) => { setPendingJoin(null); handleLeagueDone(league); }}
          onCancel={() => setPendingJoin(null)}
          initialMode="join"
          initialCode={pendingJoin}
        />
        {profileModal}
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
        onLeagueUpdated={handleLeagueUpdated}
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
        openAnalyticsNonce={analyticsNonce}
      />
      {profileModal}
    </div>
  );
}

function TopBar({ session, name, avatarUrl, onLogin, onProfile, onSignOut, theme, onThemeToggle, lang = "ru", onLangChange, leagues = [], activeLeague = null, isAdmin = false, onLeagueChange, onLeagueCreated, onLeagueUpdated }) {
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
      {/* СЛЕВА: у залогиненного — переключатель лиги; у гостя — текстовый логотип. */}
      <div style={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}>
        {session
          ? <LeagueSwitcher leagues={leagues} activeLeague={activeLeague} isAdmin={isAdmin} onLeagueChange={onLeagueChange} onLeagueCreated={onLeagueCreated} onLeagueUpdated={onLeagueUpdated} />
          : <span onClick={() => window.location.assign("/")} style={{ cursor: "pointer", display: "inline-flex" }} title={t("pub_to_app")}><Logo height={20} /></span>}
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
