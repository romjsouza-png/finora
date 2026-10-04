/**
 * View: Contas e View: Perfil.
 */

function renderAccounts() {
  const currency = state.user?.currency ?? "BRL";
  const list = state.accounts.slice().sort((a, b) => Number(a.archived) - Number(b.archived));

  $("#accounts-total").textContent = formatCurrency(totalBalance(), currency);

  $("#accounts-list").innerHTML = list.length
    ? list.map((account) => accountCard(account, currency)).join("")
    : `<div class="empty-state">
         <i class="fa-solid fa-building-columns"></i>
         <strong>Nenhuma conta cadastrada</strong>
         <span>Crie sua primeira conta para começar a registrar lançamentos.</span>
       </div>`;

  $("#account-type").innerHTML = ACCOUNT_TYPES.map((type) => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.name)}</option>`).join("");
}

function accountCard(account, currency) {
  const balance = accountBalance(account);
  const count = state.transactions.filter((item) => item.accountId === account.id).length;
  const archiveLabel = account.archived ? "Desarquivar" : "Arquivar";
  const archiveIcon = account.archived ? "fa-box-open" : "fa-archive";

  return `
    <article class="panel account-card ${account.archived ? "is-archived" : ""}">
      <span class="account-color" style="background:${escapeHtml(account.color)}"></span>
      <div class="account-info">
        <strong>${escapeHtml(account.name)}</strong>
        <small>${escapeHtml(ACCOUNT_TYPES.find((type) => type.id === account.type)?.name ?? account.type)} · ${count} lançamento(s)</small>
      </div>
      <div class="account-balance">
        <strong class="${balance < 0 ? "is-expense" : ""}">${formatCurrency(balance, currency)}</strong>
        <small>saldo${account.archived ? " · arquivada" : ""}</small>
      </div>
      <div class="row-actions">
        <button class="row-action" data-action="edit-account" data-id="${escapeHtml(account.id)}" title="Editar" aria-label="Editar conta ${escapeHtml(account.name)}">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="row-action" data-action="toggle-archive-account" data-id="${escapeHtml(account.id)}" title="${archiveLabel}" aria-label="${archiveLabel} conta ${escapeHtml(account.name)}">
          <i class="fa-solid ${archiveIcon}"></i>
        </button>
        <button class="row-action" data-action="follow-account" data-id="${escapeHtml(account.id)}" title="Liberar acompanhamento" aria-label="Liberar acompanhamento da conta ${escapeHtml(account.name)}">
          <i class="fa-solid fa-eye"></i>
        </button>
        <button class="row-action delete" data-action="delete-account" data-id="${escapeHtml(account.id)}" title="Excluir" aria-label="Excluir conta ${escapeHtml(account.name)}">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </article>`;
}

function renderFollowings() {
  const list = $("#following-list");
  if (!isSupabaseConfigured()) {
    $("#following-notice").textContent =
      "Acompanhamento entre pessoas exige Supabase configurado. O modo local guarda os dados apenas neste navegador.";
    list.innerHTML = "";
    return;
  }

  $("#following-notice").textContent =
    "As contas liberadas aparecem aqui em modo somente leitura e não entram nos seus próprios totais.";
  list.innerHTML = state.followedAccounts.length
    ? state.followedAccounts.map((account) => {
        const transactions = state.followedTransactions
          .filter((item) => item.accountId === account.id)
          .sort((a, b) => b.date.localeCompare(a.date));
        const balance = transactions.reduce(
          (sum, item) => sum + (item.type === "income" ? item.amount : -item.amount),
          Number(account.initialBalance) || 0
        );
        const recent = transactions.slice(0, 8);
        return `
          <article class="panel following-card">
            <div class="following-card-heading">
              <span class="account-color" style="background:${escapeHtml(account.color)}"></span>
              <div class="account-info">
                <strong>${escapeHtml(account.name)}</strong>
                <small>${escapeHtml(ACCOUNT_TYPES.find((type) => type.id === account.type)?.name ?? account.type)} · ${transactions.length} lançamento(s)</small>
              </div>
              <div class="account-balance">
                <strong>${formatCurrency(balance, state.user?.currency ?? "BRL")}</strong>
                <small>saldo acompanhado</small>
              </div>
            </div>
            ${recent.length
              ? `<ul class="following-transactions">${recent.map((item) => `
                  <li>
                    <span>${escapeHtml(item.description || categoryById(item.categoryId)?.name || "Lançamento")}<small>${formatDate(item.date)}</small></span>
                    <strong class="${item.type === "income" ? "is-income" : "is-expense"}">${item.type === "income" ? "+" : "−"}${formatCurrency(item.amount, state.user?.currency ?? "BRL")}</strong>
                  </li>`).join("")}</ul>`
              : `<p class="field-hint">Ainda não há lançamentos nesta conta.</p>`}
          </article>`;
      }).join("")
    : `<div class="empty-state">
         <i class="fa-solid fa-eye"></i>
         <strong>Nenhuma conta acompanhada</strong>
         <span>Quando alguém liberar uma conta para você, ela aparecerá aqui.</span>
       </div>`;
}

function renderWorkspaceAccess() {
  const configured = isSupabaseConfigured();
  const workspaceSelect = $("#profile-workspace");
  workspaceSelect.innerHTML = state.workspaces
    .map((workspace) => `<option value="${escapeHtml(workspace.id)}">${escapeHtml(workspace.name)} · ${escapeHtml(workspace.role)}</option>`)
    .join("");
  workspaceSelect.value = state.currentWorkspaceId ?? "";
  workspaceSelect.disabled = !configured || state.workspaces.length < 2;

  const currentWorkspace = state.workspaces.find((workspace) => workspace.id === state.currentWorkspaceId);
  const canManageGroup = state.isPlatformAdmin || ["owner", "admin"].includes(currentWorkspace?.role);
  $("#workspace-access-notice").textContent = !configured
    ? "Ative o Supabase para compartilhar dados entre usuários. O primeiro administrador da plataforma deve ser habilitado no SQL Editor do Supabase; depois disso, administradores podem conceder acesso pela tela."
    : currentWorkspace
      ? `Espaço atual: ${currentWorkspace.name} (${currentWorkspace.kind === "group" ? "grupo" : "pessoal"}).`
      : "Nenhum espaço disponível para esta conta.";
  $("#group-create-form").classList.toggle("is-hidden", !configured || !state.isPlatformAdmin);
  $("#platform-admin-form").classList.toggle("is-hidden", !configured || !state.isPlatformAdmin);
  $("#group-invite-form").classList.toggle(
    "is-hidden",
    !configured || currentWorkspace?.kind !== "group" || !canManageGroup
  );
}

async function saveAccountFromForm() {
  const id = $("#account-id").value;
  const name = $("#account-name").value.trim();
  const type = $("#account-type").value;
  const initialBalance = parseAmount($("#account-balance").value) || 0;
  const color = $("#account-color").value;

  if (!name) return toast("Dê um nome à conta.", "error");

  const previous = state.accounts;
  state.accounts = id
    ? state.accounts.map((account) => (account.id === id ? { ...account, name, type, initialBalance, color } : account))
    : [...state.accounts, { id: createId(), name, type, initialBalance, color, archived: false }];

  if (!(await persist("accounts"))) {
    state.accounts = previous;
    return toast("Não foi possível salvar a conta.", "error");
  }
  $("#account-form").reset();
  $("#account-id").value = "";
  toast(id ? "Conta atualizada." : "Conta criada.", "success");
  renderAccounts();
}

function openAccountModal(id = null) {
  const account = id ? accountById(id) : null;
  renderAccounts(); // garante que #account-type tenha as opções
  $("#account-id").value = account?.id ?? "";
  $("#account-name").value = account?.name ?? "";
  $("#account-balance").value = account?.initialBalance ?? "";
  $("#account-color").value = account?.color ?? "#5b5ce2";
  $("#account-modal-title").textContent = account ? "Editar conta" : "Nova conta";
  openModal("account-modal");
}

async function toggleArchiveAccount(id) {
  const account = accountById(id);
  if (!account) return;

  const previous = state.accounts.map((item) => ({ ...item }));
  state.accounts = state.accounts.map((item) =>
    item.id === id ? { ...item, archived: !Boolean(item.archived) } : item
  );

  if (!(await persist("accounts"))) {
    state.accounts = previous;
    return toast("Não foi possível atualizar o status da conta.", "error");
  }

  toast(account.archived ? "Conta reativada." : "Conta arquivada.", "success");
  renderAccounts();
}

async function deleteAccount(id) {
  const account = accountById(id);
  if (!account) return;
  const linked = state.transactions.filter((item) => item.accountId === id).length;
  if (linked) {
    toast(`Não é possível excluir: ${linked} lançamento(s) usam esta conta.`, "error");
    return;
  }
  if (state.accounts.filter((item) => !item.archived).length === 1 && !account.archived) {
    toast("É preciso manter ao menos uma conta ativa.", "error");
    return;
  }
  if (!confirm(`Excluir a conta "${account.name}"?`)) return;

  const previous = state.accounts;
  state.accounts = state.accounts.filter((item) => item.id !== id);
  if (!(await persist("accounts"))) {
    state.accounts = previous;
    return toast("Não foi possível excluir.", "error");
  }
  toast("Conta excluída.");
  renderAccounts();
}

// ---------------------------------------------------------------------- perfil

function renderProfile() {
  renderAccounts();
  renderWorkspaceAccess();
  const user = state.user;
  $("#profile-name").value = user.name;
  $("#profile-email").value = user.email;
  $("#profile-currency").value = user.currency ?? "BRL";
  $("#profile-joined").textContent = user.createdAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(user.createdAt))
    : "—";
  $("#profile-storage-ok").innerHTML = isStorageHealthy()
    ? `<i class="fa-solid fa-circle-check ok"></i> Armazenamento local disponível`
    : `<i class="fa-solid fa-triangle-exclamation warn"></i> <strong>localStorage indisponível.</strong> Os dados não serão salvos — avoid o modo privativo.`;
  $("#profile-storage-ok").classList.toggle("is-warn", !isStorageHealthy());
  $("#profile-count").textContent = state.transactions.length;
  $("#profile-accounts").textContent = state.accounts.length;
}

async function saveProfileFromForm() {
  const name = $("#profile-name").value.trim();
  if (!name) return toast("Informe seu nome.", "error");
  const patch = { name, currency: $("#profile-currency").value };
  if (!(await saveProfile(patch))) return toast("Não foi possível salvar o perfil.", "error");
  $("#avatar").textContent = initials(name);
  $("#topbar-name").textContent = name;
  toast("Perfil atualizado.", "success");
  renderProfile();
}

/** Exporta um backup completo do usuário em JSON — a única forma de levar os dados embora. */
function exportBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 2,
    profile: { name: state.user.name, email: state.user.email, currency: state.user.currency },
    accounts: state.accounts,
    transactions: state.transactions,
    budgets: state.budgets,
    goals: state.goals,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `finora-backup-${todayKey()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Backup exportado.", "success");
}

