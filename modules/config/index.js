import { registerModule } from "../../core/moduleRegistry.js";
import { loadAppConfig, saveAppConfig } from "../../core/configService.js";
import { navigateTo } from "../../core/router.js";
import { showToast } from "../../core/uiService.js";

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
        ? "Modules are detected automatically from the /modules directory (via config/modules.php). Here you can enable or disable them; configuration is stored in localStorage (app_config_v2)."
        : "Moduly jsou detekovány automaticky z adresáře /modules (přes config/modules.php). Zde je můžete zapínat/vypínat; konfigurace se ukládá do localStorage (app_config_v2).";
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
        ? "Example list of users within app_config_v2. Each user stores profile preferences either in a local folder (profiles/<login>) or in the database once connected."
        : "Ukázkový seznam uživatelů v rámci app_config_v2. Každý uživatel ukládá své preference buď do lokální složky (profiles/<login>) nebo do databáze po připojení.";
    bodyEl.appendChild(info);

    const addUserBtn = document.createElement("button");
    addUserBtn.type = "button";
    addUserBtn.className = "primary-action";
    addUserBtn.textContent = lang === "en" ? "Add user" : "Přidat uživatele";
    addUserBtn.addEventListener("click", () => openUserModal());
    bodyEl.appendChild(addUserBtn);

    const table = document.createElement("table");
    table.className = "table";
    const thead = document.createElement("thead");
    thead.innerHTML =
      lang === "en"
        ? "<tr><th>ID</th><th>User</th><th>Role</th><th>Default module</th><th>Permissions</th><th>Profile storage</th></tr>"
        : "<tr><th>ID</th><th>Uživatel</th><th>Role</th><th>Výchozí modul</th><th>Oprávnění</th><th>Úložiště profilu</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);
    bodyEl.appendChild(table);

    function renderUsersTable() {
      tbody.innerHTML = "";
      users.forEach((u) => {
        const defaultModule = (u.appConfig && u.appConfig.defaultModule) || "config";
        const permissionSummary =
          u.permissions && Object.keys(u.permissions).length
            ? Object.keys(u.permissions)
                .map((mId) => `${mId}: ${u.permissions[mId]}`)
                .join(", ")
            : lang === "en"
            ? "Inherited"
            : "Dědí z role";
        const storageLabel =
          u.storage === "database"
            ? lang === "en" ? "Database" : "Databáze"
            : (lang === "en" ? "Local: " : "Lokální: ") + (u.profilePath || "-");
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${u.id}</td><td>${u.username}</td><td>${u.role}</td><td>${defaultModule}</td><td>${permissionSummary}</td><td>${storageLabel}</td>`;
        tbody.appendChild(tr);
      });
    }

    renderUsersTable();

    function openUserModal() {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";

      const dialog = document.createElement("div");
      dialog.className = "modal";

      const header = document.createElement("div");
      header.className = "modal-header";
      const title = document.createElement("h3");
      title.textContent = lang === "en" ? "New user" : "Nový uživatel";
      header.appendChild(title);

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "modal-close";
      closeBtn.innerHTML = "&times;";
      closeBtn.addEventListener("click", () => closeModal());
      header.appendChild(closeBtn);

      dialog.appendChild(header);

      const form = document.createElement("form");
      form.className = "form-vertical";

      const inputUser = document.createElement("input");
      inputUser.placeholder = lang === "en" ? "Username" : "Uživatelské jméno";
      inputUser.required = true;

      const inputPass = document.createElement("input");
      inputPass.type = "password";
      inputPass.placeholder = lang === "en" ? "Password" : "Heslo";
      inputPass.required = true;

      const roleSelect = document.createElement("select");
      [
        { value: "admin", labelCs: "Administrátor", labelEn: "Administrator" },
        { value: "manager", labelCs: "Manažer", labelEn: "Manager" },
        { value: "user", labelCs: "Uživatel", labelEn: "User" },
        { value: "viewer", labelCs: "Pouze čtení", labelEn: "Viewer" },
      ].forEach((role) => {
        const option = document.createElement("option");
        option.value = role.value;
        option.textContent = lang === "en" ? role.labelEn : role.labelCs;
        roleSelect.appendChild(option);
      });

      const roleLabel = document.createElement("label");
      roleLabel.textContent = lang === "en" ? "Role" : "Role";
      roleLabel.appendChild(roleSelect);

      const permSection = document.createElement("div");
      permSection.className = "permissions-section";
      const permTitle = document.createElement("p");
      permTitle.className = "muted";
      permTitle.textContent =
        lang === "en"
          ? "Module permissions"
          : "Oprávnění pro jednotlivé moduly";
      permSection.appendChild(permTitle);

      const permissionControls = new Map();

      knownModules.forEach((mod) => {
        const row = document.createElement("label");
        row.className = "permission-row";
        const span = document.createElement("span");
        span.textContent = mod.label || mod.id;
        const select = document.createElement("select");
        [
          { value: "none", labelCs: "Bez přístupu", labelEn: "No access" },
          { value: "read", labelCs: "Čtení", labelEn: "Read" },
          { value: "manage", labelCs: "Plný přístup", labelEn: "Full access" },
        ].forEach((perm) => {
          const opt = document.createElement("option");
          opt.value = perm.value;
          opt.textContent = lang === "en" ? perm.labelEn : perm.labelCs;
          if (mod.id === "config" && perm.value !== "manage") {
            opt.disabled = true;
          }
          select.appendChild(opt);
        });
        if (mod.id === "config") {
          select.value = "manage";
        } else {
          select.value = "read";
        }
        permissionControls.set(mod.id, select);
        row.appendChild(span);
        row.appendChild(select);
        permSection.appendChild(row);
      });

      const submitBtn = document.createElement("button");
      submitBtn.type = "submit";
      submitBtn.textContent = lang === "en" ? "Create user" : "Vytvořit uživatele";

      form.appendChild(inputUser);
      form.appendChild(inputPass);
      form.appendChild(roleLabel);
      form.appendChild(permSection);
      form.appendChild(submitBtn);

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const username = inputUser.value.trim();
        if (!username) return;
        const password = inputPass.value;
        const role = roleSelect.value || "user";
        const permissions = {};
        permissionControls.forEach((ctrl, moduleId) => {
          permissions[moduleId] = ctrl.value;
        });

        const nextId = users.length ? users[users.length - 1].id + 1 : 1;
        const defaultModule =
          Object.keys(permissions).find((m) => permissions[m] !== "none") || "config";
        const profilePath = `/profiles/${username}`;
        const newUser = {
          id: nextId,
          username,
          password,
          role,
          permissions,
          profilePath,
          storage: "localFolder",
          appConfig: { defaultModule },
          modules: {},
        };

        users = [...users, newUser];
        appConfig.users = users;
        renderUsersTable();
        closeModal();
      });

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          closeModal();
        }
      });

      dialog.appendChild(form);
      overlay.appendChild(dialog);
      document.body.classList.add("modal-open");
      document.body.appendChild(overlay);
      inputUser.focus();

      function closeModal() {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        document.body.classList.remove("modal-open");
      }
    }
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
