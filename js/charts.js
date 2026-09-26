/**
 * Camada de gráficos.
 *
 * Duas decisões que evitam problemas reais:
 *  1. `Chart.getChart(canvas)` em vez de `Chart.instances.find(...)`. A
 *     propriedade `Chart.instances` foi removida no Chart.js v3 — o app antigo
 *     (que carrega v4) chamava isso e recebia `undefined`, recriando o gráfico
 *     a cada render e vazando canvas.
 *  2. Se o canvas já tem um gráfico, atualizamos os dados em vez de destruir e
 *     recriar. `destroy()` + `new Chart()` a cada tecla digitada era o
 *     gargalo de performance do Finora.
 */

const charts = new Map();

/** Verdadeiro se o Chart.js carregou. Sem isso a app precisa degradar sem quebrar. */
function chartsAvailable() {
  return typeof window.Chart !== "undefined";
}

function upsert(key, canvasSelector, config) {
  if (!chartsAvailable()) {
    console.warn("[finora] Chart.js indisponível — gráficos desativados.");
    return null;
  }
  const canvas = $(canvasSelector);
  if (!canvas) return null;

  const existing = charts.get(key) ?? Chart.getChart(canvas);
  if (existing) {
    existing.data = config.data;
    if (config.options) existing.options = { ...existing.options, ...config.options };
    existing.update();
    charts.set(key, existing);
    return existing;
  }

  const created = new Chart(canvas, config);
  charts.set(key, created);
  return created;
}

function destroyChart(key) {
  const chart = charts.get(key);
  if (chart) chart.destroy();
  charts.delete(key);
}

function currencyTooltip(currency) {
  return {
    callbacks: {
      label: (context) => ` ${formatCurrency(context.parsed.y ?? context.parsed, currency)}`,
    },
  };
}

// ------------------------------------------------------------------ dashboards

/** Donut de despesas por categoria no mês corrente. */
function renderCategoryChart(currency) {
  const month = currentMonthKey();
  const entries = expensesByCategory(month);
  return upsert("category", "#category-chart", {
    type: "doughnut",
    data: {
      labels: entries.map((entry) => entry.category.name),
      datasets: [
        {
          data: entries.map((entry) => entry.total),
          backgroundColor: entries.map((entry) => entry.category.color),
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      cutout: "70%",
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => ` ${formatCurrency(context.parsed, currency)}` } },
      },
    },
  });
}

/** Barras de receita x despesa dos últimos 6 meses. */
function renderIncomeExpenseChart(currency) {
  const months = incomeExpenseByMonth(6);
  return upsert("income-expense", "#income-expense-chart", {
    type: "bar",
    data: {
      labels: months.map((month) => month.label),
      datasets: [
        { label: "Receitas", data: months.map((m) => m.income), backgroundColor: "#25b890", borderRadius: 6, maxBarThickness: 28 },
        { label: "Despesas", data: months.map((m) => m.expense), backgroundColor: "#e75a72", borderRadius: 6, maxBarThickness: 28 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { boxWidth: 10, usePointStyle: true, font: { size: 11 } } }, tooltip: currencyTooltip(currency) },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, ticks: { callback: (value) => formatCurrency(value, currency, { compact: true }) } },
      },
    },
  });
}

/** Linha de evolução do saldo acumulado. */
function renderBalanceChart(currency, days = 30) {
  const points = balanceSeries(days);
  return upsert("balance", "#balance-chart", {
    type: "line",
    data: {
      labels: points.map((point) => formatDate(point.date)),
      datasets: [
        {
          label: "Saldo",
          data: points.map((point) => point.value),
          borderColor: "#5b5ce2",
          backgroundColor: "rgba(91,92,226,.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: currencyTooltip(currency) },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 11 } } },
        y: { ticks: { callback: (value) => formatCurrency(value, currency, { compact: true }) } },
      },
    },
  });
}

function destroyAllCharts() {
  charts.forEach((chart) => chart.destroy());
  charts.clear();
}
