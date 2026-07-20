// src/lib/i18n.js — simple i18n for RU / EN / ES

// Имя обезличенного профиля — точь-в-точь как ставит edge-функция delete-account.
// Такие профили не предлагаем добавлять в новые игры/турниры (аккаунт удалён).
export const DELETED_PLAYER_NAME = 'Удалённый игрок';
export const isDeletedPlayer = (p) => !!p && p.name === DELETED_PLAYER_NAME;

export const LANGS = ['ru', 'en', 'es'];
export const LANG_LABELS = { ru: 'RU', en: 'EN', es: 'ES' };

export let currentLang = localStorage.getItem('plLang') || 'ru';

// ── Локали разнесены по чанкам: грузим только активную (+ ru как фолбэк) ──────
// Словари ru/en/es лежат в отдельных модулях (src/lib/locales/*.js) и попадают в
// свои чанки — в стартовый бандл больше не входят все три. t() остаётся
// СИНХРОННОЙ: initI18n() (вызывается в main.jsx ДО первого рендера) грузит ru +
// активную локаль, поэтому к моменту рендера словари уже на месте. Вызовов t() на
// уровне модулей в проекте нет — только внутри компонентов/функций (рендер-тайм).
const T = {};
async function loadLocale(lang) {
  if (T[lang] || !LANGS.includes(lang)) return;
  if (lang === 'ru') T.ru = (await import('./locales/ru.js')).default;
  else if (lang === 'en') T.en = (await import('./locales/en.js')).default;
  else if (lang === 'es') T.es = (await import('./locales/es.js')).default;
}

// Инициализация до первого рендера: ru (фолбэк для t()) + активная локаль.
export async function initI18n() {
  await loadLocale('ru');
  if (currentLang !== 'ru') await loadLocale(currentLang);
}

// Сменить активный язык БЕЗ записи в localStorage — для гео-guess на первом заходе,
// пока пользователь/гео не зафиксировали выбор явно через setLang.
// Уведомление о смене языка — для компонентов вне дерева App (напр. баннер в Root),
// которые не перерисовываются от смены state приложения.
function emitLangChange() {
  try { window.dispatchEvent(new CustomEvent('pp-langchange', { detail: currentLang })); } catch (e) { /* SSR/старый браузер */ }
}

export async function applyLang(lang) {
  if (!LANGS.includes(lang)) return;
  await loadLocale(lang);
  currentLang = lang;
  emitLangChange();
}

export async function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  await loadLocale(lang);
  currentLang = lang;
  localStorage.setItem('plLang', lang);
  emitLangChange();
}

export function t(key) {
  return T[currentLang]?.[key] ?? T.ru?.[key] ?? key;
}

// Локаль для дат: следует ЯЗЫКУ ПРИЛОЖЕНИЯ, а не локали устройства — иначе
// на русском телефоне с приложением на EN даты оставались бы «3 июля».
export function dateLocale() {
  return currentLang === 'en' ? 'en-US' : currentLang === 'es' ? 'es-ES' : 'ru-RU';
}

// «N игр» с правильным склонением (RU); EN/ES — простое множественное число.
export function nGames(n) {
  if (currentLang === 'en') return `${n} games`;
  if (currentLang === 'es') return `${n} partidas`;
  const a = n % 100, b = n % 10;
  let w = 'игр';
  if (!(a > 10 && a < 20)) { if (b === 1) w = 'игра'; else if (b >= 2 && b <= 4) w = 'игры'; }
  return `${n} ${w}`;
}
