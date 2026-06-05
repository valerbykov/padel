// components/StandingsTable.jsx
// Таблица результатов: Игроки | Игры +/- (побед-ничьих-поражений) | Очки +/- | δ.
// props: rows (из detailedStandings), highlightId?, avatarOf?(row)=>{url?,rating?}
import React from "react";

const initials = (name = "") => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
const colorOf = (name = "") => `hsl(${[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 55% 42%)`;

function Avatar({ name, url, rating, size = 38 }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}>
      {url ? (
        <img src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "1px solid #2a4a3a" }} />
      ) : (
        <div style={{ width: size, height: size, borderRadius: "50%", background: colorOf(name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.36, border: "1px solid rgba(255,255,255,.15)" }}>{initials(name)}</div>
      )}
      {rating != null && (
        <div style={{ position: "absolute", top: -4, right: -4, background: "#34A853", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 5px", border: "2px solid #11211b" }}>{rating}</div>
      )}
    </div>
  );
}

export default function StandingsTable({ rows, highlightId, avatarOf }) {
  const grid = "1fr 70px 84px 42px";
  const deltaColor = (d) => (d > 0 ? "#3ddc84" : d < 0 ? "#ff6a52" : "#7d9488");
  return (
    <div style={{ fontFamily: "'Outfit',sans-serif", color: "#eef3ee" }}>
      <div style={{ display: "grid", gridTemplateColumns: grid, gap: 8, padding: "0 4px 8px", fontSize: 11, color: "#7d9488", borderBottom: "1px solid #22382c" }}>
        <span>Игроки</span>
        <span style={{ textAlign: "center" }}>Игры +/-</span>
        <span style={{ textAlign: "center" }}>Очки +/-</span>
        <span style={{ textAlign: "center" }}>δ</span>
      </div>
      {rows.map((p, i) => {
        const av = avatarOf ? avatarOf(p) : {};
        const hl = highlightId && p.id === highlightId;
        return (
          <div key={p.id} style={{
            display: "grid", gridTemplateColumns: grid, gap: 8, alignItems: "center",
            padding: "10px 4px", borderBottom: "1px solid #22382c",
            background: hl ? "rgba(95,160,255,.14)" : "transparent",
            borderRadius: hl ? 10 : 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ fontFamily: "'Anton',sans-serif", width: 16, color: ["#ffd23f", "#cfd8d0", "#cd7f4d"][i] || "#7d9488", fontSize: 14 }}>{i + 1}</span>
              <Avatar name={p.name} url={av.url} rating={av.rating} />
              <span style={{ fontWeight: hl ? 700 : 500, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
            </div>
            <span style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
              {p.wins}<span style={{ color: "#5d7567" }}> -{p.draws}- </span>{p.losses}
            </span>
            <span style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{p.points} - {p.against}</span>
            <span style={{ textAlign: "center", fontWeight: 700, color: deltaColor(p.delta) }}>{p.delta > 0 ? "+" : ""}{p.delta}</span>
          </div>
        );
      })}
    </div>
  );
}
