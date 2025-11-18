import { MODULE_REGISTRY } from "./core/modules.js";
import { getCurrentRoute, listenRouteChange, navigateTo } from "./core/router.js";
import { loadAppDefinition, loadAppConfig, saveAppConfig } from "./core/configService.js";
import { loadCurrentUser, saveCurrentUser, loginAsSuperAdmin } from "./core/authService.js";

const root = document.getElementById("app-root");

let activeModules = [];
let appDefinition = null; // obsah config/app.json
let appConfigForCore = {
  enabledModules: null,
  moduleConfig: {},
  users: [],
};
let currentUser = null;

// Vyrenderuje hlavní shell aplikace (sidebar + header + obsah modulu)
function renderShell(currentModuleId) {
  const current = MODULE_REGISTRY[currentModuleId];

  root.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "app-shell";

  const sidebar = document.createElement("aside");
  sidebar.className = "app-sidebar";

  const logo = document.createElement("h1");
  logo.className = "app-logo";
  logo.textContent = "CRM/ERP";
  sidebar.appendChild(logo);

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = "statická verze";
  sidebar.appendChild(badge);

  const nav = document.createElement("nav");
  activeModules.forEach((id) => {
    const mod = MODULE_REGISTRY[id];
    if (!mod) return;
    const item = document.createElement("div");
    item.className = "nav-item";
    const link = document.createElement("a");
    link.href = `#/${id}`;
    link.textContent = mod.label;
    item.appendChild(link);
    nav.appendChild(item);
  });
  sidebar.appendChild(nav);

  const main = document.createElement("main");
  main.className = "app-main";

  const header = document.createElement("div");
  header.className = "app-header";

  const title = document.createElement("h2");
  title.textContent = current ? current.label : "Neznámý modul";
  header.appendChild(title);

  const info = document.createElement("div");
  info.className = "muted";
  info.textContent =
    "Ukázkový skeleton – statické HTML/JS. Konfigurace aplikace, uživatelů i modulů se ukládá do localStorage.";
  header.appendChild(info);

  main.appendChild(header);

  const contentCard = document.createElement("div");
  contentCard.className = "card";

  if (current && typeof current.render === "function") {
    current.render(contentCard, {
      activeModules: [...activeModules],
      moduleRegistry: MODULE_REGISTRY,
      appConfig: appConfigForCore,
      currentUser,
    });
  } else {
    contentCard.innerHTML = "<p>Modul nebyl nalezen.</p>";
  }

  main.appendChild(contentCard);

  shell.appendChild(sidebar);
  shell.appendChild(main);
  root.appendChild(shell);
}

// Přihlašovací obrazovka super-admina
function renderLogin() {
  root.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "login-root";

  const card = document.createElement("div");
  card.className = "card login-card";

  const title = document.createElement("h2");
  title.className = "login-title";
  title.textContent = "Přihlášení";

  const subtitle = document.createElement("p");
  subtitle.className = "login-subtitle";
  subtitle.textContent =
    "Zadej přihlašovací údaje super-admina definované v config/app.json.";

  const form = document.createElement("form");
  form.className = "login-form";

  const inputUser = document.createElement("input");
  inputUser.type = "text";
  inputUser.placeholder = "Uživatelské jméno";
  inputUser.required = true;

  const inputPass = document.createElement("input");
  inputPass.type = "password";
  inputPass.placeholder = "Heslo";
  inputPass.required = true;

  const btn = document.createElement("button");
  btn.type = "submit";
  btn.textContent = "Přihlásit se";

  const error = document.createElement("div");
  error.className = "login-error";
  error.style.display = "none";

  form.appendChild(inputUser);
  form.appendChild(inputPass);
  form.appendChild(btn);
  form.appendChild(error);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = inputUser.value.trim();
    const password = inputPass.value;

    const user = loginAsSuperAdmin(username, password, appDefinition);
    if (user) {
      saveCurrentUser(user);
      currentUser = user;
      init(); // znovu inicializuj app jako přihlášený
    } else {
      error.textContent = "Neplatné přihlašovací údaje.";
      error.style.display = "block";
    }
  });

  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(form);
  wrapper.appendChild(card);
  root.appendChild(wrapper);
}

// Načtení a výpočet konfigurace (enabledModules, moduleConfig, users)
async function prepareConfiguration() {
  const def = appDefinition;
  let cfg = loadAppConfig();

  // enabledModules: pokud není uložené, použij defaulty z appDefinition,
  // případně všechny známé moduly
  let enabled =
    (cfg.enabledModules && cfg.enabledModules.slice()) ||
    def.defaultEnabledModules ||
    Object.keys(MODULE_REGISTRY);

  // filtr na známé moduly
  const knownIds = new Set(Object.keys(MODULE_REGISTRY));
  enabled = enabled.filter((id) => knownIds.has(id));

  // Modul konfigurace vždy aktivní
  if (MODULE_REGISTRY.config && !enabled.includes("config")) {
    enabled.unshift("config");
  }

  // Bez aktivních modulů – fallback
  if (!enabled.length) {
    enabled = Object.keys(MODULE_REGISTRY);
    if (!enabled.includes("config") && MODULE_REGISTRY.config) {
      enabled.unshift("config");
    }
  }

  // Modulová konfigurace: merge defaultů z appDefinition a uložených override
  const moduleConfig = {
    ...(def.modules || {}),
    ...(cfg.moduleConfig || {}),
  };

  // users: zatím jen to, co je v app_config_v2
  const users = Array.isArray(cfg.users) ? cfg.users : [];

  appConfigForCore = {
    enabledModules: enabled,
    moduleConfig,
    users,
  };

  // Ulož zpět (sjednocenou konfiguraci)
  saveAppConfig(appConfigForCore);

  // Sestavení activeModules bez duplicit
  const seen = new Set();
  activeModules = enabled.filter((id) => {
    if (!MODULE_REGISTRY[id]) return false;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// Hlavní inicializace aplikace
async function init() {
  root.innerHTML = '<div class="app-loading">Načítám aplikaci…</div>';

  // 1) Definice aplikace (super-admin, default moduly, modulové defaulty)
  appDefinition = await loadAppDefinition();

  // 2) Přihlášený uživatel
  currentUser = loadCurrentUser();
  if (!currentUser) {
    renderLogin();
    return;
  }

  // 3) Konfigurace (app_config_v2 + defaulty)
  await prepareConfiguration();

  if (!activeModules.length) {
    root.innerHTML =
      '<div class="app-error">Nenalezen žádný aktivní modul. Zkontroluj config/app.json nebo aplikaci restartuj.</div>';
    return;
  }

  // 4) Routing + render
  const route = getCurrentRoute();
  const moduleId = activeModules.includes(route.moduleId)
    ? route.moduleId
    : activeModules[0];

  if (moduleId !== route.moduleId) {
    navigateTo(moduleId);
    return;
  }

  renderShell(moduleId);

  listenRouteChange((r) => {
    const id = activeModules.includes(r.moduleId) ? r.moduleId : activeModules[0];
    renderShell(id);
  });
}

init();
