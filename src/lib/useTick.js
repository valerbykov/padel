// Общий «минутный тик» для карточек с живым временем (countdown до игры,
// счётчик «LIVE · N мин»). Эти значения считаются из Date.now() при рендере, но
// сами по себе не перерисовываются — без тика они замирают до следующей смены
// стейта. Один setInterval на всё приложение; подписываются ТОЛЬКО карточки,
// которым тик реально нужен (enabled), поэтому длинный список сыгранных игр не
// перерисовывается каждые полминуты.
import { useEffect, useState } from "react";

const subs = new Set();
let timer = null;

function ensure() {
  if (timer) return;
  timer = setInterval(() => { subs.forEach((fn) => { try { fn(); } catch (e) { console.error("useMinuteTick: подписчик упал", e); } }); }, 30000);
}
function maybeStop() {
  if (timer && subs.size === 0) { clearInterval(timer); timer = null; }
}

export function useMinuteTick(enabled = true) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const fn = () => bump((n) => n + 1);
    subs.add(fn);
    ensure();
    return () => { subs.delete(fn); maybeStop(); };
  }, [enabled]);
}
