// components/PublicRoster.jsx
// Гостевой ростер турнира (/t/CODE) — ТОЛЬКО ЧТЕНИЕ. На широком экране — сетка
// больших профиль-карточек (аватар 58px + имя + бейджи уровня), на узком —
// строки (аватар 36px). Пустые до target_size места — пунктирные "свободно".
// Парный формат — группировка по pair_no (groupPairs), пара = карточка/строка
// с двумя местами; открытая пара показывает "свободно" вместо второго игрока.
// Никаких ✕/добавления/шаринга — это для TournamentJoin.jsx (запись), не сюда.
import React from "react";
import Avatar from "./Avatar";
import LevelBadges from "./LevelBadges";
import { groupPairs } from "../lib/pairs";
import { t as tr } from "../lib/i18n";

const S = {
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 },

  card: {
    background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16,
    padding: "16px 10px 13px", display: "flex", flexDirection: "column", alignItems: "center",
    textAlign: "center", gap: 8, minWidth: 0,
  },
  cardName: {
    fontSize: 13.5, fontWeight: 700, maxWidth: "100%", overflow: "hidden",
    textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)",
  },
  cardFree: {
    border: "1.5px dashed var(--line)", borderRadius: 16, padding: "16px 10px 13px",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    textAlign: "center", gap: 8, color: "var(--mut)",
  },
  cardFreeAvatar: {
    width: 58, height: 58, borderRadius: "50%", display: "grid", placeItems: "center",
    border: "2px dashed color-mix(in srgb, var(--lime) 45%, transparent)", color: "var(--lime)",
    fontSize: 20, fontWeight: 700, flexShrink: 0,
  },
  cardFreeName: { fontSize: 13, fontWeight: 600, color: "var(--lime)" },

  row: { display: "flex", alignItems: "center", gap: 10, padding: "9px 4px" },
  rowName: {
    flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden",
    textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)",
  },
  rowFreeAvatar: {
    width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center",
    border: "2px dashed color-mix(in srgb, var(--lime) 45%, transparent)", color: "var(--lime)",
    fontSize: 15, fontWeight: 700, flexShrink: 0,
  },
  rowFreeName: { flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: "var(--lime)" },

  // ── пары ──────────────────────────────────────────────────────────────
  pairCard: {
    background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16,
    padding: "12px 10px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0,
  },
  pairNo: {
    fontSize: 11.5, fontWeight: 800, color: "var(--mut)", textTransform: "uppercase", letterSpacing: .5,
  },
  pairMembers: { display: "flex", flexDirection: "column", gap: 8 },
  pairMemberRow: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  pairMemberName: {
    flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflow: "hidden",
    textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)",
  },
  pairMemberFree: { display: "flex", alignItems: "center", gap: 8, minWidth: 0, color: "var(--mut)" },
  pairMemberAvatarFree: {
    borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0,
    border: "2px dashed color-mix(in srgb, var(--lime) 45%, transparent)", color: "var(--lime)",
    fontSize: 14, fontWeight: 700,
  },
  pairMemberNameFree: { fontSize: 12.5, fontWeight: 600, color: "var(--lime)" },

  pairRowWrap: { display: "flex", alignItems: "center", gap: 8, padding: "9px 4px" },
  pairRowNo: { width: 16, flexShrink: 0, fontWeight: 800, color: "var(--mut)", fontSize: 13, textAlign: "center" },
  pairAmp: { color: "var(--mut)", fontWeight: 700, flexShrink: 0 },
  pairRowMember: { display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, flex: "1 1 0" },
  pairRowName: {
    fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis",
    whiteSpace: "nowrap", minWidth: 0, color: "var(--ink)",
  },
  pairRowMemberFree: { display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, flex: "1 1 0", color: "var(--mut)" },
  pairRowAvatarFree: {
    width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0,
    border: "2px dashed color-mix(in srgb, var(--lime) 45%, transparent)", color: "var(--lime)",
    fontSize: 12, fontWeight: 700,
  },
  pairRowNameFree: { fontSize: 12.5, fontWeight: 600, color: "var(--lime)" },
};

function PlayerCard({ p }) {
  return (
    <div style={S.card}>
      <Avatar name={p.name} url={p.avatar_url} id={p.profile_id} size={58} />
      <div style={S.cardName}>{p.name}</div>
      <LevelBadges levels={p.levels} compact />
    </div>
  );
}

function FreeCard() {
  return (
    <div style={S.cardFree}>
      <div style={S.cardFreeAvatar}>+</div>
      <div style={S.cardFreeName}>{tr("pub_free")}</div>
    </div>
  );
}

