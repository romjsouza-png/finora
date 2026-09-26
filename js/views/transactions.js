/**
 * View: Lançamentos (CRUD) e View: Extrato (consulta).
 * Compartilham a mesma linha de tabela, então ficam no mesmo módulo.
 */

const ui = {
  transactionType: "all",
  transactionSearch: "",
  statementSearch: "",
  statementFrom: "",
  statementTo: "",
  statementAccount: "",
  statementType: "",
};

/** Linha de tabela compartilhada pelas duas views. */
function transactionRow(transaction) {
  const category = categoryById(transaction.categoryId);
  const account = accountById(transaction.accountId);
  const isIncome = transaction.type === "income";
  return `
    <tr data-id="${escapeHtml(transaction.id)}">
      <td>
        <div class="cell-main">
          <span class="cell-icon" style="--icon-color:${escapeHtml(category?.color ?? "#a7afbd")}">
            <i class="${escapeHtml(category?.icon ?? "fa-solid fa-box")}"></i>
          </span>
          <div>
            <strong>${escapeHtml(transaction.description || category?.name || "Sem descrição")}</strong>
            <small>${escapeHtml(category?.name ?? "—")}</small>
          </div>
        </div>
      </td>
      <td>${escapeHtml(account?.name ?? "Conta removida")}</td>
      <td>${formatDate(transaction.date, "long")}</td>
      <td class="amount-cell ${isIncome ? "is-income" : "is-expense"}">
        ${isIncome ? "+" : "−"} ${formatCurrency(transaction.amount, state.user?.currency ?? "BRL")}
      </td>
      <td>
        <div class="row-actions">
          <button class="row-action" data-action="edit" data-id="${escapeHtml(transaction.id)}" title="Editar" aria-label="Editar lançamento">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="row-action delete" data-action="delete" data-id="${escapeHtml(transaction.id)}" title="Excluir" aria-label="Excluir lançamento">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    </tr>`;
}

function sortByDateDesc(list) {
  return list.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

function fillTransactionForm(transaction) {
  const type = transaction?.type ?? "expense";
  $("#transaction-id").value = transaction?.id ?? "";
  $("#transaction-type").value = type;
  // Espelha o tipo no radio group, senão a edição reabre sempre como "Despesa".
  const radio = $(`input[name="txn-type-display"][value="${type}"]`);
  if (radio) radio.checked = true;
  fillCategoryOptions();
  $("#transaction-category").value = transaction?.categoryId ?? "";
  $("#transaction-amount").value = transaction?.amount ?? "";
  $("#transaction-date").value = transaction?.date ?? todayKey();
  $("#transaction-account").value = transaction?.accountId ?? state.accounts[0]?.id ?? "";
  $("#transaction-description").value = transaction?.description ?? "";
  $("#transaction-recurring").checked = Boolean(transaction?.recurring);
  $("#transaction-modal-title").textContent = transaction ? "Editar lançamento" : "Novo lançamento";
  $("#transaction-error").textContent = "";
}

function fillCategoryOptions() {
  const type = $("#transaction-type").value;
  const current = $("#transaction-category").value;
  $("#transaction-category").innerHTML = [
    '<option value="">Selecione…</option>',
    ...categoriesFor(type)
      .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`)
      .join(""),
  ].join("");
  if (categoriesFor(type).some((category) => category.id === current)) {
    $("#transaction-category").value = current;
  }
}

function fillAccountOptions() {
  const options = state.accounts
    .map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`)
    .join("");
  $("#transaction-account").innerHTML = options || '<option value="">Crie uma conta primeiro</option>';
  $("#statement-account").innerHTML = `<option value="">Todas as contas</option>${options}`;
}

function openTransactionModal(transactionId = null) {
  const transaction = transactionId ? state.transactions.find((item) => item.id === transactionId) : null;
  fillAccountOptions();
  fillTransactionForm(transaction);
  openModal("transaction-modal");
}

function saveTransactionFromForm() {
  const error = $("#transaction-error");
  const id = $("#transaction-id").value;
  const amount = parseAmount($("#transaction-amount").value);
  const categoryId = $("#transaction-category").value;
  const date = $("#transaction-date").value;
  const accountId = $("#transaction-account").value;
  const description = $("#transaction-description").value.trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    error.textContent = "Informe um valor maior que zero.";
    return;
  }
  if (!categoryId) {
    error.textContent = "Selecione uma categoria.";
    return;
  }
  if (!date) {
    error.textContent = "Informe a data.";
    return;
  }
  if (!accountId) {
    error.textContent = "Selecione uma conta.";
    return;
  }

  const record = {
    id: id || createId(),
    type: $("#transaction-type").value === "income" ? "income" : "expense",
    amount,
    categoryId,
    date,
    accountId,
    description,
    recurring: $("#transaction-recurring").checked,
    createdAt: id ? state.transactions.find((t) => t.id === id)?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
  };

  // Snapshot antes de mexer: se a gravação falhar, restauramos exatamente o
  // estado anterior em vez de tentar "desfazer" a operação no caminho inverso.
  const previous = state.transactions;
  state.transactions = id
    ? state.transactions.map((item) => (item.id === id ? record : item))
    : [record, ...state.transactions];

  if (!persist("transactions")) {
    state.transactions = previous;
    error.textContent = "Não foi possível salvar. Verifique o espaço disponível no navegador.";
    return;
  }

  closeModal();
  toast(id ? "Lançamento atualizado." : "Lançamento criado.", "success");
  navigate(currentRoute);
}

function deleteTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;
  const previous = state.transactions;
  state.transactions = state.transactions.filter((item) => item.id !== id);
  if (!persist("transactions")) {
    state.transactions = previous;
    toast("Não foi possível excluir.", "error");
    return;
  }
  toast("Lançamento excluído.");
  navigate(currentRoute);
}

// ----------------------------------------------------------------- lançamentos

function renderTransactions() {
  fillAccountOptions();
  const search = ui.transactionSearch.trim().toLowerCase();
  let list = state.transactions;

  if (ui.transactionType !== "all") list = list.filter((item) => item.type === ui.transactionType);
  if (search) {
    list = list.filter((item) => {
      const category = categoryById(item.categoryId);
      const account = accountById(item.accountId);
      return [item.description, category?.name, account?.name]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(search));
    });
  }

  list = sortByDateDesc(list);
  const currency = state.user?.currency ?? "BRL";
  const total = list.reduce((sum, item) => sum + (item.type === "income" ? item.amount : -item.amount), 0);

  $$(".txn-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.type === ui.transactionType));
  $("#transactions-count").textContent = `${list.length} ${list.length === 1 ? "lançamento" : "lançamentos"}`;
  $("#transactions-total").innerHTML = `Saldo da lista: <strong class="${total < 0 ? "is-expense" : "is-income"}">${formatCurrency(total, currency)}</strong>`;
  $("#transactions-body").innerHTML = list.length
    ? list.map(transactionRow).join("")
    : `<tr><td colspan="5" class="table-empty-cell">Nenhum lançamento encontrado.</td></tr>`;
}

// --------------------------------------------------------------------- extrato

function renderStatement() {
  fillAccountOptions();
  const search = ui.statementSearch.trim().toLowerCase();
  let list = state.transactions;

  if (search) {
    list = list.filter((item) => {
      const category = categoryById(item.categoryId);
      return [item.description, category?.name].filter(Boolean).some((field) => field.toLowerCase().includes(search));
    });
  }
  if (ui.statementFrom) list = list.filter((item) => item.date >= ui.statementFrom);
  if (ui.statementTo) list = list.filter((item) => item.date <= ui.statementTo);
  if (ui.statementAccount) list = list.filter((item) => item.accountId === ui.statementAccount);
  if (ui.statementType) list = list.filter((item) => item.type === ui.statementType);

  list = sortByDateDesc(list);

  const currency = state.user?.currency ?? "BRL";
  const income = list.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = list.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);

  $("#statement-count").textContent = `${list.length} ${list.length === 1 ? "registro" : "registros"}`;
  $("#statement-body").innerHTML = list.length
    ? list.map(transactionRow).join("")
    : `<tr><td colspan="5" class="table-empty-cell">Nenhum registro no período selecionado.</td></tr>`;

  renderStatementSummary("#statement-in", income, currency);
  renderStatementSummary("#statement-out", expense, currency);
  renderStatementSummary("#statement-net", income - expense, currency);
}

function renderStatementSummary(selector, value, currency) {
  const element = $(selector);
  element.textContent = formatCurrency(value, currency);
  element.classList.toggle("is-income", value > 0);
  element.classList.toggle("is-expense", value < 0);
}

/** Exporta a lista filtrada do extrato em CSV com separador ';' (padrão do Excel pt-BR). */
function exportStatementCsv() {
  const rows = sortByDateDesc(applyStatementFilters(state.transactions));
  if (!rows.length) {
    toast("Nada para exportar com os filtros atuais.", "error");
    return;
  }
  const header = ["Data", "Descrição", "Categoria", "Conta", "Tipo", "Valor"];
  const body = rows.map((item) => {
    const category = categoryById(item.categoryId);
    const account = accountById(item.accountId);
    return [
      item.date,
      item.description || "",
      category?.name ?? "",
      account?.name ?? "",
      item.type === "income" ? "Receita" : "Despesa",
      item.amount.toFixed(2).replace(".", ","),
    ];
  });
  const csv = [header, ...body]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");

  // BOM para o Excel pt-BR reconhecer UTF-8.
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `finora-extrato-${todayKey()}.csv`;
  link.click();
  // Revogar imediatamente pode cancelar o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`${rows.length} linha(s) exportada(s).`, "success");
}

function applyStatementFilters(list) {
  let result = list;
  if (ui.statementFrom) result = result.filter((item) => item.date >= ui.statementFrom);
  if (ui.statementTo) result = result.filter((item) => item.date <= ui.statementTo);
  if (ui.statementAccount) result = result.filter((item) => item.accountId === ui.statementAccount);
  if (ui.statementType) result = result.filter((item) => item.type === ui.statementType);
  return result;
}
