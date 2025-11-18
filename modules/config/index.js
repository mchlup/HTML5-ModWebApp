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
  const knownModules = [
    { id: "config", label: "Konfigurace", fixed: true },
    { id: "crm", label: "CRM – zákazníci" },
    { id: "erp", label: "ERP – objednávky" },
  ];

  const lang = (ctx && ctx.language) || "cs";
  const allowedTabs = ["modules", "users", "permissions"];
  let currentTab = (ctx && ctx.currentSubId) || "modules";
  if (!allowedTabs.includes(currentTab)) currentTab = "modules";

  let appConfig = loadAppConfig();
  if (!Array.isArray(appConfig.enabledModules) || !appConfig.enabledModules.length) {
    if (ctx && Array.isArray(ctx.activeModules)) {
      appConfig.enabledModules = [...ctx.activeModules];
    } else {
      appConfig.enabledModules = knownModules.map((m) => m.id);
    }
  }

  let users = Array.isArray(appConfig.users) ? appConfig.users : [];
  if (!users.length && ctx && ctx.appConfig && Array.isArray(ctx.appConfig.users)) {
    users = [...ctx.appConfig.users];
  }

  appConfig.moduleConfig = appConfig.moduleConfig || {};
  appConfig.moduleConfig.crm = appConfig.moduleConfig.crm || {};
  appConfig.moduleConfig.erp = appConfig.moduleConfig.erp || {};

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
        ? "Changes are stored in localStorage (app_config_v2). Module “Configuration” is always active. You may need to reload the page (F5) after changes."
        : "Změny se ukládají do localStorage (app_config_v2). Modul „Konfigurace“ je vždy aktivní. Po změně konfigurace může být potřeba obnovit stránku (F5).";
    bodyEl.appendChild(info);

    const table = document.createElement("table");
    table.className = "table";
    const thead = document.createElement("thead");
    thead.innerHTML =
      lang === "en"
        ? "<tr><th>Active</th><th>ID</th><th>Name</th><th>Module configuration</th></tr>"
        : "<tr><th>Aktivní</th><th>ID</th><th>Název</th><th>Modulová konfigurace</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    const enabledSet = new Set(appConfig.enabledModules || []);

    knownModules.forEach((m) => {
      const tr = document.createElement("tr");
      const tdCheck = document.createElement("td");
      const tdId = document.createElement("td");
      const tdLabel = document.createElement("td");
      const tdCfg = document.createElement("td");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = enabledSet.has(m.id) || m.fixed;
      if (m.fixed) cb.disabled = true;
      cb.addEventListener("change", () => {
        if (cb.checked) enabledSet.add(m.id);
        else enabledSet.delete(m.id);
        enabledSet.add("config");
        appConfig.enabledModules = Array.from(enabledSet);
      });

      tdCheck.appendChild(cb);
      tdId.textContent = m.id;
      tdLabel.textContent = m.label;

      if (m.id === "crm") {
        const input = document.createElement("input");
        input.placeholder =
          lang === "en" ? "Default city (CRM module)" : "Výchozí město (modul CRM)";
        const moduleCfg = appConfig.moduleConfig.crm || {};
        input.value = moduleCfg.defaultCity || "";
        input.addEventListener("input", () => {
          appConfig.moduleConfig.crm = {
            ...appConfig.moduleConfig.crm,
            defaultCity: input.value,
          };
        });
        tdCfg.appendChild(input);
      } else if (m.id === "erp") {
        const input = document.createElement("input");
        input.placeholder =
          lang === "en"
            ? "Default currency (ERP module, e.g. CZK)"
            : "Výchozí měna (modul ERP, např. CZK)";
        const moduleCfg = appConfig.moduleConfig.erp || {};
        input.value = moduleCfg.defaultCurrency || "CZK";
        input.addEventListener("input", () => {
          appConfig.moduleConfig.erp = {
            ...appConfig.moduleConfig.erp,
            defaultCurrency: input.value,
          };
        });
        tdCfg.appendChild(input);
      } else {
        tdCfg.innerHTML =
          '<span class="muted">' +
          (lang === "en" ? "No specific configuration" : "Žádná specifická konfigurace") +
          "</span>";
      }

      tr.appendChild(tdCheck);
      tr.appendChild(tdId);
      tr.appendChild(tdLabel);
      tr.appendChild(tdCfg);
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
        ? "Example list of users within app_config_v2. Future versions can use database and passwords; here it demonstrates that each user can have own application and module configuration."
        : "Ukázkový seznam uživatelů v rámci app_config_v2. Budoucí verze může používat databázi a hesla, zde jde o model: uživatel má vlastní konfiguraci aplikace a modulů.";
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
    inputDefaultModule.value = "crm";

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
      const defaultModule = inputDefaultModule.value.trim() || "crm";
      if (!username) return;

      const nextId = users.length ? users[users.length - 1].id + 1 : 1;
      const u = {
        id: nextId,
        username,
        role,
        appConfig: {
          defaultModule,
        },
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
        const defaultModule = (u.appConfig && u.appConfig.defaultModule) || "crm";
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
        ? "This section is a sketch of the permission system. In future it can hold a matrix <strong>user × module × rights</strong> (view/edit/admin). Currently it is only illustrative data; no permissions are applied in the UI."
        : "Tato sekce slouží jako náčrt systému oprávnění. V budoucnu může obsahovat matici <strong>uživatel × modul × práva</strong> (view/edit/admin). Zatím jsou data jen ilustrační a práva se nikde v UI neaplikují.";
    bodyEl.appendChild(info);

    const table = document.createElement("table");
    table.className = "table";
    table.innerHTML =
      lang === "en"
        ? "<thead><tr><th>User</th><th>Role</th><th>Module configuration</th></tr></thead>"
        : "<thead><tr><th>Uživatel</th><th>Role</th><th>Konfigurace modulů</th></tr></thead>";
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    users.forEach((u) => {
      const tr = document.createElement("tr");
      const modulesCfg =
        u.modules && Object.keys(u.modules).length
          ? Object.entries(u.modules)
              .map(([modId, cfg]) => `${modId}: ${JSON.stringify(cfg)}`)
              .join("; ")
          : lang === "en"
            ? "not defined yet"
            : "zatím nedefinováno";
      tr.innerHTML = `<td>${u.username}</td><td>${u.role}</td><td>${modulesCfg}</td>`;
      tbody.appendChild(tr);
    });

    bodyEl.appendChild(table);
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
