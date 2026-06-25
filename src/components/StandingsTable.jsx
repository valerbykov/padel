// components/StandingsTable.jsx
// Таблица результатов: Игроки | Игры +/- | Очки +/- | δ.
// Аватарка сверху, имя снизу под ней.
// props: rows (из detailedStandings), highlightId?, avatarOf?(row)=>{url?,rating?}
import React from "react";

const initials = (name = "") => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
const colorOf = (name = "") => `hsl(${[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 55% 42%)`;

function Avatar({ name, url, size = 34 }) {
  return url ? (
    <img src={url} alt="" loading="lazy" decoding="async" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: colorOf(name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.36, border: "1px solid rgba(255,255,255,.15)", flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

export default function StandingsTable({ rows, highlightId, avatarOf }) {
  const grid = "1fr 64px 80px 38px";
  const deltaColor = (d) => (d > 0 ? "#3ddc84" : d < 0 ? "#ff6a52" : "#7d9488");

  return (
    <div style={{ fontFamily: "'Outfit',sans-serif", color: "var(--ink)", minWidth: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: grid, gap: 6, padding: "0 4px 8px", fontSize: 10, color: "var(--mut)", borderBottom: "1px solid var(--line)" }}>
        <span>Игрок</span>
        <span style={{ textAlign: "center" }}>+/-</span>
        <span style={{ textAlign: "center" }}>Очки</span>
        <span style={{ textAlign: "center" }}>δ</span>
      </div>

      {rows.map((p, i) => {
        const av = avatarOf ? avatarOf(p) : {};
        const hl = highlightId && p.id === highlightId;
        const medal = ["#ffd23f", "#cfd8d0", "#cd7f4d"][i];

        return (
          <div key={p.id} style={{
            display: "grid", gridTemplateColumns: grid, gap: 6, alignItems: "center",
            padding: "8px 4px", borderBottom: "1px solid var(--line)",
            background: hl ? "rgba(95,160,255,.14)" : "transparent",
            borderRadius: hl ? 10 : 0,
          }}>
            {/* Колонка: номер + аватар + имя под ней */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
              <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, width: 16, flexShrink: 0, color: medal || "#7d9488", fontSize: 13, lineHeight: 1 }}>
                {i + 1}
              </span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 0, flex: 1 }}>
                <Avatar name={p.name} url={av.url} size={32} />
                <span style={{
                  fontSize: 10, lineHeight: 1.2, textAlign: "center",
                  wordBreak: "break-word", hyphens: "auto",
                  fontWeight: hl ? 700 : 500, color: "var(--ink)",
                  maxWidth: "100%",
                }}>
                  {p.name}
                </span>
              </div>
            </div>

            {/* В/Н/П */}
            <div style={{ textAlign: "center", fontSize: 11, fontVariantNumeric: "tabular-nums", lineHeight: 1.5 }}>
              <span style={{ color: "#3ddc84" }}>{p.wins}</span>
              
              <span style={{ color: "var(--mut)" }}>-{p.draws}-</span>
              <span style={{ color: "var(--coral)" }}>{p.losses}</span>
            </div>

            {/* Очки за/против */}
            <div style={{ textAlign: "center", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
              {p.points}<span style={{ color: "var(--mut)" }}>-</span>{p.against}
            </div>

            {/* Дельта */}
            <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13, color: deltaColor(p.delta) }}>
              {p.delta > 0 ? "+" : ""}{p.delta}
            </div>
          </div>
        );
      })}
    </div>
  );
}
