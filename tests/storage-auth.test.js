/**
 * js/storage.js e js/auth.js — persistência tolerante a falha e login local.
 *
 * A motivação: localStorage lança exceção em modo privativo, quando a quota
 * estoura e quando cookies de terceiros estão bloqueados. Nenhuma dessas
 * exceções pode escapar para a UI derrubar a tela.
 */

const test = require("node:test");
const assert = require("node:assert");
const { loadApp, createLocalStorage, txn } = require("./helper");

test("writeJson devolve true no caminho feliz", () => {
  const { api, storage } = loadApp();
  assert.strictEqual(api.writeJson("k", { a: 1 }), true);
  assert.deepStrictEqual(JSON.parse(storage.getItem("k")), { a: 1 });
});

test("writeJson devolve false em vez de lançar quando a quota estoura", () => {
  const { api } = loadApp({ storage: createLocalStorage({ failOnWrite: true }) });
  assert.doesNotThrow(() => api.writeJson("k", { a: 1 }));
  assert.strictEqual(api.writeJson("k", { a: 1 }), false, "o caller precisa saber que falhou");
});

test("readJson devolve o fallback quando a leitura é bloqueada", () => {
  const { api } = loadApp({ storage: createLocalStorage({ failOnRead: true }) });
  assert.deepStrictEqual(api.readJson("k", { padrao: true }), { padrao: true });
});

test("readJson devolve o fallback para JSON corrompido", () => {
  const { api, storage } = loadApp();
  storage.setItem("quebrado", "{isto nao e json");
  assert.deepStrictEqual(api.readJson("quebrado", []), []);
});

test("readJson devolve o fallback para chave ausente", () => {
  const { api } = loadApp();
  assert.deepStrictEqual(api.readJson("inexistente", "fallback"), "fallback");
});

test("remove não lança quando o armazenamento está bloqueado", () => {
  const storage = createLocalStorage();
  const { api } = loadApp({ storage });
  assert.strictEqual(api.remove("k"), true);
});

test("isStorageAvailable detecta ambiente saudável", () => {
  const { api } = loadApp();
  assert.strictEqual(api.isStorageAvailable(), true);
  assert.strictEqual(api.isStorageHealthy(), true);
});

test("isStorageAvailable detecta modo privativo", () => {
  const { api } = loadApp({ storage: createLocalStorage({ failOnWrite: true }) });
  assert.strictEqual(api.isStorageAvailable(), false);
  assert.strictEqual(api.isStorageHealthy(), false);
});

test("hashPassword é determinístico com o mesmo salt", async () => {
  const { api } = loadApp();
  const a = await api.hashPassword("segredo123", "salt-fixo");
  const b = await api.hashPassword("segredo123", "salt-fixo");
  assert.strictEqual(a, b);
});

test("hashPassword muda com a senha ou com o salt", async () => {
  const { api } = loadApp();
  const base = await api.hashPassword("segredo123", "salt-a");
  assert.notStrictEqual(base, await api.hashPassword("segredo124", "salt-a"));
  assert.notStrictEqual(base, await api.hashPassword("segredo123", "salt-b"));
});

test("hashPassword nunca devolve a senha em texto puro", async () => {
  const { api } = loadApp();
  const hash = await api.hashPassword("minhasenha123", "salt");
  assert.ok(!hash.includes("minhasenha123"));
  assert.strictEqual(hash.length, 64, "SHA-256 em hex tem 64 caracteres");
});

test("register cria a conta e a senha não fica em texto puro", async () => {
  const { api, storage } = loadApp();
  const resultado = await api.register({ name: "Maria", email: "maria@t.com", password: "segredo123" });
  assert.strictEqual(resultado.ok, true);
  const bruto = JSON.stringify(storage);
  assert.ok(!bruto.includes("segredo123"), "a senha não pode aparecer em nenhum byte do storage");
});

test("register recusa e-mail duplicado, ignorando maiúsculas", async () => {
  const { api } = loadApp();
  await api.register({ name: "A", email: "maria@t.com", password: "segredo123" });
  const segundo = await api.register({ name: "B", email: "MARIA@T.COM", password: "outra123" });
  assert.strictEqual(segundo.ok, false);
  assert.match(segundo.error, /já existe/i);
});

