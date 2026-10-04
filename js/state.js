/**
 * Estado da aplicação e selectors de cálculo financeiro.
 *
 * Modelo de dados (espelhando o prompt de especificação):
 *   Account      { id, name, type, initialBalance, color, archived }
 *   Category     { id, name, type: 'income'|'expense', icon, color }
 *   Transaction  { id, accountId, categoryId, type, amount, date, description, recurring }
 *   Budget       { id, categoryId, limit, month }   month = "AAAA-MM"
 *   Goal         { id, name, target, saved, deadline }
 *
 * O saldo de cada conta NÃO é armazenado: é sempre derivado dos lançamentos.
 * Isso elimina a classe de bugs em que um estorno de edição deixa o saldo
 * dessincronizado — o app antigo mantinha `account.balance` mutado à mão.
 */

const CATEGORIES = {
  income: [
    { id: "salary", name: "Salário", icon: "fa-solid fa-briefcase", color: "#25b890" },
    { id: "freelance", name: "Freelance", icon: "fa-solid fa-laptop-code", color: "#52a7d9" },
    { id: "investment", name: "Investimentos", icon: "fa-solid fa-arrow-trend-up", color: "#9374e8" },
    { id: "gift", name: "Presente", icon: "fa-solid fa-gift", color: "#e75a72" },
    { id: "other_income", name: "Outro", icon: "fa-solid fa-coins", color: "#a7afbd" },
  ],
  expense: [
    { id: "food", name: "Alimentação", icon: "fa-solid fa-utensils", color: "#f29b38" },
    { id: "transport", name: "Transporte", icon: "fa-solid fa-car", color: "#52a7d9" },
    { id: "housing", name: "Moradia", icon: "fa-solid fa-house", color: "#5b5ce2" },
    { id: "utilities", name: "Contas", icon: "fa-solid fa-lightbulb", color: "#f2c53d" },
    { id: "entertainment", name: "Lazer", icon: "fa-solid fa-film", color: "#e75a72" },
    { id: "health", name: "Saúde", icon: "fa-solid fa-heart-pulse", color: "#25b890" },
    { id: "shopping", name: "Compras", icon: "fa-solid fa-bag-shopping", color: "#9374e8" },
    { id: "education", name: "Educação", icon: "fa-solid fa-graduation-cap", color: "#4f8ff0" },
    { id: "personal", name: "Pessoal", icon: "fa-solid fa-scissors", color: "#c77dff" },
    { id: "other_expense", name: "Outro", icon: "fa-solid fa-box", color: "#a7afbd" },
  ],
};

const ACCOUNT_TYPES = [
  { id: "checking", name: "Conta corrente" },
  { id: "savings", name: "Poupança" },
  { id: "cash", name: "Carteira" },
  { id: "credit", name: "Cartão de crédito" },
];

const state = {
  user: null,
  workspaces: [],
  currentWorkspaceId: null,
  isPlatformAdmin: false,
  remoteSnapshots: {},
  accounts: [],
  transactions: [],
  budgets: [],
  goals: [],
};

const listeners = new Set();

/** Assina mudanças de estado. Usado pelo app para re-renderizar. */
function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emit() {
  listeners.forEach((callback) => callback());
}

function categoriesFor(type) {
  return CATEGORIES[type] ?? [];
}

function categoryById(id) {
  return [...CATEGORIES.income, ...CATEGORIES.expense].find((category) => category.id === id) ?? null;
}

function accountById(id) {
  return state.accounts.find((account) => account.id === id) ?? null;
}

// ---------------------------------------------------------------- persistência

async function loadUserData(user, workspaceId = null) {
  state.user = user;
  if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
    const access = await supabaseListWorkspaces(user.id);
    state.user = {
      ...user,
      name: access.profile?.display_name || user.name,
      currency: access.profile?.currency ?? "BRL",
    };
    state.workspaces = access.workspaces;
    state.isPlatformAdmin = access.isPlatformAdmin;
    const workspace = state.workspaces.find((item) => item.id === workspaceId) ?? state.workspaces[0];
    if (!workspace) throw new Error("Esta conta ainda não pertence a nenhum espaço.");
    state.currentWorkspaceId = workspace.id;
    const data = await supabaseLoadWorkspace(workspace.id);
    state.accounts = data.accounts;
    state.transactions = data.transactions;
    state.budgets = data.budgets;
    state.goals = data.goals;
    state.remoteSnapshots = Object.fromEntries(
      Object.entries(data).map(([key, records]) => [key, records.map((record) => ({ ...record }))])
    );
  } else {
    state.workspaces = [];
    state.currentWorkspaceId = null;
    state.isPlatformAdmin = false;
    state.remoteSnapshots = {};
    const prefix = (collection) => STORAGE.dataKey(user.id, collection);
    state.accounts = readJson(prefix("accounts"), []);
    state.transactions = readJson(prefix("transactions"), []);
    state.budgets = readJson(prefix("budgets"), []);
    state.goals = readJson(prefix("goals"), []);
  }

  if (!state.accounts.length) {
    state.accounts = [
      {
        id: createId(),
        name: "Conta corrente",
        type: "checking",
        initialBalance: 0,
        color: "#5b5ce2",
        archived: false,
      },
    ];
    await persist("accounts");
  }
  emit();
}

