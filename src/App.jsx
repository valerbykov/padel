// App.jsx — корень приложения.
// Показывает приложение лиги сразу. Сверху панель: «Войти» для гостей,
// имя + «Выйти» для авторизованных. Определяет группы пользователя (leagues)
// и прокидывает активную лигу в PadelLeague. Ссылка /j/CODE открывает экран гостя.
import React, { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import { supabase } from "./lib/supabase";
import { handleAuthCallbackUrl, handleYandexCallback, handleTelegramCallback } from "./lib/auth";
import { cachePeek, cacheSet } from "./lib/cache";
import { runBack, registerBack } from "./lib/backstack";
import Avatar from "./components/Avatar";
import Logo from "./components/Logo"; // текстовый логотип в топбаре для гостя
import LeagueSwitcher from "./components/LeagueSwitcher"; // глобальный переключатель лиги в топбаре
import NotificationBell from "./components/NotificationBell"; // колокольчик уведомлений (новые игры/турниры лиг)
import { LogIn, Sun, Moon } from "lucide-react";
import { getMyLeagues, refreshMyLeagues, bootstrapApp, joinLeague } from "./lib/padelApi";
import { findMyTournamentByCode, findMyGameByCode } from "./lib/routeResolvers";
import { t, setLang, applyLang } from "./lib/i18n";
import { detectCountry, langFromCountry } from "./lib/region";
import { getNotifPrefs, registerPush, updateNotifLang } from "./lib/notifications";

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
// Есть ли сохранённая сессия Supabase (ключ sb-<ref>-auth-token). Греем тяжёлые
// чанки ТОЛЬКО залогиненному: гостю на лендинге PadelLeague/Tournaments не нужны,
// а их парс зря грузит главный поток (бил Lighthouse TBT ~59K unused JS у гостя).
function hasStoredSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token") && localStorage.getItem(k)) return true;
    }
  } catch (e) { /* приват-режим */ }
  return false;
}
const _warm = typeof window !== "undefined" && hasStoredSession();
// Тёплый старт для ЗАЛОГИНЕННОГО: тяжёлый чанк лиги качаем СРАЗУ, параллельно с auth
// и данными (иначе загрузка стартует только после profiles+лиг). Vite дедупит
// динамический импорт — lazy() выше получит уже скачанный модуль.
if (_warm) setTimeout(() => { import("./PadelLeague").catch(() => {}); }, 0);
// ЛК открывают часто — греем его чанк на холостом ходу (после критического пути).
if (_warm) setTimeout(() => { import("./components/ProfileEditor").catch(() => {}); }, 3500);
const WelcomeScreen    = lazy(() => import("./components/WelcomeScreen"));
const LoginScreen      = lazy(() => import("./components/LoginScreen"));
const ProfileEditor    = lazy(() => import("./components/ProfileEditor"));
const LeagueSetup      = lazy(() => import("./components/LeagueSetup"));
const LeaguePublicPage = lazy(() => import("./components/LeaguePublicPage"));
const GuestJoin        = lazy(() => import("./components/GuestJoin"));
const TournamentJoin   = lazy(() => import("./components/TournamentJoin"));
const ClaimProfile     = lazy(() => import("./components/ClaimProfile"));
const TgNativeBridge   = lazy(() => import("./components/TgNativeBridge"));
const TvBoard          = lazy(() => import("./components/TvBoard"));

const BOT_NAME = "padelacc_bot"; // имя твоего Telegram-бота без @

// Длина кода — диапазон, НЕ ровно 4: клиентские genCode стали 6 символов
// (было 4), демо-игры — 8. Жёсткое {4} роняло /j/ и /t/ новых кодов на welcome.
function getInviteCode() {
  const m = window.location.pathname.match(/^\/j\/([A-Za-z0-9]{4,12})$/);
  return m ? m[1].toUpperCase() : null;
}

function getTournamentCode() {
  const m = window.location.pathname.match(/^\/t\/([A-Za-z0-9]{4,12})$/);
  return m ? m[1].toUpperCase() : null;
}

