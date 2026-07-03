// components/Fab.jsx — плавающая кнопка действия (FAB) над нижней навигацией.
// Круглая, только иконка (без подписи) — не закрывает обзор основного экрана.
// Портал в body: иначе position:fixed «уезжает» в трансформируемого предка
// (.pl-pop с анимацией).
import React from "react";
import { createPortal } from "react-dom";

export default function Fab({ onClick, label, icon }) {
  return createPortal(
    <button onClick={onClick} aria-label={label} title={label}
      style={{
        position: "fixed", right: 16, bottom: "calc(74px + env(safe-area-inset-bottom))", zIndex: 80,
        width: 56, height: 56, borderRadius: "50%", border: "none",
        background: "var(--lime)", color: "var(--lime-fg)",
        boxShadow: "0 6px 22px -6px rgba(0,0,0,.55)", cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
      {icon}
    </button>,
    document.body
  );
}