/** Importa um backup. Substitui os dados atuais — por isso pede confirmação. */
function importBackup(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    let data;
    try {
      data = JSON.parse(String(reader.result));
    } catch (error) {
      return toast("Arquivo inválido: não é um JSON de backup do Finora.", "error");
    }
    if (!Array.isArray(data.transactions) || !Array.isArray(data.accounts)) {
      return toast("Arquivo inválido: faltam as coleções de contas e lançamentos.", "error");
    }
    if (!confirm(`Importar substituirá seus dados atuais por ${data.transactions.length} lançamento(s). Continuar?`)) return;

    state.accounts = data.accounts;
    state.transactions = data.transactions;
    state.budgets = Array.isArray(data.budgets) ? data.budgets : [];
    state.goals = Array.isArray(data.goals) ? data.goals : [];
    if (data.profile) await saveProfile({ name: data.profile.name, currency: data.profile.currency });

    const results = await Promise.all(["accounts", "transactions", "budgets", "goals"].map((key) => persist(key)));
    const ok = results.every(Boolean);
    toast(ok ? "Backup restaurado." : "Dados restaurados, mas a gravação falhou.", ok ? "success" : "error");
    navigate("dashboard");
  };
  reader.onerror = () => toast("Não foi possível ler o arquivo.", "error");
  reader.readAsText(file);
}
