// components/LeaguePublicPage.jsx
// Публичная страница лиги /l/:code — без авторизации.
// Показывает афишу событий (герой + лента + пульс), рейтинг игроков, кнопку
// «Вступить» и вирусный CTA «Создать лигу».
import React, { useEffect, useState } from "react";
import { Send, Tv } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getPublicLeague } from "../lib/padelApi";
import { t, nGames , dateLocale} from "../lib/i18n";
import { playerAvatar, avatarFallback , avatarBg, avatarOnLoad} from "../lib/avatar";
import { formatMoney } from "../lib/money";
import { EventLevelBadge } from "./LevelBadges";
import { usePublicChrome, PublicToggles, plural } from "./publicChrome";
import Logo from "./Logo";
import LeagueLogo from "./LeagueLogo";
import OpenInApp from "./OpenInApp";
import LoginScreen from "./LoginScreen";
import { useIsWide } from "./wide/wide";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.lp-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;--yellow:#ffd23f;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;
 background-image:radial-gradient(circle at 80% -10%,rgba(200,255,45,.12),transparent 45%),radial-gradient(circle at 0% 110%,rgba(40,120,90,.18),transparent 40%);}
.lp-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;}
.lp-d{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.lp-join-btn{display:block;width:100%;padding:17px;background:var(--lime);color:var(--lime-fg);border:none;border-radius:16px;
 font-family:'Outfit',sans-serif;font-weight:800;font-size:17px;text-align:center;text-decoration:none;
 cursor:pointer;box-sizing:border-box;transition:filter .12s;}
.lp-join-btn:hover{filter:brightness(1.08);}

/* ── Афиша: герой ─────────────────────────────────────────────────────── */
.lp-hero{position:relative;overflow:hidden;border-radius:22px;border:1px solid var(--line);
 background:linear-gradient(155deg,color-mix(in srgb,var(--lime) 16%,var(--surface2)) 0%,var(--surface2) 55%,var(--surface) 100%);
 padding:24px 24px 20px;margin-bottom:22px;}
.lp-hero::before{content:"";position:absolute;right:-70px;top:-40px;width:340px;height:150%;
 background:linear-gradient(115deg,transparent 0%,transparent 40%,color-mix(in srgb,var(--lime) 20%,transparent) 40%,color-mix(in srgb,var(--lime) 20%,transparent) 58%,transparent 58%);
 transform:rotate(6deg);pointer-events:none;}
.lp-hero-mascot{position:absolute;right:14px;bottom:-6px;font-size:74px;opacity:.14;transform:rotate(-8deg);pointer-events:none;}
.lp-status-pill{display:inline-flex;align-items:center;gap:7px;background:var(--surface2);border:1px solid color-mix(in srgb,var(--lime) 45%,transparent);
 color:var(--lime);font-size:10.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;border-radius:999px;padding:5px 12px;margin-bottom:14px;position:relative;z-index:2;}
.lp-status-dot{width:7px;height:7px;border-radius:50%;background:var(--lime);animation:lp-pulse 1.6s infinite;flex-shrink:0;}
@keyframes lp-pulse{0%,100%{opacity:1}50%{opacity:.3}}
.lp-hero-title{font-family:'Anton',sans-serif;font-size:clamp(26px,4.4vw,38px);line-height:1.03;color:var(--ink);
 letter-spacing:.2px;text-transform:uppercase;margin-bottom:12px;position:relative;z-index:2;overflow-wrap:anywhere;}
.lp-hero-meta{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13.5px;color:var(--ink);margin-bottom:16px;position:relative;z-index:2;}
.lp-hero-fee{background:color-mix(in srgb,var(--lime) 14%,transparent);border:1px solid color-mix(in srgb,var(--lime) 42%,transparent);
 color:var(--lime);font-weight:700;font-size:12px;padding:2px 10px;border-radius:999px;}
.lp-hero-foot{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;position:relative;z-index:2;}
.lp-going-txt{font-size:12.5px;color:var(--mut);line-height:1.4;}
.lp-going-txt b{color:var(--ink);}
.lp-pulseline{color:var(--lime);font-weight:600;}
.lp-go-btn{background:var(--lime);color:var(--lime-fg);font-weight:800;font-size:14.5px;border:none;border-radius:13px;
 padding:12px 22px;text-decoration:none;display:inline-block;box-shadow:0 10px 24px -10px color-mix(in srgb,var(--lime) 70%,transparent);}
.lp-full-tag{background:var(--surface2);color:var(--mut);border:1px solid var(--line);font-weight:700;font-size:12px;border-radius:999px;padding:8px 16px;}
.lp-seats{font-family:'Anton',sans-serif;font-size:19px;white-space:nowrap;}

/* ── Секции ────────────────────────────────────────────────────────────── */
.lp-cap{font-size:10px;font-weight:800;color:var(--mut);letter-spacing:2px;margin:22px 0 12px;text-transform:uppercase;}

/* ── Таймлайн «Дальше в лиге» ──────────────────────────────────────────── */
.lp-tl-row{display:flex;gap:14px;align-items:center;padding:13px 4px;border-bottom:1px solid var(--line);}
.lp-tl-row:last-child{border-bottom:none;}
.lp-date{width:44px;flex:none;text-align:center;}
.lp-date-dd{font-family:'Anton',sans-serif;font-size:20px;line-height:1;color:var(--ink);}
.lp-date-mm{font-size:9.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);margin-top:2px;}
.lp-tl-mid{flex:1;min-width:0;}
.lp-tl-name{font-size:15px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink);}
.lp-tl-meta{display:flex;flex-wrap:wrap;gap:3px 10px;font-size:12px;color:var(--mut);margin-top:3px;align-items:center;}
.lp-fillbar{height:4px;border-radius:999px;background:var(--surface2);overflow:hidden;margin-top:7px;max-width:220px;}
.lp-fillbar i{display:block;height:100%;background:var(--lime);}
.lp-fillbar i.hot{background:var(--coral);}
.lp-tl-right{display:flex;align-items:center;gap:10px;flex:none;}
.lp-mini-btn{background:var(--lime);color:var(--lime-fg);font-weight:700;font-size:12px;border-radius:9px;padding:6px 12px;text-decoration:none;white-space:nowrap;}
.lp-mini-tag{background:var(--surface2);border:1px solid var(--line);color:var(--mut);font-weight:700;font-size:11.5px;border-radius:9px;padding:6px 10px;white-space:nowrap;}
.lp-live-tag{font-size:9.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:var(--yellow);white-space:nowrap;}

