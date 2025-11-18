import { getCurrentRoute, listenRouteChange, navigateTo, runRouteGuards } from "./core/router.js";
import { loadAppDefinition, loadAppConfig, saveAppConfig } from "./core/configService.js";
import { loadCurrentUser, saveCurrentUser, loginAsSuperAdmin, clearCurrentUser } from "./core/authService.js";
import { getModuleRegistry, initModules } from "./core/moduleRegistry.js";
import { getAppVersion, runMigrations } from "./core/versionService.js";
import * as storageService from "./core/storageService.js";
import * as uiService from "./core/uiService.js";
import * as eventBus from "./core/eventBus.js";
import * as permissionService from "./core/permissionService.js";
import { registerService } from "./core/serviceRegistry.js";
import { setLanguage, getLanguage } from "./core/i18n.js";

const root = document.getElementById("app-root");

let currentLanguage = "cs";
let MODULE_REGISTRY = {};

function resolveLabel(meta, fallback) {
  if (meta && meta.labels) {
    return meta.labels[currentLanguage] || meta.labels["cs"] || fallback;
  }
  return fallback;
}

function resolveNavItemLabel(itemMeta, fallback) {
  if (itemMeta && itemMeta.labels) {
    return itemMeta.labels[currentLanguage] || itemMeta.labels["cs"] || fallback;
  }
  return fallback;
}

const THEME_STORAGE_KEY = "app_theme_v1";

function applyTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  document.body.classList.remove("theme-dark", "theme-light");
  document.body.classList.add(t === "dark" ? "theme-dark" : "theme-light");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, t);
  } catch (err) {
    console.warn("Theme: nelze uložit do localStorage", err);
  }
}

function initTheme() {
  let t = "dark";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      t = stored;
    }
  } catch (err) {
    console.warn("Theme: nelze číst z localStorage", err);
  }
  applyTheme(t);
}

// global state
let appDefinition = null;
let appConfigForCore = {
  enabledModules: null,
  moduleConfig: {},
  users: [],
};
let activeModules = [];
let currentUser = null;

async function loadModulesFromDirectory() {
  let manifest = null;
  try {
    const res = await fetch("./config/modules.php");
    if (!res.ok) throw new Error("HTTP " + res.status);
    manifest = await res.json();
  } catch (err) {
    console.error("Nepodařilo se načíst config/modules.php:", err);
    manifest = { modules: [] };
  }

  const list = Array.isArray(manifest.modules) ? manifest.modules : [];
  if (!list.length) {
    console.warn("Manifest modulů je prázdný.");
  }

  for (const m of list) {
    if (!m || !m.entry) continue;
    try {
      await import(m.entry);
    } catch (err) {
      console.error("Chyba při dynamickém importu modulu", m.entry, err);
    }
  }

  MODULE_REGISTRY = getModuleRegistry();
}

function renderLogin() {
  const wrapper = document.createElement("div");
  wrapper.className = "login-root";

  const card = document.createElement("div");
  card.className = "login-card";

  const title = document.createElement("h1");
  title.className = "login-title";
  title.textContent = "Modulární CRM/ERP – demo";
  card.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "login-subtitle";
  subtitle.textContent =
    "Přihlaste se jako super-admin. Údaje jsou definovány v config/app.json.";
  card.appendChild(subtitle);

  const form = document.createElement("form");
  form.className = "login-form";

  const inputUser = document.createElement("input");
  inputUser.placeholder = "Uživatelské jméno";
  inputUser.value = "admin";

  const inputPass = document.createElement("input");
  inputPass.placeholder = "Heslo";
  inputPass.type = "password";
  inputPass.value = "admin";

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
    if (!user) {
      error.textContent = "Neplatné přihlašovací údaje.";
      error.style.display = "block";
      return;
    }
    error.style.display = "none";
    saveCurrentUser(user);
    currentUser = user;
    initAppAfterLogin();
  });

  card.appendChild(form);
  wrapper.appendChild(card);

  root.innerHTML = "";
  root.appendChild(wrapper);
}

function prepareConfiguration() {
  const def = appDefinition || { modules: {}, defaultEnabledModules: null };
  const cfg = loadAppConfig();

  let enabled = cfg.enabledModules;
  if (!Array.isArray(enabled) || !enabled.length) {
    enabled = def.defaultEnabledModules || Object.keys(MODULE_REGISTRY);
  }

  enabled = enabled.filter((id) => !!MODULE_REGISTRY[id]);
  if (!enabled.includes("config") && MODULE_REGISTRY["config"]) {
    enabled.unshift("config");
  }
  if (!enabled.length) {
    enabled = Object.keys(MODULE_REGISTRY);
  }

  const moduleCfgFromDef = def.modules || {};
  const moduleCfgFromStorage = cfg.moduleConfig || {};
  const moduleConfig = { ...moduleCfgFromDef, ...moduleCfgFromStorage };

  const users = Array.isArray(cfg.users) ? cfg.users : [];

  appConfigForCore = {
    enabledModules: enabled,
    moduleConfig,
    users,
  };
  activeModules = [...enabled];

  saveAppConfig(appConfigForCore);
}

