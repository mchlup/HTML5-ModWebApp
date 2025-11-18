export function getCurrentRoute() {
  const hash = window.location.hash || "#/crm";
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const parts = raw.split("/").filter(Boolean);
  const moduleId = parts[0] || "crm";
  const subId = parts[1] || null;
  return { moduleId, subId };
}

export function navigateTo(moduleId, subId) {
  const suffix = subId ? `/${subId}` : "";
  window.location.hash = `#/${moduleId}${suffix}`;
}

export function listenRouteChange(callback) {
  window.addEventListener("hashchange", () => {
    callback(getCurrentRoute());
  });
}
