import { loadAppConfig, saveAppConfig } from "../core/configService.js";

// helper pro toast notifikaci
function showToast(message) {
  const el = document.createElement("div");
  el.className = "toast-notification";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 2600);
}

export function renderConfig(container, ctx) {
  const knownModules = [
    { id: "config", label: "Konfigurace", fixed: true },
    { id: "crm", label: "CRM – zákazníci" },
    { id: "erp", label: "ERP – objednávky" },
  ];

  let currentTab = "modules"; // modules | users | permissions

  // Načíst appConfig přes službu a případně využít kontext z jádra
  let appConfig = loadAppConfig();
  if (!Array.isArray(appConfig.enabledModules) || !appConfig.enabledModules.length) {
    if (ctx && Array.isArray(ctx.activeModules)) {
      appConfig.enabledModules = [...ctx.activeModules];
    } else {
      appConfig.enabledModules = knownModules.map((m) => m.id);
    }
  }

  let users = Array.isArray(appConfig.users) ? appConfig.users : [];
  if ((!users.length) && ctx && ctx.appConfig && Array.isArray(ctx.appConfig.users)) {
    users = [...ctx.appConfig.users];
  }

  const tabsEl = document.createElement("div");
  tabsEl.className = "tabs";

  const tabDefs = [
    { id: "modules", label: "Moduly" },
    { id: "users", label: "Uživatelé" },
    { id: "permissions", label: "Oprávnění (náčrt)" },
  ];

  const headerBar = document.createElement("div");
  headerBar.style.display = "flex";
  headerBar.style.justifyContent = "space-between";
  headerBar.style.alignItems = "center";
  headerBar.style.marginBottom = "0.5rem";
  headerBar.style.gap = "0.5rem";

  const title = document.createElement("div");
  title.className = "section-title";
  title.textContent = "Konfigurace aplikace";
  headerBar.appendChild(title);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Uložit konfiguraci";
  saveBtn.style.padding = "0.35rem 0.9rem";
  saveBtn.style.borderRadius = "999px";
  saveBtn.style.border = "none";
  saveBtn.style.background = "#16a34a";
  saveBtn.style.color = "#f9fafb";
  saveBtn.style.cursor = "pointer";
  saveBtn.addEventListener("click", () => {
    appConfig.users = users;
    saveAppConfig(appConfig);
    showToast("Konfigurace uložena");
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
      "Změny se ukládají do localStorage (app_config_v2). Modul „Konfigurace“ je vždy aktivní. Po změně konfigurace může být potřeba obnovit stránku (F5).";
    bodyEl.appendChild(info);

    const table = document.createElement("table");
    table.className = "table";
    const thead = document.createElement("thead");
    thead.innerHTML =
      "<tr><th>Aktivní</th><th>ID</th><th>Název</th><th>Modulová konfigurace</th></tr>";
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
      if (m.fixed) {
        cb.disabled = true;
      }
      cb.addEventListener("change", () => {
        if (cb.checked) {
          enabledSet.add(m.id);
        } else {
          enabledSet.delete(m.id);
        }
        enabledSet.add("config");
        appConfig.enabledModules = Array.from(enabledSet);
      });

      tdCheck.appendChild(cb);
      tdId.textContent = m.id;
      tdLabel.textContent = m.label;

      if (m.id === "crm") {
        const input = document.createElement("input");
        input.placeholder = "Výchozí město (modul CRM)";
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
        input.placeholder = "Výchozí měna (modul ERP, např. CZK)";
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
        tdCfg.innerHTML = '<span class="muted">Žádná specifická konfigurace</span>';
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
      "Ukázkový seznam uživatelů v rámci app_config_v2. Budoucí verze může používat databázi a hesla, zde jde o model: uživatel má vlastní konfiguraci aplikace a modulů.";
    bodyEl.appendChild(info);

    const form = document.createElement("form");
    form.className = "form-vertical";

    const inputUser = document.createElement("input");
    inputUser.placeholder = "Uživatelské jméno";
    inputUser.required = true;

    const inputRole = document.createElement("input");
    inputRole.placeholder = "Role (např. admin, user)";
    inputRole.value = "user";

    const inputDefaultModule = document.createElement("input");
    inputDefaultModule.placeholder = "Výchozí modul (např. crm)";
    inputDefaultModule.value = "crm";

    const btn = document.createElement("button");
    btn.type = "submit";
    btn.textContent = "Přidat uživatele";

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
      "<tr><th>ID</th><th>Uživatel</th><th>Role</th><th>Výchozí modul</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);
    bodyEl.appendChild(table);

    function renderUsersTable() {
      tbody.innerHTML = "";
      users.forEach((u) => {
        const defaultModule =
          (u.appConfig && u.appConfig.defaultModule) || "crm";
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
      "Tato sekce slouží jako náčrt systému oprávnění. V budoucnu může obsahovat matici <strong>uživatel × modul × práva</strong> (view/edit/admin). " +
      "Zatím jsou data jen ilustrační a práva se nikde v UI neaplikují.";
    bodyEl.appendChild(info);

    const table = document.createElement("table");
    table.className = "table";
    table.innerHTML =
      "<thead><tr><th>Uživatel</th><th>Role</th><th>Konfigurace modulů</th></tr></thead>";
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    users.forEach((u) => {
      const tr = document.createElement("tr");
      const modulesCfg =
        u.modules && Object.keys(u.modules).length
          ? Object.entries(u.modules)
              .map(([modId, cfg]) => `${modId}: ${JSON.stringify(cfg)}`)
              .join("; ")
          : "zatím nedefinováno";
      tr.innerHTML = `<td>${u.username}</td><td>${u.role}</td><td>${modulesCfg}</td>`;
      tbody.appendChild(tr);
    });

    bodyEl.appendChild(table);
  }

  function renderBody() {
    if (currentTab === "modules") {
      renderModulesSection();
    } else if (currentTab === "users") {
      renderUsersSection();
    } else {
      renderPermissionsSection();
    }
  }

  // Hlavička + taby + obsah
  container.appendChild(headerBar);
  renderTabs();
  container.appendChild(tabsEl);
  renderBody();
  container.appendChild(bodyEl);
}
