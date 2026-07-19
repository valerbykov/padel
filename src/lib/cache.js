// lib/cache.js
// Лёгкий кэш «stale-while-revalidate» с подкладкой в localStorage.
// Зачем: на нестабильной сети (РФ-фильтрация рвёт длинные HTTPS-соединения, отчего
// браузерное HTTP/2-соединение периодически залипает на ~12 c) показываем последние
// известные данные МГНОВЕННО, а свежие тянем в фоне. Побочно это даёт базовый офлайн —
// при потере сети видно последнее загруженное. И чинит «старые друзья из прошлой лиги»:
// у каждой лиги свой ключ кэша.

const MEM = new Map();        // key -> { v, t }
const INFLIGHT = new Map();   // key -> Promise
const GEN = new Map();        // key -> поколение (растёт при bustKey)
let EPOCH = 0;                // глобальное поколение (растёт при bustCache)
const LS_PREFIX = "pp_cache:";
const LS_MAX_AGE = 1000 * 60 * 60 * 24; // сутки
const FRESH_MS = 4000;                  // окно «свежести» памяти (дедуп всплеска)

function lsGet(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return undefined;
    const o = JSON.parse(raw);
    if (!o || Date.now() - o.t > LS_MAX_AGE) return undefined;
    return o.v;
  } catch { return undefined; }
}

function lsSet(key, v) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify({ v, t: Date.now() })); } catch { /* quota */ }
}

export function swr(key, fn) {
  const c = MEM.get(key);
  if (c && Date.now() - c.t < FRESH_MS) return Promise.resolve(c.v);
  if (INFLIGHT.has(key)) return INFLIGHT.get(key);

  // Фиксируем поколение на старте запроса. Если пока он летел, ключ инвалидировали
  // (мутация → bustKey/bustCache) и уже подтянули свежее — поздний ответ этого
  // запроса НЕ затираем в кэш (иначе на экране снова старые данные).
  const gen = GEN.get(key) || 0;
  const epoch = EPOCH;
  const p = Promise.resolve().then(fn).then(
    (v) => {
      // Удаляем из INFLIGHT только свой промис: после bustKey стартует новый
      // запрос p2, и если старый p доедет позже — он не должен выселить p2 из
      // мапы (иначе следующий swr не увидит p2 и заведёт дубль-фетч).
      if (INFLIGHT.get(key) === p) INFLIGHT.delete(key);
      if ((GEN.get(key) || 0) === gen && EPOCH === epoch) { MEM.set(key, { v, t: Date.now() }); lsSet(key, v); }
      return v;
    },
    (e) => { if (INFLIGHT.get(key) === p) INFLIGHT.delete(key); throw e; }
  );
  INFLIGHT.set(key, p);

  const stale = c ? c.v : lsGet(key);
  if (stale !== undefined) { p.catch(() => {}); return Promise.resolve(stale); }
  return p;
}

// Точечно сбросить один ключ (память + localStorage) — чтобы следующий swr() сходил
// на сервер за свежими данными именно по нему, не сбрасывая весь кэш.
// Мгновенное чтение/запись кэша без сети — для инстант-пейнта из localStorage
// (профиль и т.п.): показать последнее известное сразу, ревалидацию сделать в фоне.
export function cachePeek(key) {
  const c = MEM.get(key);
  if (c) return c.v;
  return lsGet(key);
}
export function cacheSet(key, v) {
  MEM.set(key, { v, t: Date.now() });
  lsSet(key, v);
}

export function bustKey(key) {
  GEN.set(key, (GEN.get(key) || 0) + 1);   // инвалидируем ещё летящий запрос по ключу
  MEM.delete(key);
  INFLIGHT.delete(key);
  try { localStorage.removeItem(LS_PREFIX + key); } catch { /* недоступно */ }
}

export function bustCache() {
  EPOCH++;                                 // инвалидируем все летящие запросы
  MEM.clear();
  INFLIGHT.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) localStorage.removeItem(k);
    }
  } catch { /* недоступно */ }
}
