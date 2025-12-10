import { STORAGE_KEYS, RUNTIME_CONFIG_VERSION } from "./constants.js";
import { get as getStore, set as setStore, remove as removeStore } from "./storageManager.js";
import { showToast } from "./uiService.js";
import { apiJson } from "./authService.js";

const APP_CONFIG_URL = "./config/app.php";
const MODULES_ENDPOINT = "./config/modules.php";

let runtimeConfig = {
  version: RUNTIME_CONFIG_VERSION,
  enabledModules: [],
  moduleConfig: {},
  users: [],
  permissions: {},
  modules: [],
  dbAvailable: false,
};
let appDefinition = null;

function normalizeRuntimeConfig(cfg) {
  const enabled = Array.isArray(cfg?.enabledModules) ? cfg.enabledModules : [];
  return {
    version: RUNTIME_CONFIG_VERSION,
    enabledModules: enabled,
    moduleConfig: cfg?.moduleConfig || {},
    users: Array.isArray(cfg?.users) ? cfg.users : [],
    permissions: cfg?.permissions || {},
    modules: Array.isArray(cfg?.modules) ? cfg.modules : [],
    dbAvailable: Boolean(cfg?.dbAvailable),
  };
}

function persistRuntimeConfig(cfg) {
  runtimeConfig = normalizeRuntimeConfig({ ...cfg, version: RUNTIME_CONFIG_VERSION } || {});
  setStore(STORAGE_KEYS.APP_CONFIG, runtimeConfig);
  return runtimeConfig;
}

function loadCachedRuntimeConfig() {
  const raw = getStore(STORAGE_KEYS.APP_CONFIG, { raw: true });
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== RUNTIME_CONFIG_VERSION) {
      removeStore(STORAGE_KEYS.APP_CONFIG);
      return null;
    }
    return normalizeRuntimeConfig(parsed);
  } catch (err) {
    removeStore(STORAGE_KEYS.APP_CONFIG);
    return null;
  }
}

export async function loadAppDefinition() {
  if (appDefinition) return appDefinition;
  const cached = getStore(STORAGE_KEYS.APP_DEFINITION);
  if (cached) {
    appDefinition = cached;
    return appDefinition;
  }
  try {
    const def = await apiJson(APP_CONFIG_URL);
    appDefinition = def || {};
    setStore(STORAGE_KEYS.APP_DEFINITION, appDefinition);
    return appDefinition;
  } catch (err) {
    console.error("Nepodařilo se načíst app.json", err);
    showToast("Nepodařilo se načíst konfiguraci aplikace.", { type: "error" });
    appDefinition = {};
    return appDefinition;
  }
}

export function getRuntimeConfig() {
  if (runtimeConfig && Array.isArray(runtimeConfig.enabledModules) && runtimeConfig.enabledModules.length) {
    return runtimeConfig;
  }
  const cached = loadCachedRuntimeConfig();
  if (cached) {
    runtimeConfig = normalizeRuntimeConfig(cached);
  }
  return runtimeConfig;
}

export function setRuntimeConfig(cfg) {
  return persistRuntimeConfig({ ...runtimeConfig, ...(cfg || {}) });
}

export async function loadRuntimeConfig(options = {}) {
  if (!options.force && runtimeConfig.enabledModules && runtimeConfig.enabledModules.length && runtimeConfig.modules.length) {
    return runtimeConfig;
  }
  try {
    const appDefinition = await loadAppDefinition();
    const data = await apiJson(MODULES_ENDPOINT, { credentials: "same-origin" });
    const modules = Array.isArray(data?.modules) ? data.modules : [];
    const enabledFromResponse = Array.isArray(data?.enabledModules)
      ? data.enabledModules
      : null;
    const enabledModules =
      enabledFromResponse !== null
        ? enabledFromResponse.filter(Boolean)
        : modules.map((m) => m.id).filter(Boolean);
    const permissions = data?.permissions && typeof data.permissions === "object" ? data.permissions : {};
    return persistRuntimeConfig({
      ...runtimeConfig,
      enabledModules,
      moduleConfig: appDefinition?.modules || {},
      permissions,
      modules,
      dbAvailable: Boolean(data?.dbAvailable),
    });
  } catch (err) {
    console.error("Nepodařilo se načíst runtime konfiguraci", err);
    showToast("Načtení konfigurace aplikace selhalo.", { type: "error" });
    return runtimeConfig;
  }
}

