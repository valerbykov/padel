// PadelLeague.jsx — основной экран на реальных данных Supabase.
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { getLeaderboard, addMember, createGame, listGames, submitResult, linkFor } from "./lib/padelApi";
import { getRatingHistory } from "./lib/statsApi";
import { listTournaments } from "./lib/tournamentApi";
import { standings, detailedStandings } from "./lib/americano";
import StandingsTable from "./components/StandingsTable";
import { Trophy, Swords, History, Users, Share2, Check, X, RefreshCw, Copy, PlusCircle, ChevronUp, ChevronDown, Calendar, MapPin, TrendingUp, LogIn, Award, Phone, Mail, ArrowLeft } from "lucide-react";
import Tournaments, { TournamentView } from "./components/Tournaments";
import CourtView from "./components/CourtView";

const DOG_COUNT = 15;
const dogAvatar = (idOrName) => {
  if (!idOrName) return null;
  const hash = [...String(idOrName)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return `/avatars/dog-${String((hash % DOG_COUNT) + 1).padStart(2, "0")}.png`;
};
const playerAvatar = (url, idOrName) => url || dogAvatar(idOrName);

const fmtDate = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.pl-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;color-scheme:dark;
 background-image:radial-gradient(circle at 80% -10%,rgba(200,255,45,.10),transparent 45%),radial-gradient(circle at 0% 110%,rgba(40,120,90,.18),transparent 40%);}
.pl-display{font-family:'Anton',sans-serif;letter-spacing:.5px;text-transform:uppercase;}
.pl-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;}
.pl-btn{background:var(--lime);color:#0a1612;font-weight:700;border:none;border-radius:14px;cursor:pointer;transition:transform .12s,filter .12s;}
.pl-btn:active{transform:scale(.97);}.pl-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
.pl-ghost{background:var(--surface2);color:var(--ink);border:1px solid var(--line);border-radius:14px;cursor:pointer;}
.pl-input,.pl-select{background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:'Outfit';outline:none;width:100%;}
.pl-input:focus,.pl-select:focus{border-color:var(--lime);}
.pl-tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;color:var(--mut);cursor:pointer;font-size:11px;font-weight:600;padding:8px 0;}
.pl-tab.on{color:var(--lime);}
.pl-pop{animation:pop .35s cubic-bezier(.2,.8,.2,1) both;}
@keyframes pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.pl-codebox{font-family:'Anton';letter-spacing:6px;font-size:30px;color:var(--lime);text-align:center;background:var(--surface2);border:1px dashed var(--line);border-radius:14px;padding:12px;}
.pl-slot{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--surface2);border:1px solid var(--line);}
@media(max-width:400px){
  .pl-card{border-radius:14px;}
  .pl-display{letter-spacing:.3px;}
  .pl-codebox{font-size:24px;letter-spacing:4px;}
  .pl-tab{font-size:10px;padding:6px 0;}
  .pl-slot{padding:8px 10px;gap:8px;}
}
`;

function LineChart({ values }) {
  const w = 300, h = 120, pad = 10;
  if (!values || values.length < 2)
    return <div style={{ color: "var(--mut)", fontSize: 13, textAlign: "center", padding: "26px 0" }}>Сыграй матч — появится динамика рейтинга.</div>;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const x = (i) => pad + (i * (w - 2 * pad)) / (values.length - 1);
  const y = (v) => h - pad - ((v - min) / span) * (h - 2 * pad);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
      <defs><linearGradient id="plg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c8ff2d" stopOpacity="0.32" /><stop offset="100%" stopColor="#c8ff2d" stopOpacity="0" /></linearGradient></defs>
      <polygon points={`${pad},${h - pad} ${pts} ${w - pad},${h - pad}`} fill="url(#plg)" />
      <polyline points={pts} fill="none" stroke="#c8ff2d" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill="#0a1612" stroke="#c8ff2d" strokeWidth="2" />)}
    </svg>
  );
}

function Step({ label, v, set }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button className="pl-ghost" style={{ width: 34, height: 34, borderRadius: 10 }} onClick={() => set(Math.max(0, v - 1))}><ChevronDown size={16} /></button>
        <div className="pl-display" style={{ fontSize: 26, width: 26, color: "var(--lime)" }}>{v}</div>
        <button className="pl-ghost" style={{ width: 34, height: 34, borderRadius: 10 }} onClick={() => set(Math.min(3, v + 1))}><ChevronUp size={16} /></button>
      </div>
    </div>
  );
}

// Контакты: иконки-ссылки
function ContactLinks({ contacts = {} }) {
  if (!contacts || !Object.values(contacts).some(Boolean)) return null;
  const links = [
    contacts.whatsapp && { href: `https://wa.me/${contacts.whatsapp.replace(/\D/g, "")}`, label: "WA", color: "#25d366" },
    contacts.telegram && { href: `https://t.me/${contacts.telegram.replace(/^@/, "")}`, label: "TG", color: "#229ed9" },
    contacts.email    && { href: `mailto:${contacts.email}`, label: "✉", color: "var(--mut)" },
    contacts.phone    && { href: `tel:${contacts.phone}`, label: "☎", color: "var(--mut)" },
  ].filter(Boolean);
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
      {links.map((l) => (
        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" style={{
          padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
          background: "rgba(255,255,255,.07)", border: `1px solid ${l.color}`,
          color: l.color, textDecoration: "none",
        }}>{l.label}</a>
      ))}
    </div>
  );
}

