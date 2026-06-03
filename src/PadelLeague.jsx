import React, { useState, useEffect } from "react";
import { Trophy, Swords, History, Users, Share2, Link2, Check, X, RefreshCw, Copy, PlusCircle, ChevronUp, ChevronDown, Calendar, MapPin, TrendingUp } from "lucide-react";

/* ----------------------------- ELO core logic ----------------------------- */
const START_RATING = 1000;
const expected = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
const kFactor = (m) => (m < 5 ? 60 : m < 15 ? 40 : 24);

function computeMatch(players, teamA, teamB, setsA, setsB) {
  const get = (id) => players.find((p) => p.id === id);
  const a = teamA.map(get), b = teamB.map(get);
  const eA = expected((a[0].rating + a[1].rating) / 2, (b[0].rating + b[1].rating) / 2);
  const total = setsA + setsB;
  const sA = total === 0 ? 0.5 : setsA / total;
  const deltas = {};
  a.forEach((p) => (deltas[p.id] = Math.round(kFactor(p.matches) * (sA - eA))));
  b.forEach((p) => (deltas[p.id] = Math.round(kFactor(p.matches) * (1 - sA - (1 - eA)))));
  return { deltas, winnerA: setsA > setsB };
}

/* ------------------------------ invite helpers ---------------------------- */
const genCode = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const linkFor = (code) => `https://padel.app/j/${code}`;
const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch (e) { return ""; }
};

async function getShared(code) {
  try { const r = await window.storage.get("game:" + code, true); return r ? JSON.parse(r.value) : null; }
  catch (e) { return null; }
}
async function setShared(game) {
  try { await window.storage.set("game:" + game.code, JSON.stringify(game), true); } catch (e) {}
}
async function shareGame(game) {
  const url = linkFor(game.code);
  const when = game.date ? `\n🗓 ${fmtDate(game.date)}` : "";
  const where = game.place ? `\n📍 ${game.place}` : "";
  const text = `Зову на падел${game.title ? ` «${game.title}»` : ""}!${when}${where}\nПрисоединяйся: ${url} (код ${game.code})`;
  try { if (navigator.share) { await navigator.share({ title: "Падел", text, url }); return "shared"; } } catch (e) {}
  try { await navigator.clipboard.writeText(text); return "copied"; } catch (e) {}
  return "manual";
}

/* ------------------------------- persistence ------------------------------ */
const KEY = "padel-league-v2";
const loadState = async () => { try { const r = await window.storage.get(KEY); return r ? JSON.parse(r.value) : null; } catch (e) { return null; } };
const saveState = async (s) => { try { await window.storage.set(KEY, JSON.stringify(s)); } catch (e) {} };

