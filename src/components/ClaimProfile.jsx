// components/ClaimProfile.jsx
// Экран привязки гостевого профиля к аккаунту.
// Маршрут: /r/<claim_code>
// Поток: загрузка имени → логин (если не авторизован) → подтверждение → claim_profile RPC
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getProfileByClaimCode, claimProfile } from "../lib/padelApi";
import LoginScreen from "./LoginScreen";
import { UserCheck, AlertCircle, CheckCircle2, LogIn, ArrowRight } from "lucide-react";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.cp-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
  font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;color-scheme:dark;
  background-image:radial-gradient(circle at 20% 110%,rgba(200,255,45,.08),transparent 50%);}
.cp-wrap{max-width:420px;margin:0 auto;padding:40px 16px;}
.cp-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:24px;margin-bottom:12px;}
.cp-d{font-family:'Outfit',sans-serif;font-weight:800;letter-spacing:-0.3px;}
.cp-btn{background:var(--lime);color:#0a1612;font-weight:700;border:none;border-radius:14px;padding:14px;cursor:pointer;width:100%;font-family:'Outfit';font-size:15px;display:flex;align-items:center;justify-content:center;gap:8px;}
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
    return <LoginScreen botName={botName} onSuccess={() => setShowLogin(false)} />;
  }

  const claim = async () => {
    setBusy(true);
    setErr("");
    try {
      const result = await claimProfile(code);
      setDone(result.name);
    } catch (e) {
      const map = {
        claim_not_found: "Ссылка недействительна или уже была использована.",
        not_authenticated: "Нужно войти в аккаунт.",
      };
      setErr(map[e.message] || "Что-то пошло не так. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cp-root">
      <style>{css}</style>
      <div className="cp-wrap">
        <div style={{ color: "var(--lime)", fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 24 }}>
          ПАДЕЛ · ЛИГА ДРУЗЕЙ
        </div>

        {/* Загрузка */}
        {profile === undefined && (
          <div className="cp-card" style={{ textAlign: "center", color: "var(--mut)" }}>Загрузка…</div>
        )}

        {/* Профиль не найден */}
        {profile === null && (
          <div className="cp-card" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--coral)" }}>
            <AlertCircle size={20} />
            <div>
              <div style={{ fontWeight: 600 }}>Ссылка недействительна</div>
              <div style={{ fontSize: 13, color: "var(--mut)", marginTop: 4 }}>
                Возможно, профиль уже был привязан или ссылка устарела.
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
                Готово!
              </div>
              <div style={{ color: "var(--mut)", fontSize: 14 }}>
                История <b style={{ color: "var(--ink)" }}>{done}</b> привязана к твоему аккаунту.<br />
                Рейтинг и все сыгранные матчи теперь твои.
              </div>
            </div>
            <button className="cp-btn" onClick={() => window.location.assign("/")}>
              Открыть приложение <ArrowRight size={16} />
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
                Тебя добавил администратор лиги.<br />
                Привяжи аккаунт — и твоя история игр сохранится.
              </div>
            </div>

            {session ? (
              <>
                <div className="cp-card" style={{ display: "flex", alignItems: "center", gap: 10, padding: 14 }}>
                  <CheckCircle2 size={18} color="var(--lime)" />
                  <div style={{ fontSize: 13 }}>
                    Войдёшь как <b>{session.user?.user_metadata?.name || session.user?.email || "ты"}</b>
                  </div>
                </div>
                {err && (
                  <div style={{ color: "var(--coral)", fontSize: 13, marginBottom: 10, padding: "0 4px" }}>
                    {err}
                  </div>
                )}
                <button className="cp-btn" disabled={busy} onClick={claim}>
                  {busy ? "Привязываю…" : <>Да, это я — привязать аккаунт <ArrowRight size={16} /></>}
                </button>
                <button className="cp-ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => supabase.auth.signOut()}>
                  Войти под другим аккаунтом
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 12, paddingLeft: 4 }}>
                  Войди в аккаунт, чтобы привязать историю игр.
                </div>
                <button className="cp-btn" onClick={() => setShowLogin(true)}>
                  <LogIn size={16} /> Войти через Telegram
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
