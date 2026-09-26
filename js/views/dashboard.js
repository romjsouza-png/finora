/**
 * View: Visão geral.
 * Cards de resumo (saldo, receitas, despesas, resultado), evolução do saldo,
 * receita x despesa por mês e donut de categorias.
 */

function renderDashboard() {
  const currency = state.user?.currency ?? "BRL";
  const month = currentMonthKey();
  const previousMonth = toMonthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const current = monthTotals(month);
  const previous = monthTotals(previousMonth);

  // Saldo consolidado
  $("#stat-balance").textContent = formatCurrency(totalBalance(), currency);

  // Saldo do mês com variação vs. mês anterior
  const previousBalance = previous.income - previous.expense;
  setTrendBadge($("#stat-result-trend"), current.result - previousBalance, current.result, "o saldo do mês");

  $("#stat-income").textContent = formatCurrency(current.income, currency);
  $("#stat-income-note").textContent = trendNote(current.income, previous.income, currency);
  $("#stat-expense").textContent = formatCurrency(current.expense, currency);
  setTrendBadge($("#stat-expense-trend"), current.expense - previous.expense, current.expense, "o gasto do mês", { invert: true });

  $("#stat-result").textContent = formatCurrency(current.result, currency);
  $("#stat-result").classList.toggle("is-negative", current.result < 0);

  // Categorias: maior gasto do mês
  const top = expensesByCategory(month)[0];
  $("#stat-top-category").textContent = top ? top.category.name : "—";
  $("#stat-top-category-total").textContent = top
    ? `${formatCurrency(top.total, currency)} no mês`
    : "Nenhum registro no mês";

  // Total de lançamentos
  $("#stat-count").textContent = `${state.transactions.length} ${
    state.transactions.length === 1 ? "lançamento" : "lançamentos"
  }`;

  // Top 5 lançamentos do mês
  const recent = transactionsInMonth(month)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  $("#dashboard-recent-body").innerHTML = recent.length
    ? recent.map(transactionRow).join("")
    : `<tr><td colspan="4" class="table-empty-cell">Nenhum lançamento em ${escapeHtml(
        new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date())
      )}.</td></tr>`;

  renderCategoryChart(currency);
  renderIncomeExpenseChart(currency);
  renderBalanceChart(currency, 30);
}

/** Badge de variação. `invert` trata "subir" como ruim (usado em despesas). */
function setTrendBadge(element, delta, current, noun, { invert = false } = {}) {
  if (current === 0 || delta === 0) {
    element.className = "stat-trend neutral";
    element.innerHTML = `<i class="fa-solid fa-minus"></i> sem variação`;
    return;
  }
  const up = delta > 0;
  const good = invert ? !up : up;
  element.className = `stat-trend ${good ? "positive" : "negative"}`;
  const percent = Math.abs(Math.round((delta / Math.abs(current || 1)) * 100));
  element.innerHTML = `<i class="fa-solid ${up ? "fa-arrow-trend-up" : "fa-arrow-trend-down"}"></i> ${percent}% em ${escapeHtml(noun)}`;
}

function trendNote(current, previous, currency) {
  if (previous === 0) return "sem base de comparação";
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return "estável vs. mês anterior";
  return `${percent > 0 ? "+" : ""}${percent}% vs. mês anterior`;
}
