const supabaseConfig = window.FINORA_SUPABASE_CONFIG ?? {};
const supabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey);

const supabaseClient = supabaseConfigured
  ? window.supabase?.createClient(supabaseConfig.url, supabaseConfig.anonKey) ?? null
  : null;

if (supabaseConfigured && !supabaseClient) {
  console.error("[finora] Supabase configurado, mas o cliente não foi carregado.");
}

function isSupabaseConfigured() {
  return supabaseConfigured;
}

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Configure a URL e a chave pública do Supabase em js/supabase-config.js.");
  }
  return supabaseClient;
}

function supabaseUserRecord(user) {
  return {
    id: user.id,
    name: user.user_metadata?.name ?? "",
    email: user.email ?? "",
    currency: "BRL",
    createdAt: user.created_at,
  };
}

async function supabaseSignIn({ email, password }) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return supabaseUserRecord(data.user);
}

async function supabaseSignUp({ name, email, password }) {
  const { data, error } = await requireSupabase().auth.signUp({
    email,
    password,
    options: { data: { name: name.trim() } },
  });
  if (error) throw error;
  return {
    user: data.user ? supabaseUserRecord(data.user) : null,
    needsConfirmation: !data.session,
  };
}

async function supabaseGetSessionUser() {
  const { data, error } = await requireSupabase().auth.getUser();
  if (error) {
    if (error.name === "AuthSessionMissingError") return null;
    throw error;
  }
  return data.user ? supabaseUserRecord(data.user) : null;
}

async function supabaseSignOut() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

const SUPABASE_COLLECTIONS = {
  accounts: {
    table: "accounts",
    fromRow: (row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      initialBalance: Number(row.initial_balance),
      color: row.color,
      archived: row.archived,
    }),
    toRow: (record, workspaceId) => ({
      id: record.id,
      workspace_id: workspaceId,
      name: record.name,
      type: record.type,
      initial_balance: record.initialBalance,
      color: record.color,
      archived: Boolean(record.archived),
    }),
  },
  transactions: {
    table: "transactions",
    fromRow: (row) => ({
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      categoryId: row.category_id,
      date: row.date,
      accountId: row.account_id,
      description: row.description,
      recurring: row.recurring,
      createdAt: row.created_at,
    }),
    toRow: (record, workspaceId) => ({
      id: record.id,
      workspace_id: workspaceId,
      type: record.type,
      amount: record.amount,
      category_id: record.categoryId,
      date: record.date,
      account_id: record.accountId,
      description: record.description ?? "",
      recurring: Boolean(record.recurring),
    }),
  },
  budgets: {
    table: "budgets",
    fromRow: (row) => ({
      id: row.id,
      categoryId: row.category_id,
      limit: Number(row.amount),
      month: row.month.slice(0, 7),
    }),
    toRow: (record, workspaceId) => ({
      id: record.id,
      workspace_id: workspaceId,
      category_id: record.categoryId,
      amount: record.limit,
      month: `${record.month}-01`,
    }),
  },
  goals: {
    table: "goals",
    fromRow: (row) => ({
      id: row.id,
      name: row.name,
      target: Number(row.target),
      saved: Number(row.saved),
      deadline: row.deadline ?? "",
      createdAt: row.created_at,
    }),
    toRow: (record, workspaceId) => ({
      id: record.id,
      workspace_id: workspaceId,
      name: record.name,
      target: record.target,
      saved: record.saved,
      deadline: record.deadline || null,
    }),
  },
};