function renderShell(currentModuleId, currentSubId) {
  const moduleEntry = MODULE_REGISTRY[currentModuleId];
  const current = moduleEntry ? moduleEntry : null;
  const meta = current ? current.meta : null;

  root.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "app-shell";

  const sidebar = document.createElement("aside");
  sidebar.className = "app-sidebar app-sidebar-collapsed";

  const logo = document.createElement("div");
  logo.className = "app-logo-wrap";

  const logoIcon = document.createElement("div");
  logoIcon.className = "app-logo-icon";
  logoIcon.innerHTML = '<i class="fa-solid fa-layer-group"></i>';

  const logoText = document.createElement("div");
  logoText.className = "app-logo-text";
  logoText.textContent = "CRM/ERP";

  logo.appendChild(logoIcon);
  logo.appendChild(logoText);
  sidebar.appendChild(logo);

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.innerHTML = `<i class="fa-regular fa-circle-dot"></i><span>statická verze · v${getAppVersion()}</span>`;
  sidebar.appendChild(badge);

  const nav = document.createElement("nav");
  nav.className = "app-nav";

  activeModules.forEach((id) => {
    const entry = MODULE_REGISTRY[id];
    if (!entry) return;
    const mMeta = entry.meta || {};
    const item = document.createElement("div");
    item.className = "nav-item";
    if (id === currentModuleId) {
      item.classList.add("active");
    }

    const link = document.createElement("a");
    link.href = `#/${id}`;

    const iconWrap = document.createElement("span");
    iconWrap.className = "nav-icon";
    const iconClass = mMeta.iconClass || "fa-solid fa-circle";
    iconWrap.innerHTML = `<i class="${iconClass}"></i>`;

    const labelSpan = document.createElement("span");
    labelSpan.className = "nav-label";
    const moduleLabel = resolveLabel(mMeta, entry.id || id);
    labelSpan.textContent = moduleLabel;

    link.appendChild(iconWrap);
    link.appendChild(labelSpan);
    item.appendChild(link);

    if (Array.isArray(mMeta.navItems) && mMeta.navItems.length) {
      const subList = document.createElement("div");
      subList.className = "nav-submenu";
      mMeta.navItems.forEach((sub) => {
        const subItem = document.createElement("div");
        subItem.className = "nav-subitem";

        const subLink = document.createElement("a");
        const subLabel = resolveNavItemLabel(sub, sub.id);
        const subId = sub.id || null;
        const hrefSuffix = subId ? `/${subId}` : "";
        subLink.href = `#/${id}${hrefSuffix}`;
        subLink.textContent = subLabel;

        if (id === currentModuleId && subId === currentSubId) {
          subItem.classList.add("active");
        }

        subItem.appendChild(subLink);
        subList.appendChild(subItem);
      });
      item.appendChild(subList);
    }

    nav.appendChild(item);
  });

  sidebar.appendChild(nav);

  const userPanel = document.createElement("div");
  userPanel.className = "user-panel";

  const userInfo = document.createElement("div");
  userInfo.className = "user-info";
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  const initials = (currentUser && currentUser.username && currentUser.username[0]) || "S";
  avatar.textContent = initials.toUpperCase();
  const userName = document.createElement("div");
  userName.className = "user-name";
  userName.textContent = currentUser ? currentUser.username : "super-admin";
  userInfo.appendChild(avatar);
  userInfo.appendChild(userName);
  userPanel.appendChild(userInfo);

  const userActions = document.createElement("div");
  userActions.className = "user-actions";

  const themeToggle = document.createElement("button");
  themeToggle.type = "button";
  themeToggle.className = "theme-toggle";

  function updateThemeToggleLabel() {
    const isDark = document.body.classList.contains("theme-dark");
    themeToggle.innerHTML = isDark
      ? '<i class="fa-regular fa-sun"></i><span> Světlý režim</span>'
      : '<i class="fa-regular fa-moon"></i><span> Tmavý režim</span>';
  }

  themeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.contains("theme-dark");
    const next = isDark ? "light" : "dark";
    applyTheme(next);
    updateThemeToggleLabel();
  });

  updateThemeToggleLabel();
  userActions.appendChild(themeToggle);

  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.textContent = "Odhlásit";
  logoutBtn.addEventListener("click", () => {
    clearCurrentUser();
    currentUser = null;
    navigateTo("config", null);
    renderLogin();
  });
  userActions.appendChild(logoutBtn);

  userPanel.appendChild(userActions);
  sidebar.appendChild(userPanel);

  const main = document.createElement("main");
  main.className = "app-main";

  const header = document.createElement("div");
  header.className = "app-header";

  const title = document.createElement("h2");
  let baseTitle = current
    ? resolveLabel(meta, currentModuleId)
    : "Neznámý modul";

  if (meta && Array.isArray(meta.navItems) && currentSubId) {
    const sub = meta.navItems.find((s) => s.id === currentSubId);
    if (sub) {
      const subLabel = resolveNavItemLabel(sub, "");
      if (subLabel) {
        baseTitle = baseTitle + " – " + subLabel;
      }
    }
  }
  title.textContent = baseTitle;
  header.appendChild(title);

  const info = document.createElement("div");
  info.className = "muted";
  info.textContent =
    "Ukázkový skeleton – statické HTML/JS. Konfigurace aplikace, uživatelů i modulů se ukládá do localStorage.";
  header.appendChild(info);

  main.appendChild(header);

  const contentCard = document.createElement("div");
  contentCard.className = "card";

  const renderer =
    current && typeof current.render === "function" ? current.render : null;

  if (renderer) {
    renderer(contentCard, {
      activeModules: [...activeModules],
      moduleRegistry: MODULE_REGISTRY,
      appConfig: appConfigForCore,
      currentUser,
      currentSubId,
      language: currentLanguage,
      services: {
        storage: storageService,
        ui: uiService,
        events: eventBus,
        permissions: permissionService,
      },
    });
  } else {
    contentCard.innerHTML = "<p>Modul nebyl nalezen.</p>";
  }

  main.appendChild(contentCard);

  shell.appendChild(sidebar);
  shell.appendChild(main);
  root.appendChild(shell);
}

