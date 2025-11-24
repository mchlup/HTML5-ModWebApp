import { setRuntimeConfig } from "./configManager.js";

export async function loadCurrentUser() {
  try {
    const res = await fetch("./config/session.php", { credentials: "same-origin" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!data.success) return null;
    setRuntimeConfig({
      enabledModules: data.enabledModules || [],
      moduleConfig: {},
      users: [],
      permissions: data.user?.permissions || {},
    });
    return data.user;
  } catch (err) {
    console.warn("Chyba při ověřování session:", err);
    return null;
  }
}

export default { loadCurrentUser };
