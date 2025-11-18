const APP_CONFIG_STORAGE_KEY = "app_config_v2";

export async function loadAppDefinition() {
  try {
    const res = await fetch("./config/app.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    return {
      superAdmin: json.superAdmin || { username: "admin", password: "admin" },
      defaultEnabledModules: Array.isArray(json.defaultEnabledModules)
        ? json.defaultEnabledModules
        : null,
      modules: json.modules || {},
    };
  } catch (err) {
    console.error("Chyba při načítání config/app.json:", err);
    return {
      superAdmin: { username: "admin", password: "admin" },
      defaultEnabledModules: null,
      modules: {},
    };
  }
}

export function loadAppConfig() {
  try {
    const raw = localStorage.getItem(APP_CONFIG_STORAGE_KEY);
    if (!raw) {
      return {
        enabledModules: null,
        moduleConfig: {},
        users: [],
      };
    }
    const json = JSON.parse(raw);
    return {
      enabledModules: Array.isArray(json.enabledModules)
        ? json.enabledModules
        : null,
      moduleConfig:
        json.moduleConfig && typeof json.moduleConfig === "object"
          ? json.moduleConfig
          : {},
      users: Array.isArray(json.users) ? json.users : [],
    };
  } catch (err) {
    console.warn("Chyba při čtení app_config_v2:", err);
    return {
      enabledModules: null,
      moduleConfig: {},
      users: [],
    };
  }
}

export function saveAppConfig(cfg) {
  try {
    const toSave = {
      enabledModules: cfg.enabledModules || null,
      moduleConfig: cfg.moduleConfig || {},
      users: cfg.users || [],
    };
    localStorage.setItem(APP_CONFIG_STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.warn("Chyba při zápisu app_config_v2:", err);
  }
}
