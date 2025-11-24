const registry = new Map();

export function registerModule(name, definition) {
  if (!name || !definition) return;
  registry.set(name, { ...definition, id: name });
}

export function getModule(name) {
  return registry.get(name) || null;
}

export function getAllModules() {
  return Array.from(registry.values());
}

export function clearModules() {
  registry.clear();
}

export default {
  registerModule,
  getModule,
  getAllModules,
  clearModules,
};
