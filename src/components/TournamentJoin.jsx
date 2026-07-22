// components/TournamentJoin.jsx
// Гостевой вход на турнир по ссылке /t/CODE.
// Все статусы (набор / идёт / завершён) показывают полный TournamentView только для чтения.
// Кнопка «Присоединиться» видна только при status=open и ещё не зарегистрировался.
import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getTournamentByCode, getTournament, joinTournamentByCode } from "../lib/tournamentApi";
import { TournamentView, TournamentPoster, css as trCss, fmtById } from "./Tournaments";
import PublicRoster from "./PublicRoster";
import { useIsWide } from "./wide/wide";
import LoginScreen from "./LoginScreen";
import { AlertCircle, Check, UserCheck, Calendar, MapPin } from "lucide-react";
import { t as tr , dateLocale} from "../lib/i18n";
import { playerAvatar, avatarFallback, avatarBg , avatarOnLoad, setMascotEnabled} from "../lib/avatar";
import { usePublicChrome, PublicToggles } from "./publicChrome";
import { groupPairs } from "../lib/pairs";
import { formatMoney } from "../lib/money";
import { EventLevelBadge } from "./LevelBadges";
import Logo from "./Logo";

const fmtDate = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(dateLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
};
// Показываем только реальное время начала (starts_at). created_at как «время начала»
// вводил в заблуждение (показывал момент создания), поэтому фолбэк убран.
const TrnMeta = ({ trn }) => ((trn.starts_at || trn.place) ? (
  <div style={{ fontSize: 13, color: "var(--mut)", display: "flex", gap: 12, margin: "6px 0 12px", flexWrap: "wrap" }}>
    {trn.starts_at && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={13} />{fmtDate(trn.starts_at)}{trn.ends_at ? ` – ${(() => { try { return new Date(trn.ends_at).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } })()}` : ""}</span>}
    {trn.place && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} />{trn.place}</span>}
  </div>
) : null);

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.tj-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;color-scheme:dark;
 background-image:radial-gradient(circle at 80% -10%,rgba(200,255,45,.10),transparent 45%);}
