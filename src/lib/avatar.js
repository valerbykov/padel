// lib/avatar.js — единый источник аватаров.
// Фолбэк — брендовая собака с ракеткой, детерминированно по id или имени игрока.
// В /avatars лежит 15 собак (dog-01..15.webp, ~9 КБ каждая, 160px). Чтобы
// поднять до 16 — добавить dog-16.webp и менять DOG_COUNT (это пересортирует
// уже назначенные аватары: hash%16 ≠ hash%15).
export const DOG_COUNT = 15;

export function dogAvatar(idOrName) {
  if (!idOrName) return "/avatars/dog-01.webp";
  const hash = [...String(idOrName)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return `/avatars/dog-${String((hash % DOG_COUNT) + 1).padStart(2, "0")}.webp`;
}

// Кастомное фото игрока, иначе — собака-фолбэк.
export const playerAvatar = (url, idOrName) => url || dogAvatar(idOrName);

// onError-обработчик для <img> аватара. playerAvatar/Avatar дают собаку только
// когда url пустой; но если url НЕ пустой и не грузится (битая ссылка, удалённый
// объект в Storage, заблокированный внешний хост) — браузер показывает «битую
// картинку». Этот хендлер при провале загрузки один раз подменяет src на собаку.
// Флаг dataset защищает от петли, если вдруг и собака не загрузится.
export function avatarFallback(idOrName) {
  return (e) => {
    const img = e.currentTarget;
    if (img.dataset.dogFallback) return;
    img.dataset.dogFallback = "1";
    img.src = dogAvatar(idOrName);
  };
}
