import React from "react";
import { t } from "../lib/i18n";

// Ловит краши рендера и ошибки загрузки lazy-чанков (частая причина «чёрного
// экрана» после деплоя: HTML ссылается на устаревший чанк). Раньше в приложении
// ErrorBoundary не было — любой сбой ронял всё в чёрный/белый экран. Здесь вместо
// этого — восстановимая страница с перезагрузкой (для chunk-load — авто-один раз).
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    try { console.error("[ErrorBoundary]", err, info); } catch (e) {}
    const msg = String((err && err.message) || err || "");
    // Устаревший чанк после деплоя — один раз перезагружаем на свежие ассеты.
    if (/Loading chunk|dynamically imported module|Failed to fetch|module script failed|error loading dynamically/i.test(msg)) {
      try {
        if (!sessionStorage.getItem("pp_chunk_reload")) {
          sessionStorage.setItem("pp_chunk_reload", "1");
          window.location.reload();
        }
      } catch (e) {}
    }
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ minHeight: "100vh", background: "var(--bg, #0a1612)", color: "var(--ink, #eef3ee)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center", fontFamily: "'Outfit',sans-serif" }}>
          <div style={{ fontSize: 44 }}>🐾</div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{t("err_boundary_title")}</div>
          <div style={{ fontSize: 13.5, color: "var(--mut, #7d9488)", maxWidth: 340, lineHeight: 1.5 }}>{t("err_boundary_sub")}</div>
          <button onClick={() => { try { sessionStorage.removeItem("pp_chunk_reload"); } catch (e) {} window.location.reload(); }}
            style={{ marginTop: 6, background: "var(--lime, #c8ff2d)", color: "var(--lime-fg, #0a1612)", border: "none", borderRadius: 12, padding: "13px 24px", fontWeight: 800, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
            {t("err_boundary_btn")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
