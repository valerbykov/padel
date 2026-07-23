// components/LeagueSwitcher.jsx
// Глобальный переключатель лиги — живёт в топбаре (App.jsx), действует на все
// вкладки. Вынесен из PadelLeague, чтобы App не тянул весь тяжёлый чанк лиги.
import React, { useState } from "react";
import { Trophy, Check, X, PlusCircle, ChevronUp, ChevronDown, KeyRound, Settings } from "lucide-react";
import { createLeague, joinLeague } from "../lib/padelApi";
import LeagueLogo from "./LeagueLogo";
import LeagueManager from "./LeagueManager";
import { t } from "../lib/i18n";

export default function LeagueSwitcher({ leagues, leaguesReady = true, activeLeague, onLeagueChange, onLeagueCreated, onLeagueUpdated, onLeagueLeft, compact = false, expanded = false }) {
  // compact — вариант для вертикального рейла (App.jsx wide): свёрнут (только
  // аватар лиги) / развёрнут (аватар+имя+⇅), попап открывается ВПРАВО от рейла.
  // Лиги ещё грузятся и активной пока нет → показываем лоадер, а не «Без лиги»
  // (иначе на старте мигает ложное «Без лиги», пока идёт bootstrap).
  const loadingLeagues = !leaguesReady && !activeLeague;
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState(false); // false | "create" | "join"
  const [manage, setManage] = useState(null); // { id, role } — открытое окно управления
  const [newName, setNewName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const has = leagues && leagues.length > 0;
  const close = () => { setMenu(false); setMode(false); setErr(""); };

  const handleCreate = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true); setErr("");
    try { const lg = await createLeague(newName.trim()); onLeagueCreated && onLeagueCreated(lg); close(); setNewName(""); }
    catch (e) { setErr(e.message || t("err_generic")); } finally { setBusy(false); }
  };
  const handleJoin = async () => {
    if (code.trim().length < 4 || busy) return;
    setBusy(true); setErr("");
    try { const lg = await joinLeague(code.trim()); onLeagueCreated && onLeagueCreated(lg); close(); setCode(""); }
    catch (e) {
      const m = e.message || "";
      if (m.includes("league_not_found")) setErr(t("err_league_not_found"));
      else if (m.includes("already_member")) setErr(t("err_already_member"));
      else setErr(m || t("err_generic"));
    } finally { setBusy(false); }
  };

  const roleLabel = (r) => r === "owner" ? "★" : r === "admin" ? "⚙" : "";

  return (
    <div style={{ position: "relative", minWidth: 0, maxWidth: compact ? "none" : 210 }}>
      <style>{`
        .ls-trigger{transition:border-color .15s, background .15s;}
        .ls-trigger:hover{border-color:color-mix(in srgb,var(--lime) 45%,transparent);}
        .ls-item{transition:background .12s;}
        .ls-item:hover{background:var(--surface2);}
        .ls-foot-btn{transition:background .12s;}
        .ls-foot-btn:hover{background:var(--surface2);}
        /* Свитчер в топбаре (вне css PadelLeague) — дублируем нужные классы форм. */
        .ls-pop .pl-input{background:var(--surface2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:'Outfit';font-size:16px;outline:none;width:100%;box-sizing:border-box;}
        .ls-pop .pl-btn{background:var(--lime);color:var(--lime-fg);font-weight:700;border:none;border-radius:12px;cursor:pointer;font-family:'Outfit';}
        .ls-pop .pl-btn:disabled{filter:grayscale(.6) brightness(.7);cursor:not-allowed;}
        .ls-pop .pl-ghost{background:var(--surface2);color:var(--ink);border:1px solid var(--line);border-radius:12px;cursor:pointer;}
        .ls-spin{width:14px;height:14px;border-radius:50%;border:2px solid color-mix(in srgb,var(--lime) 22%,transparent);border-top-color:var(--lime);animation:lsspin .7s linear infinite;}
        @keyframes lsspin{to{transform:rotate(360deg)}}
      `}</style>
      {compact ? (
        <button className="ls-trigger" onClick={() => { setMenu((v) => !v); setMode(false); setErr(""); }} title={activeLeague?.name || t("no_league_chip")} aria-label={activeLeague?.name || t("no_league_chip")}
          style={expanded
            ? { display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 10px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, cursor: "pointer", color: "var(--ink)", fontFamily: "'Outfit'", fontSize: 13, minWidth: 0, overflow: "hidden" }
            : { position: "relative", display: "grid", placeItems: "center", width: 46, height: 46, margin: "0 auto", padding: 0, background: "none", border: "none", cursor: "pointer" }}>
          {activeLeague
            ? <LeagueLogo url={activeLeague.logo_url} name={activeLeague.name} size={expanded ? 30 : 34} radius={expanded ? 9 : 999} />
            : <span style={{ width: expanded ? 30 : 34, height: expanded ? 30 : 34, borderRadius: "50%", background: "color-mix(in srgb,var(--lime) 16%,transparent)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                {loadingLeagues ? <span className="ls-spin" /> : <Trophy size={15} style={{ color: "var(--lime)" }} />}
              </span>}
          {expanded && <span style={{ fontWeight: 800, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: loadingLeagues ? "var(--mut)" : undefined, fontSize: 13 }}>{activeLeague?.name || (loadingLeagues ? t("loading") : t("no_league_chip"))}</span>}
          {expanded
            ? (menu ? <ChevronUp size={15} style={{ color: "var(--mut)", flexShrink: 0 }} /> : <ChevronDown size={15} style={{ color: "var(--mut)", flexShrink: 0 }} />)
            : <span aria-hidden="true" style={{ position: "absolute", right: 0, bottom: 0, width: 16, height: 16, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--mut)", fontSize: 9, display: "grid", placeItems: "center" }}>⇅</span>}
        </button>
      ) : (
        <button className="ls-trigger" onClick={() => { setMenu((v) => !v); setMode(false); setErr(""); }}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 7px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999, cursor: "pointer", color: "var(--ink)", fontFamily: "'Outfit'", fontSize: 13, maxWidth: "100%", minWidth: 0, overflow: "hidden" }}>
          {activeLeague
            ? <LeagueLogo url={activeLeague.logo_url} name={activeLeague.name} size={26} radius={999} />
            : <span style={{ width: 26, height: 26, borderRadius: "50%", background: "color-mix(in srgb,var(--lime) 16%,transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {loadingLeagues ? <span className="ls-spin" /> : <Trophy size={14} style={{ color: "var(--lime)" }} />}
              </span>}
          <span style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: loadingLeagues ? "var(--mut)" : undefined }}>{activeLeague?.name || (loadingLeagues ? t("loading") : t("no_league_chip"))}</span>
          {menu ? <ChevronUp size={15} style={{ color: "var(--mut)", flexShrink: 0 }} /> : <ChevronDown size={15} style={{ color: "var(--mut)", flexShrink: 0 }} />}
        </button>
      )}

      {menu && (
        <div className="pl-pop ls-pop" style={{ position: "absolute", minWidth: 250, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, zIndex: 50, overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,.35)",
          ...(compact ? { left: "calc(100% + 10px)", top: 0 } : { top: "calc(100% + 8px)", left: 0 }) }}>
          {!mode && (
            <>
              {has && <div style={{ padding: "10px 14px 6px", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "var(--mut)", textTransform: "uppercase" }}>{t("league_your")}</div>}
              {has && leagues.map((lg) => {
                const active = lg.id === activeLeague?.id;
                return (
                  <div key={lg.id} className="ls-item" style={{ display: "flex", alignItems: "stretch", background: active ? "color-mix(in srgb,var(--lime) 10%,transparent)" : "none" }}>
                    <button onClick={() => { onLeagueChange && onLeagueChange(lg.id); close(); }}
                      style={{ flex: 1, minWidth: 0, padding: "9px 12px", textAlign: "left", background: "none", border: "none", color: "var(--ink)", fontFamily: "'Outfit'", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                      <LeagueLogo url={lg.logo_url} name={lg.name} size={30} radius={9} />
                      <span style={{ flex: 1, minWidth: 0, fontWeight: active ? 700 : 500, color: active ? "var(--lime)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {lg.name}
                        {lg.role !== "member" && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--mut)" }}>{roleLabel(lg.role)}</span>}
                      </span>
                      {active && <Check size={16} style={{ color: "var(--lime)", flexShrink: 0 }} />}
                    </button>
                    <button onClick={() => { setManage({ id: lg.id, role: lg.role, demo: !!lg.is_demo }); setMenu(false); }} title={t("league_manage")} aria-label={t("league_manage")}
                      style={{ flexShrink: 0, padding: "0 12px", background: "none", border: "none", borderLeft: "1px solid var(--line)", color: "var(--mut)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <Settings size={16} />
                    </button>
                  </div>
                );
              })}
              <div style={{ borderTop: has ? "1px solid var(--line)" : "none", display: "flex" }}>
                <button className="ls-foot-btn" onClick={() => { setMode("create"); setErr(""); }}
                  style={{ flex: 1, padding: "12px 0", background: "none", border: "none", color: "var(--lime)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit'", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><PlusCircle size={15} /> {t("league_create")}</button>
                <button className="ls-foot-btn" onClick={() => { setMode("join"); setErr(""); }}
                  style={{ flex: 1, padding: "12px 0", background: "none", border: "none", borderLeft: "1px solid var(--line)", color: "var(--mut)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit'", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><KeyRound size={15} /> {t("league_join_code")}</button>
              </div>
            </>
          )}
          {mode === "create" && (
            <div style={{ padding: 14 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{t("league_new_title")}</div>
              <input className="pl-input" style={{ padding: "9px 12px", marginBottom: 8 }} placeholder={t("league_name_placeholder")} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
              {err && <div style={{ fontSize: 12, color: "var(--coral)", marginBottom: 6 }}>{err}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="pl-btn" style={{ flex: 1, padding: 10 }} disabled={busy || !newName.trim()} onClick={handleCreate}>{busy ? t("creating") : t("league_create")}</button>
                <button className="pl-ghost" style={{ padding: "0 12px" }} onClick={close}><X size={14} /></button>
              </div>
            </div>
          )}
          {mode === "join" && (
            <div style={{ padding: 14 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{t("league_join_title")}</div>
              <input className="pl-input" style={{ padding: "9px 12px", marginBottom: 8, textTransform: "uppercase", letterSpacing: 3, textAlign: "center" }} placeholder="XXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && handleJoin()} autoFocus />
              {err && <div style={{ fontSize: 12, color: "var(--coral)", marginBottom: 6 }}>{err}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="pl-btn" style={{ flex: 1, padding: 10 }} disabled={busy || code.length < 4} onClick={handleJoin}>{busy ? t("creating") : t("league_join_btn")}</button>
                <button className="pl-ghost" style={{ padding: "0 12px" }} onClick={close}><X size={14} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {manage && (
        <LeagueManager
          groupId={manage.id}
          role={manage.role}
          isDemo={manage.demo}
          canEdit={manage.role === "owner" || manage.role === "admin"}
          onClose={() => setManage(null)}
          onUpdated={(lg) => onLeagueUpdated && onLeagueUpdated(lg)}
          onLeft={(gid) => { setManage(null); onLeagueLeft && onLeagueLeft(gid); }}
        />
      )}
    </div>
  );
}
