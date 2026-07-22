// lib/avatar.js — единый источник аватаров.
// Фолбэк — брендовая собака с ракеткой, детерминированно по id или имени игрока.
// В /avatars лежит 15 собак (dog-01..15.webp, ~9 КБ каждая, 160px). Чтобы
// поднять до 16 — добавить dog-16.webp и менять DOG_COUNT (это пересортирует
// уже назначенные аватары: hash%16 ≠ hash%15).
export const DOG_COUNT = 15;

// Модульный флаг «маскот вкл/выкл» — переключает только АВТОЗАГЛУШКУ (когда у
// игрока нет avatar_url). Личный выбор (фото или пресет /avatars/dog-NN.webp)
// от флага не зависит и показывается всегда. Выставляется снаружи (App.jsx)
// синхронно на каждый рендер по активной лиге — см. setMascotEnabled.
let mascotEnabled = true;

export function setMascotEnabled(v) {
  mascotEnabled = v !== false;
}

export function mascotOn() {
  return mascotEnabled;
}

export function dogAvatar(idOrName) {
  if (!idOrName) return "/avatars/dog-01.webp";
  const hash = [...String(idOrName)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return `/avatars/dog-${String((hash % DOG_COUNT) + 1).padStart(2, "0")}.webp`;
}

// Палитра фонов для инициалов — приятные насыщенные цвета, читаемые с белым
// или тёмным текстом (см. isLightColor). Индекс выбирается детерминированно
// по хэшу id/имени, как и для собак.
const INITIALS_PALETTE = [
  "#E63946",
  "#F4A261",
  "#2A9D8F",
  "#264653",
  "#457B9D",
  "#8E44AD",
  "#E76F51",
  "#3D5A80",
  "#6A4C93",
  "#1D8A99",
];

// true, если фон достаточно светлый и нужен тёмный текст поверх (иначе — белый).
function isLightColor(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

// UUID (id игрока/группы) — в нём нет «читаемых» инициалов, отдаём «?».
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 1–2 заглавные буквы из имени: первые буквы первых двух слов, либо первые
// две буквы одного слова. Если букв вообще нет (UUID, телефон, пусто) —
// «?» либо первый буквенно-цифровой символ.
function initialsFor(idOrName) {
  const str = String(idOrName ?? "").trim();
  if (!str) return "?";
  if (UUID_RE.test(str)) return "?";

  const lettersOnly = str.replace(/[^\p{L}]/gu, "");
  if (!lettersOnly) {
    const alnum = str.match(/[0-9A-Za-zА-Яа-яЁё]/);
    return alnum ? alnum[0].toUpperCase() : "?";
  }

  const words = str.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const a = words[0].match(/\p{L}/u);
    const b = words[1].match(/\p{L}/u);
    if (a && b) return (a[0] + b[0]).toUpperCase();
  }
  return lettersOnly.slice(0, 2).toUpperCase();
}

// Аватар-заглушка на инициалах: самодостаточный SVG (data-URI), без ассетов.
// key — ключ хэша (обычно id, для стабильного цвета), name — источник букв.
// Если name не передан, буквы берём из key (обратная совместимость: старые
// вызовы с одним аргументом-именем работают как раньше). Ключ-UUID без имени
// букв не даёт — тогда «?».
export function initialsAvatar(key, name) {
  const hashKey = String(key ?? "");
  const hash = [...hashKey].reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = INITIALS_PALETTE[hash % INITIALS_PALETTE.length];
  const initials = initialsFor(name ?? key);
  const textColor = isLightColor(bg) ? "#1a1a1a" : "#ffffff";
  const fontSize = initials.length > 1 ? 40 : 46;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">` +
    `<circle cx="50" cy="50" r="50" fill="${bg}"/>` +
    `<text x="50" y="52" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" ` +
    `font-size="${fontSize}" font-weight="700" fill="${textColor}">${initials}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Кастомное фото игрока, иначе — автозаглушка: собака (маскот вкл) или
// инициалы (маскот выкл). key — ключ хэша/собаки (id), name — источник букв
// для инициалов (передавать всегда, где ключ — UUID; иначе будет «?»).
export const playerAvatar = (url, key, name) =>
  url || (mascotEnabled ? dogAvatar(key) : initialsAvatar(key, name));

// onError-обработчик для <img> аватара. playerAvatar/Avatar дают заглушку
// только когда url пустой; но если url НЕ пустой и не грузится (битая ссылка,
// удалённый объект в Storage, заблокированный внешний хост) — браузер
// показывает «битую картинку». Этот хендлер при провале загрузки один раз
// подменяет src на заглушку (собака при маскоте, иначе инициалы).
// Флаг dataset защищает от петли, если вдруг и заглушка не загрузится.
export function avatarFallback(key, name) {
  return (e) => {
    const img = e.currentTarget;
    if (img.dataset.dogFallback) return;
    img.dataset.dogFallback = "1";
    img.src = mascotEnabled ? dogAvatar(key) : initialsAvatar(key, name);
  };
}

// Стиль-фон: заглушка ПОД <img> (собака при маскоте, иначе инициалы). Пока
// настоящее фото грузится (или висит на медленной внешней ссылке —
// Telegram/битый Storage), сквозь прозрачный img видна заглушка, а не пустой
// круг. Загрузилось фото — оно перекрывает фон; не загрузилось — остаётся
// заглушка (плюс onError-подмена как страховка).
export function avatarBg(key, name) {
  const fallbackUrl = mascotEnabled ? dogAvatar(key) : initialsAvatar(key, name);
  return { backgroundImage: `url(${fallbackUrl})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" };
}

// Когда настоящее фото загрузилось — убираем фон-заглушку, иначе она
// просвечивает сквозь прозрачные места фото (вырезанные портреты на
// прозрачном фоне). Фон-заглушка нужна только как плейсхолдер на время
// загрузки/зависания.
export const avatarOnLoad = (e) => { try { e.currentTarget.dataset.avatarLoaded = "1"; } catch (_) {} };
