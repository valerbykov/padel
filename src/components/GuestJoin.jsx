// components/GuestJoin.jsx
// Вход по ссылке-приглашению (/j/:code). Можно зайти гостем по имени
// ИЛИ войти в аккаунт — тогда слот привяжется к профилю (результат
// засчитается в твой рейтинг). props: { code, botName }.
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import LoginScreen from "./LoginScreen";
import Logo from "./Logo";
import { Calendar, MapPin, Check, AlertCircle, LogIn, UserCheck } from "lucide-react";
import { t , dateLocale} from "../lib/i18n";
import { playerAvatar, avatarFallback } from "../lib/avatar";
import { usePublicChrome, PublicToggles } from "./publicChrome";

const fmtDate = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(dateLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.gj-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:max(20px,env(safe-area-inset-top)) 20px max(20px,env(safe-area-inset-bottom));
 background-image:radial-gradient(circle at 80% -10%,rgba(200,255,45,.10),transparent 45%);}
.gj-card{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:22px;width:100%;max-width:400px;}
.gj-display{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.gj-input{width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:'Outfit';padding:12px;outline:none;box-sizing:border-box;margin-bottom:12px;}
.gj-input:focus{border-color:var(--lime);}
.gj-slot{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--surface2);border:1px solid var(--line);margin-bottom:6px;}
.gj-btn{background:var(--lime);color:var(--lime-fg);font-weight:700;border:none;border-radius:10px;padding:7px 13px;cursor:pointer;font-size:13px;}
.gj-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.gj-loginlink{background:none;border:none;color:var(--lime);cursor:pointer;font-family:'Outfit';font-size:13px;display:inline-flex;align-items:center;gap:6px;padding:0;}
`;

// Позиция на корте: занятая — аватар с подписью, свободная — пунктирный «＋»
// с плашкой «твоё место». Тап по свободной — занять (гость сначала вводит имя).
function CourtSpot({ s, side, busy, onTake }) {
  const color = side === "A" ? "var(--lime)" : "var(--coral)";
  const pos = { position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "30%" };
  if (side === "A") pos.left = "9%"; else pos.right = "9%";
  if (s.position === 1) pos.top = "10%"; else pos.bottom = "10%";
  const plate = {
    fontSize: 11, fontWeight: 600, marginTop: 3, padding: "1px 7px", borderRadius: 7,
    background: "color-mix(in srgb, var(--surface) 88%, transparent)", border: `1px solid ${color}`,
    maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  };
  if (s.taken) {
    return (
      <div style={pos}>
        <img src={playerAvatar(s.avatar_url, s.name)} onError={avatarFallback(s.name)} alt=""
          style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", border: `3px solid ${color}`, background: "var(--surface)" }} />
        <span style={plate}>{s.name}</span>
      </div>
    );
  }
  return (
    <div style={{ ...pos, cursor: "pointer" }} onClick={busy ? undefined : onTake} role="button" aria-label={t("pub_take_slot")}>
      <span style={{ width: 46, height: 46, borderRadius: "50%", border: "2.5px dashed rgba(255,255,255,.6)", background: "rgba(0,0,0,.25)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxSizing: "border-box", opacity: busy ? .5 : 1 }}>＋</span>
      <span style={{ ...plate, borderStyle: "dashed" }}>{t("pub_your_spot")}</span>
    </div>
  );
}

export default function GuestJoin({ code, botName }) {
  const [game, setGame] = useState(undefined);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [session, setSession] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const nameRef = useRef(null);
  const { theme, lang, vars, toggleTheme, cycleLang } = usePublicChrome();

  const load = async () => {
    try {
      const { data, error } = await supabase.rpc("get_game_by_code_full", { p_code: code });
      if (error) throw error;
      setGame(data || null);
    } catch (e) { setGame(null); }
  };
  useEffect(() => { load(); }, [code]);

  // следим за входом
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (s) setShowLogin(false); });
    return () => sub.subscription.unsubscribe();
  }, []);

  // имя профиля, если вошёл
  useEffect(() => {
    if (!session) { setProfileName(""); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle();
      setProfileName(data?.name || "");
    })();
  }, [session]);

  if (showLogin && !session) {
    return <LoginScreen botName={botName} onSuccess={() => setShowLogin(false)} onBack={() => setShowLogin(false)} theme={theme} lang={lang} onThemeToggle={toggleTheme} onLangChange={cycleLang} />;
  }

  const take = async (team, position) => {
    const display = session ? (profileName || t("guest_default_name")) : name.trim();
    if (!session && !name.trim()) { setErr(t("pub_name_first")); nameRef.current?.focus(); return; }
    setBusy(true); setErr(""); setNote("");
    try {
      const { data, error } = await supabase.rpc("join_game_slot", { p_code: code, p_team: team, p_position: position, p_guest_name: display });
      if (error) throw error;
      setNote(data?.already ? t("err_already_in_game") : data?.linked ? t("tj_linked") : "");
      await load();
    } catch (e) {
      const map = { slot_taken: t("err_slot_taken"), game_closed: t("err_game_closed"), game_not_found: t("err_game_not_found") };
      setErr(map[e.message] || t("err_join_slot"));
    } finally { setBusy(false); }
  };

  return (
    <div className="gj-root" style={{ ...vars, flexDirection: "column", gap: 20 }}>
      <style>{css}</style>
      <div style={{ width: "100%", maxWidth: 400, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span onClick={() => window.location.assign("/")} style={{ cursor: "pointer" }} title={t("pub_to_app")}><Logo height={18} /></span>
        <PublicToggles theme={theme} lang={lang} onTheme={toggleTheme} onLang={cycleLang} />
      </div>
      <div className="gj-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ color: "var(--lime)", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>{t("pub_invited_game")}</div>
          {game?.league_name && <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--mut)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "45%" }}>{game.league_name}</div>}
        </div>

        {game === undefined && <p style={{ color: "var(--mut)", marginTop: 16 }}>{t("pub_loading")}</p>}
        {game === null && <p style={{ color: "var(--coral)", marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}><AlertCircle size={16} /> {t("pub_game_notfound").replace("{code}", code)}</p>}

        {game && (
          <>
            <div className="gj-display" style={{ fontSize: 26, marginTop: 4 }}>{game.title || "PadelPack"}</div>
            {/* Дата/время (с фолбэком на created_at) и место — чтобы гость всегда видел контекст игры. */}
            {(game.starts_at || game.created_at || game.place) && (
              <div style={{ fontSize: 13, color: "var(--mut)", display: "flex", gap: 12, margin: "6px 0 14px", flexWrap: "wrap" }}>
                {(game.starts_at || game.created_at) && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={13} />{fmtDate(game.starts_at || game.created_at)}</span>}
                {game.place && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} />{game.place}</span>}
              </div>
            )}

            {(() => {
              const slots = game.slots || [];
              const bySpot = (team, position) => slots.find((s) => s.team === team && s.position === position) || { team, position, taken: false };
              const freeSlots = slots.filter((s) => !s.taken);
              const filled = slots.length - freeSlots.length;
              const open = game.status === "open";
              return (
                <>
                  {/* Корт — как в приложении: кто стоит и где свободно, видно сразу */}
                  <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#1f4f86", aspectRatio: "16/9", border: "1px solid var(--line)", margin: "4px 0 6px" }}>
                    <div style={{ position: "absolute", inset: 7, border: "2px solid rgba(255,255,255,.85)" }} />
                    <div style={{ position: "absolute", top: 7, bottom: 7, left: "50%", width: 8, background: "#15365e", transform: "translateX(-50%)" }} />
                    {["A", "B"].map((team) => [1, 2].map((position) => {
                      const s = bySpot(team, position);
                      return (open || s.taken)
                        ? <CourtSpot key={team + position} s={s} side={team} busy={busy} onTake={() => take(team, position)} />
                        : null;
                    }))}
                  </div>
                  {open ? (
                    <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--mut)", marginBottom: 14 }}>
                      {freeSlots.length > 0 ? `${t("pub_tap_spot")} · ${filled}/4` : t("pub_full_court")}
                    </div>
                  ) : (
                    <p style={{ color: "var(--mut)", margin: "8px 0 12px", textAlign: "center", fontSize: 13 }}>{t("pub_game_closed")}</p>
                  )}

                  {open && freeSlots.length > 0 && (
                    session ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--lime)", fontSize: 13, marginBottom: 12 }}>
                        <UserCheck size={16} /> {t("pub_logged_rating").replace("{name}", profileName || "игрок")}
                      </div>
                    ) : (
                      <input ref={nameRef} className="gj-input" placeholder={t("pub_guest_name_ph")} value={name} onChange={(e) => setName(e.target.value)} />
                    )
                  )}
                  {open && freeSlots.length > 0 && (
                    <button className="gj-btn" style={{ width: "100%", padding: 13, fontSize: 15, borderRadius: 14 }} disabled={busy}
                      onClick={() => take(freeSlots[0].team, freeSlots[0].position)}>
                      {busy ? t("pub_joining") : t("pub_stand_court")}
                    </button>
                  )}
                  {open && !session && freeSlots.length > 0 && (
                    <div style={{ textAlign: "center", marginTop: 10 }}>
                      <button className="gj-loginlink" onClick={() => setShowLogin(true)}>
                        <LogIn size={14} /> {t("pub_login_for_rating")}
                      </button>
                    </div>
                  )}
                  {err && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 8, textAlign: "center" }}>{err}</p>}
                  {note && <p style={{ color: "var(--ink)", fontSize: 13, marginTop: 8, textAlign: "center" }}>{note}</p>}
                </>
              );
            })()}
          </>
        )}
      </div>
      <div style={{ textAlign: "center", color: "var(--mut)", fontSize: 12, maxWidth: 400 }}>
        {t("pub_footer_q")}{" "}
        <a href="/" style={{ color: "var(--lime)", fontWeight: 700, textDecoration: "none" }}>
          {t("pub_footer_cta")}
        </a>
        <div style={{ marginTop: 6, opacity: .8 }}>{t("pub_demo_note")}</div>
      </div>
    </div>
  );
}
