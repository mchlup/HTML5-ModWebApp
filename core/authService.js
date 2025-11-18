import { setAppConfigCache } from "./configService.js";

const CURRENT_USER_STORAGE_KEY = "current_user_v1";

export async function loadCurrentUser() {
  try {
    const res = await fetch("./config/session.php", { credentials: "same-origin" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!data.success) return null;
    setAppConfigCache({
      enabledModules: data.enabledModules || [],
      moduleConfig: {},
      users: [],
    });
    return data.user;
  } catch (err) {
    console.warn("Chyba při ověřování session:", err);
    return null;
  }
}

export function saveCurrentUser(user) {
  void user;
}

export function clearCurrentUser() {
  try {
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  } catch (err) {
    console.warn("Chyba při mazání current_user_v1:", err);
  }
}

export function loginAsSuperAdmin(username, password, appDefinition) {
  const def = appDefinition || {};
  const sa = def.superAdmin || { username: "admin", password: "admin" };
  if (username === sa.username && password === sa.password) {
    return {
      username,
      role: "super-admin",
    };
  }
  return null;
}
