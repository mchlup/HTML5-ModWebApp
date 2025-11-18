// Jednoduchý hash router: #/crm, #/erp, #/config

export function getCurrentRoute() {
  const hash = window.location.hash || "#/crm";
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const parts = raw.split("/").filter(Boolean);
  const moduleId = parts[0] || "crm";
  return { moduleId };
}

export function navigateTo(moduleId) {
  window.location.hash = `#/${moduleId}`;
}

export function listenRouteChange(callback) {
  window.addEventListener("hashchange", () => {
    callback(getCurrentRoute());
  });
}
