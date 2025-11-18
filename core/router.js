const routeGuards = [];

export function getCurrentRoute() {
  const hash = window.location.hash || "#/config";
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const parts = raw.split("/").filter(Boolean);
  const moduleId = parts[0] || "config";
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

export function addRouteGuard(fn) {
  if (typeof fn === "function") {
    routeGuards.push(fn);
  }
}

export function runRouteGuards(route, ctx) {
  for (const g of routeGuards) {
    const res = g(route, ctx);
    if (res && res.redirectTo) {
      return res;
    }
  }
  return null;
}
