import { loadAllModules } from "./core/moduleLoader.js";
import { getAllModules, getModule } from "./core/moduleRegistry.js";
import { loadAppConfig } from "./core/configManager.js";
import { initTheme, toggleTheme, getTheme } from "./core/themeManager.js";
import { getLanguage, setLanguage } from "./core/languageManager.js";
import { on as onEvent } from "./core/eventBus.js";

const root = document.getElementById("app-root");
const SIDEBAR_STATE_KEY = "app_sidebar_state_v2";
let appConfig = { enabledModules: [], moduleConfig: {}, users: [] };
let modulesLoaded = false;
let currentUser = null;
let isSidebarCollapsed = false;

function getRoute() {
  const hash = window.location.hash.replace(/^#\//, "");
  const [moduleId, subId] = hash.split("/");
  return { moduleId: moduleId || "config", subId: subId || null };
}

function persistSidebarState(collapsed) {
  try {
    localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? "1" : "0");
  } catch (err) {
    console.warn("Sidebar state save failed", err);
  }
}

function loadSidebarState() {
  try {
    const v = localStorage.getItem(SIDEBAR_STATE_KEY);
    return v === "1";
  } catch (err) {
    return false;
  }
}

function resolveLabel(meta, fallback) {
  const lang = getLanguage();
  if (meta && meta.labels) {
    return meta.labels[lang] || meta.labels["cs"] || fallback;
  }
  return fallback;
}

function renderModule(container, moduleId, subId) {
  const mod = getModule(moduleId);
  if (mod && typeof mod.render === "function") {
    container.innerHTML = "";
    mod.render(container, {
      language: getLanguage(),
      currentSubId: subId,
      config: appConfig.moduleConfig[moduleId] || {},
      moduleRegistry: getAllModules().reduce((acc, m) => {
        acc[m.id] = m;
        return acc;
      }, {}),
    });
  } else {
    container.textContent = "Modul nebyl nalezen.";
  }
}

