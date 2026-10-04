/**
 * js/state.js — a matemática financeira.
 *
 * O foco é o saldo derivado: a garantia central do modelo é que o saldo de uma
 * conta é sempre a soma dos seus lançamentos, e que nenhum caminho de código
 * consiga deixá-lo dessincronizado.
 */

const test = require("node:test");
const assert = require("node:assert");
const { loadApp, withUser, txn, account } = require("./helper");

const { api } = loadApp();
const { accountBalance, totalBalance, monthTotals, expensesByCategory, balanceSeries, budgetUsage, incomeExpenseByMonth, persist, state } = api;

test("saldo da conta soma receitas e subtrai despesas", () => {
  withUser(api, {
    accounts: [account({ initialBalance: 100 })],
    transactions: [
      txn({ type: "income", amount: 500, date: "2026-03-10" }),
      txn({ type: "expense", amount: 200, date: "2026-03-11" }),
    ],
  });
  assert.strictEqual(accountBalance(state.accounts[0]), 400);
});

test("saldo de conta sem nenhum lançamento é o saldo inicial", () => {
  withUser(api, { accounts: [account({ initialBalance: 250 })], transactions: [] });
  assert.strictEqual(accountBalance(state.accounts[0]), 250);
});

test("saldo de conta sem saldo inicial é zero, não NaN", () => {
  withUser(api, { accounts: [account({ initialBalance: null })], transactions: [txn({ amount: 30 })] });
  assert.strictEqual(accountBalance(state.accounts[0]), -30);
});

test("lançamentos de outra conta não afetam o saldo", () => {
  withUser(api, {
    accounts: [account({ id: "a1", initialBalance: 0 }), account({ id: "a2", initialBalance: 0 })],
    transactions: [txn({ accountId: "a1", amount: 999, type: "expense" })],
  });
  assert.strictEqual(accountBalance(state.accounts[1]), 0);
  assert.strictEqual(accountBalance(state.accounts[0]), -999);
});

test("saldo nunca dessincroniza ao editar um lançamento", () => {
  withUser(api, {
    accounts: [account({ initialBalance: 0 })],
    transactions: [txn({ id: "t1", type: "expense", amount: 100, date: "2026-03-10" })],
  });
  assert.strictEqual(accountBalance(state.accounts[0]), -100);
  // Simula a edição mudando o valor e o tipo no próprio array.
  state.transactions[0].amount = 250;
  state.transactions[0].type = "income";
  assert.strictEqual(accountBalance(state.accounts[0]), 250, "o saldo recalcula, não é stored");
});

test("saldo nunca dessincroniza ao excluir um lançamento", () => {
  withUser(api, {
    accounts: [account({ initialBalance: 0 })],
    transactions: [
      txn({ id: "t1", amount: 100, date: "2026-03-10" }),
      txn({ id: "t2", amount: 40, date: "2026-03-11" }),
    ],
  });
  assert.strictEqual(accountBalance(state.accounts[0]), -140);
  state.transactions = state.transactions.filter((t) => t.id !== "t1");
  assert.strictEqual(accountBalance(state.accounts[0]), -40);
});

test("totalBalance consolida todas as contas ativas", () => {
  withUser(api, {
    accounts: [
      account({ id: "a1", initialBalance: 100 }),
      account({ id: "a2", initialBalance: 250 }),
    ],
    transactions: [txn({ accountId: "a2", amount: 50, type: "expense" })],
  });
  assert.strictEqual(totalBalance(), 300);
});

test("totalBalance ignora contas arquivadas", () => {
  withUser(api, {
    accounts: [account({ id: "a1", initialBalance: 100 }), account({ id: "a2", initialBalance: 900, archived: true })],
    transactions: [],
  });
  assert.strictEqual(totalBalance(), 100, "conta arquivada não entra no consolidado");
});

test("acompanhamentos individuais não entram nos totais financeiros pessoais", () => {
  withUser(api, {
    accounts: [account({ id: "pessoal", initialBalance: 100 })],
    transactions: [txn({ accountId: "pessoal", amount: 10, date: "2026-03-12" })],
  });
  state.followedAccounts = [account({ id: "acompanhada", initialBalance: 900 })];
  state.followedTransactions = [
    txn({ accountId: "acompanhada", type: "income", amount: 8000, date: "2026-03-15" }),
  ];

  assert.strictEqual(totalBalance(), 90);
  const totals = monthTotals("2026-03");
  assert.strictEqual(totals.income, 0);
  assert.strictEqual(totals.expense, 10);
  assert.strictEqual(totals.result, -10);
  assert.strictEqual(balanceSeries(1, new Date(2026, 2, 15, 12, 0, 0))[0].value, 90);
});

test("balanceSeries e monthTotals ignoram contas arquivadas no consolidado", () => {
  withUser(api, {
    accounts: [
      account({ id: "a1", initialBalance: 100 }),
      account({ id: "a2", initialBalance: 500, archived: true }),
    ],
    transactions: [
      txn({ accountId: "a1", type: "income", amount: 50, date: "2026-03-02" }),
      txn({ accountId: "a2", type: "income", amount: 1000, date: "2026-03-03" }),
    ],
  });

  assert.strictEqual(monthTotals("2026-03").income, 50, "somente contas ativas contam no total do mês");
  const points = balanceSeries(2, new Date(2026, 2, 3, 12, 0, 0));
  assert.strictEqual(points[0].value, 150, "o início do acumulado ignora a conta arquivada");
  assert.strictEqual(points[1].value, 150, "jamais a conta arquivada entra na linha principal do saldo");
});

