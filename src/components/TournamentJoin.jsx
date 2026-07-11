// components/TournamentJoin.jsx
// Гостевой вход на турнир по ссылке /t/CODE.
// Все статусы (набор / идёт / завершён) показывают полный TournamentView только для чтения.
// Кнопка «Присоединиться» видна только при status=open и ещё не зарегистрировался.
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getTournamentByCode, getTournament, joinTournamentByCode } from "../lib/tournamentApi";
import { TournamentView } from "./Tournaments";
import LoginScreen from "./LoginScreen";
import { Trophy, AlertCircle, Check, LogIn, UserCheck, Calendar, MapPin } from "lucide-react";
import { t as tr } from "../lib/i18n";
import { playerAvatar, avatarFallback } from "../lib/avatar";
import { usePublicChrome, PublicToggles, plural } from "./publicChrome";
import Logo from "./Logo";

const fmtDate = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
};
// Показываем только реальное время начала (starts_at). created_at как «время начала»
// вводил в заблуждение (показывал момент создания), поэтому фолбэк убран.
const TrnMeta = ({ trn }) => ((trn.starts_at || trn.place) ? (
  <div style={{ fontSize: 13, color: "var(--mut)", display: "flex", gap: 12, margin: "6px 0 12px", flexWrap: "wrap" }}>
    {trn.starts_at && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={13} />{fmtDate(trn.starts_at)}</span>}
    {trn.place && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} />{trn.place}</span>}
  </div>
) : null);

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.tj-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;color-scheme:dark;
 background-image:radial-gradient(circle at 80% -10%,rgba(200,255,45,.10),transparent 45%);}
.tj-wrap{max-width:460px;margin:0 auto;padding:20px 16px 40px;}
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
  const { theme, lang, vars, toggleTheme, cycleLang } = usePublicChrome();

  const load = async () => {
    try {
      const base = await getTournamentByCode(code);
      if (!base) { setT(null); return; }
      // Enrich with direct query that includes score_a/score_b (getTournamentByCode uses RPC that may omit scores)
      const rich = await getTournament(base.id).catch(() => null);
      setT(rich || base);
    } catch (e) { setT(null); }
  };
  useEffect(() => { load(); }, [code]);

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

  if (showLogin && !session) return <LoginScreen botName={botName} onSuccess={() => setShowLogin(false)} onBack={() => setShowLogin(false)} theme={theme} lang={lang} onThemeToggle={toggleTheme} onLangChange={cycleLang} />;

  const join = async () => {
    const display = session ? (profileName || tr("guest_default_name")) : name.trim();
    if (!session && !name.trim()) return;
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const res = await joinTournamentByCode(code, display);
      setJoined(true);
      setJoinNote(res?.already ? tr("tj_already") : res?.linked ? tr("tj_linked") : "");
      await load();
    }
    catch (e) {
      const map = { tournament_full: tr("err_tour_full"), tournament_closed: tr("err_tour_closed"), tournament_not_found: tr("err_tour_not_found") };
      setErr(map[e.message] || tr("err_join"));
    } finally { setBusy(false); }
  };

  // Вводить счёт могут только участники турнира (profile_id совпадает) или если турнир ещё в наборе
  const canEdit = !!session && !!profileId && (t?.players || []).some((p) => p.profile_id === profileId);

  return (
    <div className="tj-root" style={vars}>
      <style>{css}</style>
      <div className="tj-wrap">
        <PublicToggles theme={theme} lang={lang} onTheme={toggleTheme} onLang={cycleLang} />
        {/* Шапка */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span onClick={() => window.location.assign("/")} style={{ cursor: "pointer" }} title={tr("pub_to_app")}><Logo height={18} /></span>
          {session ? (
            <button className="tj-ghost" style={{ fontSize: 12 }} onClick={() => window.location.assign("/")}>{tr("pub_to_app")}</button>
          ) : (
            <button className="tj-ghost" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowLogin(true)}>
              <LogIn size={13} /> {tr("pub_login")}
            </button>
          )}
        </div>

        {joinNote && (
          <div className="tj-card" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} /> {joinNote}
          </div>
        )}

        {t === undefined && (
          <div className="tj-card" style={{ textAlign: "center", color: "var(--mut)" }}>{tr("pub_loading")}</div>
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
              <div className="tj-card">
                <div style={{ color: "var(--lime)", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>🏆 {tr("pub_invited_trn")}</div>
                <div className="tj-d" style={{ fontSize: 20, marginBottom: 4 }}>{t.name || tr("pub_americano")}</div>
                <TrnMeta trn={t} />
                <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 10 }}>{tr("pub_upto")} {t.points_per_game} {tr("pub_points")}</div>

                {/* Кто уже записан — чипы «аватар + имя»; свободные — пунктирные «＋ место» */}
                {(() => {
                  const players = t.players || [];
                  const freeN = Math.max(0, (t.target_size || 0) - players.length);
                  const pct = t.target_size ? Math.round((players.length / t.target_size) * 100) : 0;
                  return (
                    <>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                        {players.map((p) => (
                          <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px 4px 4px", borderRadius: 999, background: "var(--surface2)", border: "1px solid var(--line)", fontSize: 12.5, fontWeight: 600 }}>
                            <img src={playerAvatar(p.profile?.avatar_url || p.avatar_url, p.profile_id || p.name)} onError={avatarFallback(p.profile_id || p.name)} alt=""
                              style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} /> {p.name}
                          </span>
                        ))}
                        {Array.from({ length: Math.min(freeN, 8) }).map((_, i) => (
                          <span key={"f" + i} style={{ display: "inline-flex", alignItems: "center", padding: "4px 11px", borderRadius: 999, border: "1.5px dashed var(--line)", color: "var(--mut)", fontSize: 12.5 }}>{tr("pub_spot_chip")}</span>
                        ))}
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: "var(--surface2)", overflow: "hidden", marginBottom: 4 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "var(--lime)", transition: "width .3s" }} />
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--mut)", marginBottom: 14 }}>
                        {players.length}/{t.target_size} · {tr("pub_spots_left").replace("{n}", String(freeN))}
                      </div>
                    </>
                  );
                })()}

                {session ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--lime)", fontSize: 13, marginBottom: 12 }}>
                    <UserCheck size={16} /> {tr("pub_logged_rating").replace("{name}", profileName || "игрок")}
                  </div>
                ) : (
                  <>
                    <input className="tj-input" placeholder={tr("pub_guest_name_ph")} value={name} onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && join()} />
                    <button className="tj-loginlink" onClick={() => setShowLogin(true)}>
                      <LogIn size={14} /> {tr("pub_login_for_rating2")}
                    </button>
                  </>
                )}

                <button className="tj-btn" disabled={(!session && !name.trim()) || busy} onClick={join}>
                  {busy ? tr("pub_joining") : tr("pub_join_trn")}
                </button>
                {err && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 8 }}>{err}</p>}
              </div>
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

            {/* Полный TournamentView: read-only для гостей, полный для залогиненных */}
            <TournamentView id={t.id} players={[]} back={null} readOnly={!canEdit} initialT={t}
              reloadFn={() => getTournament(t.id).catch(() => getTournamentByCode(code))}
              isGroupMember={false}
              currentProfileId={profileId}
              spectatorMode={!canEdit} />
          </>
        )}
      </div>
      <div style={{ textAlign: "center", color: "var(--mut)", fontSize: 12, padding: "0 16px 8px" }}>
        {tr("pub_footer_q")}{" "}
        <a href="/" style={{ color: "var(--lime)", fontWeight: 700, textDecoration: "none" }}>
          {tr("pub_footer_cta")}
        </a>
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
