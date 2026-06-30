// components/Fab.jsx — плавающая кнопка действия (FAB) над нижней навигацией.
// Всегда доступна, без прокрутки к кнопке внизу списка. Портал в body: иначе
// position:fixed «уезжает» в трансформируемого предка (.pl-pop с анимацией).
import React from "react";
import { createPortal } from "react-dom";

export default function Fab({ onClick, label, icon }) {
  return createPortal(
    <button onClick={onClick} aria-label={label} title={label}
      style={{
        position: "fixed", right: 16, bottom: "calc(74px + env(safe-area-inset-bottom))", zIndex: 80,
        height: 50, borderRadius: 25, padding: "0 18px", border: "none",
        background: "var(--lime)", color: "var(--lime-fg)",
        fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 14,
        boxShadow: "0 6px 22px -6px rgba(0,0,0,.55)", cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 8,
      }}>
      {icon}<span>{label}</span>
    </button>,
    document.body
  );
}
