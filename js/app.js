/**
 * Bootstrap: autenticação, roteamento, seed de demonstração e wiring de eventos.
 */

const app = {
  isAuthenticated: false,
};

/**
 * Cria dois meses de lançamentos plausíveis — evita a tela morta do primeiro uso.
 *
 * Os valores vêm de um orçamento mensal explícito (e não de valores sorteados),
 * então a demo abre sempre consistente: ~R$ 5.200 de salário contra ~R$ 3.100 de
 * gastos, resultando num saldo positivo e numa variação mensal de +18% nas
 * despesas (badge vermelho, o cenário mais informativo para demonstrar).
 */
const DEMO_BUDGET = [
  { categoryId: "housing", label: "Aluguel", amount: 1450, day: 5 },
  { categoryId: "utilities", label: "Energia", amount: 214.7, day: 8 },
  { categoryId: "utilities", label: "Internet", amount: 119.9, day: 12 },
  { categoryId: "health", label: "Academia", amount: 119.9, day: 3 },
  { categoryId: "transport", label: "Combustível", amount: 260, day: 6 },
  { categoryId: "food", label: "Supermercado", amount: 412.35, day: 7 },
  { categoryId: "food", label: "Supermercado", amount: 356.8, day: 14 },
  { categoryId: "food", label: "Supermercado", amount: 289.9, day: 21 },
  { categoryId: "food", label: "Restaurante", amount: 78.5, day: 10 },
  { categoryId: "food", label: "Padaria", amount: 32.4, day: 17 },
  { categoryId: "transport", label: "Uber", amount: 47.9, day: 4 },
  { categoryId: "transport", label: "Uber", amount: 62.3, day: 18 },
  { categoryId: "entertainment", label: "Streaming", amount: 55.9, day: 2 },
  { categoryId: "entertainment", label: "Cinema", amount: 70, day: 16 },
  { categoryId: "shopping", label: "Roupas", amount: 189.9, day: 13 },
  { categoryId: "shopping", label: "Presente", amount: 94.5, day: 25 },
];

/** Gera os lançamentos de um mês. `dayOffset` = quantos dias atrás começa. */
function seedMonth(accountId, dayOffset, expenseScale, salary) {
  const today = new Date();
  const rows = [];

  DEMO_BUDGET.forEach((item, index) => {
    // Variação de ±18% por item, determinística pelo índice (sem Math.random,
    // para a demo ser reproduzível entre execuções).
    const jitter = 0.82 + ((index * 37) % 37) / 100;
    rows.push({
      id: createId(),
      type: "expense",
      amount: Math.round(item.amount * expenseScale * jitter * 100) / 100,
      categoryId: item.categoryId,
      date: toDateKey(addDays(today, -(dayOffset + item.day))),
      accountId,
      description: item.label,
      recurring: ["housing", "utilities", "entertainment"].includes(item.categoryId),
      createdAt: new Date().toISOString(),
    });
  });

  // Salário no dia 5 de cada mês.
  rows.push({
    id: createId(),
    type: "income",
    amount: salary,
    categoryId: "salary",
    date: toDateKey(addDays(today, -(dayOffset + 5))),
    accountId,
    description: "Salário",
    recurring: true,
    createdAt: new Date().toISOString(),
  });

  return rows;
}

function seedDemoData() {
  const accountId = state.accounts[0]?.id;
  if (!accountId) return;

  const transactions = [
    // Mês corrente: gastos ~18% acima do anterior.
    ...seedMonth(accountId, 0, 1.0, 5200),
    // Mês anterior, com gastos menores — é com ele que a variação do mês é calculada.
    ...seedMonth(accountId, 30, 0.85, 5200),
    // Um freelance avulso, para o card de receitas ter mais de uma categoria.
    {
      id: createId(),
      type: "income",
      amount: 1450,
      categoryId: "freelance",
      date: toDateKey(addDays(new Date(), -19)),
      accountId,
      description: "Projeto freelance",
      recurring: false,
      createdAt: new Date().toISOString(),
    },
  ];

  state.accounts = [{ ...state.accounts[0], initialBalance: 2500 }, ...state.accounts.slice(1)];
  state.transactions = transactions;
  state.budgets = [
    { id: createId(), categoryId: "food", limit: 800, month: currentMonthKey() },
    { id: createId(), categoryId: "transport", limit: 300, month: currentMonthKey() },
    { id: createId(), categoryId: "entertainment", limit: 200, month: currentMonthKey() },
  ];
  const today = new Date();
  state.goals = [
    { id: createId(), name: "Viagem em dezembro", target: 8000, saved: 3200, deadline: toDateKey(new Date(today.getFullYear(), 11, 20)), createdAt: new Date().toISOString() },
  ];
  ["accounts", "transactions", "budgets", "goals"].forEach((key) => persist(key));
}

