import labels from './lang_cs.js';
import { registerModule } from "../../core/moduleRegistry.js";
import { ensureRuntimeConfig, saveRuntimeConfig, setRuntimeConfig, loadRuntimeConfig } from "../../core/configManager.js";
import { getAllModules } from "../../core/moduleRegistry.js";
import { setLanguage, getLanguage } from "../../core/languageManager.js";
import { toggleTheme, getTheme } from "../../core/themeManager.js";
import { showToast } from "../../core/uiService.js";
import { requestWithCsrf } from "../../core/authService.js";

const CONFIG_META = {
  id: "config",
  iconClass: "fa-solid fa-sliders",
  labels: { cs: "Konfigurace", en: "Configuration" },
  navItems: [
    { id: "modules", labels: { cs: "Moduly", en: "Modules" } },
    { id: "appearance", labels: { cs: "Vzhled", en: "Appearance" } },
    { id: "database", labels: { cs: "Databáze", en: "Database" } },
    { id: "permissions", labels: { cs: "Oprávnění", en: "Permissions" } },
  ],
};

function createSectionTitle(text) {
  const title = document.createElement("div");
  title.className = "section-title";
  title.textContent = text;
  return title;
}

function renderModulesTab(container, lang, appConfig) {
  container.appendChild(createSectionTitle(lang === "en" ? "Modules" : "Moduly"));
  const enabledSet = new Set(appConfig.enabledModules || []);
  const manifest = Array.isArray(appConfig.modules) && appConfig.modules.length ? appConfig.modules : getAllModules();

  const list = document.createElement("div");
  list.className = "card";

  manifest.forEach((mod) => {
    const row = document.createElement("div");
    row.className = "form-field";
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = enabledSet.size ? enabledSet.has(mod.id) : true;
    checkbox.addEventListener("change", async () => {
      if (checkbox.checked) {
        enabledSet.add(mod.id);
      } else {
        enabledSet.delete(mod.id);
      }
      const next = Array.from(enabledSet);
      setRuntimeConfig({ ...appConfig, enabledModules: next });
      const ok = await saveRuntimeConfig({ enabledModules: next });
      if (!ok) {
        showToast(lang === "en" ? "Saving failed" : "Uložení selhalo", { type: "error" });
      }
    });
    label.appendChild(checkbox);
    const span = document.createElement("span");
    const metaLabel =
      (mod.meta && mod.meta.labels && (mod.meta.labels[lang] || mod.meta.labels.cs)) ||
      mod.name ||
      mod.id;
    span.textContent = metaLabel;
    label.appendChild(span);
    row.appendChild(label);
    list.appendChild(row);
  });

  container.appendChild(list);
}

function renderAppearanceTab(container, lang) {
  container.appendChild(createSectionTitle(lang === "en" ? "Appearance" : "Vzhled"));
  const card = document.createElement("div");
  card.className = "card";

  const themeRow = document.createElement("div");
  themeRow.className = "form-field";
  const themeLabel = document.createElement("label");
  themeLabel.textContent = lang === "en" ? "Theme" : "Motiv";
  const themeBtn = document.createElement("button");
  themeBtn.type = "button";
  function updateThemeBtn() {
    const theme = getTheme();
    themeBtn.textContent = theme === "dark" ? "Přepnout na světlý" : "Přepnout na tmavý";
  }
  updateThemeBtn();
  themeBtn.addEventListener("click", () => {
    toggleTheme();
    updateThemeBtn();
  });
  themeRow.appendChild(themeLabel);
  themeRow.appendChild(themeBtn);
  card.appendChild(themeRow);

  const langRow = document.createElement("div");
  langRow.className = "form-field";
  const langLabel = document.createElement("label");
  langLabel.textContent = lang === "en" ? "Language" : "Jazyk";
  const select = document.createElement("select");
  [
    { value: "cs", label: "Čeština" },
    { value: "en", label: "English" },
  ].forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === getLanguage()) option.selected = true;
    select.appendChild(option);
  });
  select.addEventListener("change", () => {
    setLanguage(select.value);
  });
  langRow.appendChild(langLabel);
  langRow.appendChild(select);
  card.appendChild(langRow);

  container.appendChild(card);
}

