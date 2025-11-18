const services = {};

export function registerService(name, service) {
  if (!name || !service) return;
  services[name] = service;
}

export function getService(name) {
  return services[name] || null;
}
