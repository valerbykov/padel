// components/GuestJoin.jsx
// Вход по ссылке-приглашению (/j/:code). Можно зайти гостем по имени
// ИЛИ войти в аккаунт — тогда слот привяжется к профилю (результат
// засчитается в твой рейтинг). props: { code, botName }.
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import LoginScreen from "./LoginScreen";
import { Calendar, MapPin, Check, AlertCircle, LogIn, UserCheck } from "lucide-react";
import { t } from "../lib/i18n";
import { usePublicChrome, PublicToggles } from "./publicChrome";

const fmtDate = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.gj-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;
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

export default function GuestJoin({ code, botName }) {
  const [game, setGame] = useState(undefined);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [session, setSession] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [showLogin, setShowLogin] = useState(false);
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
    return <LoginScreen botName={botName} onSuccess={() => setShowLogin(false)} theme={theme} lang={lang} onThemeToggle={toggleTheme} onLangChange={cycleLang} />;
  }

  const take = async (team, position) => {
    const display = session ? (profileName || "Игрок") : name.trim();
    if (!session && !name.trim()) return;
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.rpc("join_game_slot", { p_code: code, p_team: team, p_position: position, p_guest_name: display });
      if (error) throw error;
      await load();
    } catch (e) {
      const map = { slot_taken: "Слот уже заняли", game_closed: "Игра уже закрыта", game_not_found: "Игра не найдена" };
      setErr(map[e.message] || "Не удалось занять слот");
    } finally { setBusy(false); }
  };

  return (
    <div className="gj-root" style={{ ...vars, flexDirection: "column", gap: 20 }}>
      <style>{css}</style>
      <div style={{ width: "100%", maxWidth: 400 }}><PublicToggles theme={theme} lang={lang} onTheme={toggleTheme} onLang={cycleLang} /></div>
      <div className="gj-card">
        <div style={{ color: "var(--lime)", fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>{t("pub_game_invite")}</div>

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

            {game.status !== "open" ? (
              <p style={{ color: "var(--mut)", marginTop: 12 }}>{t("pub_game_closed")}</p>
            ) : (
              <>
                {session ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--lime)", fontSize: 13, marginBottom: 12 }}>
                    <UserCheck size={16} /> {t("pub_logged_rating").replace("{name}", profileName || "игрок")}
                  </div>
                ) : (
                  <>
                    <input className="gj-input" placeholder={t("pub_guest_name_ph")} value={name} onChange={(e) => setName(e.target.value)} />
                    <div style={{ marginBottom: 14 }}>
                      <button className="gj-loginlink" onClick={() => setShowLogin(true)}>
                        <LogIn size={14} /> {t("pub_login_for_rating")}
                      </button>
                    </div>
                  </>
                )}

                {(game.slots || []).map((s, i) => (
                  <div key={i} className="gj-slot">
                    <span className="gj-display" style={{ fontSize: 12, color: s.team === "A" ? "var(--lime)" : "var(--coral)", width: 24 }}>{s.team}</span>
                    <span style={{ flex: 1, color: s.taken ? "var(--ink)" : "var(--mut)" }}>{s.taken ? s.name : t("pub_free")}</span>
                    {!s.taken && <button className="gj-btn" disabled={(!session && !name.trim()) || busy} onClick={() => take(s.team, s.position)}>{t("pub_take_slot")}</button>}
                  </div>
                ))}
                {err && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 8 }}>{err}</p>}
              </>
            )}
          </>
        )}
      </div>
      <div style={{ textAlign: "center", color: "var(--mut)", fontSize: 12, maxWidth: 400 }}>
        {t("pub_footer_q")}{" "}
        <a href="/" style={{ color: "var(--lime)", fontWeight: 700, textDecoration: "none" }}>
          {t("pub_footer_cta")}
        </a>
      </div>
    </div>
  );
}
