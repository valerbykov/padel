// components/ui-dialogs.jsx
// Императивные диалоги в стиле приложения вместо системных confirm()/alert().
//   • confirmDialog({title, message, confirmLabel, danger}) -> Promise<boolean>
//   • showToast(message) — короткий тост снизу.
// Один <DialogHost/> монтируется в App.jsx; вызовы идут откуда угодно, без
// проброса состояния в каждый обработчик.
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "../lib/i18n";

let confirmFn = null;   // ставится DialogHost'ом
let toastFn = null;

export function confirmDialog(opts = {}) {
  if (!confirmFn) return Promise.resolve(window.confirm(opts.message || opts.title || ""));
  return confirmFn(opts);
}
export function showToast(message) {
  if (toastFn) toastFn(message);
}

export function DialogHost() {
  const [confirmState, setConfirmState] = useState(null); // {opts, resolve}
  const [toast, setToast] = useState("");

  useEffect(() => {
    confirmFn = (opts) => new Promise((resolve) => setConfirmState({ opts, resolve }));
    let timer = null;
    toastFn = (message) => { setToast(message); clearTimeout(timer); timer = setTimeout(() => setToast(""), 2400); };
    return () => { confirmFn = null; toastFn = null; clearTimeout(timer); };
  }, []);

  const close = (val) => { confirmState?.resolve(val); setConfirmState(null); };
  const o = confirmState?.opts || {};
  const danger = o.danger !== false; // по умолчанию — опасное действие (красная кнопка)

  return createPortal(
    <>
      {confirmState && (
        <div onClick={() => close(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", fontFamily: "'Outfit',sans-serif", animation: "uidlgIn .16s ease-out" }}>
          <style>{`@keyframes uidlgIn{from{opacity:0}to{opacity:1}}@keyframes uidlgPop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}`}</style>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 20, padding: 20, width: "100%", maxWidth: 340, boxShadow: "0 30px 80px -24px rgba(0,0,0,.7)", animation: "uidlgPop .18s ease-out" }}>
            {o.title && <div style={{ fontWeight: 800, fontSize: 16.5, color: "var(--ink)", marginBottom: o.message ? 8 : 16, lineHeight: 1.3 }}>{o.title}</div>}
            {o.message && <div style={{ fontSize: 13.5, color: "var(--mut)", marginBottom: 18, lineHeight: 1.45 }}>{o.message}</div>}
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => close(false)}
                style={{ flex: "0 0 38%", padding: 12, borderRadius: 13, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
                {o.cancelLabel || t("cancel")}
              </button>
              <button onClick={() => close(true)}
                style={{ flex: 1, padding: 12, borderRadius: 13, border: "none", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "'Outfit',sans-serif",
                  background: danger ? "var(--coral)" : "var(--lime)", color: danger ? "#fff" : "var(--lime-fg)" }}>
                {o.confirmLabel || t("confirm_yes")}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: "calc(84px + env(safe-area-inset-bottom))", transform: "translateX(-50%)", zIndex: 420, background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)", fontFamily: "'Outfit',sans-serif", fontSize: 13.5, fontWeight: 600, padding: "11px 18px", borderRadius: 13, boxShadow: "0 12px 34px -12px rgba(0,0,0,.6)", maxWidth: "88vw", textAlign: "center", animation: "uidlgToast .2s ease-out" }}>
          <style>{`@keyframes uidlgToast{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
          {toast}
        </div>
      )}
    </>,
    document.body
  );
}