/* ── «Было круто» ──────────────────────────────────────────────────────── */
.lp-spines{display:flex;gap:8px;flex-wrap:wrap;}
.lp-spine{border:1px solid var(--line);border-radius:9px;padding:6px 11px;font-size:11.5px;color:var(--mut);filter:grayscale(1);opacity:.8;}
.lp-spine b{color:var(--ink);}

/* ── Свёрнутый рейтинг ─────────────────────────────────────────────────── */
.lp-fold{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 14px;display:flex;
 justify-content:space-between;align-items:center;font-size:13px;color:var(--mut);cursor:pointer;margin-bottom:14px;}
.lp-fold b{color:var(--ink);}

/* ── Стена ─────────────────────────────────────────────────────────────── */
.lp-wall{display:flex;flex-wrap:wrap;gap:6px;}
.lp-wall-more{width:34px;height:34px;border-radius:50%;background:var(--surface2);border:1px dashed var(--line);
 display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:var(--mut);flex-shrink:0;}

/* ── Пульс в сайдбаре / cold start ─────────────────────────────────────── */
.lp-side-pulse{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--mut);border-top:1px solid var(--line);
 margin-top:12px;padding-top:12px;line-height:1.4;}
.lp-side-pulse b{color:var(--ink);}
.lp-cold{text-align:center;padding:28px 20px;border:1px solid var(--line);border-radius:18px;background:var(--surface);margin-bottom:22px;}