function renderShell() {
  const { moduleId, subId } = getRoute();
  const registry = getAllModules();
  const container = document.createElement("div");
  container.className = "app-shell";

  const sidebar = document.createElement("aside");
  sidebar.className = "app-sidebar";
  if (isSidebarCollapsed) sidebar.classList.add("app-sidebar-collapsed");

  const sidebarHeader = document.createElement("div");
  sidebarHeader.className = "sidebar-header";
  const logo = document.createElement("div");
  logo.className = "app-logo-wrap";
  const logoIcon = document.createElement("div");
  logoIcon.className = "app-logo-icon";
  logoIcon.innerHTML = '<i class="fa-solid fa-layer-group"></i>';
  const logoText = document.createElement("div");
  logoText.className = "app-logo-text";
  logoText.textContent = "Flexo";
  logo.appendChild(logoIcon);
  logo.appendChild(logoText);
  sidebarHeader.appendChild(logo);

  const sidebarToggle = document.createElement("button");
  sidebarToggle.type = "button";
  sidebarToggle.className = "sidebar-toggle";
  function updateToggleUi() {
    if (isSidebarCollapsed) {
      sidebarToggle.innerHTML = '<i class="fa-solid fa-angles-right" aria-hidden="true"></i>';
      sidebar.classList.add("app-sidebar-collapsed");
    } else {
      sidebarToggle.innerHTML = '<i class="fa-solid fa-angles-left" aria-hidden="true"></i>';
      sidebar.classList.remove("app-sidebar-collapsed");
    }
  }
  sidebarToggle.addEventListener("click", () => {
    isSidebarCollapsed = !isSidebarCollapsed;
    persistSidebarState(isSidebarCollapsed);
    updateToggleUi();
  });
  updateToggleUi();
  sidebarHeader.appendChild(sidebarToggle);
  sidebar.appendChild(sidebarHeader);

  const nav = document.createElement("nav");
  nav.className = "app-nav";
  let enabled = appConfig.enabledModules && appConfig.enabledModules.length
    ? appConfig.enabledModules.filter((id) => getModule(id))
    : registry.map((m) => m.id);
  if (!enabled.length) {
    enabled = registry.map((m) => m.id);
  }
  enabled.forEach((id) => {
    const entry = getModule(id);
    if (!entry) return;
    const item = document.createElement("div");
    item.className = "nav-item";
    if (id === moduleId) item.classList.add("active");
    if (entry.meta && Array.isArray(entry.meta.navItems) && entry.meta.navItems.length) {
      item.classList.add("has-submenu");
    }
    const link = document.createElement("a");
    link.href = `#/${id}`;
    const iconWrap = document.createElement("span");
    iconWrap.className = "nav-icon";
    iconWrap.innerHTML = `<i class="${entry.meta?.iconClass || "fa-solid fa-circle"}"></i>`;
    const labelSpan = document.createElement("span");
    labelSpan.className = "nav-label";
    labelSpan.textContent = resolveLabel(entry.meta, entry.id || id);
    link.appendChild(iconWrap);
    link.appendChild(labelSpan);
    if (entry.meta && Array.isArray(entry.meta.navItems) && entry.meta.navItems.length) {
      const chevron = document.createElement("span");
      chevron.className = "nav-chevron";
      chevron.innerHTML = '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>';
      link.appendChild(chevron);
    }
    item.appendChild(link);

    if (entry.meta && Array.isArray(entry.meta.navItems) && entry.meta.navItems.length) {
      const sub = document.createElement("div");
      sub.className = "nav-submenu";
      entry.meta.navItems.forEach((subItem) => {
        const subDiv = document.createElement("div");
        subDiv.className = "nav-subitem";
        const subLink = document.createElement("a");
        subLink.href = `#/${id}/${subItem.id}`;
        subLink.textContent = resolveLabel(subItem, subItem.id);
        if (id === moduleId && subItem.id === subId) subDiv.classList.add("active");
        subDiv.appendChild(subLink);
        sub.appendChild(subDiv);
      });
      item.appendChild(sub);
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
  avatar.textContent = (currentUser?.username || "S")[0].toUpperCase();
  const userName = document.createElement("div");
  userName.className = "user-name";
  userName.textContent = currentUser?.username || "super-admin";
  userInfo.appendChild(avatar);
  userInfo.appendChild(userName);
  userPanel.appendChild(userInfo);

  const themeToggle = document.createElement("button");
  themeToggle.className = "theme-toggle";
  themeToggle.type = "button";
  function updateThemeUi() {
    const theme = getTheme();
    themeToggle.innerHTML = `<i class="fa-solid ${theme === "dark" ? "fa-moon" : "fa-sun"}"></i><span>${theme === "dark" ? "Světlý" : "Tmavý"}</span>`;
  }
  updateThemeUi();
  themeToggle.addEventListener("click", () => {
    toggleTheme();
    updateThemeUi();
  });
  userPanel.appendChild(themeToggle);

  sidebar.appendChild(userPanel);

  const main = document.createElement("main");
  main.className = "app-main";
  const moduleContainer = document.createElement("div");
  moduleContainer.className = "app-main-inner";
  renderModule(moduleContainer, moduleId, subId);
  main.appendChild(moduleContainer);

  container.appendChild(sidebar);
  container.appendChild(main);

  root.innerHTML = "";
  root.appendChild(container);
}

function renderLogin() {
  const wrapper = document.createElement("div");
  wrapper.className = "login-root";
  const card = document.createElement("div");
  card.className = "login-card";
  const title = document.createElement("h1");
  title.className = "login-title";
  title.textContent = "Flexo";
  const subtitle = document.createElement("p");
  subtitle.className = "login-subtitle";
  subtitle.textContent = "Přihlaste se jako super-admin.";
  const form = document.createElement("form");
  form.className = "login-form";
  const inputUser = document.createElement("input");
  inputUser.placeholder = "Uživatelské jméno";
  inputUser.autocomplete = "username";
  inputUser.value = "admin";
  const inputPass = document.createElement("input");
  inputPass.type = "password";
  inputPass.placeholder = "Heslo";
  inputPass.autocomplete = "current-password";
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("./config/login.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: inputUser.value.trim(), password: inputPass.value }),
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (!data.success) throw new Error("Neplatné přihlašovací údaje");
      currentUser = data.user || { username: inputUser.value.trim() };
      await bootstrap();
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : "Nepodařilo se přihlásit.";
      error.style.display = "block";
    }
  });

  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(form);
  wrapper.appendChild(card);
  root.innerHTML = "";
  root.appendChild(wrapper);
}

async function bootstrap() {
  initTheme();
  isSidebarCollapsed = loadSidebarState();
  appConfig = await loadAppConfig();
  if (!appConfig || typeof appConfig !== "object") {
    appConfig = {};
  }
  appConfig.moduleConfig = appConfig.moduleConfig || {};
  appConfig.enabledModules = appConfig.enabledModules || [];
  await loadAllModules();
  modulesLoaded = true;
  renderShell();
}

window.addEventListener("hashchange", () => {
  if (modulesLoaded) renderShell();
});

onEvent("language:changed", () => {
  if (modulesLoaded) renderShell();
});

window.AppCore = {
  getLanguage,
  setLanguage,
  toggleTheme,
  getTheme,
};

renderLogin();
