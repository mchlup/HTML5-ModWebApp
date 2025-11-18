const APP_CONFIG_STORAGE_KEY = "app_config_v2";
let cachedAppConfig = null;

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
  if (cachedAppConfig) {
    return {
      enabledModules: Array.isArray(cachedAppConfig.enabledModules)
        ? cachedAppConfig.enabledModules
        : [],
      moduleConfig: cachedAppConfig.moduleConfig || {},
      users: Array.isArray(cachedAppConfig.users) ? cachedAppConfig.users : [],
    };
  }
  return {
    enabledModules: null,
    moduleConfig: {},
    users: [],
  };
}

export function saveAppConfig(cfg) {
  if (!cfg || !Array.isArray(cfg.enabledModules)) {
    console.warn("Neplatná konfigurace pro uložení", cfg);
    return;
  }
  cachedAppConfig = {
    enabledModules: cfg.enabledModules,
    moduleConfig: cfg.moduleConfig || {},
    users: Array.isArray(cfg.users) ? cfg.users : [],
  };
  return fetch("./config/modules.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabledModules: cfg.enabledModules }),
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error("Chyba při ukládání konfigurace na serveru");
      }
      return res.json();
    })
    .then((data) => {
      if (!data.success) {
        console.error("Uložení konfigurace selhalo:", data.message);
      }
    })
    .catch((err) => {
      console.error("Chyba komunikace při ukládání konfigurace:", err);
    });
}

export function setAppConfigCache(config) {
  cachedAppConfig = config;
}
