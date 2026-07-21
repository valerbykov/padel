// Карточки-картинки для шаринга результатов (canvas → PNG → системный шеринг).
// Две карточки одним движком: результат игры и подиум турнира. 1080×1350 —
// портретный формат под Telegram/WhatsApp. Аватары грузим с crossOrigin, при
// ошибке падаем на собаку-заглушку (как в UI).
import { dogAvatar } from "./avatar";
import { t, nGames } from "./i18n";

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
    // Кэш-бастер для внешних http(s)-аватаров: обычный <img> в приложении кэширует
    // картинку БЕЗ CORS, и повторный crossOrigin-запрос на тот же URL падает
    // (canvas требует CORS) → реальное фото превращалось в собаку-заглушку. Отдельный
    // URL = отдельная запись кэша, уже с CORS. Локальные/data-URI не трогаем.
    im.src = /^https?:\/\//i.test(src) ? src + (src.includes("?") ? "&" : "?") + "sc=1" : src;
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

  // Низ: без лаймового баннера и слогана — только приглушённый URL (современнее).
  ctx.font = F(700, 30); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = C.mut; ctx.fillText("padelpack.app", W / 2, H - 40);
  ctx.textBaseline = "alphabetic";
}

// ── Карточка результата игры ────────────────────────────────────────────────
// teamA/teamB: [{ name, avatar_url, id }], setsA/setsB, scoreDetail?.
export async function renderGameCard({ title, dateStr, teamA, teamB, setsA, setsB, scoreDetail }) {
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
  // Аватары пары перекрываются: пара компактнее и не налезает на крупный счёт.
  const pair = (im1, im2, cx, border) => {
    circleAvatar(ctx, im1, cx - (d - overlap) / 2, cy, d, border);
    circleAvatar(ctx, im2, cx + (d - overlap) / 2, cy, d, border);
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

  return canvas;
}

// ── Карточка микс-сессии ────────────────────────────────────────────────────
// games: [{ teamA, teamB, setsA, setsB, scoreDetail }] (команды как в renderGameCard).
// Хроника: до 5 игр строками — пары, счёт, победители цветом (макет «вариант A»).
export async function renderMixCard({ dateStr, games = [] }) {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  try { await document.fonts?.load?.("800 52px Outfit"); } catch (e) {}
  frame(ctx, { glow: "rgba(200,255,45,.15)", rightText: dateStr || "" });

  ctx.font = F(800, 36); ctx.textAlign = "center"; ctx.fillStyle = C.mut;
  ctx.fillText(`🔀 ${t("mix_session_title").toUpperCase()} · ${nGames(games.length)}`, W / 2, 240);

  const shown = games.slice(0, 5);
  const imgs = await Promise.all(shown.map((g) =>
    Promise.all([...g.teamA, ...g.teamB].map((p) => avatarImg(p.avatar_url, p.id || p.name)))));

  const firstName = (n) => String(n || "?").trim().split(/\s+/)[0];
  const fit = (tx, max) => {
    if (ctx.measureText(tx).width <= max) return tx;
    let out = tx;
    while (out.length > 1 && ctx.measureText(out + "…").width > max) out = out.slice(0, -1);
    return out + "…";
  };

  const rowH = 150, gap = 26;
  const totalH = shown.length * rowH + (shown.length - 1) * gap;
  let y = 300 + Math.max(0, (900 - totalH) / 2);
  const d = 88, ov = 26;

  shown.forEach((g, gi) => {
    const [a1, a2, b1, b2] = imgs[gi];
    const cy = y + rowH / 2;
    rr(ctx, 56, y, W - 112, rowH, 26);
    ctx.fillStyle = "rgba(255,255,255,.035)"; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();

    const aWin = g.setsA > g.setsB, bWin = g.setsB > g.setsA;
    // пары аватаров по краям
    circleAvatar(ctx, a1, 56 + 34 + d / 2, cy, d, aWin ? C.lime : C.line);
    circleAvatar(ctx, a2, 56 + 34 + d / 2 + (d - ov), cy, d, aWin ? C.lime : C.line);
    circleAvatar(ctx, b2, W - 56 - 34 - d / 2 - (d - ov), cy, d, bWin ? C.coral : C.line);
    circleAvatar(ctx, b1, W - 56 - 34 - d / 2, cy, d, bWin ? C.coral : C.line);

    // крупный счёт по центру + сеты мелко под ним
    ctx.font = F(800, 56);
    ctx.textAlign = "right"; ctx.fillStyle = aWin ? C.lime : C.ink; ctx.fillText(String(g.setsA), W / 2 - 22, cy + 8);
    ctx.textAlign = "center"; ctx.fillStyle = C.mut; ctx.fillText(":", W / 2, cy + 6);
    ctx.textAlign = "left"; ctx.fillStyle = bWin ? C.coral : C.ink; ctx.fillText(String(g.setsB), W / 2 + 22, cy + 8);
    if (Array.isArray(g.scoreDetail) && g.scoreDetail.length > 0) {
      ctx.font = F(600, 24); ctx.textAlign = "center"; ctx.fillStyle = C.mut;
      ctx.fillText(g.scoreDetail.map((x) => `${x.a}:${x.b}`).join(" · "), W / 2, cy + 48);
    }

    // имена пар — колонкой, каждое на своей строке
    ctx.font = F(700, 30);
    const nmMax = 180;
    const leftX = W / 2 - 118, rightX = W / 2 + 118;
    ctx.textAlign = "right";
    ctx.fillStyle = aWin ? C.lime : "rgba(238,243,238,.85)";
    ctx.fillText(fit(firstName(g.teamA[0]?.name), nmMax), leftX, cy - 8);
    ctx.fillText(fit(firstName(g.teamA[1]?.name), nmMax), leftX, cy + 30);
    ctx.textAlign = "left";
    ctx.fillStyle = bWin ? C.coral : "rgba(238,243,238,.85)";
    ctx.fillText(fit(firstName(g.teamB[0]?.name), nmMax), rightX, cy - 8);
    ctx.fillText(fit(firstName(g.teamB[1]?.name), nmMax), rightX, cy + 30);

    y += rowH + gap;
  });

  if (games.length > shown.length) {
    ctx.font = F(600, 30); ctx.textAlign = "center"; ctx.fillStyle = C.mut;
    ctx.fillText(`+ ${nGames(games.length - shown.length)}`, W / 2, y + 14);
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

  // Пары: у места две аватарки; соло — одна. imgSets[i] = массив из 1 или 2 картинок.
  const imgSets = await Promise.all(top3.map((p) =>
    Array.isArray(p.avatars) && p.avatars.length > 1
      ? Promise.all(p.avatars.slice(0, 2).map((u, k) => avatarImg(u, (p.names || [])[k] || p.name)))
      : avatarImg(p.avatar_url, p.id || p.name).then((im) => [im])
  ));
  const baseY = H - 200;                       // низ пьедесталов (над футером)
  const cols = [
    { p: top3[1], ims: imgSets[1], cx: W / 2 - 300, d: 170, ped: 220, color: C.silver, rank: 2 },
    { p: top3[0], ims: imgSets[0], cx: W / 2,       d: 220, ped: 320, color: C.yellow, rank: 1 },
    { p: top3[2], ims: imgSets[2], cx: W / 2 + 300, d: 170, ped: 150, color: C.bronze, rank: 3 },
  ];
  cols.forEach(({ p, ims, cx, d, ped, color, rank }) => {
    if (!p) return;
    const pedTop = baseY - ped;
    rr(ctx, cx - 130, pedTop, 260, ped, 16);
    ctx.fillStyle = rank === 1 ? "rgba(255,212,94,.2)" : C.surface2; ctx.fill();
    ctx.font = `800 ${rank === 1 ? 84 : 64}px Outfit, sans-serif`;
    ctx.textAlign = "center"; ctx.fillStyle = color;
    ctx.fillText(String(rank), cx, pedTop + (rank === 1 ? 110 : 88));
    const nameY = pedTop - (p.points != null ? 96 : 56);
    const avCy = nameY - (rank === 1 ? 90 : 60) - d / 2 + 10;
    if (ims && ims.length > 1) {
      const dd = d * 0.82;                       // две аватарки внахлёст
      circleAvatar(ctx, ims[1], cx + dd * 0.34, avCy, dd, color);
      circleAvatar(ctx, ims[0], cx - dd * 0.34, avCy, dd, color);
    } else {
      circleAvatar(ctx, (ims || [])[0], cx, avCy, d, color);
    }
    // Имя целиком, но ужимаем шрифт под ширину пьедестала (длинные пары-имена влезают).
    const nmText = `${p.name}${rank === 1 ? " 🏆" : ""}`;
    let fs = rank === 1 ? 40 : 34; const fw = rank === 1 ? 800 : 700;
    ctx.font = F(fw, fs);
    while (ctx.measureText(nmText).width > 250 && fs > 22) { fs -= 2; ctx.font = F(fw, fs); }
    ctx.fillStyle = C.ink;
    ctx.fillText(nmText, cx, nameY);
    if (p.points != null) {
      ctx.font = F(700, 30); ctx.fillStyle = rank === 1 ? C.yellow : C.mut;
      ctx.fillText(`${p.points} ${t("trn_hero_pts")}`, cx, nameY + 42);
    }
  });

  return canvas;
}

// PNG → системный шеринг; фолбэк — скачивание файла.
// В нативных оболочках Web Share API нет (Android WebView) — там пишем PNG в
// кэш и зовём системный шит через Capacitor Share (плагины берём с
// window.Capacitor, без прямых импортов @capacitor/* — см. platform.js).
export async function shareCanvas(canvas, filename) {
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  if (!blob) return false;
  const cap = typeof window !== "undefined" ? window.Capacitor : null;
  const FS = cap?.Plugins?.Filesystem, SH = cap?.Plugins?.Share;
  if (cap?.isNativePlatform?.() && FS && SH) {
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onloadend = () => res(String(r.result).split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
      const w = await FS.writeFile({ path: filename, data: b64, directory: "CACHE" });
      await SH.share({ files: [w.uri] });
      return true;
    } catch (e) {
      // отмена шита — не ошибка; прочее — пробуем веб-путь ниже
      if (/cancel/i.test(e?.message || "")) return true;
    }
  }
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
