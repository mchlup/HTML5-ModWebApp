import { logError } from "./logService.js";

const registry = {};
const initModulesList = [];

export function registerModule(def) {
  if (!def || !def.id) return;
  const normalized = {
    id: def.id,
    version: def.version || "1.0.0",
    meta: def.meta || {},
    render: def.render,
    init: typeof def.init === "function" ? def.init : null,
  };
  registry[normalized.id] = normalized;
  if (normalized.init) {
    initModulesList.push(normalized);
  }
}

export function getModuleRegistry() {
  return registry;
}

export function getModule(moduleId) {
  return registry[moduleId] || null;
}

export function listModules() {
  return Object.values(registry);
}

export async function initModules(context) {
  for (const m of initModulesList) {
    try {
      const res = m.init(context);
      if (res && typeof res.then === "function") {
        await res;
      }
    } catch (err) {
      logError("moduleRegistry", `Error in init() of module ${m.id}`, err);
    }
  }
}