/* --------------------------------- root ----------------------------------- */
export default function PadelLeague({ groupId }) {
  const [tab, setTab] = useState("board");
  const [players, setPlayers] = useState([]);

  const loadLeaderboard = useCallback(async () => {
    if (!groupId) return;
    try { setPlayers(await getLeaderboard(groupId)); } catch (e) { /* noop */ }
  }, [groupId]);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  const titles = { board: "Друзья", games: "Игры", history: "История", tournaments: "Турниры" };

  if (!groupId) {
    return (
      <div className="pl-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <style>{css}</style>
        <div className="pl-card" style={{ padding: 28, maxWidth: 360 }}>
          <LogIn size={28} color="var(--lime)" style={{ marginBottom: 10 }} />
          <div className="pl-display" style={{ fontSize: 22, marginBottom: 8 }}>Войди в лигу</div>
          <div style={{ color: "var(--mut)", fontSize: 14 }}>Нажми «Войти» наверху, чтобы увидеть рейтинг и игры своей компании.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pl-root">
      <style>{css}</style>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "20px 16px 88px" }}>
        <header style={{ marginBottom: 18 }}>
          <div style={{ color: "var(--lime)", fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>PADEL · ЛИГА ДРУЗЕЙ</div>
          <h1 className="pl-display" style={{ fontSize: 30, lineHeight: 1, marginTop: 2, color: "var(--ink)" }}>{titles[tab]}</h1>
        </header>

        {tab === "board" && <Board groupId={groupId} players={players} reload={loadLeaderboard} />}
        {tab === "games" && <Games groupId={groupId} players={players} reloadLeaderboard={loadLeaderboard} />}
        {tab === "tournaments" && <Tournaments groupId={groupId} players={players} />}
        {tab === "history" && <HistoryView groupId={groupId} players={players} />}
      </div>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(10,22,18,.92)", borderTop: "1px solid var(--line)", backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 460, margin: "0 auto", display: "flex" }}>
          <button className={`pl-tab ${tab === "board" ? "on" : ""}`} onClick={() => setTab("board")}><Trophy size={20} />Друзья</button>
          <button className={`pl-tab ${tab === "games" ? "on" : ""}`} onClick={() => setTab("games")}><Swords size={20} />Игры</button>
          <button className={`pl-tab ${tab === "tournaments" ? "on" : ""}`} onClick={() => setTab("tournaments")}><Award size={20} />Турниры</button>
          <button className={`pl-tab ${tab === "history" ? "on" : ""}`} onClick={() => setTab("history")}><History size={20} />История</button>
        </div>
      </nav>
    </div>
  );
}

/* --------------------------------- Board ---------------------------------- */
function Board({ groupId, players, reload }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState({ whatsapp: "", telegram: "", email: "", phone: "" });
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const ranked = [...players].sort((a, b) => b.rating - a.rating);

  const resetForm = () => { setName(""); setContacts({ whatsapp: "", telegram: "", email: "", phone: "" }); };

  const add = async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try { await addMember(groupId, n, contacts); resetForm(); setOpen(false); reload(); }
    catch (e) { alert("Не удалось добавить игрока"); }
    finally { setBusy(false); }
  };

  if (selected) return <PlayerDetail groupId={groupId} player={selected} players={players} close={() => setSelected(null)} />;

  return (
    <div className="pl-pop">
      {ranked.length === 0 && <div className="pl-card" style={{ padding: 24, textAlign: "center", color: "var(--mut)", marginBottom: 8 }}>Игроков пока нет — добавь первого.</div>}
      {ranked.map((p, i) => (
        <div key={p.id} className="pl-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }} onClick={() => setSelected(p)}>
          <div className="pl-display" style={{ width: 22, fontSize: 22, color: ["#ffd23f", "#cfd8d0", "#cd7f4d"][i] || "var(--mut)" }}>{i + 1}</div>
          <img src={playerAvatar(p.avatar_url, p.id)} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: "var(--mut)" }}>{p.matches} игр · {p.wins} побед</div>
          </div>
          {p.contacts && Object.values(p.contacts).some(Boolean) && (
            <div style={{ fontSize: 10, color: "var(--lime)", flexShrink: 0 }}>📞</div>
          )}
        </div>
      ))}

      {open ? (
        <div className="pl-card" style={{ padding: 14, marginTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Добавить игрока</div>
          <input className="pl-input" style={{ padding: "10px 12px", marginBottom: 8 }} placeholder="Имя *" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} autoFocus />
          <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 6 }}>Контакты (опционально)</div>
          {[
            { key: "whatsapp", placeholder: "WhatsApp (+7…)" },
            { key: "telegram", placeholder: "Telegram (@username)" },
            { key: "email",    placeholder: "Email" },
            { key: "phone",    placeholder: "Телефон" },
          ].map(({ key, placeholder }) => (
            <input key={key} className="pl-input" style={{ padding: "8px 12px", marginBottom: 6 }} placeholder={placeholder}
              value={contacts[key]} onChange={(e) => setContacts(c => ({ ...c, [key]: e.target.value }))} />
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="pl-btn" style={{ flex: 1, padding: 11 }} disabled={!name.trim() || busy} onClick={add}>{busy ? "Добавляю…" : "Добавить"}</button>
            <button className="pl-ghost" style={{ padding: "0 14px" }} onClick={() => { resetForm(); setOpen(false); }}><X size={16} /></button>
          </div>
        </div>
      ) : (
        <button className="pl-ghost" style={{ width: "100%", padding: 12, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 600 }} onClick={() => setOpen(true)}>
          <Users size={18} /> Добавить игрока
        </button>
      )}
    </div>
  );
}

