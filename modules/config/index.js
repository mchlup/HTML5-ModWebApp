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
    { id: "database", labels: { cs: "Databáze", en: "Database" } },
    { id: "users", labels: { cs: "Uživatelé", en: "Users" } },
    { id: "permissions", labels: { cs: "Oprávnění", en: "Permissions" } },
  ],
};

function renderConfig(container, ctx) {
  const lang = (ctx && ctx.language) || "cs";
  const allowedTabs = ["modules", "database", "users", "permissions"];
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
  let databaseConfig = {
    driver: "postgres",
    host: "localhost",
    port: 5432,
    database: "crm_demo",
    username: "crm_admin",
    password: "",
    ssl: false,
    ...((appConfig && appConfig.database) || {}),
  };
  let databaseStatus = { state: "idle", message: "" };
  appConfig.moduleConfig = appConfig.moduleConfig || {};

  const tabsEl = document.createElement("div");
  tabsEl.className = "tabs";

  const tabDefs = [
    { id: "modules", label: lang === "en" ? "Modules" : "Moduly" },
    { id: "database", label: lang === "en" ? "Database" : "Databáze" },
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
    appConfig.database = databaseConfig;
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

  function renderDatabaseSection() {
    bodyEl.innerHTML = "";

    const info = document.createElement("p");
    info.className = "muted";
    info.textContent =
      lang === "en"
        ? "Configure the database connection that stores users, permissions and other shared data."
        : "Nastavte připojení k databázi, která uchovává uživatele, oprávnění a další sdílená data.";
    bodyEl.appendChild(info);

    const form = document.createElement("div");
    form.className = "database-form";

    function createField(labelText, inputEl, description) {
      const wrapper = document.createElement("label");
      wrapper.className = "database-field";
      const label = document.createElement("span");
      label.textContent = labelText;
      wrapper.appendChild(label);
      wrapper.appendChild(inputEl);
      if (description) {
        const small = document.createElement("small");
        small.className = "muted";
        small.textContent = description;
        wrapper.appendChild(small);
      }
      return wrapper;
    }

    const driverSelect = document.createElement("select");
    [
      { value: "postgres", labelCs: "PostgreSQL", labelEn: "PostgreSQL" },
      { value: "mysql", labelCs: "MySQL/MariaDB", labelEn: "MySQL/MariaDB" },
      { value: "sqlite", labelCs: "SQLite", labelEn: "SQLite (soubor)" },
    ].forEach((driver) => {
      const option = document.createElement("option");
      option.value = driver.value;
      option.textContent = lang === "en" ? driver.labelEn : driver.labelCs;
      driverSelect.appendChild(option);
    });
    driverSelect.value = databaseConfig.driver || "postgres";
    driverSelect.addEventListener("change", () => {
      databaseConfig.driver = driverSelect.value;
      updatePreview();
    });
    form.appendChild(
      createField(
        lang === "en" ? "Driver" : "Databázový server",
        driverSelect,
        lang === "en"
          ? "Choose which engine the application will use."
          : "Zvolte databázový stroj, který aplikace používá."
      )
    );

    const hostInput = document.createElement("input");
    hostInput.placeholder = "db.example.cz";
    hostInput.value = databaseConfig.host || "";
    hostInput.addEventListener("input", () => {
      databaseConfig.host = hostInput.value.trim();
      updatePreview();
    });
    form.appendChild(
      createField(lang === "en" ? "Host" : "Hostitel", hostInput)
    );

    const portInput = document.createElement("input");
    portInput.type = "number";
    portInput.min = "0";
    portInput.max = "65535";
    portInput.value = databaseConfig.port || "";
    portInput.addEventListener("input", () => {
      const value = parseInt(portInput.value, 10);
      databaseConfig.port = Number.isFinite(value) ? value : "";
      updatePreview();
    });
    form.appendChild(
      createField(lang === "en" ? "Port" : "Port", portInput)
    );

    const nameInput = document.createElement("input");
    nameInput.placeholder = "crm_demo";
    nameInput.value = databaseConfig.database || "";
    nameInput.addEventListener("input", () => {
      databaseConfig.database = nameInput.value.trim();
      updatePreview();
    });
    form.appendChild(
      createField(lang === "en" ? "Database" : "Databáze", nameInput)
    );

    const userInput = document.createElement("input");
    userInput.placeholder = "crm_admin";
    userInput.value = databaseConfig.username || "";
    userInput.addEventListener("input", () => {
      databaseConfig.username = userInput.value.trim();
      updatePreview();
    });
    form.appendChild(
      createField(lang === "en" ? "User" : "Uživatel", userInput)
    );

    const passwordInput = document.createElement("input");
    passwordInput.type = "password";
    passwordInput.placeholder = lang === "en" ? "Password" : "Heslo";
    passwordInput.value = databaseConfig.password || "";
    passwordInput.addEventListener("input", () => {
      databaseConfig.password = passwordInput.value;
    });
    form.appendChild(
      createField(lang === "en" ? "Password" : "Heslo", passwordInput)
    );

    const sslWrapper = document.createElement("label");
    sslWrapper.className = "database-checkbox";
    const sslInput = document.createElement("input");
    sslInput.type = "checkbox";
    sslInput.checked = !!databaseConfig.ssl;
    sslInput.addEventListener("change", () => {
      databaseConfig.ssl = !!sslInput.checked;
      updatePreview();
    });
    const sslSpan = document.createElement("span");
    sslSpan.textContent =
      lang === "en"
        ? "Encrypt connection (SSL/TLS)"
        : "Šifrovat spojení (SSL/TLS)";
    sslWrapper.appendChild(sslInput);
    sslWrapper.appendChild(sslSpan);
    form.appendChild(sslWrapper);

    bodyEl.appendChild(form);

    const preview = document.createElement("pre");
    preview.className = "database-preview";
    bodyEl.appendChild(preview);

    const actions = document.createElement("div");
    actions.className = "database-actions";

    const testBtn = document.createElement("button");
    testBtn.type = "button";
    testBtn.textContent = lang === "en" ? "Test connection" : "Otestovat spojení";

    const createBtn = document.createElement("button");
    createBtn.type = "button";
    createBtn.textContent =
      lang === "en" ? "Provision database" : "Vytvořit databázi/tabulky";

    actions.appendChild(testBtn);
    actions.appendChild(createBtn);
    bodyEl.appendChild(actions);

    const statusPanel = document.createElement("div");
    statusPanel.className = "database-status";
    bodyEl.appendChild(statusPanel);

    const linkingPanel = document.createElement("div");
    linkingPanel.className = "database-links";
    const linkTitle = document.createElement("h4");
    linkTitle.textContent = lang === "en" ? "Linked modules" : "Napojení modulů";
    const linkDescription = document.createElement("p");
    linkDescription.textContent =
      lang === "en"
        ? "Users and permissions reuse this connection. Update credentials here whenever the DB server changes."
        : "Moduly Uživatelé a Oprávnění sdílí toto připojení. Pokud změníte server, upravte údaje zde.";
    const linkButtons = document.createElement("div");
    linkButtons.className = "database-links-actions";

    function createNavBtn(targetTab, labelCs, labelEn) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = lang === "en" ? labelEn : labelCs;
      btn.addEventListener("click", () => {
        currentTab = targetTab;
        navigateTo("config", targetTab);
        renderTabs();
        renderBody();
      });
      return btn;
    }

    linkButtons.appendChild(createNavBtn("users", "Přejít do Uživatelů", "Open Users"));
    linkButtons.appendChild(
      createNavBtn(
        "permissions",
        "Přejít do Oprávnění",
        "Open Permissions"
      )
    );

    linkingPanel.appendChild(linkTitle);
    linkingPanel.appendChild(linkDescription);
    linkingPanel.appendChild(linkButtons);
    bodyEl.appendChild(linkingPanel);

    function updatePreview() {
      const host = databaseConfig.host || "localhost";
      const port = databaseConfig.port || 5432;
      const db = databaseConfig.database || "database";
      const user = databaseConfig.username || "user";
      const driver = databaseConfig.driver || "postgres";
      const sslParam = databaseConfig.ssl ? "?ssl=1" : "";
      preview.textContent = `${driver}://${user}@${host}:${port}/${db}${sslParam}`;
    }

    function updateStatusPanel() {
      statusPanel.innerHTML = "";
      const heading = document.createElement("strong");
      heading.textContent = lang === "en" ? "Status" : "Stav";
      const message = document.createElement("p");
      let text = lang === "en" ? "Waiting for action." : "Čeká se na akci.";
      if (databaseStatus.state === "testing") {
        text =
          lang === "en"
            ? "Testing connection..."
            : "Probíhá testování spojení...";
      } else if (databaseStatus.state === "provisioning") {
        text =
          lang === "en"
            ? "Creating schema..."
            : "Vytváří se databázové tabulky...";
      } else if (databaseStatus.state === "ready") {
        text =
          databaseStatus.message ||
          (lang === "en"
            ? "Database connection is ready."
            : "Databázové připojení je připraveno.");
      } else if (databaseStatus.state === "error") {
        text = databaseStatus.message;
      }
      message.textContent = text;
      statusPanel.appendChild(heading);
      statusPanel.appendChild(message);
    }

    function runDatabaseAction(type) {
      databaseStatus = {
        state: type === "test" ? "testing" : "provisioning",
        message: "",
      };
      updateStatusPanel();
      testBtn.disabled = true;
      createBtn.disabled = true;
      setTimeout(() => {
        const success = Boolean(databaseConfig.host && databaseConfig.database);
        if (success) {
          databaseStatus = {
            state: "ready",
            message:
              type === "test"
                ? lang === "en"
                  ? "Connection succeeded."
                  : "Spojení se podařilo."
                : lang === "en"
                ? "Schema created (users, permissions)."
                : "Schéma vytvořeno (uživatelé, oprávnění).",
          };
          showToast(
            lang === "en"
              ? "Database action finished"
              : "Databázová akce dokončena"
          );
        } else {
          databaseStatus = {
            state: "error",
            message:
              lang === "en"
                ? "Fill in host and database name before running the action."
                : "Než spustíte akci, doplňte hostitele a název databáze.",
          };
        }
        updateStatusPanel();
        testBtn.disabled = false;
        createBtn.disabled = false;
      }, 800);
    }

    testBtn.addEventListener("click", () => runDatabaseAction("test"));
    createBtn.addEventListener("click", () => runDatabaseAction("provision"));

    updatePreview();
    updateStatusPanel();
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

    const dbSummary = document.createElement("div");
    dbSummary.className = "config-tip";
    const dbHeadline = document.createElement("strong");
    dbHeadline.textContent =
      lang === "en" ? "Database target" : "Cílová databáze";
    const dbText = document.createElement("p");
    dbText.textContent =
      (databaseConfig.host
        ? `${databaseConfig.host}:${databaseConfig.port || 5432}/${
            databaseConfig.database || ""}`
        : lang === "en"
        ? "Database connection is not configured yet."
        : "Databázové připojení zatím není nastaveno.") +
      " " +
      (lang === "en"
        ? "User profiles stored in database reuse these credentials."
        : "Uživatelé, kteří ukládají profil do databáze, využijí tyto údaje.");
    const dbBtn = document.createElement("button");
    dbBtn.type = "button";
    dbBtn.textContent = lang === "en" ? "Open database tab" : "Otevřít záložku Databáze";
    dbBtn.addEventListener("click", () => {
      currentTab = "database";
      navigateTo("config", "database");
      renderTabs();
      renderBody();
    });
    dbSummary.appendChild(dbHeadline);
    dbSummary.appendChild(dbText);
    dbSummary.appendChild(dbBtn);
    bodyEl.appendChild(dbSummary);

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
            ? (lang === "en" ? "Database" : "Databáze") +
              ` (${databaseConfig.host || "localhost"}/${
                databaseConfig.database || "-"})`
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

      const storageSelect = document.createElement("select");
      const localOption = document.createElement("option");
      localOption.value = "localFolder";
      localOption.textContent = lang === "en" ? "Local folder" : "Lokální složka";
      const dbOption = document.createElement("option");
      dbOption.value = "database";
      dbOption.textContent = lang === "en" ? "Database" : "Databáze";
      const dbAvailable = Boolean(databaseConfig.host && databaseConfig.database);
      if (!dbAvailable) {
        dbOption.disabled = true;
      }
      storageSelect.appendChild(localOption);
      storageSelect.appendChild(dbOption);
      storageSelect.value = dbAvailable ? "database" : "localFolder";

      const storageLabel = document.createElement("label");
      storageLabel.textContent = lang === "en" ? "Profile storage" : "Úložiště profilu";
      storageLabel.appendChild(storageSelect);
      const storageHint = document.createElement("small");
      storageHint.className = "muted";
      storageHint.textContent = dbAvailable
        ? lang === "en"
          ? "Database connection from the Databáze tab will be used."
          : "Využije se připojení definované v záložce Databáze."
        : lang === "en"
        ? "Configure the database tab to enable shared storage."
        : "Pro sdílené úložiště nastavte nejprve záložku Databáze.";
      storageLabel.appendChild(storageHint);

      const submitBtn = document.createElement("button");
      submitBtn.type = "submit";
      submitBtn.textContent = lang === "en" ? "Create user" : "Vytvořit uživatele";

      form.appendChild(inputUser);
      form.appendChild(inputPass);
      form.appendChild(roleLabel);
      form.appendChild(permSection);
      form.appendChild(storageLabel);
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
        const storage = storageSelect.value;

        const nextId = users.length ? users[users.length - 1].id + 1 : 1;
        const defaultModule =
          Object.keys(permissions).find((m) => permissions[m] !== "none") || "config";
        const profilePath =
          storage === "database"
            ? `${databaseConfig.host || "db"}/${databaseConfig.database || "profiles"}`
            : `/profiles/${username}`;
        const newUser = {
          id: nextId,
          username,
          password,
          role,
          permissions,
          profilePath,
          storage,
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

    const dbReminder = document.createElement("div");
    dbReminder.className = "config-tip";
    const reminderTitle = document.createElement("strong");
    reminderTitle.textContent = lang === "en" ? "Data source" : "Zdroj dat";
    const reminderText = document.createElement("p");
    reminderText.textContent =
      lang === "en"
        ? "Once the Databáze tab is configured, permissions can be persisted to the same schema as users."
        : "Jakmile nastavíte záložku Databáze, mohou se oprávnění ukládat do stejného schématu jako uživatelé.";
    const reminderBtn = document.createElement("button");
    reminderBtn.type = "button";
    reminderBtn.textContent = lang === "en" ? "Configure database" : "Nastavit databázi";
    reminderBtn.addEventListener("click", () => {
      currentTab = "database";
      navigateTo("config", "database");
      renderTabs();
      renderBody();
    });
    dbReminder.appendChild(reminderTitle);
    dbReminder.appendChild(reminderText);
    dbReminder.appendChild(reminderBtn);
    bodyEl.appendChild(dbReminder);
  }

  function renderBody() {
    if (currentTab === "modules") renderModulesSection();
    else if (currentTab === "database") renderDatabaseSection();
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
