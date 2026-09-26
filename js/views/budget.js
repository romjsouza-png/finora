/**
 * View: Orçamento — limites mensais por categoria de despesa.
 */

const budgetUi = { month: currentMonthKey() };

function renderBudget() {
  fillCategoryOptionsForBudget();
  $("#budget-month").value = budgetUi.month;

  const budgets = state.budgets
    .filter((budget) => budget.month === budgetUi.month)
    .sort((a, b) => budgetUsage(b).percent - budgetUsage(a).percent);

  const currency = state.user?.currency ?? "BRL";
  const totalLimit = budgets.reduce((sum, budget) => sum + budget.limit, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budgetUsage(budget).spent, 0);

  $("#budget-summary").innerHTML = budgets.length
    ? `<strong>${formatCurrency(totalSpent, currency)}</strong> de <strong>${formatCurrency(totalLimit, currency)}</strong>
       <span class="summary-separator">·</span> ${formatCurrency(Math.max(0, totalLimit - totalSpent), currency)} disponíveis`
    : `Nenhum orçamento definido para ${escapeHtml(monthLabel(budgetUi.month))}.`;

  $("#budget-list").innerHTML = budgets.length
    ? budgets.map((budget) => budgetCard(budget, currency)).join("")
    : `<div class="empty-state">
         <i class="fa-solid fa-bullseye"></i>
         <strong>Sem orçamentos em ${escapeHtml(monthLabel(budgetUi.month))}</strong>
         <span>Defina um limite por categoria para acompanhar seus gastos.</span>
       </div>`;
}

function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function fillCategoryOptionsForBudget() {
  const used = new Set(state.budgets.filter((budget) => budget.month === budgetUi.month).map((budget) => budget.categoryId));
  const available = categoriesFor("expense").filter((category) => !used.has(category.id));
  $("#budget-category").innerHTML = available.length
    ? available.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join("")
    : '<option value="">Todas as categorias já têm orçamento</option>';
  $("#budget-category").disabled = available.length === 0;
  $("#budget-submit").disabled = available.length === 0;
}

function budgetCard(budget, currency) {
  const category = categoryById(budget.categoryId);
  const usage = budgetUsage(budget);
  const percent = Math.min(usage.percent, 100);
  const state_ = usage.percent >= 100 ? "danger" : usage.percent >= 80 ? "warning" : "ok";

  return `
    <article class="panel budget-card">
      <div class="budget-head">
        <div class="cell-main">
          <span class="cell-icon" style="--icon-color:${escapeHtml(category?.color ?? "#a7afbd")}">
            <i class="${escapeHtml(category?.icon ?? "fa-solid fa-tag")}"></i>
          </span>
          <div>
            <strong>${escapeHtml(category?.name ?? "Categoria")}</strong>
            <small>${usage.spent > budget.limit ? "estourou o limite" : "ainda dentro do limite"}</small>
          </div>
        </div>
        <button class="row-action delete" data-action="delete-budget" data-id="${escapeHtml(budget.id)}" title="Remover orçamento" aria-label="Remover orçamento de ${escapeHtml(category?.name ?? "")}">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="budget-values">
        <strong class="${usage.spent > budget.limit ? "is-expense" : ""}">${formatCurrency(usage.spent, currency)}</strong>
        <span>de ${formatCurrency(budget.limit, currency)}</span>
      </div>
      <div class="progress" role="progressbar" aria-valuenow="${Math.round(usage.percent)}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(category?.name ?? "Orçamento")}">
        <div class="progress-bar ${state_}" style="width:${percent}%"></div>
      </div>
      <div class="budget-foot">
        <span>${Math.round(usage.percent)}% usado</span>
        <span class="${usage.remaining < 0 ? "is-expense" : "is-income"}">
          ${usage.remaining < 0 ? `${formatCurrency(Math.abs(usage.remaining), currency)} excedidos` : `${formatCurrency(usage.remaining, currency)} restantes`}
        </span>
      </div>
    </article>`;
}

function saveBudgetFromForm() {
  const categoryId = $("#budget-category").value;
  const limit = parseAmount($("#budget-limit").value);
  if (!categoryId) return;
  if (!Number.isFinite(limit) || limit <= 0) {
    toast("Informe um limite maior que zero.", "error");
    return;
  }
  const record = { id: createId(), categoryId, limit, month: budgetUi.month };
  const previous = state.budgets;
  state.budgets = [...state.budgets.filter((budget) => !(budget.month === record.month && budget.categoryId === categoryId)), record];
  if (!persist("budgets")) {
    state.budgets = previous;
    toast("Não foi possível salvar o orçamento.", "error");
    return;
  }
  $("#budget-form").reset();
  toast("Orçamento definido.", "success");
  renderBudget();
}

function deleteBudget(id) {
  const budget = state.budgets.find((item) => item.id === id);
  if (!budget) return;
  const name = categoryById(budget.categoryId)?.name ?? "orçamento";
  if (!confirm(`Remover o orçamento de ${name}?`)) return;
  const previous = state.budgets;
  state.budgets = state.budgets.filter((item) => item.id !== id);
  if (!persist("budgets")) {
    state.budgets = previous;
    toast("Não foi possível remover.", "error");
    return;
  }
  toast("Orçamento removido.");
  renderBudget();
}
