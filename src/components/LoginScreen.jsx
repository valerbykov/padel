// components/LoginScreen.jsx
// Единый экран входа: Telegram + Email (magic-link) + SMS (код).
// Поддерживает светлую/тёмную тему и переключение языка.
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import TelegramLogin from "./TelegramLogin";
import { Send, Mail, Phone, Check, AlertCircle, Sun, Moon, ArrowLeft } from "lucide-react";
import Logo from "./Logo";
import { t, setLang } from "../lib/i18n";
import { signInGoogle as authSignInGoogle, signInYandex, signInApple as authSignInApple } from "../lib/auth";
import { isRussiaSync, detectRegion } from "../lib/region";
import { authRedirectTo } from "../lib/platform";

const darkVars = "--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;--lime-fg:#0a1612;";
const lightVars = "--bg:#f2f7f4;--surface:#ffffff;--surface2:#e6f0ea;--line:#c4d9cc;--ink:#0d1f18;--mut:#4a7060;--lime:#2a7a00;--coral:#d93a1f;--lime-fg:#ffffff;";

const mkCss = (isLight) => `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.lg-root{${isLight ? lightVars : darkVars}
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;display:flex;flex-direction:column;
 background-image:radial-gradient(circle at 80% -10%,${isLight ? "rgba(42,122,0,.06)" : "rgba(200,255,45,.10)"},transparent 45%),radial-gradient(circle at 0% 110%,${isLight ? "rgba(40,120,90,.08)" : "rgba(40,120,90,.18)"},transparent 40%);}
.lg-body{flex:1;display:flex;align-items:center;justify-content:center;padding:20px;}
.lg-topbar{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(10px);}
.lg-card{background:var(--surface);border:1px solid var(--line);border-radius:24px;padding:26px 24px 22px;width:100%;max-width:400px;box-shadow:0 24px 60px -28px rgba(0,0,0,.6);}
.lg-sub{font-family:'Outfit',sans-serif;font-size:13.5px;color:var(--mut);text-align:center;line-height:1.45;margin:6px auto 2px;max-width:300px;}
.lg-trust{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:18px;padding-top:16px;border-top:1px solid var(--line);color:var(--mut);font-size:12px;}
.lg-trust .dot{width:5px;height:5px;border-radius:50%;background:var(--lime);}
.lg-display{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.lg-seg{display:flex;background:var(--surface2);border:1px solid var(--line);border-radius:14px;padding:4px;margin:18px 0;}
.lg-seg button{flex:1;border:none;background:none;color:var(--mut);font-family:'Outfit';font-weight:600;font-size:13px;
 padding:9px 0;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;}
.lg-seg button.on{background:var(--lime);color:var(--lime-fg);}
.lg-input{width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);
 font-family:'Outfit';padding:12px;outline:none;box-sizing:border-box;font-size:16px;}
.lg-input:focus{border-color:var(--lime);}
.lg-btn{width:100%;background:var(--lime);color:var(--lime-fg);font-weight:700;border:none;border-radius:14px;padding:13px;
 cursor:pointer;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;font-family:'Outfit';font-size:15px;
 transition:transform .12s, filter .15s;}
.lg-btn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.05);}
.lg-btn:active:not(:disabled){transform:translateY(0);}
.lg-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.lg-btn-sec{background:var(--surface2);color:var(--ink);border:1px solid var(--line);}
.lg-oauth{width:100%;margin-top:16px;padding:12px;border-radius:14px;cursor:pointer;background:#fff;color:#1f1f1f;
 border:1px solid #dadce0;font-weight:700;font-family:'Outfit',sans-serif;display:flex;align-items:center;justify-content:center;gap:10px;
 transition:transform .12s, box-shadow .15s;}
.lg-oauth:hover{transform:translateY(-1px);box-shadow:0 6px 18px -8px rgba(0,0,0,.5);}
.lg-seg button{transition:background .15s, color .15s;}
.lg-msg{display:flex;align-items:center;gap:8px;font-size:13px;margin-top:12px;padding:10px 12px;border-radius:12px;}
.lg-iconbtn{background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:6px 10px;cursor:pointer;color:var(--mut);display:flex;align-items:center;gap:4px;font-family:'Outfit';font-size:11px;font-weight:700;}
.lg-iconbtn.active{background:color-mix(in srgb,var(--lime) 18%,transparent);color:var(--lime);border-color:color-mix(in srgb,var(--lime) 40%,transparent);}
`;

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function LoginScreen({ botName, onSuccess, onBack, theme = "dark", lang = "ru", onThemeToggle, onLangChange }) {
  const [method, setMethod] = useState("email"); // telegram | email | sms — по умолчанию email
  const [isRF, setIsRF] = useState(isRussiaSync()); // РФ → скрываем Google (закон об авторизации)
  const isIOS = typeof window !== "undefined" && window.Capacitor?.getPlatform?.() === "ios"; // Sign in with Apple — только iOS
  useEffect(() => { detectRegion().then(setIsRF); }, []);
  useEffect(() => { if (isRF && method === "telegram") setMethod("email"); }, [isRF, method]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: "", text: "" });

  const reset = () => { setMsg({ kind: "", text: "" }); };

  const handleLang = (l) => { setLang(l); onLangChange?.(l); };

  // ----- Google OAuth -----
  const signInGoogle = async () => {
    reset();
    try {
      // общая логика: web -> origin, нативка -> системный браузер + deep link
      await authSignInGoogle();
    } catch (e) { setMsg({ kind: "err", text: e.message }); }
  };

  // Apple: показываем только на iOS и вне РФ (в РФ вход по Apple ID недоступен).
  const signInApple = async () => {
    reset();
    try { await authSignInApple(); }
    catch (e) { setMsg({ kind: "err", text: e.message }); }
  };

  // ----- Email magic-link -----
  const sendEmail = async () => {
    if (!emailOk(email) || busy) return;
    setBusy(true); reset();
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: authRedirectTo() },
      });
      if (error) throw error;
      setMsg({ kind: "ok", text: t("login_link_sent") });
    } catch (e) { setMsg({ kind: "err", text: e.message }); }
    finally { setBusy(false); }
  };

  // ----- SMS: шаг 1 — отправить код -----
  const sendSms = async () => {
    if (!phone.trim() || busy) return;
    setBusy(true); reset();
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim() });
      if (error) throw error;
      setSmsSent(true);
      setMsg({ kind: "ok", text: t("login_sms_sent") });
    } catch (e) { setMsg({ kind: "err", text: e.message }); }
    finally { setBusy(false); }
  };

  // ----- SMS: шаг 2 — проверить код -----
  const verifySms = async () => {
    if (!code.trim() || busy) return;
    setBusy(true); reset();
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: phone.trim(), token: code.trim(), type: "sms" });
      if (error) throw error;
      onSuccess?.();
    } catch (e) { setMsg({ kind: "err", text: e.message }); }
    finally { setBusy(false); }
  };

  const Msg = () =>
    msg.kind ? (
      <div className="lg-msg" style={{
        background: msg.kind === "ok" ? "rgba(200,255,45,.12)" : "rgba(255,106,82,.12)",
        color: msg.kind === "ok" ? "var(--lime)" : "var(--coral)",
      }}>
        {msg.kind === "ok" ? <Check size={16} /> : <AlertCircle size={16} />} {msg.text}
      </div>
    ) : null;

  return (
    <div className="lg-root">
      <style>{mkCss(theme === "light")}</style>

      {/* Top bar */}
      <div className="lg-topbar">
        {onBack ? (
          <button className="lg-iconbtn" onClick={onBack} style={{ fontSize: 13, padding: "6px 12px" }}>
            <ArrowLeft size={14} /> {t("back")}
          </button>
        ) : <span />}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button className="lg-iconbtn" onClick={() => { const o = ["ru", "en", "es"]; handleLang(o[(o.indexOf(lang) + 1) % o.length]); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {lang.toUpperCase()} <span style={{ opacity: .6, fontWeight: 400 }}>↻</span>
          </button>
          <button className="lg-iconbtn" onClick={onThemeToggle} aria-label={t("aria_theme")} style={{ padding: "6px 9px" }}>
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="lg-body">
        <div className="lg-card">
          <div style={{ display: "flex", justifyContent: "center" }}><Logo theme={theme} showTagline /></div>
          <div className="lg-sub">{t("login_subtitle")}</div>


          {!isRF && (
          <button className="lg-oauth" onClick={signInGoogle}>
            <span style={{ fontFamily: "Arial, sans-serif", fontWeight: 700, fontSize: 16 }}>
              <span style={{ color: "#4285F4" }}>G</span><span style={{ color: "#EA4335" }}>o</span><span style={{ color: "#FBBC05" }}>o</span><span style={{ color: "#4285F4" }}>g</span><span style={{ color: "#34A853" }}>l</span><span style={{ color: "#EA4335" }}>e</span>
            </span>
            {t("login_google")}
          </button>
          )}

          {!isRF && isIOS && (
          <button className="lg-oauth" onClick={signInApple} style={{ background: "#000", color: "#fff", border: "none", marginTop: 10 }}>
            <svg viewBox="0 0 384 512" width="17" height="17" fill="#fff" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
            {t("login_apple")}
          </button>
          )}

          {isRF && (
          <button className="lg-oauth" onClick={signInYandex}>
            <span style={{ fontFamily: "Arial, sans-serif", fontWeight: 900, fontSize: 17, color: "#FC3F1D" }}>Я</span>
            {t("login_yandex")}
          </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 4px", color: "var(--mut)", fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} /> {t("login_or")} <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>

          <div className="lg-seg">
            {!isRF && <button className={method === "telegram" ? "on" : ""} onClick={() => { setMethod("telegram"); reset(); }}><Send size={14} />Telegram</button>}
            <button className={method === "email" ? "on" : ""} onClick={() => { setMethod("email"); reset(); }}><Mail size={14} />Email</button>
            <button className={method === "sms" ? "on" : ""} onClick={() => { setMethod("sms"); reset(); }}><Phone size={14} />SMS</button>
          </div>

          {!isRF && method === "telegram" && (
            <div>
              <p style={{ fontSize: 13, color: "var(--mut)", marginBottom: 12 }}>{t("login_via_tg")}</p>
              <TelegramLogin botName={botName} onSuccess={onSuccess} />
            </div>
          )}

          {method === "email" && (
            <div>
              <input className="lg-input" type="email" placeholder="you@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="lg-btn" disabled={!emailOk(email) || busy} onClick={sendEmail}>
                <Mail size={16} /> {busy ? t("login_sending") : t("login_get_link")}
              </button>
              <Msg />
            </div>
          )}

          {method === "sms" && (
            <div>
              {!smsSent ? (
                <>
                  <input className="lg-input" type="tel" placeholder="+7 900 000-00-00" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <button className="lg-btn" disabled={!phone.trim() || busy} onClick={sendSms}>
                    <Phone size={16} /> {busy ? t("login_sending") : t("login_get_code")}
                  </button>
                </>
              ) : (
                <>
                  <input className="lg-input" inputMode="numeric" placeholder={t("login_sms_ph")} value={code} onChange={(e) => setCode(e.target.value)} />
                  <button className="lg-btn" disabled={!code.trim() || busy} onClick={verifySms}>
                    <Check size={16} /> {busy ? t("login_checking") : t("login_verify_code")}
                  </button>
                  <button className="lg-btn lg-btn-sec" onClick={() => { setSmsSent(false); setCode(""); reset(); }}>
                    {t("login_change_phone")}
                  </button>
                </>
              )}
              <Msg />
            </div>
          )}
        </div>
      </div>

      {/* Реквизиты владельца — публичный минимум для согласования имени отправителя SMS.
          Паспорт/адрес/ДР НЕ публикуем. */}
      <div style={{ padding: "14px 20px 22px", textAlign: "center", color: "var(--mut)", fontSize: 11.5, lineHeight: 1.6 }}>
        Быков Валерий Иванович · ИНН 770970215454 · <a href="mailto:valerbykov@gmail.com" style={{ color: "inherit", textDecoration: "underline" }}>valerbykov@gmail.com</a>
      </div>
    </div>
  );
}