test("register guarda nome e e-mail normalizados", async () => {
  const { api } = loadApp();
  const r = await api.register({ name: "  Maria Souza  ", email: "  maria@t.com ", password: "segredo123" });
  assert.strictEqual(r.user.name, "Maria Souza");
  assert.strictEqual(r.user.email, "maria@t.com");
});

test("register cria salt diferente por usuário", async () => {
  const { api } = loadApp();
  const a = await api.register({ name: "A", email: "a@t.com", password: "segredo123" });
  const b = await api.register({ name: "B", email: "b@t.com", password: "segredo123" });
  assert.notStrictEqual(a.user.salt, b.user.salt);
  assert.notStrictEqual(a.user.passwordHash, b.user.passwordHash, "mesma senha, hashes diferentes");
});

test("login aceita a senha correta", async () => {
  const { api } = loadApp();
  await api.register({ name: "A", email: "a@t.com", password: "segredo123" });
  const r = await api.login({ email: "a@t.com", password: "segredo123" });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.user.email, "a@t.com");
});

test("login dá a mesma mensagem para e-mail inexistente e senha errada", async () => {
  const { api } = loadApp();
  await api.register({ name: "A", email: "a@t.com", password: "segredo123" });
  const senhaErrada = await api.login({ email: "a@t.com", password: "errada999" });
  const emailInexistente = await api.login({ email: "ninguem@t.com", password: "segredo123" });
  assert.strictEqual(senhaErrada.ok, false);
  assert.strictEqual(emailInexistente.ok, false);
  // A mensagem não pode distinguir os dois casos: isso viraria oráculo de
  // enumeração de e-mails cadastrados.
  assert.strictEqual(senhaErrada.error, emailInexistente.error);
});

test("login recusa e-mail inexistente com a mesma mensagem genérica", async () => {
  const { api } = loadApp();
  const r = await api.login({ email: "ninguem@t.com", password: "segredo123" });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /incorretos/i);
});

test("login recusa e-mail de outro usuário com senha igual", async () => {
  const { api } = loadApp();
  await api.register({ name: "A", email: "a@t.com", password: "segredo123" });
  const r = await api.login({ email: "b@t.com", password: "segredo123" });
  assert.strictEqual(r.ok, false, "salts diferentes impedem que o hash sirva de oracle");
});

test("sessão expira e é descartada", async () => {
  const { api, storage } = loadApp();
  await api.register({ name: "A", email: "a@t.com", password: "segredo123" });
  assert.ok(api.restoreSession(), "sessão recém-criada é válida");
  // Empurra a expiração para o passado.
  const sessao = JSON.parse(storage.getItem(api.STORAGE.SESSION));
  sessao.expiresAt = Date.now() - 1000;
  storage.setItem(api.STORAGE.SESSION, JSON.stringify(sessao));
  assert.strictEqual(api.restoreSession(), null, "sessão expirada não pode ser restaurada");
  assert.strictEqual(storage.getItem(api.STORAGE.SESSION), null, "e deve ser removida");
});

test("sessão de usuário removido não é restaurada", async () => {
  const { api, storage } = loadApp();
  await api.register({ name: "A", email: "a@t.com", password: "segredo123" });
  const sessao = JSON.parse(storage.getItem(api.STORAGE.SESSION));
  sessao.userId = "usuario-fantasma";
  storage.setItem(api.STORAGE.SESSION, JSON.stringify(sessao));
  assert.strictEqual(api.restoreSession(), null);
});

test("endSession limpa a sessão", async () => {
  const { api, storage } = loadApp();
  await api.register({ name: "A", email: "a@t.com", password: "segredo123" });
  api.endSession();
  assert.strictEqual(storage.getItem(api.STORAGE.SESSION), null);
  assert.strictEqual(api.restoreSession(), null);
});

test("dados de um usuário não vazam para outro", async () => {
  const { api, storage } = loadApp();
  const a = await api.register({ name: "A", email: "a@t.com", password: "segredo123" });
  api.state.user = a.user;
  api.state.transactions = [txn()];
  api.persist("transactions");

  const b = await api.register({ name: "B", email: "b@t.com", password: "segredo123" });
  const doB = api.readJson(api.STORAGE.dataKey(b.user.id, "transactions"), []);
  assert.strictEqual(doB.length, 0);
});
