import { STORAGE_KEYS } from "./constants.js";
import { get as getStore, set as setStore } from "./storageManager.js";
import { showToast } from "./uiService.js";

const APP_CONFIG_URL = "./config/app.json";
const MODULES_ENDPOINT = "./config/modules.php";

let runtimeConfig = {
  enabledModules: [],
  moduleConfig: {},
  users: [],
  permissions: {},
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
  };
}

function syncRuntimeCache(cfg) {
  runtimeConfig = normalizeRuntimeConfig(cfg || {});
  setStore(STORAGE_KEYS.APP_CONFIG, runtimeConfig);
  return runtimeConfig;
}

export async function loadAppDefinition() {
  if (appDefinition) return appDefinition;
  const cached = getStore(STORAGE_KEYS.APP_CONFIG);
  if (cached && cached.__appDefinition) {
    appDefinition = cached.__appDefinition;
    return appDefinition;
  }
  try {
    const def = await fetchJson(APP_CONFIG_URL, { headers: { Accept: "application/json" } });
    appDefinition = def || {};
    setStore(STORAGE_KEYS.APP_CONFIG, { ...getStore(STORAGE_KEYS.APP_CONFIG), __appDefinition: appDefinition });
    return appDefinition;
  } catch (err) {
    console.error("Nepodařilo se načíst app.json", err);
    showToast("Nepodařilo se načíst konfiguraci aplikace.", { type: "error" });
    appDefinition = {};
    return appDefinition;
  }
}

export function getRuntimeConfig() {
  if (runtimeConfig && Array.isArray(runtimeConfig.enabledModules)) return runtimeConfig;
  const cached = getStore(STORAGE_KEYS.APP_CONFIG);
  if (cached) {
    runtimeConfig = normalizeRuntimeConfig(cached);
  }
  return runtimeConfig;
}

export function setRuntimeConfig(cfg) {
  return syncRuntimeCache(cfg);
}

export async function ensureRuntimeConfig() {
  if (runtimeConfig && Array.isArray(runtimeConfig.enabledModules) && runtimeConfig.enabledModules.length) {
    return runtimeConfig;
  }
  const cached = getStore(STORAGE_KEYS.APP_CONFIG);
  if (cached) {
    runtimeConfig = normalizeRuntimeConfig(cached);
    return runtimeConfig;
  }
  const definition = await loadAppDefinition();
  const defaults = Array.isArray(definition?.defaultEnabledModules) ? definition.defaultEnabledModules : [];
  runtimeConfig = normalizeRuntimeConfig({ enabledModules: defaults });
  syncRuntimeCache(runtimeConfig);
  return runtimeConfig;
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

export async function saveEnabledModules(enabledModules) {
  const payload = Array.isArray(enabledModules) ? enabledModules : [];
  try {
    const res = await fetch(MODULES_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabledModules: payload }),
      credentials: "same-origin",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data?.message || "Uložení selhalo");
    }
    syncRuntimeCache({ ...runtimeConfig, enabledModules: payload });
    showToast("Konfigurace modulů byla uložena.");
    return true;
  } catch (err) {
    console.error("Chyba při ukládání konfigurace modulů", err);
    showToast("Uložení konfigurace modulů selhalo.", { type: "error" });
    return false;
  }
}

export default {
  loadAppDefinition,
  getRuntimeConfig,
  setRuntimeConfig,
  ensureRuntimeConfig,
  loadModuleConfig,
  saveEnabledModules,
};
