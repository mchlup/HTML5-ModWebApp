import { STORAGE_KEYS } from "./constants.js";
import { get as getStore, set as setStore } from "./storageManager.js";
import { showToast } from "./uiService.js";
import { requestWithCsrf } from "./authService.js";

const APP_CONFIG_URL = "./config/app.php";
const MODULES_ENDPOINT = "./config/modules.php";

let runtimeConfig = {
  enabledModules: [],
  moduleConfig: {},
  users: [],
  permissions: {},
  modules: [],
  dbAvailable: false,
};
let appDefinition = null;

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function normalizeRuntimeConfig(cfg) {
  const enabled = Array.isArray(cfg?.enabledModules) ? cfg.enabledModules : [];
  return {
    enabledModules: enabled,
    moduleConfig: cfg?.moduleConfig || {},
    users: Array.isArray(cfg?.users) ? cfg.users : [],
    permissions: cfg?.permissions || {},
    modules: Array.isArray(cfg?.modules) ? cfg.modules : [],
    dbAvailable: Boolean(cfg?.dbAvailable),
  };
}

function persistRuntimeConfig(cfg) {
  runtimeConfig = normalizeRuntimeConfig(cfg || {});
  setStore(STORAGE_KEYS.APP_CONFIG, runtimeConfig);
  return runtimeConfig;
}

export async function loadAppDefinition() {
  if (appDefinition) return appDefinition;
  const cached = getStore(STORAGE_KEYS.APP_DEFINITION);
  if (cached) {
    appDefinition = cached;
    return appDefinition;
  }
  try {
    const def = await fetchJson(APP_CONFIG_URL, { headers: { Accept: "application/json" } });
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
  const cached = getStore(STORAGE_KEYS.APP_CONFIG);
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
    const data = await fetchJson(MODULES_ENDPOINT, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (data && data.success === false) {
      throw new Error(data.message || "Načtení konfigurace selhalo");
    }
    const modules = Array.isArray(data?.modules) ? data.modules : [];
    const enabledFromResponse = Array.isArray(data?.enabledModules) ? data.enabledModules : null;
    const enabledModules =
      enabledFromResponse && enabledFromResponse.length
        ? enabledFromResponse
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
  if (
    runtimeConfig &&
    Array.isArray(runtimeConfig.enabledModules) &&
    runtimeConfig.enabledModules.length &&
    Array.isArray(runtimeConfig.modules) &&
    runtimeConfig.modules.length
  ) {
    return runtimeConfig;
  }
  const cached = getStore(STORAGE_KEYS.APP_CONFIG);
  if (cached) {
    runtimeConfig = normalizeRuntimeConfig(cached);
    if (runtimeConfig.enabledModules.length && runtimeConfig.modules.length) return runtimeConfig;
  }
  const loaded = await loadRuntimeConfig();
  if (loaded && loaded.enabledModules.length) {
    return loaded;
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
      return await fetchJson(jsonPath, { headers: { Accept: "application/json" } });
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
  const payload = Array.isArray(config?.enabledModules) ? config.enabledModules : [];
  try {
    const res = await requestWithCsrf(MODULES_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ enabledModules: payload }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data?.message || "Uložení selhalo");
    }
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
  runtimeConfig = { enabledModules: [], moduleConfig: {}, users: [], permissions: {}, modules: [], dbAvailable: false };
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
