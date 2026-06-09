// components/TournamentJoin.jsx
// Гостевой вход на турнир по ссылке /t/CODE.
// Все статусы (набор / идёт / завершён) показывают полный TournamentView только для чтения.
// Кнопка «Присоединиться» видна только при status=open и ещё не зарегистрировался.
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getTournamentByCode, joinTournamentByCode } from "../lib/tournamentApi";
import { TournamentView } from "./Tournaments";
import LoginScreen from "./LoginScreen";
import { Trophy, AlertCircle, Check, LogIn, UserCheck } from "lucide-react";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.tj-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;color-scheme:dark;
 background-image:radial-gradient(circle at 80% -10%,rgba(200,255,45,.10),transparent 45%);}
.tj-wrap{max-width:460px;margin:0 auto;padding:20px 16px 40px;}
.tj-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:18px;margin-bottom:12px;}
.tj-d{font-family:'Anton',sans-serif;text-transform:uppercase;letter-spacing:.5px;}
.tj-input{width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:'Outfit';padding:12px;outline:none;box-sizing:border-box;margin-bottom:10px;}
.tj-input:focus{border-color:var(--lime);}
.tj-btn{background:var(--lime);color:#0a1612;font-weight:700;border:none;border-radius:14px;padding:13px;cursor:pointer;width:100%;}
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
  const [session, setSession] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [profileId, setProfileId] = useState(null);
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
      const { data } = await supabase.from("profiles").select("id, name").eq("user_id", user.id).maybeSingle();
      setProfileName(data?.name || "");
      setProfileId(data?.id || null);
    })();
  }, [session]);

  if (showLogin && !session) return <LoginScreen botName={botName} onSuccess={() => setShowLogin(false)} />;

  const join = async () => {
    const display = session ? (profileName || "Игрок") : name.trim();
    if (!session && !name.trim()) return;
    if (busy) return;
    setBusy(true); setErr("");
    try { await joinTournamentByCode(code, display); setJoined(true); await load(); }
    catch (e) {
      const map = { tournament_full: "Турнир уже заполнен", tournament_closed: "Регистрация закрыта", tournament_not_found: "Турнир не найден" };
      setErr(map[e.message] || "Не удалось присоединиться");
    } finally { setBusy(false); }
  };

  // Вводить счёт могут только участники турнира (profile_id совпадает) или если турнир ещё в наборе
  const canEdit = !!session && !!profileId && (t?.players || []).some((p) => p.profile_id === profileId);

  return (
    <div className="tj-root">
      <style>{css}</style>
      <div className="tj-wrap">
        {/* Шапка */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ color: "var(--lime)", fontSize: 12, fontWeight: 700, letterSpacing: 2, display: "flex", alignItems: "center", gap: 6 }}>
            <Trophy size={14} /> ПАДЕЛ · ТУРНИР
          </div>
          {session ? (
            <button className="tj-ghost" style={{ fontSize: 12 }} onClick={() => window.location.assign("/")}>В приложение →</button>
          ) : (
            <button className="tj-ghost" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowLogin(true)}>
              <LogIn size={13} /> Войти
            </button>
          )}
        </div>

        {t === undefined && (
          <div className="tj-card" style={{ textAlign: "center", color: "var(--mut)" }}>Загрузка…</div>
        )}

        {t === null && (
          <div className="tj-card" style={{ color: "var(--coral)", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} /> Турнир по коду {code} не найден.
          </div>
        )}

        {t && (
          <>
            {/* Баннер: присоединиться (только при status=open и ещё не зарегистрирован) */}
            {t.status === "open" && !joined && (
              <div className="tj-card">
                <div className="tj-d" style={{ fontSize: 20, marginBottom: 4 }}>{t.name || "Американо"}</div>
                <div style={{ fontSize: 13, color: "var(--mut)", marginBottom: 14 }}>
                  {(t.players || []).length}/{t.target_size} игроков · до {t.points_per_game} очков
                </div>

                {session ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--lime)", fontSize: 13, marginBottom: 12 }}>
                    <UserCheck size={16} /> Вошёл как {profileName || "игрок"} — результат пойдёт в рейтинг
                  </div>
                ) : (
                  <>
                    <input className="tj-input" placeholder="Твоё имя (как гость)" value={name} onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && join()} />
                    <button className="tj-loginlink" onClick={() => setShowLogin(true)}>
                      <LogIn size={14} /> Войти для записи в рейтинг
                    </button>
                  </>
                )}

                <button className="tj-btn" disabled={(!session && !name.trim()) || busy} onClick={join}>
                  {busy ? "Присоединяюсь…" : "Присоединиться к турниру"}
                </button>
                {err && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 8 }}>{err}</p>}
              </div>
            )}

            {/* Подтверждение присоединения */}
            {joined && (
              <div className="tj-card" style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--lime)", fontWeight: 600 }}>
                <Check size={18} /> Ты в списке участников!
              </div>
            )}

            {/* Гостю объясняем ограничение */}
            {!session && t.status !== "open" && (
              <div style={{ fontSize: 12, color: "var(--mut)", textAlign: "center", marginBottom: 8 }}>
                Режим просмотра · <button className="tj-loginlink" style={{ display: "inline", fontSize: 12 }} onClick={() => setShowLogin(true)}>Войди</button> для ввода счёта
              </div>
            )}

            {/* Полный TournamentView: read-only для гостей, полный для залогиненных */}
            <TournamentView id={t.id} players={[]} back={null} readOnly={!canEdit} initialT={t}
              reloadFn={() => getTournamentByCode(code)}
              isGroupMember={false}
              currentProfileId={profileId}
              spectatorMode={!canEdit} />
          </>
        )}
      </div>
    </div>
  );
}