function PlayerRow({ p, last }) {
  return (
    <div style={{ ...S.row, borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <Avatar name={p.name} url={p.avatar_url} id={p.profile_id} size={36} />
      <div style={S.rowName}>{p.name}</div>
      <LevelBadges levels={p.levels} compact />
    </div>
  );
}

function FreeRow({ last }) {
  return (
    <div style={{ ...S.row, borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <div style={S.rowFreeAvatar}>+</div>
      <div style={S.rowFreeName}>{tr("pub_free")}</div>
    </div>
  );
}

// Место в паре (карточка, широкий экран): игрок или пунктирное "свободно".
function PairMember({ p, size }) {
  if (!p) {
    return (
      <div style={S.pairMemberFree}>
        <div style={{ ...S.pairMemberAvatarFree, width: size, height: size }}>+</div>
        <div style={S.pairMemberNameFree}>{tr("pub_free")}</div>
      </div>
    );
  }
  return (
    <div style={S.pairMemberRow}>
      <Avatar name={p.name} url={p.avatar_url} id={p.profile_id} size={size} />
      <div style={S.pairMemberName}>{p.name}</div>
      <LevelBadges levels={p.levels} compact />
    </div>
  );
}

// Карточка пары (широкий экран): номер пары + два места друг под другом.
function PairCard({ pairNo, a, b }) {
  return (
    <div style={S.pairCard}>
      {pairNo != null && <div style={S.pairNo}>{pairNo}</div>}
      <div style={S.pairMembers}>
        <PairMember p={a} size={34} />
        <PairMember p={b} size={34} />
      </div>
    </div>
  );
}

// Место в паре (строка, узкий экран): игрок или пунктирное "свободно".
function PairRowMember({ p }) {
  if (!p) {
    return (
      <span style={S.pairRowMemberFree}>
        <span style={S.pairRowAvatarFree}>+</span>
        <span style={S.pairRowNameFree}>{tr("pub_free")}</span>
      </span>
    );
  }
  return (
    <span style={S.pairRowMember}>
      <Avatar name={p.name} url={p.avatar_url} id={p.profile_id} size={28} />
      <span style={S.pairRowName}>{p.name}</span>
      <LevelBadges levels={p.levels} compact />
    </span>
  );
}

// Строка пары (узкий экран): номер + игрок1 + "&" + игрок2 (или "свободно").
function PairRow({ pairNo, a, b, last }) {
  return (
    <div style={{ ...S.pairRowWrap, borderBottom: last ? "none" : "1px solid var(--line)" }}>
      {pairNo != null && <span style={S.pairRowNo}>{pairNo}</span>}
      <PairRowMember p={a} />
      <span style={S.pairAmp}>&amp;</span>
      <PairRowMember p={b} />
    </div>
  );
}

// Парный ростер: реальные пары (groupPairs) + одиночки без pair_no (pool) +
// полностью пустые пары до заполнения target_size — все три вида в одном
// списке единиц отображения (юнит = одна карточка/строка на пару).
function PairRoster({ players, targetSize, isWide }) {
  const { pairs, pool } = groupPairs(players);
  const pairCap = Math.floor((targetSize || 0) / 2);
  const extraPairs = Math.max(0, pairCap - pairs.length);

  const units = [
    ...pairs.map((pr) => ({ key: `p${pr.pair_no}`, pairNo: pr.pair_no, a: pr.members[0] || null, b: pr.members[1] || null })),
    // Игроки без пары (pool) — показываем как есть, второе место пунктиром.
    ...pool.map((p) => ({ key: `s${p.id}`, pairNo: null, a: p, b: null })),
    // Полностью свободные пары сверх текущего ростера — обе позиции пунктиром.
    ...Array.from({ length: extraPairs }, (_, i) => ({ key: `x${i}`, pairNo: null, a: null, b: null })),
  ];

  if (isWide) {
    return (
      <div style={S.grid}>
        {units.map((u) => <PairCard key={u.key} pairNo={u.pairNo} a={u.a} b={u.b} />)}
      </div>
    );
  }
  return (
    <div>
      {units.map((u, i) => (
        <PairRow key={u.key} pairNo={u.pairNo} a={u.a} b={u.b} last={i === units.length - 1} />
      ))}
    </div>
  );
}

export default function PublicRoster({ players, targetSize, isWide, isPair }) {
  const list = Array.isArray(players) ? players : [];

  if (isPair) {
    return <PairRoster players={list} targetSize={targetSize || 0} isWide={isWide} />;
  }

  const freeCount = Math.max(0, (targetSize || 0) - list.length);

  if (isWide) {
    return (
      <div style={S.grid}>
        {list.map((p) => <PlayerCard key={p.id} p={p} />)}
        {Array.from({ length: freeCount }, (_, i) => <FreeCard key={`f${i}`} />)}
      </div>
    );
  }

  const total = list.length + freeCount;
  return (
    <div>
      {list.map((p, i) => <PlayerRow key={p.id} p={p} last={i === total - 1} />)}
      {Array.from({ length: freeCount }, (_, i) => (
        <FreeRow key={`f${i}`} last={list.length + i === total - 1} />
      ))}
    </div>
  );
}
