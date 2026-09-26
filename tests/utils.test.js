/**
 * js/utils.js — formatação de valores, datas e helpers de DOM.
 */

const test = require("node:test");
const assert = require("node:assert");
const { loadApp } = require("./helper");

const { api } = loadApp();
const { parseAmount, formatCurrency, escapeHtml, initials, addDays, startOfMonth } = api;

test("parseAmount entende o formato brasileiro", () => {
  assert.strictEqual(parseAmount("1.234,56"), 1234.56);
  assert.strictEqual(parseAmount("12,50"), 12.5);
  assert.strictEqual(parseAmount("0,01"), 0.01);
});

test("parseAmount entende o formato com ponto decimal", () => {
  assert.strictEqual(parseAmount("1234.56"), 1234.56);
  assert.strictEqual(parseAmount("42"), 42);
});

test("parseAmount trata separador de milhar com ponto", () => {
  assert.strictEqual(parseAmount("1.000"), 1000, "só ponto com 3 dígitos é milhar, não decimal");
  assert.strictEqual(parseAmount("1.5"), 1.5, "só ponto com 1 dígito é decimal");
});

test("parseAmount aceita ruído de digitação", () => {
  assert.strictEqual(parseAmount("R$ 1.234,56"), 1234.56);
  assert.strictEqual(parseAmount(" 89,90 "), 89.9);
});

test("parseAmount rejeita entrada inválida em vez de virar NaN silencioso", () => {
  assert.ok(Number.isNaN(parseAmount("")));
  assert.ok(Number.isNaN(parseAmount("abc")));
  assert.ok(Number.isNaN(parseAmount(null)));
  assert.ok(Number.isNaN(parseAmount(undefined)));
});

test("formatCurrency usa o padrão brasileiro", () => {
  assert.strictEqual(formatCurrency(1234.56, "BRL"), "R$ 1.234,56");
  assert.strictEqual(formatCurrency(0, "BRL"), "R$ 0,00");
});

test("formatCurrency trata valor ausente sem virar NaN", () => {
  assert.strictEqual(formatCurrency(null, "BRL"), "R$ 0,00");
  assert.strictEqual(formatCurrency(undefined, "BRL"), "R$ 0,00");
  assert.strictEqual(formatCurrency("abc", "BRL"), "R$ 0,00");
});

test("formatCurrency em modo compacto", () => {
  const compacto = formatCurrency(15000, "BRL", { compact: true });
  assert.match(compacto, /15/);
  assert.ok(compacto.length < formatCurrency(15000, "BRL").length, "compacto deve ser menor");
});

test("formatCurrency suporta outras moedas", () => {
  assert.match(formatCurrency(10, "USD"), /10/);
  assert.match(formatCurrency(10, "EUR"), /10/);
});

test("escapeHtml neutraliza as cinco entidades perigosas", () => {
  assert.strictEqual(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  assert.strictEqual(escapeHtml("a & b"), "a &amp; b");
  assert.strictEqual(escapeHtml("'aspas'"), "&#039;aspas&#039;");
});

test("escapeHtml não quebra texto normal", () => {
  assert.strictEqual(escapeHtml("Supermercado São Paulo"), "Supermercado São Paulo");
  assert.strictEqual(escapeHtml(""), "");
});

test("escapeHtml lida com null e undefined sem explodir", () => {
  assert.strictEqual(escapeHtml(null), "");
  assert.strictEqual(escapeHtml(undefined), "");
});

test("initials monta as iniciais do nome", () => {
  assert.strictEqual(initials("Maria Souza"), "MS");
  assert.strictEqual(initials("Ana"), "AN");
  assert.strictEqual(initials("Joao Pedro de Oliveira"), "JO");
  assert.strictEqual(initials(""), "?");
  assert.strictEqual(initials(null), "?");
});

test("addDays atravessa a virada de mês", () => {
  assert.strictEqual(addDays(new Date(2026, 0, 31), 1).getMonth(), 1);
  assert.strictEqual(addDays(new Date(2026, 2, 1), -1).getDate(), 28);
});

test("addDays não muta a data original", () => {
  const original = new Date(2026, 0, 10);
  addDays(original, 5);
  assert.strictEqual(original.getDate(), 10);
});

test("startOfMonth zera o dia", () => {
  const inicio = startOfMonth(new Date(2026, 6, 22, 15, 30, 0));
  assert.strictEqual(inicio.getDate(), 1);
  assert.strictEqual(inicio.getHours(), 0);
});

test("createId gera ids únicos", () => {
  const ids = new Set(Array.from({ length: 500 }, () => api.createId()));
  assert.strictEqual(ids.size, 500);
});

test("createId funciona sem crypto (contexto file://)", () => {
  // O sandbox deste teste tem window.crypto, mas o fallback precisa existir
  // para o caso de o app ser aberto por file://.
  const original = globalThis.crypto;
  try {
    const isolado = loadApp();
    assert.ok(isolado.api.createId().length > 0);
  } finally {
    globalThis.crypto = original;
  }
});
