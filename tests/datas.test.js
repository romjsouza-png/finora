/**
 * Regressão: datas locais, não UTC.
 *
 * O bug original usava toISOString(), que converte para UTC. Em UTC-3 (Brasil),
 * um lançamento registrado às 22h de 25/01 voltava como 26/01 — sumia do dia
 * errado em todo cálculo mensal e em todo gráfico.
 *
 * Estes testes existem para travar esse comportamento. Se alguém "simplificar"
 * de volta para toISOString(), eles falham.
 */

const test = require("node:test");
const assert = require("node:assert");
const { loadApp } = require("./helper");

const { api } = loadApp();
const { toDateKey, toMonthKey, parseDateKey, todayKey, balanceSeries, monthTotals } = api;

test("toDateKey usa a data local, não a UTC", () => {
  // 25/01 às 22:30 no horário de Brasília. Em UTC isso seria 26/01 01:30,
  // então toISOString() devolveria o dia errado.
  const noite = new Date(2026, 0, 25, 22, 30, 0);
  assert.strictEqual(toDateKey(noite), "2026-01-25");

  // E o caso simétrico: madrugada local também não deve pular para trás.
  const madrugada = new Date(2026, 0, 25, 0, 30, 0);
  assert.strictEqual(toDateKey(madrugada), "2026-01-25");
});

test("toDateKey não desloca o dia em nenhum horário do dia", () => {
  for (let hora = 0; hora < 24; hora += 1) {
    const data = new Date(2026, 5, 15, hora, 0, 0);
    assert.strictEqual(toDateKey(data), "2026-06-15", `falhou às ${hora}h`);
  }
});

test("toDateKey preenche mês e dia com dois dígitos", () => {
  assert.strictEqual(toDateKey(new Date(2026, 0, 5)), "2026-01-05");
  assert.strictEqual(toDateKey(new Date(2026, 8, 9)), "2026-09-09");
});

test("toMonthKey agrupa pelo mês local", () => {
  assert.strictEqual(toMonthKey(new Date(2026, 0, 1, 0, 0, 0)), "2026-01");
  assert.strictEqual(toMonthKey(new Date(2026, 11, 31, 23, 59, 0)), "2026-12");
});

test("parseDateKey abre ao meio-dia, imune a salto de fuso", () => {
  const data = parseDateKey("2026-01-15");
  assert.strictEqual(data.getFullYear(), 2026);
  assert.strictEqual(data.getMonth(), 0);
  assert.strictEqual(data.getDate(), 15);
  assert.strictEqual(data.getHours(), 12);
});

test("parseDateKey + toDateKey fazem ida e volta", () => {
  for (const key of ["2026-01-01", "2026-02-28", "2026-12-31", "2024-02-29"]) {
    assert.strictEqual(toDateKey(parseDateKey(key)), key);
  }
});

test("todayKey segue o mesmo formato de toDateKey", () => {
  assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/);
  assert.strictEqual(todayKey(), toDateKey(new Date()));
});

test("lançamento às 22h conta no mês correto", () => {
  // 31/01 23:00 local. Em UTC seria 01/02, jogando a despesa para o mês errado.
  const key = toDateKey(new Date(2026, 0, 31, 23, 0, 0));
  assert.strictEqual(key, "2026-01-31");
  assert.strictEqual(toMonthKey(new Date(2026, 0, 31, 23, 0, 0)), "2026-01");
});

test("balanceSeries inclui o lançamento do dia no ponto de hoje", () => {
  const api2 = api;
  api2.state.user = { id: "u1", currency: "BRL" };
  api2.state.accounts = [{ id: "a1", name: "C", type: "checking", initialBalance: 0, color: "#000", archived: false }];
  api2.state.transactions = [
    {
      id: "t1", type: "expense", amount: 50, categoryId: "food",
      date: "2026-03-20", accountId: "a1", description: "x", recurring: false, createdAt: "",
    },
  ];
  // Meia-noite local: o pior caso para bug de fuso, porque o dia está na borda.
  const referencia = new Date(2026, 2, 20, 0, 15, 0);
  const serie = balanceSeries(5, referencia);
  assert.strictEqual(serie.length, 5);
  assert.strictEqual(serie.at(-1).date, "2026-03-20");
  assert.strictEqual(serie.at(-1).value, -50, "o gasto do dia precisa aparecer no último ponto");
});

test("balanceSeries acumula ao longo dos dias", () => {
  api.state.accounts = [{ id: "a1", name: "C", type: "checking", initialBalance: 100, color: "#000", archived: false }];
  api.state.transactions = [
    { id: "t1", type: "income", amount: 50, categoryId: "salary", date: "2026-03-18", accountId: "a1", description: "", recurring: false, createdAt: "" },
    { id: "t2", type: "expense", amount: 30, categoryId: "food", date: "2026-03-19", accountId: "a1", description: "", recurring: false, createdAt: "" },
  ];
  const serie = balanceSeries(4, new Date(2026, 2, 20, 12, 0, 0));
  // 17/03 = 100 (inicial), 18/03 = 150, 19/03 = 120, 20/03 = 120
  assert.strictEqual(serie.map((p) => p.value).join(","), "100,150,120,120");
});
