/**
 * Infraestrutura de UI: roteador de views, modais acessíveis, tema e avisos.
 */

// ------------------------------------------------------------------- roteador

const ROUTES = {
  dashboard: { title: "Visão geral", icon: "fa-solid fa-grid-2", render: () => renderDashboard() },
  transactions: { title: "Lançamentos", icon: "fa-solid fa-arrow-right-arrow-left", render: () => renderTransactions() },
  statement: { title: "Extrato", icon: "fa-solid fa-receipt", render: () => renderStatement() },
  budget: { title: "Orçamento", icon: "fa-solid fa-bullseye", render: () => renderBudget() },
  goals: { title: "Metas", icon: "fa-solid fa-rocket", render: () => renderGoals() },
  accounts: { title: "Contas", icon: "fa-solid fa-building-columns", render: () => renderAccounts() },
  following: { title: "Acompanhamentos", icon: "fa-solid fa-eye", render: () => renderFollowings() },
  profile: { title: "Perfil", icon: "fa-solid fa-user", render: () => renderProfile() },
};

let currentRoute = "dashboard";

function navigate(route) {
  if (!ROUTES[route]) route = "dashboard";
  currentRoute = route;
  location.hash = route;

  $$(".nav-item[data-route]").forEach((item) => {
    const active = item.dataset.route === route;
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });

  $$(".view").forEach((view) => view.classList.toggle("is-hidden", view.dataset.view !== route));
  $("#page-title").textContent = ROUTES[route].title;
  closeSidebar();
  ROUTES[route].render();
}

// ---------------------------------------------------------------------- tema

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  $("#theme-toggle").setAttribute("aria-label", isDark ? "Ativar tema claro" : "Ativar tema escuro");
  $("#theme-toggle").innerHTML = `<i class="${isDark ? "fa-solid fa-sun" : "fa-solid fa-moon"}"></i>`;
  writeJson(STORAGE.THEME, isDark ? "dark" : "light");
  // O Chart.js não lê as variáveis CSS do tema: cores fixadas ficariam
  // erradas ao alternar. Redesenha os gráficos da view atual.
  if (currentRoute === "dashboard") ROUTES.dashboard.render();
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}

// -------------------------------------------------------------------- avisos

let toastTimer;

function toast(message, type = "info") {
  const element = $("#toast");
  element.className = `toast toast-${type} is-visible`;
  element.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : type === "success" ? "fa-circle-check" : "fa-circle-info"}"></i><span>${escapeHtml(message)}</span>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("is-visible"), 3800);
}

// ------------------------------------------------------------------- modais

let activeModal = null;
let lastFocused = null;

function openModal(id) {
  const modal = $(`#${id}`);
  if (!modal) return;
  lastFocused = document.activeElement;
  activeModal = modal;
  modal.classList.remove("is-hidden");
  document.body.classList.add("has-modal");
  const focusable = modal.querySelector("input:not([type=hidden]), select, textarea, button");
  focusable?.focus();
}

function closeModal() {
  if (!activeModal) return;
  activeModal.classList.add("is-hidden");
  document.body.classList.remove("has-modal");
  activeModal = null;
  lastFocused?.focus();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (activeModal) closeModal();
    else closeSidebar();
    return;
  }
  // Focus trap: sem isso o Tab escapa do modal para a página de trás.
  if (event.key !== "Tab" || !activeModal) return;
  const focusables = $$(
    'a[href], button:not([disabled]), input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
    activeModal
  ).filter((element) => element.offsetParent !== null);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

document.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) closeModal();
});

// ------------------------------------------------------------------- sidebar

function openSidebar() {
  // A classe é "open" (e não "is-open") para casar com o .sidebar.open já
  // definido em styles.css.
  $(".sidebar").classList.add("open");
  $(".sidebar-scrim").classList.remove("is-hidden");
  $("#menu-toggle").setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  $(".sidebar").classList.remove("open");
  $(".sidebar-scrim").classList.add("is-hidden");
  $("#menu-toggle").setAttribute("aria-expanded", "false");
}
