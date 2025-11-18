const registry = {};

export function registerModule(def) {
  if (!def || !def.id) return;
  registry[def.id] = {
    id: def.id,
    meta: def.meta || {},
    render: def.render,
  };
}

export function getModuleRegistry() {
  return registry;
}
