/**
 * View: Metas de economia.
 */

function renderGoals() {
  const currency = state.user?.currency ?? "BRL";
  const list = state.goals.slice().sort((a, b) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  });

  $("#goals-summary").textContent = list.length
    ? `${list.length} ${list.length === 1 ? "meta ativa" : "metas ativas"}`
    : "Nenhuma meta ainda";

  $("#goals-list").innerHTML = list.length
    ? list.map((goal) => goalCard(goal, currency)).join("")
    : `<div class="empty-state">
         <i class="fa-solid fa-rocket"></i>
         <strong>Nenhuma meta definida</strong>
         <span>Crie uma meta — como "Viagem em dezembro" — e acompanhe o progresso.</span>
       </div>`;
}

function goalCard(goal, currency) {
  const percent = goal.target > 0 ? (goal.saved / goal.target) * 100 : 0;
  const clamped = Math.min(percent, 100);
  const done = percent >= 100;
  const state_ = done ? "ok" : clamped >= 60 ? "warning" : "info";

  return `
    <article class="panel goal-card ${done ? "is-complete" : ""}">
      <div class="budget-head">
        <div>
          <strong>${escapeHtml(goal.name)}</strong>
          <small>${deadlineLabel(goal.deadline, done)}</small>
        </div>
        <div class="row-actions">
          <button class="row-action" data-action="add-goal-savings" data-id="${escapeHtml(goal.id)}" title="Adicionar valor" aria-label="Adicionar valor à meta ${escapeHtml(goal.name)}">
            <i class="fa-solid fa-plus"></i>
          </button>
          <button class="row-action delete" data-action="delete-goal" data-id="${escapeHtml(goal.id)}" title="Excluir meta" aria-label="Excluir meta ${escapeHtml(goal.name)}">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
      <div class="goal-amount">
        <strong>${formatCurrency(goal.saved, currency)}</strong>
        <span>de ${formatCurrency(goal.target, currency)}</span>
      </div>
      <div class="progress" role="progressbar" aria-valuenow="${Math.round(percent)}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(goal.name)}">
        <div class="progress-bar ${state_}" style="width:${clamped}%"></div>
      </div>
      <div class="budget-foot">
        <span>${Math.round(percent)}% concluída</span>
        <span>${done ? "🎉 meta batida" : `faltam ${formatCurrency(goal.target - goal.saved, currency)}`}</span>
      </div>
    </article>`;
}

function deadlineLabel(deadline, done) {
  if (done) return "Meta concluída";
  if (!deadline) return "Sem prazo definido";
  const days = Math.ceil((parseDateKey(deadline) - new Date()) / 86400000);
  if (days < 0) return `Prazo venceu há ${Math.abs(days)} dia(s)`;
  if (days === 0) return "Prazo é hoje";
  return `${days} dia(s) até o prazo`;
}

async function saveGoalFromForm() {
  const name = $("#goal-name").value.trim();
  const target = parseAmount($("#goal-target").value);
  const saved = parseAmount($("#goal-saved").value) || 0;
  const deadline = $("#goal-deadline").value;

  if (!name) return toast("Dê um nome à meta.", "error");
  if (!Number.isFinite(target) || target <= 0) return toast("Informe um valor-alvo maior que zero.", "error");
  if (saved > target) return toast("O valor já guardado não pode passar do valor-alvo.", "error");

  const previous = state.goals;
  state.goals = [
    ...state.goals,
    { id: createId(), name, target, saved, deadline, createdAt: new Date().toISOString() },
  ];
  if (!(await persist("goals"))) {
    state.goals = previous;
    return toast("Não foi possível salvar a meta.", "error");
  }
  $("#goal-form").reset();
  toast("Meta criada.", "success");
  renderGoals();
}

/** Deposita um valor numa meta existente (fluxo rápido, sem abrir modal). */
async function addGoalSavings(id) {
  const goal = state.goals.find((item) => item.id === id);
  if (!goal) return;
  const currency = state.user?.currency ?? "BRL";
  const raw = prompt(`Quanto adicionar à meta "${goal.name}"? (restam ${formatCurrency(goal.target - goal.saved, currency)})`);
  if (raw === null) return;
  const amount = parseAmount(raw);
  if (!Number.isFinite(amount) || amount <= 0) return toast("Valor inválido.", "error");
  if (goal.saved + amount > goal.target) return toast("Isso passaria do valor-alvo da meta.", "error");

  const previous = state.goals;
  state.goals = state.goals.map((item) => (item.id === id ? { ...item, saved: item.saved + amount } : item));
  if (!(await persist("goals"))) {
    state.goals = previous;
    return toast("Não foi possível atualizar a meta.", "error");
  }
  toast(`${formatCurrency(amount, currency)} adicionados à meta.`, "success");
  renderGoals();
}

async function deleteGoal(id) {
  const goal = state.goals.find((item) => item.id === id);
  if (!goal) return;
  if (!confirm(`Excluir a meta "${goal.name}"?`)) return;
  const previous = state.goals;
  state.goals = state.goals.filter((item) => item.id !== id);
  if (!(await persist("goals"))) {
    state.goals = previous;
    return toast("Não foi possível excluir.", "error");
  }
  toast("Meta excluída.");
  renderGoals();
}