// ------------------------------------------------------------------ autenticação

function showAuthView() {
  app.isAuthenticated = false;
  destroyAllCharts();
  clearUserData();
  $("#app-view").classList.add("is-hidden");
  $("#auth-view").classList.remove("is-hidden");
  switchAuthMode("login");
}

function showApp(user) {
  app.isAuthenticated = true;
  loadUserData(user);
  $("#auth-view").classList.add("is-hidden");
  $("#app-view").classList.remove("is-hidden");
  $("#avatar").textContent = initials(user.name);
  $("#topbar-name").textContent = user.name;
  $("#topbar-email").textContent = user.email;
  $("#current-date").textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());
  navigate(location.hash.replace("#", "") || "dashboard");
}

function switchAuthMode(mode) {
  $("#auth-login-form").classList.toggle("is-hidden", mode !== "login");
  $("#auth-register-form").classList.toggle("is-hidden", mode !== "register");
  $("#auth-title").textContent = mode === "login" ? "Acesse sua conta" : "Crie sua conta";
  $("#auth-subtitle").textContent =
    mode === "login" ? "Bem-vindo de volta ao seu controle financeiro." : "Leva menos de um minuto.";
  $$("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === mode);
    button.setAttribute("aria-pressed", String(button.dataset.authMode === mode));
  });
  $$(".auth-error").forEach((element) => (element.textContent = ""));
}

