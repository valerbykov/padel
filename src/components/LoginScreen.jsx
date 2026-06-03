// components/LoginScreen.jsx
// Единый экран входа: Telegram + Email (magic-link) + SMS (код).
// Требует lib/supabase.js и components/TelegramLogin.jsx.
import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import TelegramLogin from "./TelegramLogin";
import { Send, Mail, Phone, Check, AlertCircle } from "lucide-react";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.lg-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;
 background-image:radial-gradient(circle at 80% -10%,rgba(200,255,45,.10),transparent 45%),radial-gradient(circle at 0% 110%,rgba(40,120,90,.18),transparent 40%);}
.lg-card{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:24px;width:100%;max-width:400px;}
.lg-display{font-family:'Anton',sans-serif;text-transform:uppercase;letter-spacing:.5px;}
.lg-seg{display:flex;background:var(--surface2);border:1px solid var(--line);border-radius:14px;padding:4px;margin:18px 0;}
.lg-seg button{flex:1;border:none;background:none;color:var(--mut);font-family:'Outfit';font-weight:600;font-size:13px;
 padding:9px 0;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;}
.lg-seg button.on{background:var(--lime);color:#0a1612;}
.lg-input{width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);
 font-family:'Outfit';padding:12px;outline:none;box-sizing:border-box;}
.lg-input:focus{border-color:var(--lime);}
.lg-btn{width:100%;background:var(--lime);color:#0a1612;font-weight:700;border:none;border-radius:14px;padding:13px;
 cursor:pointer;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;}
.lg-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.lg-msg{display:flex;align-items:center;gap:8px;font-size:13px;margin-top:12px;padding:10px 12px;border-radius:12px;}
`;

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function LoginScreen({ botName, onSuccess }) {
  const [method, setMethod] = useState("telegram"); // telegram | email | sms
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: "", text: "" });

  const reset = () => { setMsg({ kind: "", text: "" }); };

  // ----- Email magic-link -----
  const sendEmail = async () => {
    if (!emailOk(email) || busy) return;
    setBusy(true); reset();
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setMsg({ kind: "ok", text: "Ссылка для входа отправлена на почту" });
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
      setMsg({ kind: "ok", text: "Код отправлен по SMS" });
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
      <style>{css}</style>
      <div className="lg-card">
        <div style={{ color: "var(--lime)", fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>PADEL · ЛИГА ДРУЗЕЙ</div>
        <div className="lg-display" style={{ fontSize: 28, marginTop: 4 }}>Вход</div>

        <div className="lg-seg">
          <button className={method === "telegram" ? "on" : ""} onClick={() => { setMethod("telegram"); reset(); }}><Send size={14} />Telegram</button>
          <button className={method === "email" ? "on" : ""} onClick={() => { setMethod("email"); reset(); }}><Mail size={14} />Email</button>
          <button className={method === "sms" ? "on" : ""} onClick={() => { setMethod("sms"); reset(); }}><Phone size={14} />SMS</button>
        </div>

        {method === "telegram" && (
          <div>
            <p style={{ fontSize: 13, color: "var(--mut)", marginBottom: 12 }}>Войди одним нажатием через свой Telegram-аккаунт.</p>
            <TelegramLogin botName={botName} onSuccess={onSuccess} />
          </div>
        )}

        {method === "email" && (
          <div>
            <input className="lg-input" type="email" placeholder="you@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="lg-btn" disabled={!emailOk(email) || busy} onClick={sendEmail}>
              <Mail size={16} /> {busy ? "Отправляю…" : "Получить ссылку"}
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
                  <Phone size={16} /> {busy ? "Отправляю…" : "Получить код"}
                </button>
              </>
            ) : (
              <>
                <input className="lg-input" inputMode="numeric" placeholder="Код из SMS" value={code} onChange={(e) => setCode(e.target.value)} />
                <button className="lg-btn" disabled={!code.trim() || busy} onClick={verifySms}>
                  <Check size={16} /> {busy ? "Проверяю…" : "Войти"}
                </button>
                <button className="lg-btn" style={{ background: "var(--surface2)", color: "var(--ink)", border: "1px solid var(--line)" }}
                  onClick={() => { setSmsSent(false); setCode(""); reset(); }}>
                  Изменить номер
                </button>
              </>
            )}
            <Msg />
          </div>
        )}
      </div>
    </div>
  );
}
