// components/Fab.jsx — плавающая кнопка действия (FAB) над нижней навигацией.
// Круглая, только иконка + маленький «+»-бейдж: по кнопке сразу понятно, что
// добавляешь (игрока/игру/турнир), без взгляда на вкладку. Портал в body: иначе
// position:fixed «уезжает» в трансформируемого предка (.pl-pop с анимацией).
import React from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";

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
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
        <span style={{
          position: "absolute", right: -9, bottom: -9, width: 20, height: 20, borderRadius: "50%",
          background: "var(--lime-fg)", color: "var(--lime)", border: "2px solid var(--lime)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Plus size={12} strokeWidth={3} />
        </span>
      </span>
    </button>,
    document.body
  );
}
