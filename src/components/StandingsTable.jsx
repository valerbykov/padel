// components/StandingsTable.jsx
// Таблица результатов: Игроки | Игры +/- | Очки +/- | δ.
// Аватарка сверху, имя снизу под ней.
// props: rows (из detailedStandings), highlightId?, avatarOf?(row)=>{url?,rating?},
//        championIds? — id игроков пары-чемпиона (парные форматы): 👑 + золотая строка,
//        даже если по очкам они не первые (правило «удержал корт №1»).
import React from "react";
import Avatar from "./Avatar";
import { t } from "../lib/i18n";

export default function StandingsTable({ rows, highlightId, avatarOf, championIds }) {
  const grid = "1fr 50px 66px 40px";
  const deltaColor = (d) => (d > 0 ? "#3ddc84" : d < 0 ? "var(--coral)" : "var(--mut)");
  const champSet = new Set(championIds || []);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", color: "var(--ink)", minWidth: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: grid, gap: 5, padding: "0 4px 8px", fontSize: 10, color: "var(--mut)", borderBottom: "1px solid var(--line)" }}>
        <span>{t("st_player")}</span>
        <span style={{ textAlign: "center" }}>{t("st_record")}</span>
        <span style={{ textAlign: "center" }}>{t("st_points")}</span>
        <span style={{ textAlign: "center" }}>{t("st_diff")}</span>
      </div>

      {rows.map((p, i) => {
        const av = avatarOf ? avatarOf(p) : {};
        const hl = highlightId && p.id === highlightId;
        const champ = champSet.has(p.id);
        const glow = champ ? "#f7d978" : hl ? "var(--lime)" : null; // золото — чемпион-пара, лайм — ты
        const medal = ["#ffd23f", "#cfd8d0", "#cd7f4d"][i];

        return (
          <div key={p.id} style={{
            display: "grid", gridTemplateColumns: grid, gap: 5, alignItems: "center",
            padding: "6px 8px",
            borderBottom: glow ? "none" : "1px solid var(--line)",
            border: glow ? `1px solid color-mix(in srgb, ${glow} 55%, transparent)` : undefined,
            background: glow ? `color-mix(in srgb, ${glow} 12%, transparent)` : "transparent",
            borderRadius: glow ? 10 : 0,
          }}>
            {/* Номер + аватар + имя в строку (компактно) */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
              <span style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", fontWeight: 800, width: 14, flexShrink: 0, color: medal || "var(--mut)", fontSize: 13, lineHeight: 1, textAlign: "center" }}>
                {i + 1}
              </span>
              <Avatar name={p.name} url={av.url} id={p.id} size={24} />
              <span style={{ fontSize: 13, fontWeight: (hl || champ) ? 700 : 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                {p.name}
              </span>
              {champ && <span style={{ flexShrink: 0, fontSize: 12, lineHeight: 1 }}>👑</span>}
            </div>

            {/* В/Н/П */}
            <div style={{ textAlign: "center", fontSize: 13, fontVariantNumeric: "tabular-nums", lineHeight: 1.5 }}>
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