async function handleAuthSubmit(event, mode) {
  event.preventDefault();
  const form = event.currentTarget;
  const errorElement = $(".auth-error", form);
  const submit = $("button[type=submit]", form);
  errorElement.textContent = "";
  submit.disabled = true;

  try {
    const credentials =
      mode === "login"
        ? { email: $("#login-email").value.trim(), password: $("#login-password").value }
        : {
            name: $("#register-name").value.trim(),
            email: $("#register-email").value.trim(),
            password: $("#register-password").value,
            confirm: $("#register-confirm").value,
          };

    if (mode === "login") {
      if (!credentials.email || !credentials.password) throw new Error("Preencha e-mail e senha.");
    } else {
      if (!credentials.name) throw new Error("Informe seu nome completo.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email)) throw new Error("E-mail inválido.");
      if (credentials.password.length < 6) throw new Error("A senha precisa de ao menos 6 caracteres.");
      if (credentials.password !== credentials.confirm) throw new Error("As senhas não coincidem.");
    }

    const result = mode === "login" ? await login(credentials) : await register(credentials);
    if (!result.ok) throw new Error(result.error);

    form.reset();
    showApp(result.user);
    // O seed precisa rodar DEPOIS de showApp: é loadUserData() que cria a
    // conta corrente padrão, e seedDemoData() depende dela para existir.
    if (mode === "register") {
      seedDemoData();
      navigate("dashboard");
      toast("Conta criada! Carregamos um mês de dados de exemplo para você explorar.", "success");
    } else {
      toast(`Bem-vindo de volta, ${state.user?.name ?? ""}!`, "success");
    }
  } catch (error) {
    errorElement.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
}

function logout() {
  if (!confirm("Sair da sua conta?")) return;
  endSession();
  showAuthView();
  toast("Sessão encerrada.");
}

// ------------------------------------------------------------------------ init

function wireEvents() {
  // Navegação
  $$(".nav-item[data-route]").forEach((item) => item.addEventListener("click", () => navigate(item.dataset.route)));
  $$("[data-goto]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.goto)));
  $("#menu-toggle").addEventListener("click", () =>
    $(".sidebar").classList.contains("is-open") ? closeSidebar() : openSidebar()
  );
  $(".sidebar-scrim").addEventListener("click", closeSidebar);
  $("#logout-button").addEventListener("click", logout);
  $("#theme-toggle").addEventListener("click", toggleTheme);

  // Autenticação
  $$("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => switchAuthMode(button.dataset.authMode)));
  $("#auth-login-form").addEventListener("submit", (event) => handleAuthSubmit(event, "login"));
  $("#auth-register-form").addEventListener("submit", (event) => handleAuthSubmit(event, "register"));

  // Lançamentos
  $$("#header-new-transaction, #transactions-new").forEach((button) =>
    button.addEventListener("click", () => openTransactionModal())
  );
  // O seletor visual é um radio group; #transaction-type guarda o valor real
  // usado no submit, então os dois precisam ficar sincronizados nos dois sentidos.
  $$('input[name="txn-type-display"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      $("#transaction-type").value = radio.value;
      fillCategoryOptions();
    });
  });
  $("#transaction-type").addEventListener("change", () => {
    const radio = $(`input[name="txn-type-display"][value="${$("#transaction-type").value}"]`);
    if (radio) radio.checked = true;
    fillCategoryOptions();
  });
  $("#transaction-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveTransactionFromForm();
  });
  $("#transaction-search").addEventListener(
    "input",
    debounce((event) => {
      ui.transactionSearch = event.target.value;
      renderTransactions();
    })
  );
  $$(".txn-tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      ui.transactionType = tab.dataset.type;
      renderTransactions();
    })
  );

  // Ações de linha (delegação: as linhas são recriadas a cada render)
  ["#transactions-body", "#dashboard-recent-body", "#statement-body"].forEach((selector) => {
    $(selector).addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      if (button.dataset.action === "edit") openTransactionModal(button.dataset.id);
      if (button.dataset.action === "delete") deleteTransaction(button.dataset.id);
    });
  });

  // Extrato
  const statementFilters = [
    ["#statement-search", "statementSearch", "input"],
    ["#statement-from", "statementFrom", "change"],
    ["#statement-to", "statementTo", "change"],
    ["#statement-account", "statementAccount", "change"],
    ["#statement-type", "statementType", "change"],
  ];
  statementFilters.forEach(([selector, key, event]) => {
    $(selector).addEventListener(event, (e) => {
      ui[key] = e.target.value;
      renderStatement();
    });
  });
  $("#statement-clear").addEventListener("click", () => {
    ui.statementSearch = ui.statementFrom = ui.statementTo = ui.statementAccount = ui.statementType = "";
    ["#statement-search", "#statement-from", "#statement-to", "#statement-account", "#statement-type"].forEach((s) => ($(s).value = ""));
    renderStatement();
  });
  $("#statement-export").addEventListener("click", exportStatementCsv);

  // Orçamento
  $("#budget-month").addEventListener("change", (event) => {
    budgetUi.month = event.target.value || currentMonthKey();
    renderBudget();
  });
  $("#budget-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveBudgetFromForm();
  });
  $("#budget-list").addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="delete-budget"]');
    if (button) deleteBudget(button.dataset.id);
  });

  // Metas
  $("#goal-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveGoalFromForm();
  });
  $("#goals-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "delete-goal") deleteGoal(button.dataset.id);
    if (button.dataset.action === "add-goal-savings") addGoalSavings(button.dataset.id);
  });

  // Contas
  $("#accounts-new").addEventListener("click", () => openAccountModal());
  $("#account-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveAccountFromForm();
  });
  $("#accounts-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit-account") openAccountModal(button.dataset.id);
    if (button.dataset.action === "delete-account") deleteAccount(button.dataset.id);
  });

  // Perfil
  $("#profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveProfileFromForm();
  });
  $("#profile-export").addEventListener("click", exportBackup);
  $("#profile-import").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) importBackup(file);
    event.target.value = "";
  });
}

function init() {
  if (!isStorageAvailable()) {
    console.warn("[finora] localStorage indisponível — os dados não serão persistidos.");
  }

  applyTheme(readJson(STORAGE.THEME, "light"));
  wireEvents();
  subscribe(() => {
    // Re-renderiza a view ativa quando o estado muda.
    if (app.isAuthenticated) ROUTES[currentRoute]?.render();
  });

  const user = restoreSession();
  if (user) showApp(user);
  else showAuthView();
}

document.addEventListener("DOMContentLoaded", init);
