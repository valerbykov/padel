// Карточки-картинки для шаринга результатов (canvas → PNG → системный шеринг).
// Две карточки одним движком: результат игры и подиум турнира. 1080×1350 —
// портретный формат под Telegram/WhatsApp. Аватары грузим с crossOrigin, при
// ошибке падаем на собаку-заглушку (как в UI).
import { dogAvatar } from "./avatar";
import { t } from "./i18n";

const W = 1080, H = 1350;
const C = {
  bg1: "#0d1b15", bg2: "#0a1612", surface2: "#16291f", line: "#22382c",
  ink: "#eef3ee", mut: "#7d9488", lime: "#c8ff2d", coral: "#ff6a52",
  yellow: "#ffd45e", limeFg: "#0a1612", silver: "#cfd8d0", bronze: "#cd7f4d",
};
const F = (w, s) => `${w} ${s}px Outfit, system-ui, sans-serif`;

function loadImg(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}
async function avatarImg(url, idOrName) {
  return (url && await loadImg(url)) || await loadImg(dogAvatar(idOrName || "?"));
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circleAvatar(ctx, im, cx, cy, d, border) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.clip();
  if (im) ctx.drawImage(im, cx - d / 2, cy - d / 2, d, d);
  else { ctx.fillStyle = "#243b2e"; ctx.fillRect(cx - d / 2, cy - d / 2, d, d); }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  ctx.lineWidth = 8; ctx.strokeStyle = border; ctx.stroke();
}


// Общий фон + шапка «PadelPack | справа контекст» + брендовый футер.
function frame(ctx, { glow, rightText }) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, C.bg1); g.addColorStop(0.6, C.bg2); g.addColorStop(1, C.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W * 0.85, -60, 0, W * 0.85, -60, 700);
  rg.addColorStop(0, glow); rg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "alphabetic";
  ctx.font = F(800, 52); ctx.textAlign = "left";
  ctx.fillStyle = C.lime; ctx.fillText("Padel", 64, 108);
  const pw = ctx.measureText("Padel").width;
  ctx.fillStyle = C.ink; ctx.fillText("Pack", 64 + pw, 108);
  if (rightText) {
    ctx.font = F(600, 34); ctx.textAlign = "right"; ctx.fillStyle = C.mut;
    ctx.fillText(rightText, W - 64, 104);
  }

  ctx.fillStyle = C.lime; ctx.fillRect(0, H - 96, W, 96);
  ctx.font = F(800, 38); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = C.limeFg; ctx.fillText(`padelpack.app — ${t("sc_footer")}`, W / 2, H - 46);
  ctx.textBaseline = "alphabetic";
}

// ── Карточка результата игры ────────────────────────────────────────────────
// teamA/teamB: [{ name, avatar_url, id }], setsA/setsB, scoreDetail?, deltas?:
// [{ name, delta }] — только зарегистрированные участники.
export async function renderGameCard({ title, dateStr, teamA, teamB, setsA, setsB, scoreDetail, deltas = [] }) {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  try { await document.fonts?.load?.("800 52px Outfit"); } catch (e) {}
  frame(ctx, { glow: "rgba(200,255,45,.15)", rightText: dateStr || "" });

  if (title) {
    ctx.font = F(800, 36); ctx.textAlign = "center"; ctx.fillStyle = C.mut;
    ctx.fillText(String(title).toUpperCase().slice(0, 34), W / 2, 240);
  }

  const imgs = await Promise.all([...teamA, ...teamB].map((p) => avatarImg(p.avatar_url, p.id || p.name)));
  const [a1, a2, b1, b2] = imgs;
  const d = 190, overlap = 60, cy = 480;
  const pair = (im1, im2, cx, border) => {
    circleAvatar(ctx, im1, cx - overlap / 2 - d / 2 + overlap / 2, cy, d, border);
    circleAvatar(ctx, im2, cx + overlap / 2 + d / 2 - overlap / 2, cy, d, border);
  };
  pair(a1, a2, 250, C.lime);
  pair(b1, b2, W - 250, C.coral);

  const aWin = setsA > setsB, bWin = setsB > setsA;
  ctx.font = F(800, 150); ctx.textAlign = "center";
  ctx.fillStyle = C.mut; ctx.fillText(":", W / 2, cy + 52);
  ctx.textAlign = "right"; ctx.fillStyle = aWin ? C.lime : C.ink; ctx.fillText(String(setsA), W / 2 - 30, cy + 52);
  ctx.textAlign = "left"; ctx.fillStyle = bWin ? C.coral : C.ink; ctx.fillText(String(setsB), W / 2 + 30, cy + 52);

  const nm = (team) => team.map((p) => p.name).join(" & ");
  ctx.font = F(700, 36); ctx.textAlign = "center";
  ctx.fillStyle = aWin ? C.lime : C.mut; ctx.fillText(nm(teamA).slice(0, 24), 250, cy + 170);
  ctx.fillStyle = bWin ? C.coral : C.mut; ctx.fillText(nm(teamB).slice(0, 24), W - 250, cy + 170);

  // Сеты
  if (Array.isArray(scoreDetail) && scoreDetail.length > 0) {
    ctx.font = F(700, 44); ctx.textAlign = "center";
    const parts = scoreDetail.map((s) => `${s.a}:${s.b}`);
    const gap = 70;
    const widths = parts.map((p) => ctx.measureText(p).width);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
    let x = W / 2 - total / 2;
    parts.forEach((p, i) => {
      const s = scoreDetail[i];
      ctx.textAlign = "left";
      ctx.fillStyle = s.a > s.b ? C.lime : s.b > s.a ? C.coral : C.mut;
      ctx.fillText(p, x, 800);
      x += widths[i] + gap;
    });
  }

  // Дельты рейтинга — бейджи-пилюли по центру
  if (deltas.length > 0) {
    const items = deltas.slice(0, 4).map((r) => `${r.name.split(" ")[0]} ${r.delta > 0 ? "+" : ""}${r.delta}`);
    ctx.font = F(800, 30);
    const ws = items.map((tx) => ctx.measureText(tx).width + 48);
    const gap = 20;
    const total = ws.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
    let x = W / 2 - total / 2;
    items.forEach((tx, i) => {
      const pos = deltas[i].delta > 0;
      rr(ctx, x, 880, ws[i], 56, 28);
      ctx.fillStyle = pos ? "rgba(200,255,45,.16)" : "rgba(255,106,82,.15)"; ctx.fill();
      ctx.fillStyle = pos ? C.lime : C.coral;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(tx, x + ws[i] / 2, 880 + 30);
      ctx.textBaseline = "alphabetic";
      x += ws[i] + gap;
    });
  }

  return canvas;
}

