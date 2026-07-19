// lib/money.js
// Валюта взноса — display-only (без реальных платежей/конвертации). Форматируем
// через Intl; символ берём из Intl «currency»-части.

export const CURRENCIES = ["RUB", "EUR", "USD", "GBP", "ARS", "MXN", "BRL", "AED"];

const SYMBOLS = { RUB: "₽", EUR: "€", USD: "$", GBP: "£", ARS: "AR$", MXN: "MX$", BRL: "R$", AED: "AED" };

export function currencySymbol(cur) {
  return SYMBOLS[cur] || cur || "";
}

// «1 500 ₽» / «20 €» / «20 $». Символ — из нашей карты (НЕ зависит от локали
// зрителя; Intl style:"currency" рендерит RUB как «RUB» вне ru-локали). Число —
// с группировкой по локали зрителя. Символ суффиксом — единообразно и однозначно.
export function formatMoney(n, cur) {
  const amount = Number(n) || 0;
  const code = cur || "RUB";
  let num;
  try { num = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amount); }
  catch (e) { num = String(amount); }
  return `${num} ${currencySymbol(code)}`.trim();
}
