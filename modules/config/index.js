import { registerModule } from "../../core/moduleRegistry.js";
import { ensureRuntimeConfig, saveEnabledModules, setRuntimeConfig } from "../../core/configManager.js";
import { getAllModules } from "../../core/moduleRegistry.js";
import { setLanguage, getLanguage } from "../../core/languageManager.js";
import { toggleTheme, getTheme } from "../../core/themeManager.js";
import { showToast } from "../../core/uiService.js";

const CONFIG_META = {
  id: "config",
  iconClass: "fa-solid fa-sliders",
  labels: { cs: "Konfigurace", en: "Configuration" },
  navItems: [
    { id: "modules", labels: { cs: "Moduly", en: "Modules" } },
    { id: "appearance", labels: { cs: "Vzhled", en: "Appearance" } },
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
  const registry = getAllModules();

  const list = document.createElement("div");
  list.className = "card";

  registry.forEach((mod) => {
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
      const ok = await saveEnabledModules(next);
      if (!ok) {
        showToast(lang === "en" ? "Saving failed" : "Uložení selhalo", { type: "error" });
      }
    });
    label.appendChild(checkbox);
    const span = document.createElement("span");
    span.textContent = (mod.meta && mod.meta.labels && (mod.meta.labels[lang] || mod.meta.labels.cs)) || mod.id;
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

async function render(container, ctx) {
  const lang = (ctx && ctx.language) || getLanguage();
  const tab = (ctx && ctx.currentSubId) || "modules";
  const cfg = await ensureRuntimeConfig();

  const tabs = document.createElement("div");
  tabs.className = "tabs";
  const definitions = [
    { id: "modules", label: lang === "en" ? "Modules" : "Moduly" },
    { id: "appearance", label: lang === "en" ? "Appearance" : "Vzhled" },
  ];
  let currentTab = tab;
  const body = document.createElement("div");
  body.className = "card";

  function rerenderBody() {
    body.innerHTML = "";
    if (currentTab === "appearance") {
      renderAppearanceTab(body, lang);
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
