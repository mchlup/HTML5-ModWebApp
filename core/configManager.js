import { get, set } from "./storageManager.js";

const APP_CONFIG_URL = "./config/app.json";
const APP_CONFIG_KEY = "app_config_cache_v2";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function fetchModuleFile(moduleName, filename) {
  const jsPath = `../modules/${moduleName}/${filename}.js`;
  const jsonPath = `./modules/${moduleName}/${filename}.json`;
  try {
    return (await import(jsPath)).default || null;
  } catch (err) {
    // ignore and try json
  }
  try {
    return await fetchJson(jsonPath);
  } catch (err) {
    return null;
  }
}

export async function loadAppConfig() {
  const cached = get(APP_CONFIG_KEY);
  if (cached) return cached;
  try {
    const data = await fetchJson(APP_CONFIG_URL);
    set(APP_CONFIG_KEY, data);
    return data;
  } catch (err) {
    console.warn("Nelze načíst app.json", err);
    return {};
  }
}

export async function saveAppConfig(config) {
  set(APP_CONFIG_KEY, config || {});
}

export async function loadModuleConfig(moduleName) {
  if (!moduleName) return null;
  try {
    const cfg = await fetchModuleFile(moduleName, "config");
    return cfg || null;
  } catch (err) {
    console.warn("Nepodařilo se načíst config pro modul", moduleName, err);
    return null;
  }
}

export default {
  loadAppConfig,
  saveAppConfig,
  loadModuleConfig,
};