function getClaimCode() {
  const m = window.location.pathname.match(/^\/r\/([0-9a-f-]{36})$/i);
  return m ? m[1].toLowerCase() : null;
}

function getLeaguePublicCode() {
  const m = window.location.pathname.match(/^\/l\/([A-Za-z0-9]{4,12})$/i);
  return m ? m[1].toUpperCase() : null;
}

// /tv/CODE — публичное ТВ-табло турнира (без логина, только чтение).
const getTvCode = () => {
  const m = window.location.pathname.match(/^\/tv\/([A-Za-z0-9]{4,12})$/i);
  return m ? m[1] : null;
};

export default function App({ initialShowLogin = false }) {
  const [session,      setSession]      = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [leagues,      setLeagues]      = useState(null);   // null = загружается
  const [activeLeague, setActiveLeague] = useState(null);   // { id, name, invite_code, role }
  const [tourRoute, setTourRoute] = useState(null);          // /t/CODE у залогиненного: null=решаем, "inapp"|"public"
  const [leagueRoute, setLeagueRoute] = useState(null);      // /l/CODE у залогиненного: null=решаем, "inapp"|"public"
  const [gameRoute, setGameRoute] = useState(null);          // /j/CODE у залогиненного: null=решаем, "inapp"|"public"
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
  const handleLangChange = useCallback(async (l) => { await setLang(l); setLangState(l); updateNotifLang(l); }, []);

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
  const [analyticsNonce] = useState(0); // открыть аналитику лиги из шапки
  const [openEvent, setOpenEvent] = useState(null); // {kind:'game'|'tour', id, groupId, nonce} — открыть игру/турнир из уведомления
  // «Подробнее о PadelPack» → полноэкранный лендинг (статическая маркетинговая страница).
  const openLanding = useCallback(() => { window.location.href = "/landing.html"; }, []);

  // Нативный статус-бар (Android/iOS) — EDGE-TO-EDGE. Android 15 (targetSdk 35+)
  // принудительно включает отображение от края до края и объявил устаревшими
  // Window.setStatusBarColor / setNavigationBarColor (Play помечает их
  // предупреждением). Поэтому цвет бара НЕ красим — вместо этого пускаем webview
  // под статус-бар (overlay:true), а его фон закрывает шапка/навбар, у которых
  // есть отступы env(safe-area-inset-*). Оставляем только setStyle — он меняет
  // контраст иконок через WindowInsetsController и не устарел.
  useEffect(() => {
    const Cap = window.Capacitor;
    const SB = Cap?.Plugins?.StatusBar;
    if (!SB) return;
    const dark = theme !== "light";
    if (Cap.getPlatform && Cap.getPlatform() === "android") {
      SB.setOverlaysWebView({ overlay: true }).catch(() => {});
    }
    SB.setStyle({ style: dark ? "DARK" : "LIGHT" }).catch(() => {}); // DARK = светлые иконки (для тёмного фона)
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
  const tvCode          = getTvCode();

  // ?join=CODE — автозаполнение формы вступления в лигу. В нативной обёртке
  // полная навигация webview теряет query, поэтому публичная страница лиги
  // дублирует код в localStorage (pp_pending_join) — читаем оба источника.
  // ВАЖНО: инициализатор ЧИСТЫЙ — конкурентный рендер (Suspense-ретраи) может
  // выполнить его несколько раз, и побочный consume здесь терял код (форма
  // вступления молча не открывалась). Эффекты — ниже, после коммита.
  const [pendingJoin, setPendingJoin] = useState(() => {
    const p = new URLSearchParams(window.location.search).get("join")?.toUpperCase();
    let ls = null;
    try { ls = localStorage.getItem("pp_pending_join"); } catch (e) {}
    return p || (ls ? ls.toUpperCase() : null);
  });
  useEffect(() => {
    // Код держим в localStorage до успешного вступления/отказа (onDone/onCancel):
    // так он переживает и OAuth-редирект логина, и перезагрузку webview.
    if (pendingJoin) { try { localStorage.setItem("pp_pending_join", pendingJoin); } catch (e) {} }
    if (new URLSearchParams(window.location.search).get("join")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const clearPendingJoin = useCallback(() => {
    setPendingJoin(null);
    try { localStorage.removeItem("pp_pending_join"); } catch (e) {}
  }, []);

  // Universal/App Links: https://padelpack.app/{l|j|t|r}/CODE, открытые в нативной обёртке,
  // прилетают как событие appUrlOpen (webview грузит свой bundle, а не внешний URL),
  // поэтому путь достаём вручную и «навешиваем» на роутер (getLeaguePublicCode и т.п.
  // читают window.location.pathname при рендере). routeNonce форсит перерендер.
  const [, setRouteNonce] = useState(0);
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
      // Нативный возврат Yandex ID SDK (yx<clientid>://finish?code=…) полностью
      // обрабатывается натив­но (AppDelegate→SDK→плагин отдаёт token). У него свой
      // ?code — яндексовый, не Supabase-PKCE. JS его не трогает, иначе
      // handleAuthCallbackUrl зря дёргает exchangeCodeForSession → 400.
      if (/^yx[0-9a-f]{16,}:/i.test(url)) return;
      if (routeFromUrl(url)) return;                                          // app link на лигу/игру/турнир
      if (url.includes("tgauth=1")) { await handleTelegramCallback(url); return; } // возврат Telegram-моста
      if (!(await handleYandexCallback(url))) await handleAuthCallbackUrl(url); // иначе — auth-callback
    });
    // Capacitor 8: addListener может вернуть handle напрямую ИЛИ Promise<handle>
    if (res && typeof res.then === "function") res.then((h) => { sub = h; });
    else sub = res;
    return () => { sub?.remove?.(); };
  }, []);

  // Модалки App-уровня в back-stack: аппаратная «Назад» закрывает их, а не выходит.
  useEffect(() => { if (showProfile) return registerBack(() => setShowProfile(false)); }, [showProfile]);
  useEffect(() => { if (showLogin) return registerBack(() => setShowLogin(false)); }, [showLogin]);

  // Аппаратная кнопка «Назад» (Android): сначала закрываем верхний открытый слой
  // (модалку/под-экран через back-stack); если закрывать нечего — сворачиваем
  // приложение (а не выходим). На вебе плагина нет — эффект ничего не делает.
  useEffect(() => {
    const CapApp = window.Capacitor?.Plugins?.App;
    if (!CapApp) return;
    let sub;
    const res = CapApp.addListener("backButton", () => {
      if (runBack()) return;                 // закрыли модалку/под-экран
      (CapApp.minimizeApp ? CapApp.minimizeApp() : CapApp.exitApp?.());
    });
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

  // Профиль + ЛИГИ + лидерборд активной лиги — ОДНИМ запросом (app_bootstrap):
  // раньше холодный старт делал каскад из 3-4 последовательных запросов
  // (profiles → group_members → leaderboard → counts), на медленной сети это и
  // был «разогрев» до списка друзей. Инстант-пейнт из кэша сохранён; если RPC
  // ещё не задеплоен — фолбэк на старый путь (profiles + loadLeagues-каскад).
  const bootBusyRef = useRef(false); // бутстрап в полёте/успешен → каскад лиг не нужен
  useEffect(() => {
    let active = true;
    if (!session) { setProfile(null); return; }
    const user = session.user;            // уже есть из getSession — без лишнего getUser()
    if (!user) return;
    const key = "profile:" + user.id;
    const cached = cachePeek(key);
    if (cached && active) setProfile(cached);
    bootBusyRef.current = true;
    (async () => {
      let savedId = null;
      try { savedId = localStorage.getItem("plActiveLeague"); } catch (e) { /* ignore */ }
      const boot = await bootstrapApp(savedId);
      if (!active) { bootBusyRef.current = false; return; }
      if (boot) {
        cacheSet(key, boot.profile);
        setProfile(boot.profile);
        setLeagues(boot.leagues);
        setActiveLeague((prev) =>
          boot.leagues.find((l) => l.id === prev?.id) ||
          boot.leagues.find((l) => l.id === boot.activeGroupId) ||
          boot.leagues[0] || null);
        return; // bootBusyRef остаётся true — эффект лиг ниже пропустит каскад
      }
      // Фолбэк (app_bootstrap не задеплоен): старый путь.
      bootBusyRef.current = false;
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (active && data) { setProfile(data); cacheSet(key, data); }
      // Сеть не отдала профиль, но есть кэш — хотя бы запускаем каскад лиг по нему
      // (setProfile(cached) выше эффект лиг пропустил из-за bootBusyRef).
      // eslint-disable-next-line no-use-before-define -- вызов асинхронный (после монтирования), loadLeagues к тому моменту определён
      else if (active && cached) loadLeagues(cached.id);
    })();
    return () => { active = false; };
  }, [session, pNonce]);

  // Push-напоминания: при наличии сессии в нативке регистрируем/обновляем FCM-токен,
  // если у пользователя включены уведомления. Веб/PWA — эффект тихо ничего не делает.
  useEffect(() => {
    if (!session || !window.Capacitor?.isNativePlatform?.()) return;
    let alive = true;
    // Отложено: не конкурируем с критическим путём (bootstrap+чанк) за канал.
    const tm = setTimeout(async () => {
      try { const { enabled } = await getNotifPrefs(); if (alive && enabled) await registerPush(); }
      catch (e) { /* ignore */ }
    }, 2500);
    return () => { alive = false; clearTimeout(tm); };
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
    // Отметка не срочная — уступаем канал критическому пути холодного старта.
    const tm = setTimeout(async () => {
      try { await supabase.rpc("touch_last_seen"); } catch (e) { /* тихо игнорируем */ }
    }, 2000);
    return () => clearTimeout(tm);
  }, [session]);

  // Загрузить список лиг пользователя. loadLeaguesRef — для ретрая из catch
  // (объявлен до useCallback, иначе TDZ).
  const loadLeaguesRef = useRef(null);
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
    } catch {
      // Сетевой сбой ≠ «нет лиг»: раньше ставили [] и Board уходил в соло-режим
      // «Играли вместе» (все «не в лиге») до ручного обновления. Прежний список
      // не трогаем; если его ещё нет (холодный старт) — остаёмся в загрузке
      // (skeleton) и повторяем через 3с, пока не получится.
      setLeagues((prev) => {
        if (prev) return prev;
        setTimeout(() => loadLeaguesRef.current?.(pid), 3000);
        return null;
      });
    }
  }, []);
  useEffect(() => { loadLeaguesRef.current = loadLeagues; }, [loadLeagues]);

  useEffect(() => {
    if (!profile) { setLeagues(null); setActiveLeague(null); return; }
    // Бутстрап сам ставит лиги (или уже поставил) — не дублируем запрос group_members.
    if (bootBusyRef.current) return;
    loadLeagues(profile.id);
  }, [profile, loadLeagues]);

  // Роли (owner/admin/member) живут в leagues и грузятся при старте; если права
  // сняли, пока приложение открыто, UI продолжал их показывать до жёсткого F5
  // (сервер при этом уже всё запрещал). Ревалидируем список при возврате фокуса,
  // не чаще раза в минуту.
  const lastRolesRef = useRef(0);
  useEffect(() => {
    if (!profile?.id) return;
    const pid = profile.id;
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (Date.now() - lastRolesRef.current < 60e3) return;
      lastRolesRef.current = Date.now();
      refreshMyLeagues(pid).then((list) => {
        setLeagues(list);
        setActiveLeague((prev) => list.find((l) => l.id === prev?.id) || list[0] || null);
      }).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [profile?.id]);

  // Запоминаем последнюю активную лигу, чтобы она не слетала после обновления страницы.
  useEffect(() => {
    if (activeLeague?.id) localStorage.setItem("plActiveLeague", activeLeague.id);
  }, [activeLeague?.id]);

  // Когда пользователь создал/вступил в лигу из LeagueSetup.
  // Оптимистично добавляем возврат RPC, но список перечитываем с сервера:
  // join_league может вернуть не полную строку лиги (без id) — тогда локальное
  // состояние ломалось («вступил, а лиги нет»), хотя вступление записано.
  const handleLeagueDone = useCallback(async (league) => {
    const prevIds = new Set((leagues || []).map((l) => l.id));
    if (league?.id) {
      setLeagues((p) => [...(p || []), league]);
      setActiveLeague(league);
    }
    if (!profile?.id) return;
    try {
      const list = await getMyLeagues(profile.id); // кэш сброшен bustCache() в joinLeague
      setLeagues(list);
      setActiveLeague((cur) => {
        if (league?.id) return list.find((l) => l.id === league.id) || cur;
        return list.find((l) => !prevIds.has(l.id)) || cur;
      });
    } catch (e) { /* останемся на оптимистичном состоянии */ }
  }, [leagues, profile?.id]);

  // Смена активной лиги из dropdown.
  // Автовступление по ?join=CODE: код уже пришёл по ссылке/QR — не заставляем
  // подтверждать его формой. Форма (LeagueSetup) остаётся фолбэком при ошибке.
  const [autoJoinErr, setAutoJoinErr] = useState("");
  const autoJoinRef = useRef(false);
  useEffect(() => {
    if (!(pendingJoin && session && profile && leagues !== null)) return;
    if (autoJoinRef.current || autoJoinErr) return;
    const existing = (leagues || []).find((l) => l.invite_code === pendingJoin);
    if (existing) { clearPendingJoin(); setActiveLeague(existing); return; }
    autoJoinRef.current = true;
    joinLeague(pendingJoin)
      .then((lg) => { clearPendingJoin(); return handleLeagueDone(lg); })
      .catch((e) => {
        const msg = e?.message || "";
        if (msg.includes("already_member")) { clearPendingJoin(); loadLeagues(profile.id); }
        else setAutoJoinErr(msg.includes("league_not_found") ? t("err_league_not_found") : (msg || t("err_generic")));
      })
      .finally(() => { autoJoinRef.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJoin, session, profile, leagues]);

  const handleLeagueChange = useCallback((leagueId) => {
    setActiveLeague((prev) => leagues?.find((l) => l.id === leagueId) || prev);
  }, [leagues]);

  // Тап по уведомлению в колокольчике: переключаем лигу (если событие из другой)
  // и просим PadelLeague открыть игру/турнир ВНУТРИ приложения (не гостевую ссылку).
  const handleOpenEvent = useCallback((evt) => {
    if (!evt?.id) return;
    if (evt.groupId) setActiveLeague((prev) => (prev?.id === evt.groupId ? prev : (leagues || []).find((l) => l.id === evt.groupId) || prev));
    setOpenEvent((p) => ({ ...evt, nonce: (p?.nonce || 0) + 1 }));
  }, [leagues]);

  // /t/CODE у ЗАЛОГИНЕННОГО: турнир из его лиги открываем ВНУТРИ приложения (как тап
  // из Истории), а не публичной страницей «как гость». RLS-запрос вернёт строку
  // только участнику лиги; не участник/гость → публичная TournamentJoin.
  useEffect(() => {
    if (!tournamentCode) { setTourRoute(null); return; }
    if (!session) { setTourRoute("public"); return; }
    if (!profile || leagues === null) return;              // ждём профиль/лиги
    let alive = true;
    findMyTournamentByCode(tournamentCode).then((tt) => {
      if (!alive) return;
      const lg = tt?.group_id && (leagues || []).find((l) => l.id === tt.group_id);
      if (lg && tt?.id) {
        setActiveLeague(lg);
        handleOpenEvent({ kind: "tour", id: tt.id, groupId: lg.id });
        setTourRoute("inapp");
        try { window.history.replaceState({}, "", "/"); } catch (e) { /* приват/SSR */ }
      } else setTourRoute("public");
    }).catch(() => { if (alive) setTourRoute("public"); });
    return () => { alive = false; };
  }, [tournamentCode, session, profile, leagues, handleOpenEvent]);

  // /l/CODE у ЗАЛОГИНЕННОГО: если это ЕГО лига (код среди загруженных) — открываем её
  // в приложении (доска), а не публичной страницей «как гость». Не участник → публичная.
  useEffect(() => {
    if (!leaguePublicCode) { setLeagueRoute(null); return; }
    if (!session) { setLeagueRoute("public"); return; }
    if (leagues === null) return;                          // ждём список лиг
    const lg = (leagues || []).find((l) => l.invite_code === leaguePublicCode);
    if (lg) {
      setActiveLeague(lg);
      setLeagueRoute("inapp");
      try { window.history.replaceState({}, "", "/"); } catch (e) { /* приват/SSR */ }
    } else setLeagueRoute("public");
  }, [leaguePublicCode, session, leagues]);

  // /j/CODE у ЗАЛОГИНЕННОГО: игра из его лиги → ин-апп вид игры (как тап из «Игр»), а не
  // гостевая страница. RLS-запрос вернёт строку только участнику лиги.
  useEffect(() => {
    if (!inviteCode) { setGameRoute(null); return; }
    if (!session) { setGameRoute("public"); return; }
    if (!profile || leagues === null) return;
    let alive = true;
    findMyGameByCode(inviteCode).then((g) => {
      if (!alive) return;
      const lg = g?.group_id && (leagues || []).find((l) => l.id === g.group_id);
      if (lg && g?.id) {
        setActiveLeague(lg);
        handleOpenEvent({ kind: "game", id: g.id, groupId: lg.id });
        setGameRoute("inapp");
        try { window.history.replaceState({}, "", "/"); } catch (e) { /* приват/SSR */ }
      } else setGameRoute("public");
    }).catch(() => { if (alive) setGameRoute("public"); });
    return () => { alive = false; };
  }, [inviteCode, session, profile, leagues, handleOpenEvent]);

  // Лигу отредактировали в окне управления (имя/логотип/телеграм) — мёржим.
  const handleLeagueUpdated = useCallback((lg) => {
    if (!lg?.id) return;
    setLeagues((prev) => (prev || []).map((l) => (l.id === lg.id ? { ...l, ...lg } : l)));
    setActiveLeague((prev) => (prev && prev.id === lg.id ? { ...prev, ...lg } : prev));
  }, []);

  // Пользователь покинул лигу или удалил её: убираем из списка; если она была
  // активной — переключаемся на первую оставшуюся.
  const handleLeagueLeft = useCallback((gid) => {
    const next = (leagues || []).filter((l) => l.id !== gid);
    setLeagues(next);
    setActiveLeague((prev) => (prev && prev.id === gid ? next[0] || null : prev));
    try { if (localStorage.getItem("pp_demo_gid") === gid) localStorage.removeItem("pp_demo_gid"); } catch (e) {}
  }, [leagues]);

  const isAdmin = !!(activeLeague && (activeLeague.role === "owner" || activeLeague.role === "admin"));

  // #7: ЛК теперь всплывающее окно (ProfileEditor сам портелится в body), а не
  // отдельный полноэкранный маршрут — рендерим поверх приложения там, где есть топбар.
  const profileModal = (showProfile && session) ? (
    <ProfileEditor onClose={() => setShowProfile(false)} onSaved={() => setPNonce((n) => n + 1)} theme={theme}
      lang={lang} onThemeToggle={toggleTheme} onLangChange={handleLangChange}
      profile={profile} activeLeague={activeLeague} leagueCount={(leagues || []).length}
      onOpenStats={() => { setShowProfile(false); setStatsNonce((n) => n + 1); }} />
  ) : null;

  // Страница-мост Telegram для нативного входа (открывается в системном браузере).
  if (typeof window !== "undefined" && window.location.pathname === "/tg-native")
    return <TgNativeBridge botName={BOT_NAME} />;

  // Спиннер, пока резолвим доступ залогиненного к гостевой ссылке (/l/, /j/, /t/):
  // не мигаем публичной страницей, участника уводим в ин-апп (эффекты выше).
  const routeSpinner = (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", border: "3px solid rgba(255,255,255,.12)", borderTopColor: "var(--lime, #c8ff2d)", animation: "appspin .7s linear infinite" }} />
      <style>{`@keyframes appspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // /tv/CODE — публичное ТВ-табло турнира (без логина; поллинг публичного RPC).
  if (tvCode) return (
    <Suspense fallback={routeSpinner}>
      <TvBoard code={tvCode} />
    </Suspense>
  );

  // /l/CODE — публичная страница лиги. Залогиненный УЧАСТНИК → своя лига в приложении.
  if (leaguePublicCode && leagueRoute !== "inapp") {
    if (!session || leagueRoute === "public") return <LeaguePublicPage code={leaguePublicCode} />;
    return routeSpinner;
  }

  // /j/CODE — вступление в игру. Залогиненный участник лиги → ин-апп вид игры.
  if (inviteCode && gameRoute !== "inapp") {
    if (!session || gameRoute === "public") return <GuestJoin code={inviteCode} botName={BOT_NAME} />;
    return routeSpinner;
  }

  // /t/CODE — турнир (эффект выше). Залогиненный участник → ин-апп вьюха.
  if (tournamentCode && tourRoute !== "inapp") {
    if (!session || tourRoute === "public") return <TournamentJoin code={tournamentCode} botName={BOT_NAME} />;
    return routeSpinner;
  }
  if (claimCode)     return <ClaimProfile code={claimCode} botName={BOT_NAME} />;

  // Явно открыли экран входа.
  if (showLogin && !session)
    return <LoginScreen botName={BOT_NAME} onSuccess={() => setShowLogin(false)} onBack={() => setShowLogin(false)} theme={theme} lang={lang} onThemeToggle={toggleTheme} onLangChange={handleLangChange} />;

  // Переход по ?join=CODE: автовступление крутит спиннер; форма — фолбэк при ошибке.
  if (pendingJoin && session && profile && leagues !== null && !autoJoinErr) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", border: "3px solid rgba(255,255,255,.12)", borderTopColor: "var(--lime, #c8ff2d)", animation: "appspin .7s linear infinite" }} />
        <style>{`@keyframes appspin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ color: "var(--mut)", fontSize: 14, fontFamily: "'Outfit',sans-serif" }}>{t("pj_joining")}</div>
      </div>
    );
  }
  if (pendingJoin && session && profile && leagues !== null) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <TopBar
          session={session} name={profile?.name} avatarUrl={profile?.avatar_url} avatarId={profile?.id}
          onLogin={() => setShowLogin(true)}
          onProfile={() => setShowProfile(true)}
          onSignOut={() => supabase.auth.signOut()}
          theme={theme} onThemeToggle={toggleTheme}
          lang={lang} onLangChange={handleLangChange}
          leagues={leagues || []} leaguesReady={leagues !== null} activeLeague={activeLeague} isAdmin={isAdmin}
          onLeagueChange={handleLeagueChange} onLeagueCreated={handleLeagueDone}
          onLeagueUpdated={handleLeagueUpdated} onLeagueLeft={handleLeagueLeft} onOpenEvent={handleOpenEvent}
        />
        <LeagueSetup
          onDone={(league) => { clearPendingJoin(); setAutoJoinErr(""); handleLeagueDone(league); }}
          onCancel={() => { clearPendingJoin(); setAutoJoinErr(""); }}
          initialMode="join"
          initialCode={pendingJoin}
        />
        {profileModal}
      </div>
    );
  }

  // Гость (без сессии): лёгкий экран «Начало» БЕЗ TopBar/PadelLeague/Tournaments —
  // весь тяжёлый чанк лиги грузится только после входа. Публичные маршруты и
  // экран входа обработаны выше ранними return'ами.
  if (!session)
    return (
      <WelcomeScreen
        onLogin={() => setShowLogin(true)}
        onOpenLanding={openLanding}
        theme={theme}
        lang={lang}
        onThemeToggle={toggleTheme}
        onLangChange={handleLangChange}
      />
    );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <TopBar
        session={session}
        name={profile?.name}
        avatarUrl={profile?.avatar_url} avatarId={profile?.id}
        onLogin={() => setShowLogin(true)}
        onProfile={() => setShowProfile(true)}
        onSignOut={() => supabase.auth.signOut()}
        theme={theme}
        onThemeToggle={toggleTheme}
        lang={lang}
        onLangChange={handleLangChange}
        leagues={leagues || []}
        leaguesReady={leagues !== null}
        activeLeague={activeLeague}
        isAdmin={isAdmin}
        onLeagueChange={handleLeagueChange}
        onLeagueCreated={handleLeagueDone}
        onLeagueUpdated={handleLeagueUpdated}
        onLeagueLeft={handleLeagueLeft}
        onOpenEvent={handleOpenEvent}
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
        openEvent={openEvent}
        profileNonce={pNonce}
      />
      {profileModal}
    </div>
  );
}

