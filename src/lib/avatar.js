// lib/avatar.js — единый источник аватаров.
// Фолбэк — брендовая собака с ракеткой, детерминированно по id или имени игрока.
// В /avatars лежит 15 собак (dog-01..15) + sprite.png. Чтобы поднять до 16 —
// нужно добавить файл dog-16.png и тогда менять DOG_COUNT (это пересортирует
// уже назначенные аватары: hash%16 ≠ hash%15).
export const DOG_COUNT = 15;

export function dogAvatar(idOrName) {
  if (!idOrName) return "/avatars/dog-01.png";
  const hash = [...String(idOrName)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return `/avatars/dog-${String((hash % DOG_COUNT) + 1).padStart(2, "0")}.png`;
}

// Кастомное фото игрока, иначе — собака-фолбэк.
export const playerAvatar = (url, idOrName) => url || dogAvatar(idOrName);