/* ── Липкая CTA (телефон) ──────────────────────────────────────────────── */
.lp-sticky-cta{position:fixed;left:12px;right:12px;bottom:max(12px, env(safe-area-inset-bottom));background:var(--lime);
 color:var(--lime-fg);border-radius:15px;padding:13px 16px;display:flex;justify-content:space-between;align-items:center;
 gap:10px;font-weight:800;font-size:14px;text-decoration:none;box-shadow:0 -8px 30px -6px rgba(0,0,0,.4);z-index:50;}
.lp-sticky-cta small{font-weight:700;font-size:11px;opacity:.85;white-space:nowrap;}
`;

function Avatar({ name = "", url, size = 38 }) {
  return (
    <img src={playerAvatar(url, name)} onError={avatarFallback(name)} onLoad={avatarOnLoad} alt="" loading="lazy" decoding="async"
      style={{ ...avatarBg(name), width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "1.5px solid var(--line)", flexShrink: 0 }} />
  );
}

// Стопка перекрывающихся аватаров (кто идёт на событие) — как на карточке героя/в ленте.
function AvatarStack({ people = [], size = 28 }) {
  if (!people.length) return null;
  return (
    <div style={{ display: "flex" }}>
      {people.map((p, i) => (
        <div key={`${p.name}-${p.avatar_url ?? i}`} style={{ marginLeft: i === 0 ? 0 : -Math.round(size * 0.3), borderRadius: "50%", boxShadow: "0 0 0 2px var(--surface2)", lineHeight: 0 }}>
          <Avatar name={p.name} url={p.avatar_url} size={size} />
        </div>
      ))}
    </div>
  );
}

// Эмодзи формата — своя мини-карта (без импорта тяжёлого Tournaments.jsx ради
// пары иконок: увеличило бы чанк витрины). Игра (без формата) — 🎾.
const FORMAT_EMOJI = { americano: "🔄", mexicano: "📊", round_robin: "🔁", king_of_hill: "⛰️", beat_the_box: "📦" };
function eventEmoji(kind, format) { return kind === "game" ? "🎾" : (FORMAT_EMOJI[format] || "🏆"); }
function eventHref(e) { return `/${e.kind === "tournament" ? "t" : "j"}/${e.invite_code}`; }

// Дата+время («22 июл, 08:00») — той же локалью, что и остальное приложение.
function fmtDateTime(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(dateLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
}
function fmtTime(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
}
function fmtDay(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" }); }
  catch (e) { return ""; }
}
// Дата-якорь таймлайна: число + короткий месяц отдельно (под Anton-цифру).
function dateParts(iso) {
  if (!iso) return { dd: "", mm: "" };
  try {
    const d = new Date(iso);
    return { dd: d.toLocaleDateString(dateLocale(), { day: "numeric" }), mm: d.toLocaleDateString(dateLocale(), { month: "short" }).replace(/\.$/, "") };
  } catch (e) { return { dd: "", mm: "" }; }
}

// Относительное время «пульса лиги» — чистая функция, без библиотек.
// <1 мин → «только что»; <60 мин → «N мин назад»; <24 ч → «N ч назад»; иначе «N дн назад».
function relTime(iso) {
  if (!iso) return "";
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t("ago_just");
  if (mins < 60) return t("ago_min").replace("{n}", String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("ago_hour").replace("{n}", String(hours));
  const days = Math.floor(hours / 24);
  return t("ago_day").replace("{n}", String(days));
}

export default function LeaguePublicPage({ code }) {
  const [league, setLeague] = useState(undefined);
  const [err,    setErr]    = useState(null);
  const [session, setSession] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const { theme, lang, vars, toggleTheme, cycleLang } = usePublicChrome();
  // Десктоп-раскладка (≥900px) — хук строго до ранних return (showLogin/loading/error ниже).
  const isWide = useIsWide();
  // Свёртка полного рейтинга под подиумом — по умолчанию свёрнут (see mockup «▾»).
  const [ratingOpen, setRatingOpen] = useState(false);

  // Вход по хедерной кнопке «Войти» (общий паттерн публичных страниц) —
  // на этой странице раньше входа не было вовсе.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (s) setShowLogin(false); });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Публичный фетч по коду с РЕТРАЯМИ: свежесозданную лигу открывают по ссылке в
  // ту же секунду, а разовый таймаут/сбой сети (особенно через RU-прокси, где
  // rpc-POST не ретраится кастомным fetch) без ретрая оставлял «Лига не найдена»
  // до ручного релоада — отсюда «появилась только через пару минут». Пробуем
  // несколько раз (пока держим экран загрузки), потом уже показываем ошибку.
  useEffect(() => {
    let alive = true;
    let attempt = 0;
    let timer = null;
    const run = () => {
      if (!alive) return;
      getPublicLeague(code)
        .then((l) => { if (alive) setLeague(l); })
        .catch(() => {
          if (!alive) return;
          if (attempt < 4) { attempt += 1; timer = setTimeout(run, 1200); return; }
          setErr(t("err_league_not_found")); setLeague(null);
        });
    };
    run();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [code]);

  if (showLogin && !session) {
    return <LoginScreen onSuccess={() => setShowLogin(false)} onBack={() => setShowLogin(false)} theme={theme} lang={lang} onThemeToggle={toggleTheme} onLangChange={cycleLang} />;
  }

  const joinUrl   = `${window.location.origin}/?join=${code}`;
  const createUrl = window.location.origin;

  // Ширина контейнера: узко всегда 440px; расширяем только когда реально
  // рисуем двухколонник (лига загружена) — на loading/error экранах растягивать
  // одну строку/карточку на 980px незачем (мирроринг TournamentJoin: инлайн
  // maxWidth включается только для нужного состояния).
  const wideLayout = isWide && !!league;

  const membersCount = (league?.members || []).length;

  // Афиша: ближайшее «открытое» событие — герой, остальное — лента «Дальше в лиге».
  // Нет событий вовсе → cold start (герой/лента скрыты, «Было круто»/стена — как есть).
  const events = league?.events || [];
  const recentList = league?.recent || [];
  const heroEvent = events.find((e) => e.status === "open") || events[0] || null;
  const restEvents = heroEvent ? events.filter((e) => e !== heroEvent) : [];
  const coldStart = events.length === 0;
  const heroLive = !!heroEvent && (heroEvent.status === "active" || heroEvent.status === "live");
  const heroFull = !!heroEvent && heroEvent.taken >= heroEvent.target;
  const heroFree = heroEvent ? Math.max(0, heroEvent.target - heroEvent.taken) : 0;
  const heroHref = heroEvent ? eventHref(heroEvent) : null;
  // Липкая CTA на телефоне — только когда реально можно записаться или посмотреть.
  const showStickyCta = !wideLayout && !!heroEvent && (heroLive || !heroFull);

  return (
    <div className="lp-root" style={vars}>
      <style>{css}</style>
      <div style={{ maxWidth: wideLayout ? 980 : 440, margin: "0 auto", padding: `max(20px, env(safe-area-inset-top)) 16px calc(${showStickyCta ? 90 : 56}px + env(safe-area-inset-bottom))` }}>
        <PublicToggles theme={theme} lang={lang} onTheme={toggleTheme} onLang={cycleLang} onLogin={session ? undefined : () => setShowLogin(true)} />

        {/* Брендинг */}
        <div style={{ marginBottom: 22 }}><Logo height={24} /></div>

        {/* Загрузка / ошибка */}
        {league === undefined && (
          <div style={{ color: "var(--mut)", fontSize: 14 }}>{t("pub_loading")}</div>
        )}
        {err && (
          <div className="lp-card" style={{ padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏓</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("pub_league_notfound_t")}</div>
            <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 18 }}>
              {t("pub_league_notfound_s")}
            </div>
            <a href={createUrl} className="lp-join-btn" style={{ fontSize: 15 }}>
              {t("pub_create_own")}
            </a>
          </div>
        )}

        {league && (() => {
          // Название лиги + логотип клуба (шапка, на wide — во всю ширину сверху грида).
          const header = (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: league.telegram_url ? 12 : 28 }}>
                {league.logo_url && <LeagueLogo url={league.logo_url} name={league.name} size={60} radius={16} />}
                <div style={{ minWidth: 0 }}>
                  <div className="lp-d" style={{ fontSize: 34, lineHeight: 1.05, marginBottom: 6, color: "var(--ink)", overflowWrap: "anywhere" }}>
                    {league.name}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--mut)" }}>
                    {league.member_count} {plural(league.member_count, "players")}
                    {league.games_count > 0 && <> · {nGames(league.games_count)}</>}
                    {league.created_at && (() => { try { return <> · {t("pub_since")} {new Date(league.created_at).toLocaleDateString(dateLocale(), { month: "long", year: "numeric" })}</>; } catch (e) { return null; } })()}
                  </div>
                </div>
              </div>
              {league.telegram_url && (
                <a href={league.telegram_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--lime)", fontWeight: 600, fontSize: 14, textDecoration: "none", marginBottom: 26 }}>
                  <Send size={14} /> {t("league_open_channel")}
                </a>
              )}
            </>
          );

          // ── Афиша-герой: ближайшее открытое (или первое любое) событие ──────
          const heroPlaceInTitle = heroEvent && !heroEvent.name && !!heroEvent.place;
          const heroSection = heroEvent && (
            <div className="lp-hero">
              <span className="lp-hero-mascot" aria-hidden="true">🐕</span>
              <div className="lp-status-pill"><span className="lp-status-dot" />{heroLive ? t("showcase_live") : t("showcase_open")}</div>
              <div className="lp-hero-title">{heroEvent.name || heroEvent.place || "Padel"}</div>
              <div className="lp-hero-meta">
                {heroEvent.starts_at && <span><span aria-hidden="true">🗓️</span> <b>{fmtDateTime(heroEvent.starts_at)}</b></span>}
                {heroEvent.place && !heroPlaceInTitle && <span><span aria-hidden="true">📍</span> {heroEvent.place}</span>}
                {heroEvent.level && <EventLevelBadge level={heroEvent.level} />}
                {heroEvent.fee_per_player > 0 && <span className="lp-hero-fee"><span aria-hidden="true">💸</span> {formatMoney(heroEvent.fee_per_player, heroEvent.fee_currency)}</span>}
              </div>
              <div className="lp-hero-foot">
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <AvatarStack people={heroEvent.going || []} size={30} />
                  <div className="lp-going-txt">
                    <b>{t("showcase_going").replace("{n}", String(heroEvent.taken))}</b>
                    {heroEvent.last_join && (<><br /><span className="lp-pulseline"><span aria-hidden="true">⚡</span> {heroEvent.last_join.name} {relTime(heroEvent.last_join.at)}</span></>)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {/* Статус (осталось мест / «полный») — текст виден на ОБЕИХ раскладках;
                      сама кнопка записи — только на wide (на телефоне — липкая CTA внизу). */}
                  {!heroLive && (
                    heroFull ? (
                      <span className="lp-full-tag">{t("showcase_full")}</span>
                    ) : (
                      <div className="lp-seats" style={{ color: heroFree < 3 ? "var(--coral)" : "var(--lime)" }}>
                        {t("showcase_seats_left").replace("{n}", String(heroFree))}
                      </div>
                    )
                  )}
                  {wideLayout && (
                    heroLive ? (
                      <a href={heroHref} className="lp-go-btn">{t("showcase_watch")}</a>
                    ) : !heroFull ? (
                      <a href={heroHref} className="lp-go-btn">{t("showcase_join")}</a>
                    ) : null
                  )}
                </div>
              </div>
            </div>
          );

          // ── «Дальше в лиге»: остальные события таймлайном ────────────────────
          const timelineSection = restEvents.length > 0 && (
            <>
              <div className="lp-cap">{t("showcase_next")}</div>
              <div>
                {restEvents.map((e) => {
                  const dp = dateParts(e.starts_at);
                  const free = Math.max(0, e.target - e.taken);
                  const isFull = e.taken >= e.target;
                  const isLive = e.status === "active" || e.status === "live";
                  const hot = !isFull && free < 3;
                  const pct = Math.min(100, Math.round((100 * e.taken) / Math.max(1, e.target)));
                  const placeInTitle = !e.name && !!e.place; // название = место → не дублируем в мете
                  return (
                    <div key={`${e.kind}-${e.id}`} className="lp-tl-row">
                      <div className="lp-date"><div className="lp-date-dd">{dp.dd}</div><div className="lp-date-mm">{dp.mm}</div></div>
                      <div className="lp-tl-mid">
                        <div className="lp-tl-name">{e.name || e.place || "Padel"}</div>
                        <div className="lp-tl-meta">
                          {e.starts_at && <span>{fmtTime(e.starts_at)}{e.place && !placeInTitle ? ` · ${e.place}` : ""}</span>}
                          {e.level && <EventLevelBadge level={e.level} compact />}
                          {e.fee_per_player > 0 && <span style={{ color: "var(--lime)", fontWeight: 700 }}>{formatMoney(e.fee_per_player, e.fee_currency)}</span>}
                        </div>
                        <div className="lp-fillbar"><i className={hot ? "hot" : ""} style={{ width: `${pct}%` }} /></div>
                      </div>
                      <div className="lp-tl-right">
                        {wideLayout && <AvatarStack people={e.going || []} size={24} />}
                        {isLive ? (
                          <>
                            <span className="lp-live-tag">{t("showcase_live")}</span>
                            <a href={eventHref(e)} className="lp-mini-btn">{t("showcase_watch")}</a>
                          </>
                        ) : isFull ? (
                          <span className="lp-mini-tag">{t("showcase_full")}</span>
                        ) : (
                          <a href={eventHref(e)} className="lp-mini-btn">{free < 3 ? t("showcase_seats_left").replace("{n}", String(free)) : t("showcase_join")}</a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          );

          // ── «Было круто»: завершённые события корешками ─────────────────────
          const recentSection = recentList.length > 0 && (
            <>
              <div className="lp-cap">{t("showcase_recent")}</div>
              <div className="lp-spines">
                {recentList.map((r) => (
                  <span className="lp-spine" key={`${r.kind}-${r.name}-${r.at}`}><span aria-hidden="true">{eventEmoji(r.kind, r.format)}</span> <b>{r.name || "Padel"}</b> · {fmtDay(r.at)}</span>
                ))}
              </div>
            </>
          );

          // Cold start: событий вообще нет — маскот + «скоро первое событие» + телеграм.
          const coldSection = coldStart && (
            <div className="lp-cold">
              <div style={{ fontSize: 40, marginBottom: 10 }} aria-hidden="true">🐕</div>
              <div style={{ fontWeight: 700, color: "var(--ink)" }}>{t("showcase_soon")}</div>
              {league.telegram_url && (
                <a href={league.telegram_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--lime)", fontWeight: 600, fontSize: 14, textDecoration: "none", marginTop: 12 }}>
                  <Send size={14} /> {t("league_open_channel")}
                </a>
              )}
            </div>
          );

          // Заголовок таблицы
          const membersHeading = (
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--mut)", letterSpacing: 2, marginBottom: 10 }}>
              {t("pub_members")}
            </div>
          );

          // Подиум топ-3 — как на вкладке «Друзья» в приложении
          const podium = membersCount >= 3 && (() => {
            const [p1, p2, p3] = league.members;
            const medal = ["var(--yellow)", "#cfd8d0", "#cd7f4d"];
            const col = (p, rank, size, pad) => (
              <div style={{ textAlign: "center", minWidth: 0, flex: 1, maxWidth: 120 }}>
                <div style={{ display: "flex", justifyContent: "center" }}><Avatar name={p.name} url={p.avatar_url} size={size} /></div>
                <div style={{ fontSize: rank === 1 ? 13 : 12, fontWeight: rank === 1 ? 700 : 600, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                {p.rating != null && <div style={{ fontSize: 10.5, color: rank === 1 ? "var(--yellow)" : "var(--mut)", fontWeight: 700 }}>{p.rating}</div>}
                <div style={{ background: rank === 1 ? "color-mix(in srgb, var(--yellow) 18%, var(--surface2))" : "var(--surface2)", borderRadius: "10px 10px 0 0", padding: `${pad}px 0`, fontWeight: 800, color: medal[rank - 1], marginTop: 6, fontFamily: "'Anton',sans-serif", fontSize: 17 }}>{rank}</div>
              </div>
            );
            return (
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 10, padding: "6px 6px 0", marginBottom: 0 }}>
                {col(p2, 2, 46, 12)}
                {col(p1, 1, 58, 20)}
                {col(p3, 3, 46, 7)}
              </div>
            );
          })();

          // Лидерборд (при подиуме — с 4-го места)
          const leaderboard = (
            <div id="lp-full-rating" className="lp-card" style={{ marginBottom: 20, overflow: "hidden", borderTopLeftRadius: membersCount >= 3 ? 0 : undefined, borderTopRightRadius: membersCount >= 3 ? 0 : undefined }}>
              {membersCount === 0 && (
                <div style={{ padding: 20, textAlign: "center", color: "var(--mut)", fontSize: 13 }}>
                  {t("pub_no_players")}
                </div>
              )}
              {(membersCount >= 3 ? league.members.slice(3) : (league.members || [])).map((p, idx) => {
                const i = membersCount >= 3 ? idx + 3 : idx;
                const rankColor = ["var(--yellow)", "#cfd8d0", "#cd7f4d"][i] || "var(--mut)";
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 11, padding: "10px 14px",
                    borderBottom: i < league.members.length - 1 ? "1px solid var(--line)" : "none",
                  }}>
                    <div style={{ width: 20, textAlign: "center", fontFamily: "'Anton',sans-serif", fontSize: 17, color: rankColor, flexShrink: 0 }}>{i + 1}</div>
                    <Avatar name={p.name} url={p.avatar_url} id={p.id || p.profile_id} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}{i === 0 ? " 🥇" : ""}
                      </div>
                    </div>
                    {p.matches > 0 && <div style={{ fontSize: 12, color: "var(--mut)", flexShrink: 0 }}>{nGames(p.matches)}</div>}
                  </div>
                );
              })}
            </div>
          );

          // Свёртка полного рейтинга — по умолчанию закрыт, подиум уже виден.
          const ratingBlock = membersCount >= 3 ? (
            <>
              <div className="lp-fold" role="button" tabIndex={0} aria-expanded={ratingOpen} aria-controls="lp-full-rating"
                onClick={() => setRatingOpen((v) => !v)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRatingOpen((v) => !v); } }}>
                <span>{t("showcase_full_rating").replace("{n}", String(membersCount))}</span>
                <span>{ratingOpen ? "▴" : "▾"}</span>
              </div>
              {ratingOpen && leaderboard}
            </>
          ) : leaderboard;

          // ── «Вся стая»: стена аватаров участников ────────────────────────────
          const wallSection = membersCount > 0 && (
            <>
              <div className="lp-cap">{t("showcase_wall")}</div>
              <div className="lp-wall">
                {league.members.slice(0, 10).map((p, i) => <Avatar key={i} name={p.name} url={p.avatar_url} size={34} />)}
                {membersCount > 10 && <div className="lp-wall-more">+{membersCount - 10}</div>}
              </div>
            </>
          );

          // Левая колонка целиком (в узкой раскладке — просто вертикальный поток).
          const leftColumn = (
            <>
              {coldStart ? coldSection : heroSection}
              {timelineSection}
              {recentSection}
              {membersHeading}
              {podium}
              {ratingBlock}
              {wallSection}
            </>
          );

          // Кнопка «Вступить» + подсказка + OpenInApp. Залогиненному (участник он
          // или нет) показываем «Открыть в приложении» — /?join=CODE идемпотентен:
          // участника просто откроет в его лиге, не-участника добавит. Подсказку
          // «после входа добавим» показываем только гостю.
          const joinBlock = (
            <>
              <a href={joinUrl} className="lp-join-btn" style={{ marginBottom: 12 }}
                onClick={() => { try { localStorage.setItem("pp_pending_join", code); } catch (e) {} }}>
                {session ? t("pub_open_in_app") : t("pub_join_league")}
              </a>
              {/* QR открылся в браузере, а приложение уже установлено → в натив по тапу */}
              <OpenInApp path={`/l/${code}`} style={{ marginBottom: 12 }} />
              {/* ТВ клуба — полноэкранное табло лиги для экрана в клубе / планшета на стойке */}
              <a href={`/tv/l/${code}`} target="_blank" rel="noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: session ? 12 : 20,
                  padding: 12, borderRadius: 14, textDecoration: "none", fontSize: 13.5, fontWeight: 700,
                  border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)" }}>
                <Tv size={16} style={{ color: "var(--lime)" }} /> {t("pub_open_tv")}
              </a>
              {!session && (
                <div style={{ fontSize: 12, color: "var(--mut)", textAlign: "center", marginBottom: 28 }}>
                  {t("pub_after_login")}
                </div>
              )}
            </>
          );

          // Вирусный CTA
          const viral = (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 22, textAlign: "center" }}>
              <div className="lp-d" style={{ fontSize: 13, color: "var(--mut)", marginBottom: 10, letterSpacing: 1 }}>
                {t("pub_want_own_t")}
              </div>
              <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 14, lineHeight: 1.5 }}>
                {t("pub_want_own_s")}
              </div>
              <a href={createUrl} style={{ color: "var(--lime)", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                {t("pub_create_own")}
              </a>
            </div>
          );

          // Липкая CTA на телефоне — вне сетки/паддингов, position:fixed.
          const stickyCta = showStickyCta && (
            <a href={heroHref} className="lp-sticky-cta">
              <span>{heroLive ? t("showcase_watch") : t("showcase_join")}</span>
              <small>{heroLive ? t("showcase_live") : t("showcase_seats_left").replace("{n}", String(heroFree))}</small>
            </a>
          );

          if (!wideLayout) {
            return (
              <>
                {header}
                {leftColumn}
                {joinBlock}
                {viral}
                {stickyCta}
              </>
            );
          }

          // Правая sticky-колонка: клубная карточка/CTA как раньше + строка пульса лиги.
          const sidePulse = heroEvent?.last_join && (
            <div className="lp-side-pulse">
              <Avatar name={heroEvent.last_join.name} size={24} />
              <span><span aria-hidden="true">⚡</span> <b>{heroEvent.last_join.name}</b> {relTime(heroEvent.last_join.at)}</span>
            </div>
          );

          return (
            <>
              {header}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
                <div>{leftColumn}</div>
                <div style={{ position: "sticky", top: 16 }}>
                  {joinBlock}
                  {viral}
                  {sidePulse}
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