/* ----------------------------- PlayerDetail ------------------------------- */
function PlayerDetail({ groupId, player, players, close }) {
  const [hist, setHist] = useState(null);
  const [myId, setMyId] = useState(null);
  const [allMatches, setAllMatches] = useState(null);

  useEffect(() => {
    getRatingHistory(groupId, player.id).then(setHist).catch(() => setHist([player.rating]));

    // Определяем свой profile_id
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => { if (data) setMyId(data.id); });
    });

    // Загружаем матчи группы для статистики
    supabase.from("matches")
      .select("id, team_a, team_b, sets_a, sets_b, played_at")
      .eq("group_id", groupId)
      .order("played_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setAllMatches(data || []));
  }, [groupId, player.id]);

  const nameOf = (id) => players.find((p) => p.id === id)?.name || "Игрок";

  // Матчи, в которых участвуют оба (я + выбранный игрок)
  const withPlayer = !myId || !allMatches ? [] : allMatches.filter((m) => {
    const all = [...(m.team_a || []), ...(m.team_b || [])];
    return all.includes(myId) && all.includes(player.id);
  });

  // Разбиваем на "вместе" и "против"
  let toWins = 0, toLosses = 0, toDraws = 0; // together
  let vsWins = 0, vsLosses = 0, vsDraws = 0; // versus
  withPlayer.forEach((m) => {
    const myInA = (m.team_a || []).includes(myId);
    const thInA = (m.team_a || []).includes(player.id);
    const together = myInA === thInA;
    const myTeamWon = myInA ? m.sets_a > m.sets_b : m.sets_b > m.sets_a;
    const isDraw = m.sets_a === m.sets_b;
    if (together) {
      if (isDraw) toDraws++; else if (myTeamWon) toWins++; else toLosses++;
    } else {
      if (isDraw) vsDraws++; else if (myTeamWon) vsWins++; else vsLosses++;
    }
  });
  const toTotal = toWins + toLosses + toDraws;
  const vsTotal = vsWins + vsLosses + vsDraws;

  const statRow = (label, w, d, l, total) => total === 0 ? null : (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 22, color: "#3ddc84" }}>{w}</div>
          <div style={{ fontSize: 10, color: "var(--mut)" }}>победы</div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 22, color: "var(--ink)" }}>{d}</div>
          <div style={{ fontSize: 10, color: "var(--mut)" }}>ничьи</div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 22, color: "var(--coral)" }}>{l}</div>
          <div style={{ fontSize: 10, color: "var(--mut)" }}>поражения</div>
        </div>
        <div style={{ flex: 2, height: 6, borderRadius: 3, overflow: "hidden", background: "#16291f", display: "flex" }}>
          {w > 0 && <div style={{ flex: w, background: "#3ddc84" }} />}
          {d > 0 && <div style={{ flex: d, background: "#7d9488" }} />}
          {l > 0 && <div style={{ flex: l, background: "var(--coral)" }} />}
        </div>
      </div>
    </div>
  );

  return (
    <div className="pl-pop">
      <button className="pl-ghost" style={{ padding: "6px 12px", marginBottom: 12 }} onClick={close}>
        <ArrowLeft size={14} style={{ display: "inline", marginRight: 4 }} />Назад
      </button>

      {/* Шапка игрока */}
      <div className="pl-card" style={{ padding: 18, marginBottom: 10, textAlign: "center" }}>
        <img src={playerAvatar(player.avatar_url, player.id)} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--line)", marginBottom: 8 }} />
        <div className="pl-display" style={{ fontSize: 24 }}>{player.name}</div>
        <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 4 }}>{player.matches} игр · {player.wins} побед</div>
        <ContactLinks contacts={player.contacts} />
      </div>

      {/* Рейтинг + график */}
      <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <div className="pl-display" style={{ fontSize: 36, color: "var(--lime)" }}>{player.rating}</div>
          <div style={{ fontSize: 12, color: "var(--mut)" }}>рейтинг</div>
        </div>
        <LineChart values={hist || [player.rating]} />
      </div>

      {/* Статистика с этим игроком */}
      {myId && myId !== player.id && withPlayer.length > 0 && (
        <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Вместе сыграно {withPlayer.length} матчей</div>
          {statRow("Играли в одной команде", toWins, toDraws, toLosses, toTotal)}
          {statRow("Играли против друг друга", vsWins, vsDraws, vsLosses, vsTotal)}
        </div>
      )}

      {/* Последние совместные игры */}
      {myId && myId !== player.id && withPlayer.length > 0 && (
        <div className="pl-card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 8 }}>Последние игры вместе</div>
          {withPlayer.slice(0, 5).map((m) => {
            const myInA = (m.team_a || []).includes(myId);
            const thInA = (m.team_a || []).includes(player.id);
            const together = myInA === thInA;
            const myTeamWon = myInA ? m.sets_a > m.sets_b : m.sets_b > m.sets_a;
            const isDraw = m.sets_a === m.sets_b;
            const result = isDraw ? "Н" : myTeamWon ? "П" : "П";
            const resultColor = isDraw ? "var(--mut)" : myTeamWon ? "#3ddc84" : "var(--coral)";
            const teamA = (m.team_a || []).map(nameOf).join(" & ");
            const teamB = (m.team_b || []).map(nameOf).join(" & ");
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: isDraw ? "#22382c" : myTeamWon ? "rgba(61,220,132,.15)" : "rgba(255,106,82,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: resultColor, flexShrink: 0 }}>
                  {isDraw ? "Н" : myTeamWon ? "В" : "П"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--mut)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {teamA} <span style={{ color: "var(--line)" }}>vs</span> {teamB}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--mut)" }}>{together ? "вместе" : "против"} · {fmtDate(m.played_at)}</div>
                </div>
                <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 14, flexShrink: 0 }}>{m.sets_a}:{m.sets_b}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Games ---------------------------------- */
function Games({ groupId, players, reloadLeaderboard }) {
  const [games, setGames] = useState([]);
  const [mode, setMode] = useState("list");
  const [selId, setSelId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadGames = useCallback(async () => {
    setLoading(true);
    try { setGames(await listGames(groupId)); } catch (e) { /* noop */ } finally { setLoading(false); }
  }, [groupId]);
  useEffect(() => { loadGames(); }, [loadGames]);

  if (mode === "create")
    return <CreateGame groupId={groupId} players={players} back={() => setMode("list")} done={() => { setMode("list"); loadGames(); }} />;

  if (mode === "view") {
    const g = games.find((x) => x.id === selId);
    if (!g) { setMode("list"); return null; }
    return <GameCard game={g} back={() => setMode("list")} reloadGames={loadGames} reloadLeaderboard={reloadLeaderboard} />;
  }

  return (
    <div className="pl-pop">
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="pl-btn" style={{ flex: 1, padding: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setMode("create")}>
          <PlusCircle size={18} /> Создать игру
        </button>
        <button className="pl-ghost" style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 600 }} onClick={loadGames}>
          <RefreshCw size={16} />
        </button>
      </div>
      {loading && <div className="pl-card" style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>Загрузка…</div>}
      {!loading && games.length === 0 && <div className="pl-card" style={{ padding: 24, textAlign: "center", color: "var(--mut)" }}>Игр нет. Создай игру и отправь ссылку друзьям.</div>}
      {!loading && (() => {
        const upcoming = games.filter(g => g.status === "open" && (g.slots||[]).filter(s=>s.profile_id||s.guest_name).length < 4);
        const active   = games.filter(g => g.status === "open" && (g.slots||[]).filter(s=>s.profile_id||s.guest_name).length === 4);
        const played   = games.filter(g => g.status === "played");
        const section = (label, color, items) => items.length === 0 ? null : (
          <div key={label}>
            <div style={{ fontSize: 12, color: "var(--mut)", fontFamily:"'Anton',sans-serif", textTransform:"uppercase", letterSpacing:1, margin:"12px 2px 6px" }}>{label}</div>
            {items.map(g => {
              const filled = (g.slots||[]).filter(s=>s.profile_id||s.guest_name).length;
              return (
                <div key={g.id} className="pl-card" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "12px 14px" }} onClick={() => { setSelId(g.id); setMode("view"); }}>
                  <Swords size={18} color={color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.title || "Падел"}</div>
                    <div style={{ fontSize: 12, color: "var(--mut)" }}>{g.starts_at ? fmtDate(g.starts_at) + " · " : ""}{filled}/4</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "rgba(255,255,255,.06)", color, flexShrink:0 }}>
                    {g.status === "played" ? "✓" : `${filled}/4`}
                  </span>
                </div>
              );
            })}
          </div>
        );
        return [
          section("Предстоящие", "var(--mut)", upcoming),
          section("Активные", "var(--lime)", active),
          section("Прошедшие", "#7d9488", played),
        ];
      })()}
    </div>
  );
}