const seed = {
  players: [
    { id: "p1", name: "Артём", rating: 1000, matches: 0, wins: 0, history: [1000] },
    { id: "p2", name: "Лена", rating: 1000, matches: 0, wins: 0, history: [1000] },
    { id: "p3", name: "Дима", rating: 1000, matches: 0, wins: 0, history: [1000] },
    { id: "p4", name: "Соня", rating: 1000, matches: 0, wins: 0, history: [1000] },
  ],
  games: [],
  matches: [],
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600;700&display=swap');
.pl-root{--bg:#0a1612;--surface:#11211b;--surface2:#16291f;--line:#22382c;--ink:#eef3ee;--mut:#7d9488;--lime:#c8ff2d;--coral:#ff6a52;
 font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;
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
`;

/* ------------------------------- rating chart ----------------------------- */
function LineChart({ values }) {
  const w = 300, h = 120, pad = 10;
  if (!values || values.length < 2)
    return <div style={{ color: "var(--mut)", fontSize: 13, textAlign: "center", padding: "30px 0" }}>Сыграй матч — здесь появится динамика рейтинга.</div>;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => pad + (i * (w - 2 * pad)) / (values.length - 1);
  const y = (v) => h - pad - ((v - min) / span) * (h - 2 * pad);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${pad},${h - pad} ${pts} ${w - pad},${h - pad}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
      <defs>
        <linearGradient id="plg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8ff2d" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#c8ff2d" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#plg)" />
      <polyline points={pts} fill="none" stroke="#c8ff2d" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#0a1612" stroke="#c8ff2d" strokeWidth="2" />)}
    </svg>
  );
}

function PlayerDetail({ player, close }) {
  const hist = player.history || [player.rating];
  const peak = Math.max(...hist), low = Math.min(...hist);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(5,12,9,.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={close}>
      <div className="pl-card pl-pop" style={{ width: "100%", maxWidth: 460, margin: 8, padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <div className="pl-display" style={{ fontSize: 26 }}>{player.name}</div>
            <div style={{ fontSize: 12, color: "var(--mut)" }}>{player.matches} игр · {player.wins} побед</div>
          </div>
          <button className="pl-ghost" style={{ padding: 8 }} onClick={close}><X size={18} /></button>
        </div>
        <div className="pl-display" style={{ fontSize: 40, color: "var(--lime)", lineHeight: 1, marginBottom: 12 }}>{player.rating}</div>
        <LineChart values={hist} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {[["Пик", peak], ["Минимум", low], ["Старт", hist[0]]].map(([l, v]) => (
            <div key={l} className="pl-slot" style={{ flex: 1, flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 11, color: "var(--mut)" }}>{l}</span>
              <span className="pl-display" style={{ fontSize: 18 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- root ----------------------------------- */
export default function PadelLeague() {
  const [state, setState] = useState(seed);
  const [tab, setTab] = useState("board");
  const [ready, setReady] = useState(false);

  useEffect(() => { loadState().then((s) => { if (s) setState(s); setReady(true); }); }, []);
  useEffect(() => { if (ready) saveState(state); }, [state, ready]);

  const ranked = [...state.players].sort((a, b) => b.rating - a.rating);
  const titles = { board: "Таблица", games: "Игры", history: "История" };

  return (
    <div className="pl-root">
      <style>{css}</style>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "20px 16px 88px" }}>
        <header className="flex items-center justify-between" style={{ marginBottom: 18 }}>
          <div>
            <div style={{ color: "var(--lime)", fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>PADEL · ЛИГА ДРУЗЕЙ</div>
            <h1 className="pl-display" style={{ fontSize: 30, lineHeight: 1, marginTop: 2 }}>{titles[tab]}</h1>
          </div>
          <div className="pl-card" style={{ padding: "8px 12px", textAlign: "center" }}>
            <div className="pl-display" style={{ fontSize: 22, color: "var(--lime)" }}>{state.matches.length}</div>
            <div style={{ fontSize: 10, color: "var(--mut)" }}>матчей</div>
          </div>
        </header>

        {tab === "board" && <Board ranked={ranked} setState={setState} />}
        {tab === "games" && <Games state={state} setState={setState} />}
        {tab === "history" && <HistoryView state={state} />}
      </div>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(10,22,18,.92)", borderTop: "1px solid var(--line)", backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 460, margin: "0 auto", display: "flex" }}>
          <button className={`pl-tab ${tab === "board" ? "on" : ""}`} onClick={() => setTab("board")}><Trophy size={20} />Рейтинг</button>
          <button className={`pl-tab ${tab === "games" ? "on" : ""}`} onClick={() => setTab("games")}><Swords size={20} />Игры</button>
          <button className={`pl-tab ${tab === "history" ? "on" : ""}`} onClick={() => setTab("history")}><History size={20} />История</button>
        </div>
      </nav>
    </div>
  );
}

/* --------------------------------- Board ---------------------------------- */
function Board({ ranked, setState }) {
  const [name, setName] = useState(""), [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const addPlayer = () => {
    const n = name.trim(); if (!n) return;
    setState((s) => ({ ...s, players: [...s.players, { id: "p" + Date.now(), name: n, rating: START_RATING, matches: 0, wins: 0, history: [START_RATING] }] }));
    setName(""); setOpen(false);
  };
  const live = selected ? ranked.find((p) => p.id === selected.id) : null;
  return (
    <div className="pl-pop">
      {live && <PlayerDetail player={live} close={() => setSelected(null)} />}
      {ranked.map((p, i) => (
        <div key={p.id} className="pl-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }} onClick={() => setSelected(p)}>
          <div className="pl-display" style={{ width: 30, fontSize: 22, color: ["#ffd23f", "#cfd8d0", "#cd7f4d"][i] || "var(--mut)" }}>{i + 1}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 16, display: "flex", alignItems: "center", gap: 6 }}>{p.name}<TrendingUp size={13} color="var(--mut)" /></div>
            <div style={{ fontSize: 12, color: "var(--mut)" }}>{p.matches} игр · {p.wins} побед</div>
          </div>
          <div className="pl-display" style={{ fontSize: 24, color: "var(--lime)" }}>{p.rating}</div>
        </div>
      ))}
      {open ? (
        <div className="pl-card" style={{ padding: 12, marginTop: 8, display: "flex", gap: 8 }}>
          <input className="pl-input" style={{ padding: "10px 12px" }} placeholder="Имя игрока" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()} autoFocus />
          <button className="pl-btn" style={{ padding: "0 16px" }} onClick={addPlayer}>OK</button>
          <button className="pl-ghost" style={{ padding: "0 12px" }} onClick={() => setOpen(false)}><X size={16} /></button>
        </div>
      ) : (
        <button className="pl-ghost" style={{ width: "100%", padding: 12, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 600 }} onClick={() => setOpen(true)}>
          <Users size={18} /> Добавить игрока
        </button>
      )}
    </div>
  );
}

/* --------------------------------- Games ---------------------------------- */
function Games({ state, setState }) {
  const [mode, setMode] = useState("list"); // list | create | join
  if (mode === "create") return <CreateGame state={state} setState={setState} back={() => setMode("list")} />;
  if (mode === "join") return <JoinByCode state={state} setState={setState} back={() => setMode("list")} />;

  return (
    <div className="pl-pop">
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="pl-btn" style={{ flex: 1, padding: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setMode("create")}>
          <PlusCircle size={18} /> Создать игру
        </button>
        <button className="pl-ghost" style={{ flex: 1, padding: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 600 }} onClick={() => setMode("join")}>
          <Link2 size={18} /> По коду
        </button>
      </div>
      {state.games.length === 0 && <div className="pl-card" style={{ padding: 26, textAlign: "center", color: "var(--mut)" }}>Нет активных игр. Создай игру и отправь ссылку друзьям.</div>}
      {state.games.map((g) => <GameCard key={g.id} game={g} state={state} setState={setState} />)}
    </div>
  );
}

function CreateGame({ state, setState, back }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [slots, setSlots] = useState(["", "", "", ""]); // "" = open, else playerId
  const chosen = slots.filter(Boolean);
  const setSlot = (i, v) => setSlots((s) => s.map((x, j) => (j === i ? v : x)));
  const nameOf = (id) => state.players.find((p) => p.id === id)?.name;

  const create = () => {
    const game = {
      id: "g" + Date.now(), code: genCode(), title: title.trim(), date, place: place.trim(), createdAt: Date.now(), status: "open",
      slots: slots.map((id) => (id ? { name: nameOf(id), playerId: id } : null)), result: null,
    };
    setShared(game);
    setState((s) => ({ ...s, games: [game, ...s.games] }));
    back();
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
        <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 10 }}>Слоты — оставь «по ссылке», чтобы друг занял сам</div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className="pl-display" style={{ width: 58, fontSize: 12, color: i < 2 ? "var(--lime)" : "var(--coral)" }}>{i < 2 ? "КОМ. A" : "КОМ. B"}</span>
            <select className="pl-select" style={{ padding: "9px 10px" }} value={slots[i]} onChange={(e) => setSlot(i, e.target.value)}>
              <option value="">🔗 по ссылке</option>
              {state.players.map((p) => <option key={p.id} value={p.id} disabled={chosen.includes(p.id) && slots[i] !== p.id}>{p.name}</option>)}
            </select>
          </div>
        ))}
      </div>
      <button className="pl-btn" style={{ width: "100%", padding: 14, fontSize: 16 }} onClick={create}>Создать и получить ссылку</button>
    </div>
  );
}

function GameCard({ game, state, setState }) {
  const [showShare, setShowShare] = useState(false);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const filled = game.slots.filter(Boolean).length;

  const refresh = async () => {
    setBusy(true);
    const fresh = await getShared(game.code);
    if (fresh) setState((s) => ({ ...s, games: s.games.map((g) => (g.code === game.code ? fresh : g)) }));
    setBusy(false);
  };
  const doShare = async () => {
    const r = await shareGame(game);
    setToast(r === "shared" ? "Отправлено" : r === "copied" ? "Скопировано ✓" : "Скопируй вручную");
    setTimeout(() => setToast(""), 1800);
  };

  if (game.status === "played")
    return (
      <div className="pl-card" style={{ padding: 14, marginBottom: 8, opacity: .75 }}>
        <div style={{ fontSize: 12, color: "var(--mut)" }}>{game.title || "Игра"} · сыграна</div>
        <div className="pl-display" style={{ fontSize: 18 }}>{game.slots.map((s) => s?.name).join(", ")} — {game.result.sA}:{game.result.sB}</div>
      </div>
    );

  return (
    <div className="pl-card pl-pop" style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="pl-display" style={{ fontSize: 18 }}>{game.title || "Падел"}</div>
          {(game.date || game.place) && (
            <div style={{ fontSize: 12, color: "var(--mut)", display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
              {game.date && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} />{fmtDate(game.date)}</span>}
              {game.place && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} />{game.place}</span>}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="pl-ghost" style={{ padding: 8 }} onClick={refresh}><RefreshCw size={16} className={busy ? "" : ""} /></button>
          <button className="pl-btn" style={{ padding: "8px 12px", display: "flex", gap: 6, alignItems: "center" }} onClick={() => setShowShare((v) => !v)}><Share2 size={15} /> Ссылка</button>
        </div>
      </div>

      {showShare && (
        <div className="pl-pop" style={{ marginTop: 12 }}>
          <div className="pl-codebox">{game.code}</div>
          <div style={{ fontSize: 12, color: "var(--mut)", margin: "8px 0 4px", wordBreak: "break-all" }}>{linkFor(game.code)}</div>
          <button className="pl-btn" style={{ width: "100%", padding: 12, marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={doShare}>
            <Copy size={16} /> {toast || "Поделиться приглашением"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {game.slots.map((s, i) => (
          <div key={i} className="pl-slot">
            <span className="pl-display" style={{ fontSize: 11, color: i < 2 ? "var(--lime)" : "var(--coral)", width: 30 }}>{i < 2 ? "A" : "B"}</span>
            <span style={{ flex: 1, color: s ? "var(--ink)" : "var(--mut)" }}>{s ? s.name : "🔗 свободно — ждёт по ссылке"}</span>
            {s && <Check size={15} color="var(--lime)" />}
          </div>
        ))}
      </div>

      {filled === 4
        ? <EnterScore game={game} setState={setState} />
        : <div style={{ textAlign: "center", color: "var(--mut)", fontSize: 12, marginTop: 10 }}>{filled}/4 — нажми «Обновить», когда друзья зайдут</div>}
    </div>
  );
}

function EnterScore({ game, setState }) {
  const [sA, setSA] = useState(0), [sB, setSB] = useState(0);
  const valid = sA !== sB;

  const record = () => {
    setState((s) => {
      let players = [...s.players];
      const ensure = (name) => {
        let p = players.find((x) => x.name.toLowerCase() === name.toLowerCase());
        if (!p) { p = { id: "p" + Date.now() + Math.random().toString(36).slice(2, 5), name, rating: START_RATING, matches: 0, wins: 0, history: [START_RATING] }; players.push(p); }
        return p;
      };
      const ids = game.slots.map((sl) => ensure(sl.name).id);
      const { deltas, winnerA } = computeMatch(players, [ids[0], ids[1]], [ids[2], ids[3]], sA, sB);
      players = players.map((p) => {
        if (deltas[p.id] === undefined) return p;
        const won = (winnerA && (p.id === ids[0] || p.id === ids[1])) || (!winnerA && (p.id === ids[2] || p.id === ids[3]));
        const nextRating = p.rating + deltas[p.id];
        return { ...p, rating: nextRating, matches: p.matches + 1, wins: p.wins + (won ? 1 : 0), history: [...(p.history || [p.rating]), nextRating] };
      });
      const match = { id: "m" + Date.now(), date: Date.now(), teamA: [ids[0], ids[1]], teamB: [ids[2], ids[3]], sA, sB, deltas };
      const played = { ...game, status: "played", result: { sA, sB } };
      setShared(played);
      return { ...s, players, matches: [match, ...s.matches], games: s.games.map((g) => (g.code === game.code ? played : g)) };
    });
  };

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center" }}>
        <Step label="Сеты A" v={sA} set={setSA} />
        <span className="pl-display" style={{ fontSize: 20 }}>:</span>
        <Step label="Сеты B" v={sB} set={setSB} />
      </div>
      <button className="pl-btn" style={{ width: "100%", padding: 12, marginTop: 12 }} disabled={!valid} onClick={record}>Записать результат</button>
    </div>
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

/* ------------------------------- JoinByCode ------------------------------- */
function JoinByCode({ state, setState, back }) {
  const [code, setCode] = useState("");
  const [game, setGame] = useState(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState(""); // '', 'notfound', 'joined'

  const find = async () => {
    const g = await getShared(code.trim().toUpperCase());
    setGame(g); setStatus(g ? "" : "notfound");
  };
  const take = async (i) => {
    if (!name.trim() || !game) return;
    const updated = { ...game, slots: game.slots.map((s, j) => (j === i ? { name: name.trim() } : s)) };
    await setShared(updated);
    // if it's also my local game, sync it
    setState((s) => ({ ...s, games: s.games.map((g) => (g.code === updated.code ? updated : g)) }));
    setGame(updated); setStatus("joined");
  };

  return (
    <div className="pl-pop">
      <button className="pl-ghost" style={{ padding: "6px 12px", marginBottom: 12 }} onClick={back}>← Назад</button>
      <div className="pl-card" style={{ padding: 14, marginBottom: 12, display: "flex", gap: 8 }}>
        <input className="pl-input" style={{ padding: "10px 12px", textTransform: "uppercase", letterSpacing: 4, fontFamily: "Anton" }} placeholder="КОД" maxLength={4} value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="pl-btn" style={{ padding: "0 18px" }} onClick={find}>Найти</button>
      </div>
      {status === "notfound" && <div className="pl-card" style={{ padding: 20, textAlign: "center", color: "var(--coral)" }}>Игра с таким кодом не найдена.</div>}
      {game && (
        <div className="pl-card pl-pop" style={{ padding: 14 }}>
          <div className="pl-display" style={{ fontSize: 18, marginBottom: 4 }}>{game.title || "Падел"}</div>
          {(game.date || game.place) && (
            <div style={{ fontSize: 12, color: "var(--mut)", display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              {game.date && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} />{fmtDate(game.date)}</span>}
              {game.place && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} />{game.place}</span>}
            </div>
          )}
          {status === "joined" && <div style={{ color: "var(--lime)", fontSize: 13, marginBottom: 8 }}>Ты в игре ✓</div>}
          <input className="pl-input" style={{ padding: "10px 12px", marginBottom: 10 }} placeholder="Твоё имя" value={name} onChange={(e) => setName(e.target.value)} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {game.slots.map((s, i) => (
              <div key={i} className="pl-slot">
                <span className="pl-display" style={{ fontSize: 11, color: i < 2 ? "var(--lime)" : "var(--coral)", width: 24 }}>{i < 2 ? "A" : "B"}</span>
                <span style={{ flex: 1, color: s ? "var(--ink)" : "var(--mut)" }}>{s ? s.name : "свободно"}</span>
                {!s && <button className="pl-btn" style={{ padding: "6px 12px", fontSize: 13 }} disabled={!name.trim()} onClick={() => take(i)}>Занять</button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- HistoryView ------------------------------ */
function HistoryView({ state }) {
  const nameOf = (id) => state.players.find((p) => p.id === id)?.name || "?";
  if (state.matches.length === 0)
    return <div className="pl-card pl-pop" style={{ padding: 28, textAlign: "center", color: "var(--mut)" }}>Пока нет сыгранных матчей.</div>;
  return (
    <div className="pl-pop">
      {state.matches.map((m) => {
        const aWon = m.sA > m.sB;
        return (
          <div key={m.id} className="pl-card" style={{ padding: 14, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: 1, fontWeight: aWon ? 700 : 400, color: aWon ? "var(--lime)" : "var(--ink)" }}>{nameOf(m.teamA[0])} / {nameOf(m.teamA[1])}</div>
              <div className="pl-display" style={{ fontSize: 20, padding: "0 12px" }}>{m.sA}:{m.sB}</div>
              <div style={{ flex: 1, textAlign: "right", fontWeight: !aWon ? 700 : 400, color: !aWon ? "var(--lime)" : "var(--ink)" }}>{nameOf(m.teamB[0])} / {nameOf(m.teamB[1])}</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {Object.entries(m.deltas).map(([id, d]) => (
                <span key={id} style={{ fontSize: 11, color: "var(--mut)" }}>{nameOf(id)} <b style={{ color: d >= 0 ? "var(--lime)" : "var(--coral)" }}>{d >= 0 ? "+" : ""}{d}</b></span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
