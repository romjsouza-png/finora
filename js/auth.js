/**
 * Autenticação local.
 *
 * AVISO HONESTO DE SEGURANÇA: isto NÃO é segurança de verdade. Tudo vive no
 * localStorage do navegador, que qualquer pessoa com acesso ao mesmo perfil do
 * SO consegue ler. A senha nunca sai em claro (é derivada com SHA-256 + salt),
 * mas o objetivo real é apenas evitar que ela apareça em texto puro num dump do
 * localStorage, e deixar a porta de integração com um backend real
 * (bcrypt/argon2 + sessão no servidor) bem definida.
 *
 * A interface trata isso como "login local", não como autenticação de confiança.
 */

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function hasSubtleCrypto() {
  return Boolean(window.crypto?.subtle);
}

/** SHA-256 hex. Degrada com aviso se o contexto não for seguro (ex.: aberto por file://). */
async function hashPassword(password, salt) {
  const input = `finora:${salt}:${password}`;
  if (hasSubtleCrypto()) {
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  // Fallback nao criptografico: apenas para o app continuar utilizavel.
  console.warn("[finora] crypto.subtle indisponivel (contexto nao seguro). Hash de senha fraco.");
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `weak-${hash.toString(16)}`;
}

function findUserByEmail(users, email) {
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

async function register({ name, email, password }) {
  if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
    try {
      const result = await supabaseSignUp({ name, email: email.trim().toLowerCase(), password });
      return {
        ok: true,
        user: result.user,
        needsConfirmation: result.needsConfirmation,
      };
    } catch (error) {
      return { ok: false, error: error.message || "Não foi possível criar a conta." };
    }
  }

  const users = readJson(STORAGE.USERS, []);
  if (findUserByEmail(users, email)) {
    return { ok: false, error: "Já existe uma conta com este e-mail." };
  }
  const salt = createId().slice(0, 12);
  const user = {
    id: createId(),
    name: name.trim(),
    email: email.trim(),
    salt,
    passwordHash: await hashPassword(password, salt),
    currency: "BRL",
    createdAt: new Date().toISOString(),
  };
  writeJson(STORAGE.USERS, [...users, user]);
  startSession(user);
  return { ok: true, user };
}

async function login({ email, password }) {
  if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
    try {
      const user = await supabaseSignIn({ email: email.trim().toLowerCase(), password });
      return { ok: true, user };
    } catch (error) {
      return { ok: false, error: "E-mail ou senha incorretos." };
    }
  }

  const users = readJson(STORAGE.USERS, []);
  const user = findUserByEmail(users, email);
  if (!user) return { ok: false, error: "E-mail ou senha incorretos." };

  const attempt = await hashPassword(password, user.salt);
  if (attempt !== user.passwordHash) return { ok: false, error: "E-mail ou senha incorretos." };

  startSession(user);
  return { ok: true, user };
}

function startSession(user) {
  writeJson(STORAGE.SESSION, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
}

function restoreSession() {
  const session = readJson(STORAGE.SESSION, null);
  if (!session || typeof session.expiresAt !== "number") return null;
  if (Date.now() > session.expiresAt) {
    remove(STORAGE.SESSION);
    return null;
  }
  const user = readJson(STORAGE.USERS, []).find((candidate) => candidate.id === session.userId);
  return user ?? null;
}

async function endSession() {
  if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
    try {
      await supabaseSignOut();
      return true;
    } catch (error) {
      console.error("[finora] não foi possível encerrar a sessão remota", error);
      return false;
    }
  }
  remove(STORAGE.SESSION);
  return true;
}

async function saveProfile(patch) {
  if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
    try {
      await supabaseUpdateProfile(state.user.id, patch);
      state.user = { ...state.user, ...patch };
      emit();
      return true;
    } catch (error) {
      console.error("[finora] não foi possível salvar o perfil no Supabase", error);
      return false;
    }
  }

  const users = readJson(STORAGE.USERS, []);
  const index = users.findIndex((candidate) => candidate.id === state.user.id);
  if (index === -1) return false;
  users[index] = { ...users[index], ...patch };
  const ok = writeJson(STORAGE.USERS, users);
  state.user = { ...state.user, ...patch };
  emit();
  return ok;
}