.tj-wrap{max-width:460px;margin:0 auto;padding:max(20px,env(safe-area-inset-top)) 16px calc(40px + env(safe-area-inset-bottom));}
.tj-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:18px;margin-bottom:12px;}
.tj-d{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.tj-input{width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:'Outfit';padding:12px;outline:none;box-sizing:border-box;margin-bottom:10px;}
.tj-input:focus{border-color:var(--lime);}
.tj-btn{background:var(--lime);color:var(--lime-fg);font-weight:700;border:none;border-radius:14px;padding:13px;cursor:pointer;width:100%;}
.tj-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.tj-loginlink{background:none;border:none;color:var(--lime);cursor:pointer;font-family:'Outfit';font-size:13px;display:inline-flex;align-items:center;gap:6px;padding:0;margin-bottom:10px;}
.tj-ghost{background:var(--surface2);color:var(--ink);border:1px solid var(--line);border-radius:12px;cursor:pointer;padding:8px 14px;font-family:'Outfit';}
`;

export default function TournamentJoin({ code, botName }) {
  const [t, setT] = useState(undefined);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [err, setErr] = useState("");
  const [joinNote, setJoinNote] = useState("");
  const [session, setSession] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [profileId, setProfileId] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const [showAllPairs, setShowAllPairs] = useState(false); // ?pair=N: раскрыть весь ростер
  const { theme, lang, vars, toggleTheme, cycleLang } = usePublicChrome();
  const isWide = useIsWide();
  // Маскот афиши = маскот ЕЁ лиги (не зрителя). Выставляем синхронно на рендер,
  // до отрисовки ростера/аватаров; по умолчанию вкл, пока данные не пришли.
  setMascotEnabled(t?.mascot !== false);

  const load = useCallback(async () => {
    try {
      const base = await getTournamentByCode(code);
      if (!base) { setT(null); setLoadErr(false); return; }  // реально не найден
      // Обогащаем счётами через прямой запрос (getTournamentByCode — RPC без
      // score_a/score_b) ТОЛЬКО авторизованным: у анонима RLS рубит прямой
      // select турнира в 406 (спам в консоли + бесполезный запрос). Гостю
      // хватает данных из RPC.
      const rich = session ? await getTournament(base.id).catch(() => null) : null;
      // mascot приходит только из публичного RPC (base); переносим его в rich,
      // чтобы афиша уважала маскот СВОЕЙ лиги (инициалы вместо собак при выкл).
      setT(rich ? { ...rich, mascot: base.mascot } : base); setLoadErr(false);
    } catch (e) {
      // Сетевой/серверный сбой — это НЕ «турнир не найден». Логируем и показываем
      // отдельное сообщение, иначе аутаж выглядит как неверный код.
      console.warn("[TournamentJoin] загрузка турнира не удалась", code, e);
      setLoadErr(true);
    }
  }, [code, session]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (s) setShowLogin(false); });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfileName(""); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("id, name").eq("user_id", user.id).maybeSingle();
      setProfileName(data?.name || "");
      setProfileId(data?.id || null);
    })();
  }, [session]);

  const reloadBoth = useCallback(async () => {
    // Как и в load(): прямой getTournament — только для авторизованных (RLS),
    // иначе аноним получает 406. Гость обновляется через публичный RPC.
    const d = session
      ? await getTournament(t?.id).catch(() => getTournamentByCode(code))
      : await getTournamentByCode(code);
    if (d) setT(d);
    return d;
  }, [t?.id, code, session]);

  if (showLogin && !session) return <LoginScreen botName={botName} onSuccess={() => setShowLogin(false)} onBack={() => setShowLogin(false)} theme={theme} lang={lang} onThemeToggle={toggleTheme} onLangChange={cycleLang} />;

  // pairNo: null — solo или «создать пару» (RPC сам решит по формату); N — встать в пару N.
  const join = async (pairNo = null) => {
    const display = session ? (profileName || tr("guest_default_name")) : name.trim();
    if (!session && !name.trim()) return;
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const res = await joinTournamentByCode(code, display, pairNo);
      setJoined(true);
      setJoinNote(res?.already ? tr("tj_already") : res?.linked ? tr("tj_linked") : "");
      await load();
    }
    catch (e) {
      const map = { tournament_full: tr("err_tour_full"), tournament_closed: tr("err_tour_closed"), tournament_not_found: tr("err_tour_not_found"), pair_full: tr("err_tour_full"), pair_not_found: tr("err_join") };
      setErr(map[e.message] || tr("err_join"));
    } finally { setBusy(false); }
  };

  // Вводить счёт могут только участники турнира (profile_id совпадает) или если турнир ещё в наборе
  const canEdit = !!session && !!profileId && (t?.players || []).some((p) => p.profile_id === profileId);
  const isPair = !!t && (t.format === "king_of_hill" || t.format === "round_robin");
  const targetPair = (() => { try { const v = new URLSearchParams(window.location.search).get("pair"); return v && /^\d+$/.test(v) ? Number(v) : null; } catch (e) { return null; } })();
  // Ссылка ?pair=N ведёт в КОНКРЕТНУЮ пару: показываем сфокусированный экран
  // (первый игрок + твоё место + одна кнопка), пока не раскрыли «весь турнир».
  const focusedPair = isPair && targetPair != null && !showAllPairs && t && t.status === "open" && !joined;
  const targetPr = focusedPair ? (groupPairs(t.players || []).pairs.find((p) => p.pair_no === targetPair) || null) : null;
  const targetFirst = targetPr?.members?.[0] || null;
  const targetFull = !!targetPr && targetPr.members.length >= 2; // пара уже занята
  // Открытый турнир, гость ещё не записан, не сфокусирован на конкретной паре —
  // новая композиция (афиша+ростер+запись), для неё расширяем контейнер на
  // широком экране. Остальные состояния (focusedPair/joined/active/finished)
  // остаются на телефонной ширине 460px — их вёрстку не трогаем.
  const openGeneral = !!t && t.status === "open" && !joined && !focusedPair;

  return (
    <div className="tj-root" style={vars}>
      <style>{css}</style>
      <style>{trCss}</style>
      <div className="tj-wrap" style={(isWide && openGeneral) ? { maxWidth: 1040 } : undefined}>
        <PublicToggles theme={theme} lang={lang} onTheme={toggleTheme} onLang={cycleLang} onLogin={session ? undefined : () => setShowLogin(true)} />
        {/* Шапка */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span onClick={() => window.location.assign("/")} style={{ cursor: "pointer" }} title={tr("pub_to_app")}><Logo height={18} /></span>
          {session && (
            <button className="tj-ghost" style={{ fontSize: 12 }} onClick={() => window.location.assign("/")}>{tr("pub_to_app")}</button>
          )}
        </div>

        {joinNote && (
          <div className="tj-card" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} /> {joinNote}
          </div>
        )}

        {t === undefined && !loadErr && (
          <div className="tj-card" style={{ textAlign: "center", color: "var(--mut)" }}>{tr("pub_loading")}</div>
        )}

        {t === undefined && loadErr && (
          <div className="tj-card" style={{ color: "var(--coral)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><AlertCircle size={16} /> {tr("err_generic")}</span>
            <button className="tj-ghost" style={{ fontSize: 12 }} onClick={() => { setLoadErr(false); load(); }}>↻</button>
          </div>
        )}

        {t === null && (
          <div className="tj-card" style={{ color: "var(--coral)", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} /> {tr("pub_trn_notfound").replace("{code}", code)}
          </div>
        )}

        {t && (
          <>
            {/* Баннер: присоединиться (только при status=open и ещё не зарегистрирован) */}
            {t.status === "open" && !joined && (
              focusedPair ? (
                /* Ссылка ?pair=N: сфокусированная карточка КОНКРЕТНОЙ пары —
                   старая презентация не трогается (вне скоупа этой задачи). */
                <div className="tj-card">
                  <div style={{ color: "var(--lime)", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>🏆 {tr("pub_invited_pair")}</div>
                  <div className="tj-d" style={{ fontSize: 20, marginBottom: 4 }}>{t.name || tr("pub_americano")}</div>
                  <TrnMeta trn={t} />
                  <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 10 }}>{tr("pub_upto")} {t.points_per_game} {tr("pub_points")}</div>
                  {t.description && <div style={{ fontSize: 13, color: "var(--ink)", margin: "0 0 10px", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{t.description}</div>}
                  {t.contact_name && <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 10 }}>{tr("trn_contact_name_label")}: <span style={{ color: "var(--ink)", fontWeight: 600 }}>{t.contact_name}</span>{t.contact_link && <span> · {t.contact_link}</span>}</div>}
                  {t.fee_per_player > 0 && <div style={{ marginBottom: 10 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "var(--lime)", background: "color-mix(in srgb, var(--lime) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 40%, transparent)", borderRadius: 999, padding: "3px 10px" }}>💸 {formatMoney(t.fee_per_player, t.fee_currency)}</span></div>}
                  {t.level && <div style={{ marginBottom: 10 }}><EventLevelBadge level={t.level} /></div>}

                  {(() => {
                    const avatar = (p, ring) => (
                      <img src={playerAvatar(p.profile?.avatar_url || p.avatar_url, p.profile_id || p.name, p.name)} onError={avatarFallback(p.profile_id || p.name, p.name)} onLoad={avatarOnLoad} alt=""
                        style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", boxShadow: `0 0 0 3px ${ring}`, ...avatarBg(p.profile_id || p.name, p.name) }} />
                    );
                    const accent = targetFull ? "var(--coral)" : "var(--lime)";
                    const slot = (children) => <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, textAlign: "center", minWidth: 0 }}>{children}</div>;
                    const warn = (msg) => <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, background: "color-mix(in srgb, var(--coral) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--coral) 30%, transparent)", borderRadius: 12, padding: "10px 12px", fontSize: 12.5, color: "var(--coral)" }}>⚠️ {msg}</div>;
                    return (
                      <div style={{ margin: "4px 0 12px", background: "var(--surface2)", border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`, borderRadius: 16, padding: "15px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--mut)", marginBottom: 12 }}>
                          <span>{tr("trn_pairs")} <b style={{ color: accent }}>{targetPair}</b></span>
                          <span>{targetFull ? tr("pub_pair_full_tag") : tr("pub_your_spot")}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {targetFirst ? slot(<>
                            {avatar(targetFirst, "var(--lime)")}
                            <span style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{targetFirst.name}</span>
                            {!targetFull && <span style={{ fontSize: 11, color: "var(--mut)" }}>{tr("trn_looking_partner")}</span>}
                          </>) : <div style={{ flex: 1 }} />}
                          <span style={{ color: "var(--mut)", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>&amp;</span>
                          {targetFull ? slot(<>
                            {avatar(targetPr.members[1], "var(--mut)")}
                            <span style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{targetPr.members[1].name}</span>
                          </>) : slot(<>
                            <span style={{ width: 56, height: 56, borderRadius: "50%", border: "2px dashed color-mix(in srgb, var(--lime) 55%, transparent)", display: "grid", placeItems: "center", color: "var(--lime)", fontSize: 24 }}>＋</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--lime)" }}>{tr("pub_your_spot")}</span>
                          </>)}
                        </div>
                        {targetFull && warn(tr("pub_pair_full_note"))}
                        {!targetFirst && warn(tr("pub_pair_notfound"))}
                      </div>
                    );
                  })()}

                  {!(targetFull || !targetFirst) && (session ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--lime)", fontSize: 13, marginBottom: 12 }}>
                      <UserCheck size={16} /> {tr("pub_logged_rating").replace("{name}", profileName || tr("guest_default_name"))}
                    </div>
                  ) : (
                    <input className="tj-input" placeholder={tr("pub_guest_name_ph")} value={name} onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && join(targetPair)} />
                  ))}

                  {(targetFull || !targetFirst) ? (
                    <button className="tj-btn" onClick={() => setShowAllPairs(true)}>{tr("pub_see_tournament")} ›</button>
                  ) : (
                    <button className="tj-btn" disabled={(!session && !name.trim()) || busy} onClick={() => join(targetPair)}>
                      {busy ? tr("pub_joining") : tr("pub_join_this_pair").replace("{name}", targetFirst.name)}
                    </button>
                  )}
                  {!targetFull && targetFirst && (
                    <button className="tj-loginlink" style={{ marginTop: 10 }} onClick={() => setShowAllPairs(true)}>{tr("pub_see_tournament")} ›</button>
                  )}
                  {err && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 8 }}>{err}</p>}
                </div>
              ) : (() => {
                // Открытый турнир, без фокуса на паре: афиша (TournamentPoster) +
                // ростер участников (PublicRoster) + компактная карточка записи —
                // единая композиция, двухколонная на широком экране (см. спек
                // 2026-07-22-public-tournament-wide-design.md).
                const players = t.players || [];
                const fmt = fmtById(t.format);
                const filled = players.length;
                const freeN = Math.max(0, (t.target_size || 0) - filled);
                const pct = t.target_size ? Math.round((filled / (t.target_size || 1)) * 100) : 0;
                // avatarOfTp: как в TournamentView, но источник — только гостевой
                // RPC-агрегат (players уже содержит avatar_url/profile).
                const avatarOfTp = (tpId) => {
                  const tp = players.find((p) => p.id === tpId);
                  if (!tp) return null;
                  return tp.avatar_url || tp.profile?.avatar_url || (tp.profile_id ? playerAvatar(null, tp.profile_id, tp.profile?.name || tp.name) : null);
                };

                const isBtb = t.format === "beat_the_box";
                const isKoth = t.format === "king_of_hill";
                const posterAndRoster = (
                  <div>
                    <TournamentPoster trnData={t} fmt={fmt} readOnly isBtb={isBtb} isKoth={isKoth} avatarOfTp={avatarOfTp} />
                    <div className="tj-card">
                      <PublicRoster players={players} targetSize={t.target_size} isPair={isPair} isWide={isWide} />
                    </div>
                  </div>
                );

                const joinCard = (
                  <div className="tj-card" style={isWide ? { position: "sticky", top: 16 } : undefined}>
                    <div style={{ color: "var(--lime)", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>🏆 {tr("pub_invited_trn")}</div>
                    <div className="tj-d" style={{ fontSize: 18, marginBottom: 10 }}>{t.name || fmt.name}</div>
                    <div style={{ height: 8, borderRadius: 999, background: "var(--surface2)", overflow: "hidden", margin: "2px 0 6px" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "var(--lime)", transition: "width .3s" }} />
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 14 }}>
                      {filled}/{t.target_size} · {tr("pub_spots_left").replace("{n}", String(freeN))}
                    </div>
                    {session ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--lime)", fontSize: 13, marginBottom: 12 }}>
                        <UserCheck size={16} /> {tr("pub_logged_rating").replace("{name}", profileName || tr("guest_default_name"))}
                      </div>
                    ) : (
                      <input className="tj-input" placeholder={tr("pub_guest_name_ph")} value={name} onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && join(isPair ? targetPair : undefined)} />
                    )}
                    {isPair ? (
                      <button className="tj-btn" disabled={(!session && !name.trim()) || busy} onClick={() => join(targetPair)}>
                        {busy ? tr("pub_joining") : (targetPair ? tr("trn_join_partner") : tr("trn_create_pair"))}
                      </button>
                    ) : (
                      <button className="tj-btn" disabled={(!session && !name.trim()) || busy} onClick={() => join()}>
                        {busy ? tr("pub_joining") : tr("pub_join_trn")}
                      </button>
                    )}
                    <div style={{ color: "var(--mut)", fontSize: 12, lineHeight: 1.45, marginTop: 11, textAlign: "center" }}>{tr("pub_guest_rating_hint")}</div>
                    {err && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 8 }}>{err}</p>}
                  </div>
                );

                return isWide ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 372px", gap: 24, alignItems: "start", maxWidth: 980, margin: "0 auto" }}>
                    {posterAndRoster}
                    {joinCard}
                  </div>
                ) : (
                  <>
                    {posterAndRoster}
                    {joinCard}
                  </>
                );
              })()
            )}

            {/* Подтверждение присоединения */}
            {joined && (
              <div className="tj-card" style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--lime)", fontWeight: 600 }}>
                <Check size={18} /> {tr("pub_youre_in")}
              </div>
            )}

            {/* Гостю объясняем ограничение */}
            {!session && t.status !== "open" && (
              <div style={{ fontSize: 12, color: "var(--mut)", textAlign: "center", marginBottom: 8 }}>
                {tr("pub_view_mode")}
              </div>
            )}

            {/* Полный TournamentView: read-only для гостей, полный для залогиненных.
                Для открытого турнира, пока не записан, join-карточка выше уже содержит
                всю инфу (имя/дата/место/ростер/запись) — не дублируем её афишей ниже. */}
            {!(t.status === "open" && !joined) && (
              <TournamentView id={t.id} players={[]} back={null} readOnly={!canEdit} initialT={t}
                reloadFn={reloadBoth}
                isGroupMember={false}
                currentProfileId={profileId}
                spectatorMode={!canEdit} />
            )}
          </>
        )}
      </div>
      <div style={{ textAlign: "center", color: "var(--mut)", fontSize: 12, padding: "0 16px 8px" }}>
        {tr("pub_footer_q")}{" "}
        <a href="/" style={{ color: "var(--lime)", fontWeight: 700, textDecoration: "none" }}>
          {tr("pub_footer_cta")}
        </a>
        <div style={{ marginTop: 6, opacity: .8 }}>{tr("pub_demo_note")}</div>
      </div>
      {/* Отсылка на маркетинговый лендинг (как «Подробнее о PadelPack» в приложении). */}
      <div style={{ textAlign: "center", padding: "0 16px 14px" }}>
        <a href="/landing.html" style={{ color: "var(--lime)", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
          {tr("lp_about")}
        </a>
      </div>
    </div>
  );
}
