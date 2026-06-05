// components/TournamentJoin.jsx
// Вход на турнир по ссылке /t/CODE. Можно зайти гостем по имени ИЛИ войти
// в аккаунт — тогда участие привяжется к профилю. props: { code, botName }.
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getTournamentByCode, joinTournamentByCode } from "../lib/tournamentApi";
import { standings, detailedStandings } from "../lib/americano";
import StandingsTable from "./StandingsTable";
import LoginScreen from "./LoginScreen";
import { Trophy, Users, AlertCircle, Check, LogIn, UserCheck } from "lucide-react";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.tj-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;
 background-image:radial-gradient(circle at 80% -10%,rgba(200,255,45,.10),transparent 45%);}
.tj-card{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:22px;width:100%;max-width:400px;}
.tj-d{font-family:'Anton',sans-serif;text-transform:uppercase;letter-spacing:.5px;}
.tj-input{width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:'Outfit';padding:12px;outline:none;box-sizing:border-box;margin-bottom:10px;}
.tj-btn{width:100%;background:var(--lime);color:#0a1612;font-weight:700;border:none;border-radius:14px;padding:13px;cursor:pointer;}
.tj-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.tj-loginlink{background:none;border:none;color:var(--lime);cursor:pointer;font-family:'Outfit';font-size:13px;display:inline-flex;align-items:center;gap:6px;padding:0;margin-bottom:6px;}
`;

export default function TournamentJoin({ code, botName }) {
  const [t, setT] = useState(undefined);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [err, setErr] = useState("");
  const [session, setSession] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [showLogin, setShowLogin] = useState(false);

  const load = async () => { try { setT(await getTournamentByCode(code)); } catch (e) { setT(null); } };
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
      const { data } = await supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle();
      setProfileName(data?.name || "");
    })();
  }, [session]);

  if (showLogin && !session) {
    return <LoginScreen botName={botName} onSuccess={() => setShowLogin(false)} />;
  }

  const join = async () => {
    const display = session ? (profileName || "Игрок") : name.trim();
    if (!session && !name.trim()) return;
    if (busy) return;
    setBusy(true); setErr("");
    try { await joinTournamentByCode(code, display); setJoined(true); await load(); }
    catch (e) {
      const map = { tournament_full: "Турнир уже заполнен", tournament_closed: "Регистрация закрыта — турнир начался", tournament_not_found: "Турнир не найден" };
      setErr(map[e.message] || "Не удалось присоединиться");
    } finally { setBusy(false); }
  };

  return (
    <div className="tj-root">
      <style>{css}</style>
      <div className="tj-card">
        <div style={{ color: "var(--lime)", fontSize: 12, fontWeight: 700, letterSpacing: 2, display: "flex", alignItems: "center", gap: 6 }}>
          <Trophy size={14} /> ПРИГЛАШЕНИЕ НА ТУРНИР
        </div>

        {t === undefined && <p style={{ color: "var(--mut)", marginTop: 16 }}>Загрузка…</p>}
        {t === null && <p style={{ color: "var(--coral)", marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}><AlertCircle size={16} /> Турнир по коду {code} не найден.</p>}

        {t && (
          <>
            <div className="tj-d" style={{ fontSize: 26, marginTop: 4 }}>{t.name || "Американо"}</div>
            <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 14 }}>{(t.players || []).length}/{t.target_size} игроков · до {t.points_per_game} очков</div>

            {t.status !== "open" ? (
              <>
                {session ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--lime)", marginBottom: 12 }}>
                    <UserCheck size={16} /> Вошёл как {profileName || "игрок"}
                    <button onClick={() => window.location.assign("/")} style={{ marginLeft: "auto", background: "#16291f", color: "#eef3ee", border: "1px solid #22382c", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontSize: 12 }}>В приложение →</button>
                  </div>
                ) : (
                  <button className="tj-btn" style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setShowLogin(true)}>
                    <LogIn size={16} /> Войти
                  </button>
                )}
                <TournamentResults t={t} />
              </>
            ) : joined ? (
              <p style={{ color: "var(--lime)", display: "flex", alignItems: "center", gap: 8 }}><Check size={16} /> Ты в списке участников!</p>
            ) : (
              <>
                {session ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--lime)", fontSize: 13, marginBottom: 12 }}>
                    <UserCheck size={16} /> Вошёл как {profileName || "игрок"}
                  </div>
                ) : (
                  <>
                    <input className="tj-input" placeholder="Твоё имя (как гость)" value={name} onChange={(e) => setName(e.target.value)} />
                    <button className="tj-loginlink" onClick={() => setShowLogin(true)}>
                      <LogIn size={14} /> Войти через аккаунт
                    </button>
                  </>
                )}
                <button className="tj-btn" disabled={(!session && !name.trim()) || busy} onClick={join}>{busy ? "Присоединяюсь…" : "Присоединиться"}</button>
                {err && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 8 }}>{err}</p>}
              </>
            )}

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 6 }}>Участники</div>
              {(t.players || []).map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                  <Users size={13} color="var(--mut)" /><span>{p.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TournamentResults({ t }) {
  const table = detailedStandings((t.players || []).map((p) => ({ id: p.id, name: p.name })), t.matches || []);
  const done = t.status === "finished";
  return (
    <div>
      <p style={{ color: "var(--mut)", marginBottom: 6 }}>{done ? "Турнир завершён." : "Турнир идёт."}</p>
      <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>{done ? "Итоговая таблица" : "Текущая таблица"}</div>
      <StandingsTable rows={table} />
    </div>
  );
}