function SlotPicker({ value, players, taken, onChange, teamLabel }) {
  const [q, setQ] = useState("");
  const color = teamLabel === "A" ? "var(--lime)" : "var(--coral)";
  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="pl-display" style={{ width: 24, fontSize: 12, color }}>{teamLabel}</span>
        <div className="pl-slot" style={{ flex: 1, justifyContent: "space-between" }}>
          <span>{value.label}</span>
          <button style={{ padding: 4, border: "none", background: "none", color: "var(--mut)", cursor: "pointer" }} onClick={() => onChange(null)}><X size={14} /></button>
        </div>
      </div>
    );
  }
  const matches = q.trim()
    ? players.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()) && !taken.includes(p.id)).slice(0, 5)
    : [];
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="pl-display" style={{ width: 24, fontSize: 12, color }}>{teamLabel}</span>
        <input className="pl-input" style={{ padding: "9px 10px" }} placeholder="Имя / поиск (пусто = по ссылке)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {q.trim() && (
        <div style={{ marginTop: 6, marginLeft: 32, display: "flex", flexDirection: "column", gap: 4 }}>
          {matches.map((p) => (
            <button key={p.id} className="pl-ghost" style={{ padding: "8px 10px", textAlign: "left" }} onClick={() => { onChange({ profileId: p.id, label: p.name }); setQ(""); }}>{p.name}</button>
          ))}
          <button className="pl-btn" style={{ padding: "8px 10px", textAlign: "left" }} onClick={() => { onChange({ guestName: q.trim(), label: q.trim() + " (гость)" }); setQ(""); }}>+ Гость: {q.trim()}</button>
        </div>
      )}
    </div>
  );
}