async function switchWorkspace(workspaceId) {
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace || workspaceId === state.currentWorkspaceId) return true;
  try {
    const data = await supabaseLoadWorkspace(workspaceId);
    state.currentWorkspaceId = workspaceId;
    state.accounts = data.accounts;
    state.transactions = data.transactions;
    state.budgets = data.budgets;
    state.goals = data.goals;
    state.remoteSnapshots = Object.fromEntries(
      Object.entries(data).map(([key, records]) => [key, records.map((record) => ({ ...record }))])
    );
    if (!state.accounts.length) {
      state.accounts = [{ id: createId(), name: "Conta corrente", type: "checking", initialBalance: 0, color: "#5b5ce2", archived: false }];
      await persist("accounts");
    }
    emit();
    return true;
  } catch (error) {
    console.error("[finora] não foi possível trocar de espaço", error);
    return false;
  }
}

function persist(collection) {
  if (!state.user) return false;
  if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
    if (!state.currentWorkspaceId) return false;
    return supabaseSaveCollection(
        collection,
        state.currentWorkspaceId,
        state[collection],
        state.remoteSnapshots[collection] ?? []
      )
      .then((snapshot) => {
        state.remoteSnapshots[collection] = snapshot;
        return true;
      })
      .catch((error) => {
        console.error(`[finora] não foi possível salvar ${collection} no Supabase`, error);
        return false;
      });
  }
  return writeJson(STORAGE.dataKey(state.user.id, collection), state[collection]);
}

function clearUserData() {
  state.user = null;
  state.workspaces = [];
  state.currentWorkspaceId = null;
  state.isPlatformAdmin = false;
  state.remoteSnapshots = {};
  state.accounts = [];
  state.transactions = [];
  state.budgets = [];
  state.goals = [];
  emit();
}

// ------------------------------------------------------------------ selectors

/** Saldo derivado: saldo inicial + receitas - despesas de cada conta. */
function accountBalance(account) {
  const movements = state.transactions.filter((transaction) => transaction.accountId === account.id);
  const delta = movements.reduce(
    (sum, transaction) => sum + (transaction.type === "income" ? transaction.amount : -transaction.amount),
    0
  );
  return (Number(account.initialBalance) || 0) + delta;
}

function activeAccounts() {
  return state.accounts.filter((account) => !account.archived);
}

function totalBalance() {
  return activeAccounts().reduce((sum, account) => sum + accountBalance(account), 0);
}

function transactionsInMonth(monthKey) {
  const activeIds = state.accounts.length ? new Set(activeAccounts().map((account) => account.id)) : null;
  return state.transactions.filter(
    (transaction) => (!activeIds || activeIds.has(transaction.accountId)) && transaction.date.startsWith(monthKey)
  );
}

function monthTotals(monthKey) {
  const income = transactionsInMonth(monthKey)
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expense = transactionsInMonth(monthKey)
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return { income, expense, result: income - expense };
}

/** Categorias mais gastas no mês, ordenadas por total decrescente. */
function expensesByCategory(monthKey) {
  const totals = new Map();
  transactionsInMonth(monthKey)
    .filter((transaction) => transaction.type === "expense")
    .forEach((transaction) => {
      totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amount);
    });
  return [...totals.entries()]
    .map(([id, total]) => ({ category: categoryById(id), total }))
    .filter((entry) => entry.category)
    .sort((a, b) => b.total - a.total);
}

/**
 * Saldo acumulado dia a dia, para o gráfico de evolução patrimonial.
 * `today` é injetável para permitir testes determinísticos.
 */
function balanceSeries(days, today = new Date()) {
  today = new Date(today);
  today.setHours(12, 0, 0, 0);
  const activeIds = state.accounts.length ? new Set(activeAccounts().map((account) => account.id)) : null;
  const points = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = addDays(today, -offset);
    const key = toDateKey(day);
    const upto = state.transactions.filter(
      (transaction) => (!activeIds || activeIds.has(transaction.accountId)) && transaction.date <= key
    );
    const flow = upto.reduce(
      (sum, transaction) => sum + (transaction.type === "income" ? transaction.amount : -transaction.amount),
      0
    );
    const opening = activeAccounts().reduce((sum, account) => sum + (Number(account.initialBalance) || 0), 0);
    points.push({ date: key, value: opening + flow });
  }
  return points;
}

/** Receita x despesa dos últimos N meses, para o gráfico de barras. */
function incomeExpenseByMonth(months, today = new Date()) {
  const buckets = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const key = toMonthKey(date);
    buckets.push({ key, label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date), ...monthTotals(key) });
  }
  return buckets;
}

function budgetUsage(budget) {
  const spent = transactionsInMonth(budget.month)
    .filter((transaction) => transaction.type === "expense" && transaction.categoryId === budget.categoryId)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return { spent, remaining: budget.limit - spent, percent: budget.limit > 0 ? (spent / budget.limit) * 100 : 0 };
}

function currentMonthKey(today = new Date()) {
  return toMonthKey(today);
}
