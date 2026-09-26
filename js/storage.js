/**
 * Camada de persistência sobre localStorage.
 *
 * Tudo aqui é tolerante a falha de propósito: localStorage lança exceção em
 * modo privativo, quando o quota é estourado e quando cookies de terceiros
 * estão bloqueados. Um throw silencioso no meio de um `render()` derrubaria a
 * tela inteira, então cada operação devolve um valor seguro e registra o erro.
 */

const STORAGE = {
  USERS: "finora:users",
  SESSION: "finora:session",
  THEME: "finora:theme",
  CURRENCY: "finora:currency",
  dataKey: (userId, collection) => `finora:${userId}:${collection}`,
};

let storageHealthy = true;

function isStorageAvailable() {
  try {
    const probe = "__finora_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    storageHealthy = true;
    return true;
  } catch (error) {
    storageHealthy = false;
    return false;
  }
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (error) {
    console.warn(`[finora] não foi possível ler "${key}"`, error);
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[finora] não foi possível gravar "${key}"`, error);
    return false;
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[finora] não foi possível remover "${key}"`, error);
    return false;
  }
}

function isStorageHealthy() {
  return storageHealthy;
}