async function renderDatabaseTab(container, lang) {
  container.appendChild(createSectionTitle(lang === "en" ? "Database" : "Databáze"));
  const card = document.createElement("div");
  card.className = "card";

  const form = document.createElement("form");
  form.className = "form-grid";
  form.innerHTML = `
    <label>Driver<select name="driver">
      <option value="mysql">MySQL</option>
      <option value="postgres">PostgreSQL</option>
      <option value="sqlite">SQLite</option>
    </select></label>
    <label>Host<input name="host" value="localhost"></label>
    <label>Port<input name="port" type="number" min="0"></label>
    <label>Název DB<input name="database"></label>
    <label>Uživatel<input name="username"></label>
    <label>Heslo<input name="password" type="password"></label>
    <div class="form-actions">
      <button type="submit">Uložit konfiguraci</button>
      <button type="button" data-action="test">Otestovat spojení</button>
    </div>
  `;

  async function loadConfig() {
    try {
      const res = await fetch('./config/database.php', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Načtení selhalo');
      if (data.config) {
        form.driver.value = data.config.driver || 'mysql';
        form.host.value = data.config.host || '';
        form.port.value = data.config.port || '';
        form.database.value = data.config.database || '';
        form.username.value = data.config.username || '';
      }
    } catch (err) {
      showToast(err.message, { type: 'error' });
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    try {
      const res = await requestWithCsrf('./config/database.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Uložení selhalo');
      showToast('Konfigurace DB uložena.');
    } catch (err) {
      showToast(err.message, { type: 'error' });
    }
  });

  form.querySelector('[data-action="test"]').addEventListener('click', async () => {
    const payload = Object.fromEntries(new FormData(form));
    try {
      const res = await requestWithCsrf('./config/database.php?action=test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Test selhal');
      showToast(data.message || 'Připojení úspěšné.');
    } catch (err) {
      showToast(err.message, { type: 'error' });
    }
  });

  card.appendChild(form);
  container.appendChild(card);
  loadConfig();
}

async function renderPermissionsTab(container, lang) {
  container.appendChild(createSectionTitle(lang === "en" ? "Permissions" : "Oprávnění"));
  const card = document.createElement("div");
  card.className = "card";
  card.textContent = lang === "en" ? "Loading permissions..." : "Načítám oprávnění...";

  async function loadPermissions() {
    try {
      const res = await fetch('./config/permissions.php', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Načtení selhalo');
      const roles = new Set(['user', 'admin', 'super-admin']);
      (data.users || []).forEach((u) => roles.add(u.role));
      const modules = data.modules || [];
      const permissions = data.permissions || {};

      card.innerHTML = '';
      const table = document.createElement('table');
      table.className = 'permissions-table';
      const header = document.createElement('tr');
      header.innerHTML = '<th>Role</th>' + modules.map((m) => `<th>${m.id}</th>`).join('');
      table.appendChild(header);

      const levels = ['none', 'read', 'manage', 'full'];
      roles.forEach((role) => {
        const tr = document.createElement('tr');
        const label = document.createElement('td');
        label.textContent = role;
        tr.appendChild(label);
        modules.forEach((mod) => {
          const td = document.createElement('td');
          const select = document.createElement('select');
          levels.forEach((level) => {
            const opt = document.createElement('option');
            opt.value = level;
            opt.textContent = level;
            if ((permissions[role] && permissions[role][mod.id]) === level) opt.selected = true;
            select.appendChild(opt);
          });
          td.appendChild(select);
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });
      card.appendChild(table);

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.textContent = lang === 'en' ? 'Save permissions' : 'Uložit oprávnění';
      saveBtn.addEventListener('click', async () => {
        const payload = {};
        const rows = Array.from(table.querySelectorAll('tr')).slice(1);
        rows.forEach((rowEl) => {
          const role = rowEl.querySelector('td')?.textContent || '';
          payload[role] = {};
          const selects = rowEl.querySelectorAll('select');
          modules.forEach((mod, idx) => {
            payload[role][mod.id] = selects[idx].value;
          });
        });
        try {
          const res = await requestWithCsrf('./config/permissions.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permissions: payload }),
          });
          const data = await res.json();
          if (!res.ok || data.success === false) throw new Error(data.message || 'Uložení selhalo');
          showToast('Oprávnění uložena.');
        } catch (err) {
          showToast(err.message, { type: 'error' });
        }
      });
      card.appendChild(saveBtn);
    } catch (err) {
      card.textContent = err.message;
    }
  }

  container.appendChild(card);
  loadPermissions();
}

async function render(container, ctx) {
  const lang = (ctx && ctx.language) || getLanguage();
  const tab = (ctx && ctx.currentSubId) || "modules";
  const cfg = await ensureRuntimeConfig();

  const tabs = document.createElement("div");
  tabs.className = "tabs";
  const definitions = [
    { id: "modules", label: lang === "en" ? "Modules" : "Moduly" },
    { id: "appearance", label: lang === "en" ? "Appearance" : "Vzhled" },
    { id: "database", label: lang === "en" ? "Database" : "Databáze" },
    { id: "permissions", label: lang === "en" ? "Permissions" : "Oprávnění" },
  ];
  let currentTab = tab;
  const body = document.createElement("div");
  body.className = "card";

  function rerenderBody() {
    body.innerHTML = "";
    if (currentTab === "appearance") {
      renderAppearanceTab(body, lang);
    } else if (currentTab === "database") {
      renderDatabaseTab(body, lang);
    } else if (currentTab === "permissions") {
      renderPermissionsTab(body, lang);
    } else {
      renderModulesTab(body, lang, cfg);
    }
  }

  const buttons = [];
  definitions.forEach((def) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    if (def.id === currentTab) btn.classList.add("active");
    btn.textContent = def.label;
    btn.addEventListener("click", () => {
      currentTab = def.id;
      buttons.forEach((b) => {
        b.classList.toggle("active", b.dataset.tab === currentTab);
      });
      rerenderBody();
    });
    btn.dataset.tab = def.id;
    buttons.push(btn);
    tabs.appendChild(btn);
  });

  container.innerHTML = "";
  container.appendChild(tabs);
  rerenderBody();
  container.appendChild(body);
}

export default {
  register() {
    registerModule("config", {
      id: "config",
      meta: CONFIG_META,
      render,
    });
  },
  meta: CONFIG_META,
  render,
};