// ── Карточка подиума турнира ────────────────────────────────────────────────
// top3: [{ name, avatar_url, id, points }] в порядке мест 1..3.
export async function renderTournamentCard({ name, dateStr, metaStr, top3 }) {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  try { await document.fonts?.load?.("800 52px Outfit"); } catch (e) {}
  frame(ctx, { glow: "rgba(255,212,94,.18)", rightText: dateStr || "" });

  ctx.font = F(800, 48); ctx.textAlign = "center"; ctx.fillStyle = C.yellow;
  ctx.fillText(`🏆 ${String(name).slice(0, 26)}`, W / 2, 250);
  if (metaStr) {
    ctx.font = F(600, 32); ctx.fillStyle = C.mut;
    ctx.fillText(metaStr, W / 2, 306);
  }

  const imgs = await Promise.all(top3.map((p) => avatarImg(p.avatar_url, p.id || p.name)));
  const baseY = H - 200;                       // низ пьедесталов (над футером)
  const cols = [
    { p: top3[1], im: imgs[1], cx: W / 2 - 300, d: 170, ped: 220, color: C.silver, rank: 2 },
    { p: top3[0], im: imgs[0], cx: W / 2,       d: 220, ped: 320, color: C.yellow, rank: 1 },
    { p: top3[2], im: imgs[2], cx: W / 2 + 300, d: 170, ped: 150, color: C.bronze, rank: 3 },
  ];
  cols.forEach(({ p, im, cx, d, ped, color, rank }) => {
    if (!p) return;
    const pedTop = baseY - ped;
    rr(ctx, cx - 130, pedTop, 260, ped, 16);
    ctx.fillStyle = rank === 1 ? "rgba(255,212,94,.2)" : C.surface2; ctx.fill();
    ctx.font = `800 ${rank === 1 ? 84 : 64}px Outfit, sans-serif`;
    ctx.textAlign = "center"; ctx.fillStyle = color;
    ctx.fillText(String(rank), cx, pedTop + (rank === 1 ? 110 : 88));
    const nameY = pedTop - (p.points != null ? 96 : 56);
    circleAvatar(ctx, im, cx, nameY - (rank === 1 ? 90 : 60) - d / 2 + 10, d, color);
    ctx.font = F(rank === 1 ? 800 : 700, rank === 1 ? 40 : 34); ctx.fillStyle = C.ink;
    ctx.fillText(`${p.name.slice(0, 14)}${rank === 1 ? " 👑" : ""}`, cx, nameY);
    if (p.points != null) {
      ctx.font = F(700, 30); ctx.fillStyle = rank === 1 ? C.yellow : C.mut;
      ctx.fillText(`${p.points} ${t("trn_hero_pts")}`, cx, nameY + 42);
    }
  });

  return canvas;
}

// PNG → системный шеринг; фолбэк — скачивание файла.
export async function shareCanvas(canvas, filename) {
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  if (!blob) return false;
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return true; }
    catch (e) { if (e && e.name === "AbortError") return true; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return true;
}