export async function ensureRuntimeConfig() {
  // Pokud už máme v paměti plnohodnotnou konfiguraci, můžeme ji použít
  if (
    runtimeConfig &&
    Array.isArray(runtimeConfig.enabledModules) &&
    runtimeConfig.enabledModules.length &&
    Array.isArray(runtimeConfig.modules) &&
    runtimeConfig.modules.length
  ) {
    return runtimeConfig;
  }

  // Zkusíme načíst cache ze storage – ale vždy se pokusíme i o refresh z backendu
  const cached = loadCachedRuntimeConfig();
  if (cached && (!runtimeConfig.enabledModules.length || !runtimeConfig.modules.length)) {
    runtimeConfig = normalizeRuntimeConfig(cached);
  }

  try {
    const loaded = await loadRuntimeConfig({ force: true });
    if (loaded && loaded.enabledModules.length) {
      return loaded;
    }
  } catch (err) {
    console.warn("Načtení runtime konfigurace z backendu selhalo, používám cache.", err);
    if (
      runtimeConfig &&
      Array.isArray(runtimeConfig.enabledModules) &&
      runtimeConfig.enabledModules.length &&
      Array.isArray(runtimeConfig.modules) &&
      runtimeConfig.modules.length
    ) {
      return runtimeConfig;
    }
  }

  const definition = await loadAppDefinition();
  const defaults = Array.isArray(definition?.defaultEnabledModules) ? definition.defaultEnabledModules : [];
  return persistRuntimeConfig({
    enabledModules: defaults,
    moduleConfig: definition?.modules || {},
  });
}

export async function loadModuleConfig(moduleName) {
  if (!moduleName) return null;
  try {
    const jsPath = `../modules/${moduleName}/config.js`;
    const jsonPath = `./modules/${moduleName}/config.json`;
    try {
      const mod = await import(jsPath);
      return mod.default || mod.config || null;
    } catch (err) {
      void err;
    }
    try {
      return await apiJson(jsonPath, { credentials: "same-origin" });
    } catch (err) {
      return null;
    }
  } catch (err) {
    console.warn("Nepodařilo se načíst config pro modul", moduleName, err);
    showToast("Nepodařilo se načíst konfiguraci modulu.", { type: "error" });
    return null;
  }
}

export async function saveRuntimeConfig(config) {
  const payload = Array.isArray(config?.enabledModules)
    ? Array.from(
        new Set(
          config.enabledModules
            .map((id) => (typeof id === "string" ? id.trim() : String(id || "")))
            .filter(Boolean)
        )
      )
    : [];
  try {
    await apiJson(MODULES_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ enabledModules: payload }),
    });
    persistRuntimeConfig({ ...runtimeConfig, enabledModules: payload });
    showToast("Konfigurace modulů byla uložena.");
    return true;
  } catch (err) {
    console.error("Chyba při ukládání konfigurace modulů", err);
    showToast("Uložení konfigurace modulů selhalo.", { type: "error" });
    return false;
  }
}

export function clearRuntimeConfig() {
  runtimeConfig = {
    version: RUNTIME_CONFIG_VERSION,
    enabledModules: [],
    moduleConfig: {},
    users: [],
    permissions: {},
    modules: [],
    dbAvailable: false,
  };
  setStore(STORAGE_KEYS.APP_CONFIG, runtimeConfig);
}

// Alias pro zpětnou kompatibilitu
export const saveEnabledModules = saveRuntimeConfig;

export default {
  loadAppDefinition,
  getRuntimeConfig,
  setRuntimeConfig,
  loadRuntimeConfig,
  ensureRuntimeConfig,
  loadModuleConfig,
  saveRuntimeConfig,
  saveEnabledModules,
  clearRuntimeConfig,
};
