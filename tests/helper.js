/**
 * Harness de teste.
 *
 * Os módulos do app são scripts clássicos (sem import/export), cada um
 * declarando funções e constantes no escopo global. Para testá-los no Node sem
 * instalar nada, carregamos os arquivos num contexto `vm` compartilhado.
 *
 * Detalhe importante do V8: declarações `const`/`function` de topo de um script
 * vivem no escopo léxico do contexto, e não viram propriedades de globalThis.
 * Por isso, depois de carregar os arquivos, rodamos uma PONTE — uma expressão
 * que captura as declarações e as devolve como objeto comum.
 *
 * A ordem de carga é a mesma do index.html, porque os módulos se referenciam
 * entre si (state.js usa utils.js e storage.js).
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

/** localStorage em memória, com falha simulável. */
function createLocalStorage({ failOnWrite = false, failOnRead = false } = {}) {
  const map = new Map();
  return {
    getItem(key) {
      if (failOnRead) throw new Error("SecurityError: leitura bloqueada");
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      if (failOnWrite) throw new Error("QuotaExceededError: cota estourada");
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
    get size() {
      return map.size;
    },
  };
}

const APP_FILES = ["js/utils.js", "js/storage.js", "js/state.js", "js/auth.js", "js/charts.js"];

// Expressão avaliada dentro do contexto: captura as declarações léxicas.
const BRIDGE = `(() => ({
  // utils.js
  toDateKey, toMonthKey, todayKey, parseDateKey, startOfMonth, addDays,
  formatDate, formatCurrency, parseAmount, escapeHtml, createId, debounce,
  initials, $, $$,
  // storage.js
  readJson, writeJson, remove, isStorageAvailable, isStorageHealthy, STORAGE,
  // state.js — 'state' é o próprio objeto, então os testes mutam suas
  // propriedades para injetar fixtures.
  state, categoriesFor, categoryById, accountById, accountBalance, totalBalance,
  transactionsInMonth, monthTotals, expensesByCategory, balanceSeries,
  incomeExpenseByMonth, budgetUsage, currentMonthKey, persist,
  CATEGORIES, ACCOUNT_TYPES,
  // auth.js
  hashPassword, login, register, findUserByEmail, restoreSession, endSession,
}))()`;

function loadApp({ storage = createLocalStorage() } = {}) {
  const sandbox = {
    console,
    localStorage: storage,
    // O app acessa window.crypto; o contexto do vm não tem 'window' próprio.
    window: { crypto: globalThis.crypto },
    setTimeout,
    clearTimeout,
    TextEncoder,
  };
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  for (const file of APP_FILES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  }

  return { api: vm.runInContext(BRIDGE, context), context, storage };
}

/** Cria um usuário de fixture e carrega os dados nele. */
function withUser(api, { accounts = [], transactions = [], budgets = [], goals = [] } = {}) {
  api.state.user = { id: "u1", name: "Teste", email: "t@t.com", currency: "BRL" };
  api.state.accounts = accounts;
  api.state.transactions = transactions;
  api.state.budgets = budgets;
  api.state.goals = goals;
  api.state.followedAccounts = [];
  api.state.followedTransactions = [];
  return api;
}

/** Transação de fixture com campos sensatos. */
function txn(overrides = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    type: "expense",
    amount: 100,
    categoryId: "food",
    date: "2026-01-15",
    accountId: "a1",
    description: "Teste",
    recurring: false,
    createdAt: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}

/** Conta de fixture. */
function account(overrides = {}) {
  return { id: "a1", name: "Conta", type: "checking", initialBalance: 0, color: "#5b5ce2", archived: false, ...overrides };
}

module.exports = { loadApp, createLocalStorage, withUser, txn, account, ROOT };