async function init() {
  initTheme();

  // registrace core služeb do serviceRegistry – moduly si je mohou vyzvednout
  registerService("storage", storageService);
  registerService("ui", uiService);
  registerService("events", eventBus);
  registerService("permissions", permissionService);

  // jazyk – zatím natvrdo cs, do budoucna z configu/uživatele
  currentLanguage = "cs";
  setLanguage(currentLanguage);

  root.innerHTML = '<div class="app-loading">Načítám aplikaci…</div>';

  try {
    appDefinition = await loadAppDefinition();
  } catch (err) {
    console.error(err);
    root.innerHTML =
      '<div class="app-error">Nepodařilo se načíst konfiguraci aplikace (config/app.json).</div>';
    return;
  }

  // migrace dat (zatím jen placeholder)
  runMigrations({});

  await loadModulesFromDirectory();

  if (!Object.keys(MODULE_REGISTRY).length) {
    root.innerHTML =
      '<div class="app-error">Nebyl nalezen žádný modul. Zkontrolujte adresář /modules a config/modules.php.</div>';
    return;
  }

  // init hooky modulů
  await initModules({
    moduleRegistry: MODULE_REGISTRY,
    appConfig: appConfigForCore,
    currentUser,
  });

  currentUser = loadCurrentUser();

  if (!currentUser) {
    renderLogin();
    return;
  }

  await initAppAfterLogin();
}

async function initAppAfterLogin() {
  prepareConfiguration();

  const route = getCurrentRoute();
  const guarded = runRouteGuards(route, {
    currentUser,
    appConfig: appConfigForCore,
  });
  if (guarded && guarded.redirectTo) {
    window.location.hash = guarded.redirectTo;
    return;
  }

  const moduleId = activeModules.includes(route.moduleId)
    ? route.moduleId
    : activeModules[0];
  const currentSubId = route.subId || null;

  if (moduleId !== route.moduleId || currentSubId !== route.subId) {
    navigateTo(moduleId, currentSubId);
    return;
  }

  renderShell(moduleId, currentSubId);

  listenRouteChange((r) => {
    const guardedR = runRouteGuards(r, {
      currentUser,
      appConfig: appConfigForCore,
    });
    if (guardedR && guardedR.redirectTo) {
      window.location.hash = guardedR.redirectTo;
      return;
    }

    const id = activeModules.includes(r.moduleId) ? r.moduleId : activeModules[0];
    const subId = r.subId || null;
    renderShell(id, subId);
  });
}

init();