function CreateGame({ groupId, players, back, done }) {
  const [title, setTitle] = useState(""), [date, setDate] = useState(""), [place, setPlace] = useState("");
  const [slots, setSlots] = useState([null, null, null, null]);
  const [busy, setBusy] = useState(false);
  const chosenIds = slots.filter((v) => v && v.profileId).map((v) => v.profileId);
  const setSlot = (i, v) => setSlots((s) => s.map((x, j) => (j === i ? v : x)));

  const create = async () => {
    setBusy(true);
    try { await createGame(groupId, { title, startsAt: date || null, place, slots }); done(); }
    catch (e) { alert("Не удалось создать игру"); setBusy(false); }
  };

  return (
    <div className="pl-pop">
      <button className="pl-ghost" style={{ padding: "6px 12px", marginBottom: 12 }} onClick={back}>← Назад</button>
      <div className="pl-card" style={{ padding: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <input className="pl-input" style={{ padding: "10px 12px" }} placeholder="Название: «Вторник вечер»" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Calendar size={18} color="var(--mut)" />
          <input type="datetime-local" className="pl-input" style={{ padding: "9px 12px" }} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MapPin size={18} color="var(--mut)" />
          <input className="pl-input" style={{ padding: "10px 12px" }} placeholder="Корт / клуб" value={place} onChange={(e) => setPlace(e.target.value)} />
        </div>
      </div>
      <div className="pl-card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 10 }}>Слоты — выбери из состава, впиши гостя или оставь пустым (займут по ссылке)</div>
        {[0, 1, 2, 3].map((i) => (
          <SlotPicker key={i} value={slots[i]} players={players} taken={chosenIds}
            onChange={(v) => setSlot(i, v)} teamLabel={i < 2 ? "A" : "B"} />
        ))}
      </div>
      <button className="pl-btn" style={{ width: "100%", padding: 14, fontSize: 16 }} disabled={busy} onClick={create}>{busy ? "Создаю…" : "Создать и получить ссылку"}</button>
    </div>
  );
}

function GameCard({ game, back, reloadGames, reloadLeaderboard }) {
  const [showShare, setShowShare] = useState(false);
  const [toast, setToast] = useState("");
  const slots = [...(game.slots || [])].sort((a, b) => (a.team + a.position).localeCompare(b.team + b.position));
  const nameOf = (s) => s.profile?.name || s.guest_name;
  const avatarOf = (s) => s.profile_id ? playerAvatar(s.profile?.avatar_url, s.profile_id) : null;
  const filled = slots.filter((s) => s.profile_id || s.guest_name).length;
  const slotsA = slots.filter((s) => s.team === "A");
  const slotsB = slots.filter((s) => s.team === "B");

  const share = async () => {
    const url = linkFor(game.invite_code);
    const text = `Зову на падел${game.title ? ` «${game.title}»` : ""}! Присоединяйся: ${url} (код ${game.invite_code})`;
    try { if (navigator.share) { await navigator.share({ title: "Падел", text, url }); return; } } catch (e) {}
    try { await navigator.clipboard.writeText(text); setToast("Скопировано ✓"); setTimeout(() => setToast(""), 1600); } catch (e) { setToast("Скопируй вручную"); }
  };

  if (game.status === "played") {
    const match = (game.matches || [])[0];
    return (
      <div className="pl-pop">
        {back && <button className="pl-ghost" style={{ padding: "6px 12px", marginBottom: 12 }} onClick={back}>← К списку</button>}
        <div className="pl-card" style={{ padding: 14 }}>
          <div className="pl-display" style={{ fontSize: 18 }}>{game.title || "Падел"} · сыграна</div>
          <div style={{ marginTop: 10 }}>
            <CourtView courtNumber={1} mode="sets"
              teamA={slotsA.map(nameOf)} teamB={slotsB.map(nameOf)}
              teamAvatarsA={slotsA.map(avatarOf)} teamAvatarsB={slotsB.map(avatarOf)}
              scoreA={match?.sets_a ?? null} scoreB={match?.sets_b ?? null}
              scoreDetail={match?.score_detail || null}
              editable={false} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pl-pop">
      {back && <button className="pl-ghost" style={{ padding: "6px 12px", marginBottom: 12 }} onClick={back}>← К списку</button>}
      <div className="pl-card" style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="pl-display" style={{ fontSize: 18 }}>{game.title || "Падел"}</div>
          {(game.starts_at || game.place) && (
            <div style={{ fontSize: 12, color: "var(--mut)", display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
              {game.starts_at && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} />{fmtDate(game.starts_at)}</span>}
              {game.place && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} />{game.place}</span>}
            </div>
          )}
        </div>
        <button className="pl-btn" style={{ padding: "8px 12px", display: "flex", gap: 6, alignItems: "center" }} onClick={() => setShowShare((v) => !v)}><Share2 size={15} /> Ссылка</button>
      </div>

      {showShare && (
        <div className="pl-pop" style={{ marginTop: 12 }}>
          <div className="pl-codebox">{game.invite_code}</div>
          <div style={{ fontSize: 12, color: "var(--mut)", margin: "8px 0 4px", wordBreak: "break-all" }}>{linkFor(game.invite_code)}</div>
          <button className="pl-btn" style={{ width: "100%", padding: 12, marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={share}>
            <Copy size={16} /> {toast || "Поделиться приглашением"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {slots.map((s, i) => (
          <div key={i} className="pl-slot">
            <span className="pl-display" style={{ fontSize: 11, color: s.team === "A" ? "var(--lime)" : "var(--coral)", width: 30 }}>{s.team}</span>
            <span style={{ flex: 1, color: nameOf(s) ? "var(--ink)" : "var(--mut)" }}>{nameOf(s) || "🔗 свободно — ждёт по ссылке"}</span>
            {nameOf(s) && <Check size={15} color="var(--lime)" />}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        {filled === 4 ? (
          <CourtView courtNumber={1} mode="sets" editable
            teamA={slotsA.map(nameOf)} teamB={slotsB.map(nameOf)}
            teamAvatarsA={slotsA.map(avatarOf)} teamAvatarsB={slotsB.map(avatarOf)}
            onSave={async (a, b, detail) => { await submitResult(game.id, a, b, detail); await Promise.all([reloadGames(), reloadLeaderboard()]); }} />
        ) : (
          <>
            <CourtView courtNumber={1}
              teamA={slotsA.map(nameOf)} teamB={slotsB.map(nameOf)}
              teamAvatarsA={slotsA.map(avatarOf)} teamAvatarsB={slotsB.map(avatarOf)}
              editable={false} />
            <div style={{ textAlign: "center", color: "var(--mut)", fontSize: 12, marginTop: 6 }}>{filled}/4 — обнови список, когда друзья зайдут по ссылке</div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

function EnterScore({ gameId, reloadGames, reloadLeaderboard }) {
  const [sA, setSA] = useState(0), [sB, setSB] = useState(0), [busy, setBusy] = useState(false);
  const valid = sA !== sB;
  const record = async () => {
    if (!valid) return;
    setBusy(true);
    try { await submitResult(gameId, sA, sB); await Promise.all([reloadGames(), reloadLeaderboard()]); }
    catch (e) { alert("Не удалось записать результат"); setBusy(false); }
  };
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center" }}>
        <Step label="Сеты A" v={sA} set={setSA} />
        <span className="pl-display" style={{ fontSize: 20 }}>:</span>
        <Step label="Сеты B" v={sB} set={setSB} />
      </div>
      <button className="pl-btn" style={{ width: "100%", padding: 12, marginTop: 12 }} disabled={!valid || busy} onClick={record}>{busy ? "Записываю…" : "Записать результат"}</button>
    </div>
  );
}

/* ------------------------------- HistoryView ------------------------------ */
function HistoryView({ groupId, players }) {
  const [matches, setMatches] = useState(null);
  const [tours, setTours] = useState([]);
  const [sel, setSel] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (sel) return;
    (async () => {
      const { data } = await supabase.from("matches")
        .select("id, team_a, team_b, sets_a, sets_b, score_detail, played_at")
        .eq("group_id", groupId).order("played_at", { ascending: false }).limit(30);
      setMatches(data || []);
      try { const all = await listTournaments(groupId); setTours(all.filter((t) => t.status === "finished")); }
      catch (e) { setTours([]); }
    })();
  }, [groupId, sel]);

  if (sel) return <TournamentView id={sel.id} players={players} back={() => setSel(null)} />;

  const nameOf = (id) => players.find((p) => p.id === id)?.name || "Игрок";
  const avatarOf = (id) => { const gp = players.find((p) => p.id === id); return gp ? playerAvatar(gp.avatar_url, id) : null; };
  const head = (txt) => <div className="pl-display" style={{ fontSize: 13, color: "var(--mut)", margin: "10px 2px 8px" }}>{txt}</div>;

  if (matches === null) return <div className="pl-card pl-pop" style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>Загрузка…</div>;
  if (matches.length === 0 && tours.length === 0) return <div className="pl-card pl-pop" style={{ padding: 28, textAlign: "center", color: "var(--mut)" }}>Пока нет сыгранных игр и турниров.</div>;

  return (
    <div className="pl-pop">
      {tours.length > 0 && head("Турниры")}
      {tours.map((t) => {
        const table = standings((t.players || []).map((p) => ({ id: p.id, name: p.name })), t.matches || []);
        const w = table[0];
        return (
          <div key={t.id} className="pl-card" style={{ padding: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setSel(t)}>
            <Trophy size={18} color="#ffd23f" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name || "Американо"}</div>
              <div style={{ fontSize: 12, color: "var(--mut)" }}>{w ? `Победитель: ${w.name} · ${w.points} очк.` : "-"}</div>
            </div>
            <span style={{ fontSize: 16, color: "var(--lime)", flexShrink: 0 }}>→</span>
          </div>
        );
      })}

      {matches.length > 0 && head("Игры")}
      {matches.map((m) => {
        const aWon = m.sets_a > m.sets_b;
        const rawDetail = m.score_detail;
        const detail = (() => {
          if (!rawDetail) return null;
          if (Array.isArray(rawDetail) && rawDetail.length > 0) return rawDetail;
          try { const p = typeof rawDetail === "string" ? JSON.parse(rawDetail) : rawDetail; return Array.isArray(p) && p.length > 0 ? p : null; }
          catch (e) { return null; }
        })();
        const isExpanded = expanded === m.id;
        return (
          <div key={m.id} className="pl-card" style={{ padding: 12, marginBottom: 8, cursor: detail ? "pointer" : "default" }}
            onClick={() => detail && setExpanded(isExpanded ? null : m.id)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {(m.team_a || []).map((id) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    {avatarOf(id) && <img src={avatarOf(id)} alt="" style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, fontWeight: aWon ? 700 : 400, color: aWon ? "var(--lime)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(id)}</span>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div className="pl-display" style={{ fontSize: 22 }}>{m.sets_a}:{m.sets_b}</div>
                {detail && <div style={{ fontSize: 10, color: "var(--lime)", marginTop: 2 }}>{isExpanded ? "▲" : "▼"}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                {(m.team_b || []).map((id) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 13, fontWeight: !aWon ? 700 : 400, color: !aWon ? "var(--lime)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(id)}</span>
                    {avatarOf(id) && <img src={avatarOf(id)} alt="" style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            </div>
            {isExpanded && detail && (
              <div style={{ marginTop: 10, borderTop: "1px solid #22382c", paddingTop: 8, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {detail.map((s, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 52 }}>
                    <div style={{ fontSize: 10, color: "var(--mut)" }}>Сет {i + 1}</div>
                    <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 18, color: s.a > s.b ? "var(--lime)" : s.b > s.a ? "var(--coral)" : "var(--ink)" }}>
                      {s.a}<span style={{ color: "var(--mut)", fontSize: 14 }}>:</span>{s.b}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
