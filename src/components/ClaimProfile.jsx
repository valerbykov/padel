// components/ClaimProfile.jsx
// Экран привязки гостевого профиля к аккаунту.
// Маршрут: /r/<claim_code>
// Поток: загрузка имени → логин (если не авторизован) → подтверждение → claim_profile RPC
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getProfileByClaimCode, claimProfile } from "../lib/padelApi";
import LoginScreen from "./LoginScreen";
import { UserCheck, AlertCircle, CheckCircle2, LogIn, ArrowRight } from "lucide-react";
import { t } from "../lib/i18n";
import { usePublicChrome, PublicToggles } from "./publicChrome";
import Logo from "./Logo";
import OpenInApp from "./OpenInApp";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.cp-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
  font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;color-scheme:dark;
  background-image:radial-gradient(circle at 20% 110%,rgba(200,255,45,.08),transparent 50%);}
.cp-wrap{max-width:420px;margin:0 auto;padding:40px 16px;}
.cp-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:24px;margin-bottom:12px;}
.cp-d{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.cp-btn{background:var(--lime);color:var(--lime-fg);font-weight:700;border:none;border-radius:14px;padding:14px;cursor:pointer;width:100%;font-family:'Outfit';font-size:15px;display:flex;align-items:center;justify-content:center;gap:8px;}
.cp-btn:disabled{filter:grayscale(.5) brightness(.7);cursor:not-allowed;}
.cp-ghost{background:var(--surface2);color:var(--ink);border:1px solid var(--line);border-radius:12px;cursor:pointer;padding:10px 16px;font-family:'Outfit';font-size:13px;}
`;

export default function ClaimProfile({ code, botName }) {
  const [profile, setProfile] = useState(undefined); // undefined=loading, null=not found, obj=found
  const [session, setSession] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // claimed name
  const [err, setErr] = useState("");
  const { theme, lang, vars, toggleTheme, cycleLang } = usePublicChrome();

  useEffect(() => {
    getProfileByClaimCode(code)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [code]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) setShowLogin(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (showLogin && !session) {
    return <LoginScreen botName={botName} onSuccess={() => setShowLogin(false)} onBack={() => setShowLogin(false)} theme={theme} lang={lang} onThemeToggle={toggleTheme} onLangChange={cycleLang} />;
  }

  const claim = async () => {
    setBusy(true);
    setErr("");
    try {
      const result = await claimProfile(code);
      setDone(result.name);
    } catch (e) {
      const map = {
        claim_not_found: t("err_claim_invalid"),
        not_authenticated: t("err_claim_auth"),
      };
      setErr(map[e.message] || t("err_claim_generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cp-root" style={vars}>
      <style>{css}</style>
      <div className="cp-wrap">
        <PublicToggles theme={theme} lang={lang} onTheme={toggleTheme} onLang={cycleLang} />
        <div style={{ marginBottom: 22 }}><Logo height={22} /></div>

        {/* Загрузка */}
        {profile === undefined && (
          <div className="cp-card" style={{ textAlign: "center", color: "var(--mut)" }}>{t("pub_loading")}</div>
        )}

        {/* Профиль не найден */}
        {profile === null && (
          <div className="cp-card" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--coral)" }}>
            <AlertCircle size={20} />
            <div>
              <div style={{ fontWeight: 600 }}>{t("pub_claim_invalid_t")}</div>
              <div style={{ fontSize: 13, color: "var(--mut)", marginTop: 4 }}>
                {t("pub_claim_invalid_s")}
              </div>
            </div>
          </div>
        )}

        {/* Успех после привязки */}
        {done && (
          <>
            <div className="cp-card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
              <div className="cp-d" style={{ fontSize: 22, color: "var(--lime)", marginBottom: 6 }}>
                {t("pub_claim_done_t")}
              </div>
              <div style={{ color: "var(--mut)", fontSize: 14 }}>
                {(() => { const parts = t("pub_claim_done_s").split("{name}"); return (<>{parts[0]}<b style={{ color: "var(--ink)" }}>{done}</b>{parts[1] || ""}</>); })()}
              </div>
            </div>
            <button className="cp-btn" onClick={() => window.location.assign("/")}>
              {t("pub_open_app")} <ArrowRight size={16} />
            </button>
          </>
        )}

        {/* Основной экран — профиль найден */}
        {profile && !done && (
          <>
            <div className="cp-card" style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--surface2)", border: "2px solid var(--lime)", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <UserCheck size={28} color="var(--lime)" />
              </div>
              <div className="cp-d" style={{ fontSize: 22, marginBottom: 4 }}>{profile.name}</div>
              <div style={{ fontSize: 13, color: "var(--mut)" }}>
                {t("pub_added_by_admin")}
              </div>
            </div>

            {session ? (
              <>
                <div className="cp-card" style={{ display: "flex", alignItems: "center", gap: 10, padding: 14 }}>
                  <CheckCircle2 size={18} color="var(--lime)" />
                  <div style={{ fontSize: 13 }}>
                    {(() => { const nm = session.user?.user_metadata?.name || session.user?.email || t("guest_default_name"); const parts = t("pub_login_as").split("{name}"); return (<>{parts[0]}<b>{nm}</b>{parts[1] || ""}</>); })()}
                  </div>
                </div>
                {err && (
                  <div style={{ color: "var(--coral)", fontSize: 13, marginBottom: 10, padding: "0 4px" }}>
                    {err}
                  </div>
                )}
                <button className="cp-btn" disabled={busy} onClick={claim}>
                  {busy ? t("pub_claiming") : <>{t("pub_claim_confirm")} <ArrowRight size={16} /></>}
                </button>
                <button className="cp-ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => supabase.auth.signOut()}>
                  {t("pub_login_other")}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 12, paddingLeft: 4 }}>
                  {t("pub_login_to_claim")}
                </div>
                <button className="cp-btn" onClick={() => setShowLogin(true)}>
                  <LogIn size={16} /> {t("pub_login_tg")}
                </button>
                {/* Сценарий «приложение уже установлено, QR открылся в браузере»:
                    тап уводит в натив (padelpack:// по жесту), код клейма доезжает
                    через appUrlOpen→routeFromUrl. Нет приложения — тап без эффекта. */}
                <OpenInApp path={`/r/${code}`} style={{ marginTop: 8 }} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
