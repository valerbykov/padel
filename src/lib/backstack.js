// lib/backstack.js — стек «как закрыть текущий слой» для аппаратной кнопки «Назад»
// (Android) и жеста назад. Модалки/под-экраны регистрируют обработчик при
// открытии и снимают при закрытии; runBack() закрывает верхний слой.
// Не зависит от Capacitor — App.jsx навешивает это на событие backButton.
const stack = [];

// Зарегистрировать обработчик закрытия. Возвращает функцию снятия.
export function registerBack(handler) {
  const entry = { handler };
  stack.push(entry);
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
  };
}

// Закрыть верхний слой. true — что-то закрыли (значит выходить из приложения не надо).
export function runBack() {
  const top = stack[stack.length - 1];
  if (!top) return false;
  try { top.handler(); } catch (_) { /* обработчик сам себя снимет через unregister */ }
  return true;
}

export function hasBackLayers() { return stack.length > 0; }
