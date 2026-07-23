// components/InviteCard.jsx
// Единая инвайт-карта лиги: крупный код + три действия — скопировать код
// (с текстом-приглашением), поделиться ссылкой на публичную страницу /l/CODE
// (системный share-sheet, фолбэк — копирование) и QR для сканирования прямо
// на корте. Используется в шапке «Друзей» (compact, с логотипом лиги) и в
// «Управлении лигой». Генератор QR грузится лениво при первом открытии.
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Check, Share2, QrCode, X } from "lucide-react";
import LeagueLogo from "./LeagueLogo";
import { WEB_BASE } from "../lib/platform";
import { shareUrl } from "../lib/shareLink";
import { t } from "../lib/i18n";

function Btn({ onClick, label, children }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      style={{ flexShrink: 0, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--lime) 16%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 35%, transparent)", borderRadius: 11, color: "var(--lime)", cursor: "pointer" }}>
      {children}
    </button>
  );
}

export default function InviteCard({ code, leagueName = "", logoUrl = null, compact = false, style }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [qr, setQr] = useState(null); // svg-строка QR
  const url = `${WEB_BASE}/l/${code}`;

  const copyCode = () => {
    try { navigator.clipboard?.writeText(t("invite_text").replace("{name}", leagueName).replace("{code}", code)); } catch (e) { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };
  const shareLink = async () => {
    // Натив-безопасно: Capacitor Share (в Android WebView нет navigator.share), фолбэк — буфер.
    const r = await shareUrl({ title: leagueName, text: leagueName, url });
    if (r !== "shared") { setShared(true); setTimeout(() => setShared(false), 1600); }
  };
  const showQr = async () => {
    try {
      const mod = await import("qrcode-generator");
      const make = mod.default || mod;
      const q = make(0, "M");
      q.addData(url);
      q.make();
      // Фиксированный размер svg → растягиваем под контейнер.
      const svg = q.createSvgTag(5, 4).replace("<svg ", '<svg style="width:100%;height:auto;display:block" ');
      setQr(svg);
    } catch (e) { /* без QR переживём */ }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: compact ? "8px 10px 8px 8px" : "12px 13px", background: "color-mix(in srgb, var(--lime) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--lime) 33%, transparent)", borderRadius: 14, fontFamily: "'Outfit',sans-serif", ...style }}>
        {compact && <LeagueLogo url={logoUrl} name={leagueName} size={38} radius={12} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: "var(--mut)", lineHeight: 1 }}>{t("league_invite_label")}</div>
          <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 22, letterSpacing: 3, color: "var(--lime)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis" }}>{code}</div>
        </div>
        <Btn onClick={copyCode} label={t("copy_code")}>{copied ? <Check size={16} /> : <Copy size={16} />}</Btn>
        <Btn onClick={shareLink} label={t("invite_share")}>{shared ? <Check size={16} /> : <Share2 size={16} />}</Btn>
        <Btn onClick={showQr} label="QR"><QrCode size={16} /></Btn>
      </div>

      {/* QR-оверлей: белая карточка ради контраста сканирования */}
      {qr && createPortal(
        <div onClick={() => setQr(null)} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,.7)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Outfit',sans-serif" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 22, padding: 18, maxWidth: 320, width: "100%", textAlign: "center", position: "relative" }}>
            <button onClick={() => setQr(null)} aria-label="✕"
              style={{ position: "absolute", top: 10, right: 10, background: "#f0f4f1", border: "none", borderRadius: 10, padding: 6, display: "flex", cursor: "pointer", color: "#4a7060" }}><X size={15} /></button>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0a1612", padding: "0 30px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{leagueName}</div>
            <div dangerouslySetInnerHTML={{ __html: qr }} style={{ margin: "12px auto 0", width: "100%", maxWidth: 232 }} />
            <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 20, letterSpacing: 4, color: "#0a1612", marginTop: 10 }}>{code}</div>
            <div style={{ fontSize: 12, color: "#4a7060", marginTop: 4 }}>{t("invite_scan")}</div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
