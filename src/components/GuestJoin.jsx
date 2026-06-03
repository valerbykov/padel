// components/GuestJoin.jsx
// Экран входа по ссылке-приглашению (/j/:code). Работает БЕЗ логина:
// читает игру через публичную RPC и даёт занять свободный слот.
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Calendar, MapPin, Check, AlertCircle } from "lucide-react";

const fmtDate = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.gj-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;
 background-image:radial-gradient(circle at 80% -10%,rgba(200,255,45,.10),transparent 45%),radial-gradient(circle at 0% 110%,rgba(40,120,90,.18),transparent 40%);}
.gj-card{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:22px;width:100%;max-width:400px;}
.gj-display{font-family:'Anton',sans-serif;text-transform:uppercase;letter-spacing:.5px;}
.gj-input{width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);
 font-family:'Outfit';padding:12px;outline:none;box-sizing:border-box;margin-bottom:12px;}
.gj-input:focus{border-color:var(--lime);}
.gj-slot{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--surface2);border:1px solid var(--line);margin-bottom:6px;}
.gj-btn{background:var(--lime);color:#0a1612;font-weight:700;border:none;border-radius:10px;padding:7px 13px;cursor:pointer;font-size:13px;}
.gj-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
`;

export default function GuestJoin({ code }) {
  const [game, setGame] = useState(undefined); // undefined=loading, null=not found
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const { data, error } = await supabase.rpc("get_game_by_code_full", { p_code: code });
      if (error) throw error;
      setGame(data || null);
    } catch (e) { setGame(null); }
  };
  useEffect(() => { load(); }, [code]);

  const take = async (team, position) => {
    if (!name.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.rpc("join_game_slot", {
        p_code: code, p_team: team, p_position: position, p_guest_name: name.trim(),
      });
      if (error) throw error;
      await load();
    } catch (e) {
      const map = { slot_taken: "Слот уже заняли", game_closed: "Игра уже закрыта", game_not_found: "Игра не найдена" };
      setErr(map[e.message] || "Не удалось занять слот");
    } finally { setBusy(false); }
  };

  return (
    <div className="gj-root">
      <style>{css}</style>
      <div className="gj-card">
        <div style={{ color: "var(--lime)", fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>ПРИГЛАШЕНИЕ В ИГРУ</div>

        {game === undefined && <p style={{ color: "var(--mut)", marginTop: 16 }}>Загрузка…</p>}

        {game === null && (
          <p style={{ color: "var(--coral)", marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} /> Игра по коду {code} не найдена.
          </p>
        )}

        {game && (
          <>
            <div className="gj-display" style={{ fontSize: 26, marginTop: 4 }}>{game.title || "Падел"}</div>
            {(game.starts_at || game.place) && (
              <div style={{ fontSize: 13, color: "var(--mut)", display: "flex", gap: 12, margin: "6px 0 14px", flexWrap: "wrap" }}>
                {game.starts_at && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={13} />{fmtDate(game.starts_at)}</span>}
                {game.place && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} />{game.place}</span>}
              </div>
            )}

            {game.status !== "open" ? (
              <p style={{ color: "var(--mut)", marginTop: 12 }}>Игра уже закрыта для входа.</p>
            ) : (
              <>
                <input className="gj-input" placeholder="Твоё имя" value={name} onChange={(e) => setName(e.target.value)} />
                {(game.slots || []).map((s, i) => (
                  <div key={i} className="gj-slot">
                    <span className="gj-display" style={{ fontSize: 12, color: s.team === "A" ? "var(--lime)" : "var(--coral)", width: 24 }}>{s.team}</span>
                    <span style={{ flex: 1, color: s.taken ? "var(--ink)" : "var(--mut)" }}>{s.taken ? s.name : "свободно"}</span>
                    {s.taken ? <Check size={15} color="var(--lime)" /> : (
                      <button className="gj-btn" disabled={!name.trim() || busy} onClick={() => take(s.team, s.position)}>Занять</button>
                    )}
                  </div>
                ))}
                {err && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 8 }}>{err}</p>}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