test("monthTotals separa receita, despesa e resultado", () => {
  withUser(api, {
    transactions: [
      txn({ type: "income", amount: 1000, date: "2026-03-05" }),
      txn({ type: "income", amount: 500, date: "2026-03-20" }),
      txn({ type: "expense", amount: 300, date: "2026-03-10" }),
      txn({ type: "expense", amount: 200, date: "2026-04-01" }),
    ],
  });
  const marco = monthTotals("2026-03");
  assert.strictEqual(marco.income, 1500);
  assert.strictEqual(marco.expense, 300);
  assert.strictEqual(marco.result, 1200);
});

test("monthTotals não vaza lançamento para o mês vizinho", () => {
  withUser(api, {
    transactions: [
      txn({ amount: 100, date: "2026-03-31" }),
      txn({ amount: 999, date: "2026-04-01" }),
    ],
  });
  assert.strictEqual(monthTotals("2026-03").expense, 100);
  assert.strictEqual(monthTotals("2026-04").expense, 999);
});

test("monthTotals de mês sem movimento é zero", () => {
  withUser(api, { transactions: [] });
  const vazio = monthTotals("2026-07");
  assert.strictEqual(vazio.income, 0);
  assert.strictEqual(vazio.expense, 0);
  assert.strictEqual(vazio.result, 0);
});

test("expensesByCategory agrupa e ordena do maior para o menor", () => {
  withUser(api, {
    transactions: [
      txn({ categoryId: "food", amount: 100, date: "2026-03-05" }),
      txn({ categoryId: "food", amount: 50, date: "2026-03-06" }),
      txn({ categoryId: "transport", amount: 300, date: "2026-03-07" }),
    ],
  });
  const lista = expensesByCategory("2026-03");
  assert.strictEqual(lista.length, 2);
  assert.strictEqual(lista[0].category.id, "transport");
  assert.strictEqual(lista[0].total, 300);
  assert.strictEqual(lista[1].category.id, "food");
  assert.strictEqual(lista[1].total, 150, "mesma categoria soma");
});

test("expensesByCategory só considera despesas do mês", () => {
  withUser(api, {
    transactions: [
      txn({ categoryId: "salary", type: "income", amount: 5000, date: "2026-03-05" }),
      txn({ categoryId: "food", amount: 100, date: "2026-02-05" }),
    ],
  });
  assert.strictEqual(expensesByCategory("2026-03").length, 0, "receita e mês anterior ficam de fora");
});

test("expensesByCategory descarta categoria desconhecida", () => {
  withUser(api, { transactions: [txn({ categoryId: "inexistente", amount: 10, date: "2026-03-05" })] });
  assert.strictEqual(expensesByCategory("2026-03").length, 0, "categoria órfã não deve quebrar o donut");
});

test("budgetUsage calcula gasto, restante e percentual", () => {
  withUser(api, { transactions: [txn({ categoryId: "food", amount: 250, date: "2026-03-10" })] });
  const uso = budgetUsage({ categoryId: "food", limit: 500, month: "2026-03" });
  assert.strictEqual(uso.spent, 250);
  assert.strictEqual(uso.remaining, 250);
  assert.strictEqual(uso.percent, 50);
});

test("budgetUsage com limite estourado gera restante negativo", () => {
  withUser(api, { transactions: [txn({ categoryId: "food", amount: 800, date: "2026-03-10" })] });
  const uso = budgetUsage({ categoryId: "food", limit: 500, month: "2026-03" });
  assert.strictEqual(uso.remaining, -300);
  assert.strictEqual(uso.percent, 160, "o percentual pode passar de 100; a UI é que limita a barra");
});

test("budgetUsage com limite zero não divide por zero", () => {
  withUser(api, { transactions: [] });
  const uso = budgetUsage({ categoryId: "food", limit: 0, month: "2026-03" });
  assert.strictEqual(uso.percent, 0, "evita Infinity/NaN");
});

test("incomeExpenseByMonth devolve os meses em ordem cronológica", () => {
  withUser(api, { transactions: [] });
  const meses = incomeExpenseByMonth(6, new Date(2026, 2, 15, 12, 0, 0));
  assert.strictEqual(meses.length, 6);
  assert.strictEqual(meses[5].key, "2026-03", "o último mês é o corrente");
  assert.strictEqual(meses[0].key, "2025-10", "seis meses para trás");
});

test("incomeExpenseByMonth cruza a virada de ano", () => {
  withUser(api, { transactions: [] });
  const meses = incomeExpenseByMonth(3, new Date(2026, 0, 15, 12, 0, 0));
  assert.strictEqual(meses.map((m) => m.key).join(","), "2025-11,2025-12,2026-01");
});

test("incomeExpenseByMonth soma os lançamentos em cada mês", () => {
  withUser(api, {
    transactions: [
      txn({ type: "income", amount: 1000, date: "2026-02-10" }),
      txn({ type: "expense", amount: 400, date: "2026-02-11" }),
    ],
  });
  const meses = incomeExpenseByMonth(3, new Date(2026, 2, 15, 12, 0, 0));
  const fevereiro = meses.find((m) => m.key === "2026-02");
  assert.strictEqual(fevereiro.income, 1000);
  assert.strictEqual(fevereiro.expense, 400);
});

test("persist grava sob a chave do usuário, sem vazar entre contas", () => {
  const { api: a, storage } = loadApp();
  a.state.user = { id: "user-1" };
  a.state.transactions = [txn()];
  assert.strictEqual(a.persist("transactions"), true);
  a.state.user = { id: "user-2" };
  a.state.transactions = [];
  assert.strictEqual(a.persist("transactions"), true);

  const salvo1 = JSON.parse(storage.getItem("finora:user-1:transactions"));
  const salvo2 = JSON.parse(storage.getItem("finora:user-2:transactions"));
  assert.strictEqual(salvo1.length, 1);
  assert.strictEqual(salvo2.length, 0, "usuários diferentes não podem enxergar os dados um do outro");
});