async function supabaseListWorkspaces(userId) {
  const client = requireSupabase();
  const [memberships, profile, admin] = await Promise.all([
    client.from("workspace_members").select("role, workspaces(id, name, kind)").eq("user_id", userId),
    client.from("profiles").select("display_name, currency").eq("id", userId).maybeSingle(),
    client.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  for (const result of [memberships, profile, admin]) {
    if (result.error) throw result.error;
  }
  return {
    workspaces: (memberships.data ?? [])
      .map((item) => ({ ...item.workspaces, role: item.role }))
      .filter((workspace) => workspace.id)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    profile: profile.data,
    isPlatformAdmin: Boolean(admin.data),
  };
}

async function supabaseLoadWorkspace(workspaceId) {
  const client = requireSupabase();
  const names = Object.keys(SUPABASE_COLLECTIONS);
  const results = await Promise.all(
    names.map((name) =>
      client.from(SUPABASE_COLLECTIONS[name].table).select("*").eq("workspace_id", workspaceId)
    )
  );
  const data = {};
  results.forEach((result, index) => {
    if (result.error) throw result.error;
    const collection = SUPABASE_COLLECTIONS[names[index]];
    data[names[index]] = (result.data ?? []).map(collection.fromRow);
  });
  return data;
}

async function supabaseSaveCollection(name, workspaceId, records, snapshot) {
  const client = requireSupabase();
  const collection = SUPABASE_COLLECTIONS[name];
  if (!collection) throw new Error(`Coleção desconhecida: ${name}`);

  const oldById = new Map(snapshot.map((record) => [record.id, record]));
  const newById = new Map(records.map((record) => [record.id, record]));
  const changed = records.filter((record) => JSON.stringify(record) !== JSON.stringify(oldById.get(record.id)));
  const removed = snapshot.filter((record) => !newById.has(record.id));

  if (changed.length) {
    const { error } = await client
      .from(collection.table)
      .upsert(changed.map((record) => collection.toRow(record, workspaceId)), { onConflict: "id" });
    if (error) throw error;
  }
  for (const record of removed) {
    const { error } = await client
      .from(collection.table)
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("id", record.id);
    if (error) throw error;
  }
  return records.map((record) => ({ ...record }));
}

async function supabaseUpdateProfile(userId, patch) {
  const { error } = await requireSupabase()
    .from("profiles")
    .update({ display_name: patch.name, currency: patch.currency })
    .eq("id", userId);
  if (error) throw error;
}

async function supabaseCreateGroup(name) {
  const { data, error } = await requireSupabase().rpc("create_group_workspace", { workspace_name: name });
  if (error) throw error;
  return data;
}

async function supabaseLoadFollowedAccounts(userId) {
  const client = requireSupabase();
  const { data: follows, error: followsError } = await client
    .from("account_followers")
    .select("accounts(*)")
    .eq("user_id", userId);
  if (followsError) throw followsError;

  const accounts = (follows ?? [])
    .map((follow) => follow.accounts)
    .filter(Boolean)
    .map(SUPABASE_COLLECTIONS.accounts.fromRow);
  if (!accounts.length) return { accounts, transactions: [] };

  const { data: transactions, error: transactionsError } = await client
    .from("transactions")
    .select("*")
    .in("account_id", accounts.map((account) => account.id))
    .order("date", { ascending: false });
  if (transactionsError) throw transactionsError;
  return {
    accounts,
    transactions: (transactions ?? []).map(SUPABASE_COLLECTIONS.transactions.fromRow),
  };
}

async function supabaseManageAccess(body) {
  const { data, error } = await requireSupabase().functions.invoke("access-management", { body });
  if (error) {
    if (error.context instanceof Response) {
      const response = await error.context.json().catch(() => null);
      if (response?.error) throw new Error(response.error);
    }
    throw error;
  }
  return data;
}

async function supabaseInviteToWorkspace(email, workspaceId) {
  return supabaseManageAccess({ action: "invite_workspace_member", email, workspaceId });
}

async function supabaseGrantAccountFollow(email, accountId) {
  return supabaseManageAccess({ action: "follow_account", email, accountId });
}

async function supabaseRevokeAccountFollow(email, accountId) {
  return supabaseManageAccess({ action: "revoke_account_follow", email, accountId });
}

async function supabasePromotePlatformAdmin(email) {
  return supabaseManageAccess({ action: "promote_platform_admin", email });
}