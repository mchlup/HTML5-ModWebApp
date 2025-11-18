import { registerModule } from "../../core/moduleRegistry.js";
import { loadAppConfig, saveAppConfig } from "../../core/configService.js";
import { navigateTo } from "../../core/router.js";

const CONFIG_META = {
  id: "config",
  iconClass: "fa-solid fa-sliders",
  labels: {
    cs: "Konfigurace",
    en: "Configuration",
  },
  navItems: [
    { id: "modules", labels: { cs: "Moduly", en: "Modules" } },
    { id: "users", labels: { cs: "Uživatelé", en: "Users" } },
    { id: "permissions", labels: { cs: "Oprávnění", en: "Permissions" } },
  ],
};

function showToast(message) {
  const el = document.createElement("div");
  el.className = "toast-notification";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 2600);
}

function renderConfig(container, ctx) {
  const lang = (ctx && ctx.language) || "cs";
  const allowedTabs = ["modules", "users", "permissions"];
  let currentTab = (ctx && ctx.currentSubId) || "modules";
  if (!allowedTabs.includes(currentTab)) currentTab = "modules";

  let appConfig = loadAppConfig();
  let knownModules = (ctx && ctx.moduleRegistry)
    ? Object.keys(ctx.moduleRegistry).map((id) => ({
        id,
        label: (ctx.moduleRegistry[id].meta &&
                ctx.moduleRegistry[id].meta.labels &&
                (ctx.moduleRegistry[id].meta.labels[lang] ||
                 ctx.moduleRegistry[id].meta.labels["cs"])) || id
      }))
    : [];

  // Ujistíme se, že konfigurace obsahuje alespoň modul config
  if (!knownModules.find((m) => m.id === "config")) {
    knownModules.unshift({ id: "config", label: "Konfigurace" });
  }

  if (!Array.isArray(appConfig.enabledModules) || !appConfig.enabledModules.length) {
    appConfig.enabledModules = knownModules.map((m) => m.id);
  }

  let users = Array.isArray(appConfig.users) ? appConfig.users : [];
  appConfig.moduleConfig = appConfig.moduleConfig || {};

  const tabsEl = document.createElement("div");
  tabsEl.className = "tabs";

  const tabDefs = [
    { id: "modules", label: lang === "en" ? "Modules" : "Moduly" },
    { id: "users", label: lang === "en" ? "Users" : "Uživatelé" },
    { id: "permissions", label: lang === "en" ? "Permissions (sketch)" : "Oprávnění (náčrt)" },
  ];

  const headerBar = document.createElement("div");
  headerBar.style.display = "flex";
  headerBar.style.justifyContent = "space-between";
  headerBar.style.alignItems = "center";
  headerBar.style.marginBottom = "0.5rem";
  headerBar.style.gap = "0.5rem";

  const title = document.createElement("div");
  title.className = "section-title";
  title.textContent = lang === "en" ? "Application configuration" : "Konfigurace aplikace";
  headerBar.appendChild(title);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = lang === "en" ? "Save configuration" : "Uložit konfiguraci";
  saveBtn.addEventListener("click", () => {
    appConfig.users = users;
    saveAppConfig(appConfig);
    showToast(lang === "en" ? "Configuration saved" : "Konfigurace uložena");
  });
  headerBar.appendChild(saveBtn);

  function renderTabs() {
    tabsEl.innerHTML = "";
    tabDefs.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab" + (t.id === currentTab ? " active" : "");
      btn.textContent = t.label;
      btn.addEventListener("click", () => {
        currentTab = t.id;
        navigateTo("config", currentTab);
        renderBody();
        renderTabs();
      });
      tabsEl.appendChild(btn);
    });
  }

  const bodyEl = document.createElement("div");

  function renderModulesSection() {
    bodyEl.innerHTML = "";

    const info = document.createElement("p");
    info.className = "muted";
    info.textContent =
      lang === "en"
        ? "Modules are detected automatically from the /modules directory (via config/modules.php). Here you can enable or disable them and adjust per-module configuration stored in localStorage (app_config_v2)."
        : "Moduly jsou detekovány automaticky z adresáře /modules (přes config/modules.php). Zde je můžete zapínat/vypínat a upravovat jejich konfiguraci, která se ukládá v localStorage (app_config_v2).";
    bodyEl.appendChild(info);

    const table = document.createElement("table");
    table.className = "table";
    const thead = document.createElement("thead");
    thead.innerHTML =
      lang === "en"
        ? "<tr><th>Active</th><th>ID</th><th>Name</th></tr>"
        : "<tr><th>Aktivní</th><th>ID</th><th>Název</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    const enabledSet = new Set(appConfig.enabledModules || []);

    knownModules.forEach((m) => {
      const tr = document.createElement("tr");
      const tdCheck = document.createElement("td");
      const tdId = document.createElement("td");
      const tdLabel = document.createElement("td");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = enabledSet.has(m.id);
      if (m.id === "config") cb.disabled = true;
      cb.addEventListener("change", () => {
        if (cb.checked) enabledSet.add(m.id);
        else enabledSet.delete(m.id);
        enabledSet.add("config");
        appConfig.enabledModules = Array.from(enabledSet);
      });

      tdCheck.appendChild(cb);
      tdId.textContent = m.id;
      tdLabel.textContent = m.label;

      tr.appendChild(tdCheck);
      tr.appendChild(tdId);
      tr.appendChild(tdLabel);
      tbody.appendChild(tr);
    });

    bodyEl.appendChild(table);
  }

  function renderUsersSection() {
    bodyEl.innerHTML = "";

    const info = document.createElement("p");
    info.className = "muted";
    info.textContent =
      lang === "en"
        ? "Example list of users within app_config_v2. Each user may have own configuration in future."
        : "Ukázkový seznam uživatelů v rámci app_config_v2. Každý uživatel může mít do budoucna vlastní konfiguraci.";
    bodyEl.appendChild(info);

    const form = document.createElement("form");
    form.className = "form-vertical";

    const inputUser = document.createElement("input");
    inputUser.placeholder = lang === "en" ? "Username" : "Uživatelské jméno";
    inputUser.required = true;

    const inputRole = document.createElement("input");
    inputRole.placeholder = lang === "en" ? "Role (e.g. admin, user)" : "Role (např. admin, user)";
    inputRole.value = "user";

    const inputDefaultModule = document.createElement("input");
    inputDefaultModule.placeholder =
      lang === "en" ? "Default module (e.g. crm)" : "Výchozí modul (např. crm)";
    inputDefaultModule.value = "config";

    const btn = document.createElement("button");
    btn.type = "submit";
    btn.textContent = lang === "en" ? "Add user" : "Přidat uživatele";

    form.appendChild(inputUser);
    form.appendChild(inputRole);
    form.appendChild(inputDefaultModule);
    form.appendChild(btn);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = inputUser.value.trim();
      const role = inputRole.value.trim() || "user";
      const defaultModule = inputDefaultModule.value.trim() || "config";
      if (!username) return;

      const nextId = users.length ? users[users.length - 1].id + 1 : 1;
      const u = {
        id: nextId,
        username,
        role,
        appConfig: { defaultModule },
        modules: {},
      };
      users = [...users, u];
      appConfig.users = users;
      inputUser.value = "";
      renderUsersTable();
    });

    bodyEl.appendChild(form);

    const table = document.createElement("table");
    table.className = "table";
    const thead = document.createElement("thead");
    thead.innerHTML =
      lang === "en"
        ? "<tr><th>ID</th><th>User</th><th>Role</th><th>Default module</th></tr>"
        : "<tr><th>ID</th><th>Uživatel</th><th>Role</th><th>Výchozí modul</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);
    bodyEl.appendChild(table);

    function renderUsersTable() {
      tbody.innerHTML = "";
      users.forEach((u) => {
        const defaultModule = (u.appConfig && u.appConfig.defaultModule) || "config";
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${u.id}</td><td>${u.username}</td><td>${u.role}</td><td>${defaultModule}</td>`;
        tbody.appendChild(tr);
      });
    }

    renderUsersTable();
  }

  function renderPermissionsSection() {
    bodyEl.innerHTML = "";
    const info = document.createElement("p");
    info.className = "muted";
    info.innerHTML =
      lang === "en"
        ? "This section is a sketch of a permission system (user × module × rights). Currently it is only illustrative."
        : "Tato sekce je pouze náčrtem systému oprávnění (uživatel × modul × práva). Zatím slouží jen ilustračnímu účelu.";
    bodyEl.appendChild(info);
  }

  function renderBody() {
    if (currentTab === "modules") renderModulesSection();
    else if (currentTab === "users") renderUsersSection();
    else renderPermissionsSection();
  }

  container.appendChild(headerBar);
  renderTabs();
  container.appendChild(tabsEl);
  renderBody();
  container.appendChild(bodyEl);
}

registerModule({
  id: CONFIG_META.id,
  meta: CONFIG_META,
  render: renderConfig,
});
