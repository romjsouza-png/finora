/**
 * Utilitários de formatação, datas e DOM.
 *
 * REGRA CRÍTICA DE DATAS: neste app toda data trafega como string "AAAA-MM-DD"
 * gerada a partir da data LOCAL. Nunca use toISOString() para isso: ele converte
 * para UTC e, em fusos negativos como o do Brasil (UTC-3), empurra qualquer
 * registro feito após 21h para o dia seguinte.
 */

const CURRENCY_SYMBOLS = { BRL: "R$", USD: "US$", EUR: "€" };

/** Chave "AAAA-MM-DD" no fuso local. */
function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Chave "AAAA-MM" no fuso local. */
function toMonthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayKey() {
  return toDateKey(new Date());
}

/** "AAAA-MM-DD" -> Date ao meio-dia, imune a salto de fuso/DST. */
function parseDateKey(key) {
  return new Date(`${key}T12:00:00`);
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatDate(key, style = "short") {
  const date = parseDateKey(key);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", style === "long" ? { dateStyle: "long" } : { dateStyle: "short" }).format(date);
}

function formatCurrency(value, currency = "BRL", { compact = false } = {}) {
  const amount = Number(value) || 0;
  if (compact) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

/** Converte o texto digitado no campo de valor para number. Aceita "1.234,56" e "1234.56". */
function parseAmount(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  let text = String(raw ?? "").trim().replace(/[^\d,.-]/g, "");
  if (!text) return NaN;
  // Se tem ponto E vírgula, o ponto é separador de milhar.
  if (text.includes(",") && text.includes(".")) text = text.replace(/\./g, "").replace(",", ".");
  // Se só tem vírgula, ela é o separador decimal (padrão pt-BR).
  else if (text.includes(",")) text = text.replace(",", ".");
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? value : NaN;
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]
  );
}

function createId() {
  return window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function debounce(fn, wait = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function initials(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
