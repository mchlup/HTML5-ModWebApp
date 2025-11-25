import labels from './lang_cs.js';
import { registerModule } from "../../core/moduleRegistry.js";
import {
  ensureRuntimeConfig,
  saveRuntimeConfig,
  setRuntimeConfig,
  loadRuntimeConfig,
  loadModuleConfig,
  getRuntimeConfig,
} from "../../core/configManager.js";
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
    { id: "module-settings", labels: { cs: "Konfigurace modulů", en: "Module settings" } },
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

function createBadge(text, tone = "info") {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.style.background = tone === "success" ? "#065f46" : tone === "danger" ? "#7f1d1d" : "";
  badge.style.color = tone === "success" || tone === "danger" ? "#f8fafc" : "";
  badge.textContent = text;
  return badge;
}

function createHint(text) {
  const hint = document.createElement("small");
  hint.className = "muted";
  hint.textContent = text;
  return hint;
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

    const header = document.createElement("div");
    header.className = "flex-row";
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "flex-start";
    label.style.gap = "0.5rem";
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
    const textWrap = document.createElement("div");
    const title = document.createElement("div");
    title.className = "strong";
    const metaLabel =
      (mod.meta && mod.meta.labels && (mod.meta.labels[lang] || mod.meta.labels.cs)) ||
      mod.name ||
      mod.id;
    title.textContent = metaLabel;
    textWrap.appendChild(title);
    const metaLine = document.createElement("div");
    metaLine.className = "muted";
    const infoPieces = [mod.id && `ID: ${mod.id}`];
    if (mod.version) infoPieces.push(`${lang === "en" ? "Version" : "Verze"}: ${mod.version}`);
    if (mod.category) infoPieces.push(`${lang === "en" ? "Category" : "Kategorie"}: ${mod.category}`);
    metaLine.textContent = infoPieces.filter(Boolean).join(" • ");
    textWrap.appendChild(metaLine);
    if (mod.description) {
      const desc = document.createElement("div");
      desc.className = "muted";
      desc.textContent = mod.description;
      textWrap.appendChild(desc);
    }
    label.appendChild(textWrap);
    header.appendChild(label);
    row.appendChild(header);
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

async function renderDatabaseTab(container, lang, runtimeConfig) {
  container.appendChild(createSectionTitle(lang === "en" ? "Database" : "Databáze"));
  const card = document.createElement("div");
  card.className = "card";

  const statusRow = document.createElement("div");
  statusRow.className = "form-field";
  const badge = createBadge(
    runtimeConfig?.dbAvailable
      ? lang === "en" ? "Database online" : "Databáze dostupná"
      : lang === "en" ? "Database offline" : "Databáze nedostupná",
    runtimeConfig?.dbAvailable ? "success" : "danger"
  );
  statusRow.appendChild(badge);
  statusRow.appendChild(
    createHint(
      lang === "en"
        ? "Stav načtený z backendu nebo lokální konfigurace."
        : "Stav načtený z backendu nebo lokální konfigurace."
    )
  );
  card.appendChild(statusRow);

  const feedback = document.createElement("div");
  feedback.className = "muted";
  feedback.style.marginBottom = "0.5rem";
  card.appendChild(feedback);

  const form = document.createElement("form");
  form.className = "form-grid";
  form.innerHTML = `
    <label>Driver<span class="muted"> *</span><select name="driver" required>
      <option value="mysql">MySQL</option>
      <option value="postgres">PostgreSQL</option>
      <option value="sqlite">SQLite</option>
    </select></label>
    <label>Host<span class="muted"> *</span><input name="host" value="localhost" placeholder="např. db.example.com" required></label>
    <label>Port<input name="port" type="number" min="0" placeholder="3306"></label>
    <label>Název DB<input name="database" placeholder="flexo" required></label>
    <label>Uživatel<input name="username" placeholder="db_user" required></label>
    <label>Heslo<input name="password" type="password" placeholder="••••••"></label>
    <div class="form-actions">
      <button type="submit" data-action="save">Uložit konfiguraci</button>
      <button type="button" data-action="test">Otestovat spojení</button>
    </div>
  `;

  const saveBtn = form.querySelector('[data-action="save"]');
  const testBtn = form.querySelector('[data-action="test"]');

  function setBusy(isBusy, message) {
    [saveBtn, testBtn].forEach((btn) => {
      btn.disabled = isBusy;
      btn.textContent = isBusy ? (message || "...") : btn.getAttribute("data-action") === "test" ? "Otestovat spojení" : "Uložit konfiguraci";
    });
    feedback.textContent = message || "";
  }

  function renderResult(text, tone = "info") {
    feedback.innerHTML = "";
    const badgeEl = createBadge(text, tone === "danger" ? "danger" : tone === "success" ? "success" : "info");
    feedback.appendChild(badgeEl);
  }

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
      renderResult(lang === 'en' ? 'Konfigurace načtena' : 'Konfigurace načtena', 'success');
    } catch (err) {
      console.error(err);
      renderResult(err.message || 'Načtení selhalo', 'danger');
      showToast(err.message || 'Načtení selhalo', { type: 'error' });
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    try {
      setBusy(true, lang === 'en' ? 'Ukládám…' : 'Ukládám…');
      const res = await requestWithCsrf('./config/database.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Uložení selhalo');
      renderResult(data.message || 'Konfigurace DB uložena.', 'success');
      showToast('Konfigurace DB uložena.');
      await loadRuntimeConfig({ force: true });
    } catch (err) {
      console.error(err);
      renderResult(err.message || 'Uložení selhalo', 'danger');
      showToast(err.message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  });

  form.querySelector('[data-action="test"]').addEventListener('click', async () => {
    const payload = Object.fromEntries(new FormData(form));
    try {
      setBusy(true, lang === 'en' ? 'Testuji spojení…' : 'Testuji spojení…');
      const res = await requestWithCsrf('./config/database.php?action=test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Test selhal');
      renderResult(data.message || 'Připojení úspěšné.', 'success');
      showToast(data.message || 'Připojení úspěšné.');
    } catch (err) {
      console.error(err);
      renderResult(err.message || 'Test selhal', 'danger');
      showToast(err.message, { type: 'error' });
    } finally {
      setBusy(false);
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

  const text = document.createElement("p");
  text.textContent =
    lang === "en"
      ? "Správa oprávnění byla přesunuta do Administrace, aby byla po ruce s uživateli."
      : "Správa oprávnění byla přesunuta do Administrace, aby byla po ruce s uživateli.";
  card.appendChild(text);

  const action = document.createElement("div");
  action.className = "form-actions";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = lang === "en" ? "Přejít do administrace" : "Přejít do administrace";
  btn.addEventListener("click", () => {
    window.location.hash = "#/admin/permissions";
  });
  action.appendChild(btn);
  card.appendChild(action);

  container.appendChild(card);
}

async function renderModuleSettingsTab(container, lang, appConfig) {
  container.appendChild(createSectionTitle(lang === "en" ? "Module settings" : "Konfigurace modulů"));
  const card = document.createElement("div");
  card.className = "card";

  const info = document.createElement("p");
  info.textContent =
    lang === "en"
      ? "Moduly s vlastním config.js mohou definovat schéma nastavení. Zde je můžete upravit."
      : "Moduly s vlastním config.js mohou definovat schéma nastavení. Zde je můžete upravit.";
  card.appendChild(info);

  const list = document.createElement("div");
  list.className = "form-grid";
  card.appendChild(list);

  const modules = Array.isArray(appConfig.modules) ? appConfig.modules : [];
  const moduleConfigs = await Promise.all(
    modules.map(async (mod) => ({
      mod,
      config: await loadModuleConfig(mod.id).catch(() => null),
    }))
  );

  const configurable = moduleConfigs.filter((item) => item.config?.settingsSchema?.fields?.length);
  if (!configurable.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = lang === "en" ? "Žádné moduly nemají konfigurační schéma." : "Žádné moduly nemají konfigurační schéma.";
    card.appendChild(empty);
    container.appendChild(card);
    return;
  }

  configurable.forEach(({ mod, config }) => {
    const formWrap = document.createElement("div");
    formWrap.className = "form-field";
    const title = document.createElement("div");
    title.className = "strong";
    title.textContent = config?.name || mod.name || mod.id;
    formWrap.appendChild(title);
    if (config?.description) {
      formWrap.appendChild(createHint(config.description));
    }

    const form = document.createElement("form");
    form.className = "form-grid";
    const currentValues = getRuntimeConfig().moduleConfig?.[mod.id] || {};

    (config.settingsSchema.fields || []).forEach((field) => {
      const wrapper = document.createElement("label");
      wrapper.textContent = field.label || field.key;
      if (field.type === "select" && Array.isArray(field.options)) {
        const select = document.createElement("select");
        select.name = field.key;
        field.options.forEach((opt) => {
          const option = document.createElement("option");
          option.value = opt.value;
          option.textContent = opt.label;
          if (currentValues[field.key] === opt.value) option.selected = true;
          select.appendChild(option);
        });
        wrapper.appendChild(select);
      } else if (field.type === "checkbox") {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.name = field.key;
        input.checked = Boolean(currentValues[field.key]);
        wrapper.appendChild(input);
      } else {
        const input = document.createElement("input");
        input.type = field.type || "text";
        input.name = field.key;
        input.value = currentValues[field.key] ?? "";
        if (field.placeholder) input.placeholder = field.placeholder;
        if (field.min !== undefined) input.min = field.min;
        wrapper.appendChild(input);
      }
      if (field.helpText) {
        wrapper.appendChild(createHint(field.helpText));
      }
      form.appendChild(wrapper);
    });

    const actions = document.createElement("div");
    actions.className = "form-actions";
    const save = document.createElement("button");
    save.type = "submit";
    save.textContent = lang === "en" ? "Uložit" : "Uložit";
    actions.appendChild(save);
    form.appendChild(actions);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const values = {};
      (config.settingsSchema.fields || []).forEach((field) => {
        if (field.type === "checkbox") {
          values[field.key] = formData.get(field.key) === "on";
        } else if (field.type === "number") {
          const raw = formData.get(field.key);
          values[field.key] = raw === null || raw === "" ? null : Number(raw);
        } else {
          values[field.key] = formData.get(field.key);
        }
      });
      const current = getRuntimeConfig();
      setRuntimeConfig({ ...current, moduleConfig: { ...current.moduleConfig, [mod.id]: values } });
      showToast(lang === "en" ? "Module settings saved" : "Nastavení modulu uloženo.");
    });

    formWrap.appendChild(form);
    list.appendChild(formWrap);
  });

  container.appendChild(card);
}

async function render(container, ctx) {
  const lang = (ctx && ctx.language) || getLanguage();
  const tab = (ctx && ctx.currentSubId) || "modules";
  const cfg = await ensureRuntimeConfig();

  const tabs = document.createElement("div");
  tabs.className = "tabs";
  const definitions = [
    { id: "modules", label: lang === "en" ? "Modules" : "Moduly" },
    { id: "module-settings", label: lang === "en" ? "Module settings" : "Konfigurace modulů" },
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
      renderDatabaseTab(body, lang, cfg);
    } else if (currentTab === "permissions") {
      renderPermissionsTab(body, lang);
    } else if (currentTab === "module-settings") {
      renderModuleSettingsTab(body, lang, cfg);
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
