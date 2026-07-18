// components/FeesCard.jsx
// «Взносы» за организацию — ОБЩАЯ карточка для завершённых турниров И игр.
// Сбор запускается ЯВНО организатором (кнопка), сумма — «с каждого» или общая
// (делим поровну); участник сам отмечает свою строку «скинулся», админ/организатор
// может править любую. «Напомнить пушем» — адресное уведомление должникам
// (+ авто-сообщение в Telegram-чат лиги, если привязан публичный чат);
// «Напомнить должникам» — готовое сообщение в чат вручную.
//
// api-адаптер (разница турнир/игра инкапсулирована снаружи):
//   getFee(id) → number|null · getPaid(id) → Set<key> · setFee(id, per)
//   togglePaid(key) → bool · remind(id) → number
// players: [{ key, profile_id, name }] — key = tournament_players.id / game_slots.id.
import React, { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { showToast } from "./ui-dialogs";
import { t as tr } from "../lib/i18n";

export default function FeesCard({ entityId, entityName = "", players = [], me, canManage, readOnly, avatarOf, api, cardClass = "tr-card" }) {
  const [fee, setFee] = useState(undefined);        // undefined=загрузка, null=не задана
  const [paid, setPaid] = useState(new Set());
  const [setup, setSetup] = useState(false);
  const [mode, setMode] = useState("each");
  const [amount, setAmount] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [remindBusy, setRemindBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    // Сброс на смену сущности: иначе на новой карточке мелькает сумма/оплаты
    // прошлой игры и остаётся открытой её форма редактирования.
    setFee(undefined); setPaid(new Set()); setSetup(false); setAmount(""); setBusyKey(null);
    api.getFee(entityId).then((f) => { if (alive) setFee(f); });
    api.getPaid(entityId).then((s) => { if (alive) setPaid(s); });
    return () => { alive = false; };
  }, [entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (fee === undefined) return null;
  if (fee == null && !canManage) return null;
  if (readOnly && fee == null) return null;

  const per = fee || 0;
  const paidCount = players.filter((p) => paid.has(p.key)).length;
  const total = per * players.length;
  const collected = per * paidCount;
  const fmtR = (n) => `${n.toLocaleString("ru-RU")} ₽`;

  const save = async () => {
    const n = Math.round(Number(String(amount).replace(/[^\d.]/g, "")));
    if (!n || n <= 0) { showToast(tr("fee_bad_amount")); return; }
    const perPlayer = mode === "total" ? Math.ceil(n / Math.max(players.length, 1)) : n;
    setSaving(true);
    try { await api.setFee(entityId, perPlayer); setFee(perPlayer); setSetup(false); }
    catch (e) { showToast(`${tr("err_generic") || "Ошибка"}: ${e?.message || e}`); }
    finally { setSaving(false); }
  };

  const toggle = async (p) => {
    const mine = p.profile_id && p.profile_id === me;
    if (!(mine || canManage) || busyKey) return;
    setBusyKey(p.key);
    try {
      const now = await api.togglePaid(p.key);
      setPaid((prev) => { const s = new Set(prev); if (now) s.add(p.key); else s.delete(p.key); return s; });
    } catch (e) { showToast(`${tr("err_generic") || "Ошибка"}: ${e?.message || e}`); }
    finally { setBusyKey(null); }
  };

  const remindPush = async () => {
    if (remindBusy) return;
    setRemindBusy(true);
    try {
      const n = await api.remind(entityId);
      showToast(n > 0 ? tr("fee_push_sent").replace("{n}", String(n)) : tr("fee_push_none"));
    } catch (e) { showToast(`${tr("err_generic") || "Ошибка"}: ${e?.message || e}`); }
    finally { setRemindBusy(false); }
  };

  const remindChat = async () => {
    const debtors = players.filter((p) => !paid.has(p.key)).map((p) => p.name);
    if (!debtors.length) { showToast(tr("fee_all_paid")); return; }
    const msg = tr("fee_remind_msg").replace("{names}", debtors.join(", ")).replace("{n}", String(per)).replace("{t}", entityName);
    const Share = (typeof window !== "undefined" && window.Capacitor?.Plugins?.Share) || null;
    if (Share) { try { await Share.share({ text: msg }); return; } catch (e) { /* отмена — ок */ } }
    try { await navigator.clipboard.writeText(msg); showToast(tr("copied")); }
    catch (e) { showToast(tr("copy_manual")); }
  };

  const pill = (on) => ({ minWidth: 58, height: 30, borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 12,
    background: on ? "var(--lime)" : "var(--surface2)", color: on ? "var(--lime-fg)" : "var(--mut)",
    ...(on ? {} : { border: "1px solid var(--line)", fontWeight: 600 }) });
  const primBtn = { width: "100%", padding: 12, borderRadius: 12, cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 13.5,
    background: "color-mix(in srgb, var(--lime) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 40%, transparent)", color: "var(--lime)",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7 };

  return (
    <div className={cardClass} style={{ marginBottom: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>💸 {tr("fee_title")}</span>
        {fee != null && (
          <span style={{ fontSize: 12, color: "var(--mut)" }}>
            {tr("fee_per_label").replace("{n}", fmtR(per))}
            {canManage && <button onClick={() => { setSetup((s) => !s); setMode("each"); setAmount(String(per)); }} style={{ background: "none", border: "none", color: "var(--mut)", cursor: "pointer", fontSize: 12, padding: "0 0 0 6px" }}>✎</button>}
          </span>
        )}
      </div>

      {fee == null && !setup ? (
        <>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 10 }}>{tr("fee_start_hint")}</div>
          <button onClick={() => { setSetup(true); setMode("each"); setAmount(""); }} style={{ ...primBtn, background: "var(--lime)", color: "var(--lime-fg)", fontWeight: 800, fontSize: 14, border: "none" }}>
            💸 {tr("fee_start_btn")}
          </button>
        </>
      ) : (fee == null || setup) ? (
        <>
          <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 10 }}>{tr("fee_setup_hint")}</div>
          <div style={{ display: "flex", gap: 4, background: "var(--surface2)", borderRadius: 10, padding: 3, marginBottom: 8 }}>
            {[["each", tr("fee_mode_each")], ["total", tr("fee_mode_total")]].map(([k, lbl]) => (
              <button key={k} onClick={() => setMode(k)} style={{ flex: 1, border: "none", borderRadius: 8, padding: "7px 0", cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 12,
                background: mode === k ? "var(--lime)" : "none", color: mode === k ? "var(--lime-fg)" : "var(--mut)" }}>{lbl}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input inputMode="numeric" aria-label={mode === "total" ? tr("fee_ph_total") : tr("fee_ph_each")} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={mode === "total" ? tr("fee_ph_total") : tr("fee_ph_each")}
              style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 11, padding: "10px 12px", color: "var(--ink)", fontSize: 15, fontFamily: "'Outfit',sans-serif" }} />
            <button disabled={saving} onClick={save} style={{ padding: "10px 16px", fontSize: 13, borderRadius: 11, border: "none", background: "var(--lime)", color: "var(--lime-fg)", fontWeight: 800, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>{saving ? "…" : tr("fee_save")}</button>
          </div>
          {mode === "total" && Number(amount) > 0 && players.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 6, textAlign: "center" }}>
              {tr("fee_split_hint").replace("{c}", String(players.length)).replace("{n}", fmtR(Math.ceil(Number(amount) / players.length)))}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0 2px" }}>
            <b style={{ fontSize: 24, color: "var(--lime)", fontFamily: "'Anton',sans-serif", letterSpacing: .5 }}>{fmtR(collected)}</b>
            <span style={{ fontSize: 12.5, color: "var(--mut)" }}>{tr("fee_of").replace("{n}", fmtR(total))}</span>
          </div>
          <div style={{ height: 8, borderRadius: 6, background: "var(--surface2)", margin: "10px 0 5px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${total ? Math.round(collected / total * 100) : 0}%`, background: "var(--lime)", borderRadius: 6, transition: "width .3s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--mut)", marginBottom: 6 }}>
            <span>{tr("fee_progress").replace("{a}", String(paidCount)).replace("{b}", String(players.length))}</span>
            <span>{collected < total ? tr("fee_left").replace("{n}", fmtR(total - collected)) : "🎉"}</span>
          </div>
          {players.map((p) => {
            const on = paid.has(p.key);
            const mine = p.profile_id && p.profile_id === me;
            const can = (mine || canManage) && !readOnly;
            return (
              <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderBottom: "1px solid color-mix(in srgb, var(--line) 60%, transparent)" }}>
                <Avatar name={p.name} url={avatarOf ? avatarOf(p.key) : null} id={p.profile_id || p.key} size={32} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}{mine && <span style={{ fontSize: 10, color: "var(--yellow)", marginLeft: 5 }}>{tr("fee_you")}</span>}
                </span>
                <button onClick={() => toggle(p)} disabled={!can || busyKey === p.key} style={{ ...pill(on), opacity: can ? 1 : .55, cursor: can ? "pointer" : "default" }}>
                  {busyKey === p.key ? "…" : on ? `${per} ✓` : per}
                </button>
              </div>
            );
          })}
          {!readOnly && paidCount < players.length && (
            <>
              {canManage && (
                <>
                  <button onClick={remindPush} disabled={remindBusy} style={{ ...primBtn, marginTop: 12, opacity: remindBusy ? .6 : 1 }}>
                    🔔 {remindBusy ? "…" : tr("fee_remind_push")}
                  </button>
                  <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 4, textAlign: "center" }}>{tr("fee_remind_push_hint")}</div>
                </>
              )}
              <button onClick={remindChat} style={{ width: "100%", marginTop: 8, padding: 11, borderRadius: 12, cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: 12.5,
                background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--mut)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                📣 {tr("fee_remind")}
              </button>
              <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 4, textAlign: "center" }}>{tr("fee_remind_chat_hint")}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
