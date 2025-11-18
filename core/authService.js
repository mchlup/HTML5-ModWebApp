const CURRENT_USER_STORAGE_KEY = "current_user_v1";

export function loadCurrentUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user || typeof user !== "object") return null;
    return user;
  } catch (err) {
    console.warn("Chyba při čtení current_user_v1:", err);
    return null;
  }
}

export function saveCurrentUser(user) {
  try {
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
  } catch (err) {
    console.warn("Chyba při zápisu current_user_v1:", err);
  }
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