function TopBar({ session, name, avatarUrl, avatarId, onLogin, onProfile, theme, onThemeToggle, lang = "ru", onLangChange, leagues = [], leaguesReady = true, activeLeague = null, isAdmin = false, onLeagueChange, onLeagueCreated, onLeagueUpdated, onLeagueLeft, onOpenEvent }) {
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
          ? <LeagueSwitcher leagues={leagues} leaguesReady={leaguesReady} activeLeague={activeLeague} isAdmin={isAdmin} onLeagueChange={onLeagueChange} onLeagueCreated={onLeagueCreated} onLeagueUpdated={onLeagueUpdated} onLeagueLeft={onLeagueLeft} />
          : <span onClick={() => window.location.assign("/")} style={{ cursor: "pointer", display: "inline-flex" }} title={t("pub_to_app")}><Logo height={20} /></span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* Сегмент: тема (всегда) + язык (только гостям — у залогиненных язык в ЛК,
            освобождаем место под колокольчик). */}
        <div style={{ display: "flex", gap: 4, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: 3 }}>
          {!session && (
            <button className="tb-btn" onClick={() => { const o = ["ru","en","es"]; onLangChange?.(o[(o.indexOf(lang) + 1) % o.length]); }}
              title="RU / EN / ES"
              style={{ border: "none", background: "none", color: "var(--ink)", padding: "5px 9px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, borderRadius: 9, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
              {lang.toUpperCase()} <span style={{ color: "var(--mut)", fontWeight: 400, fontSize: 13 }}>↻</span>
            </button>
          )}
          <button className="tb-btn" onClick={onThemeToggle} aria-label={t("aria_theme")} title={t(theme === "dark" ? "theme_to_light" : "theme_to_dark")}
            style={{ border: "none", background: "none", color: "var(--mut)", display: "flex", alignItems: "center", padding: "5px 8px", borderRadius: 9, cursor: "pointer" }}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
        {/* Колокольчик уведомлений — только для залогиненных с лигами */}
        {session && <NotificationBell leagues={leagues} activeLeague={activeLeague} onOpen={onOpenEvent} />}
        {/* СПРАВА: профиль (только иконка) для залогиненного, иначе «Войти» */}
        {session ? (
          <button onClick={onProfile} className="tb-profile" aria-label={name || t("pc_title")} title={name || t("pc_title")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid transparent", borderRadius: 999, cursor: "pointer", padding: 2, transition: "background .15s" }}>
            <Avatar url={avatarUrl} id={avatarId} name={name} size={32} />
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
