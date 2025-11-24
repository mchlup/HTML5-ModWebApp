import { registerModule } from "./moduleRegistry.js";
import { loadModuleConfig } from "./configManager.js";
import { loadModuleTranslations } from "./languageManager.js";
import { showToast } from "./uiService.js";

async function fetchManifest() {
  try {
    const res = await fetch("./config/modules.php", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return Array.isArray(data.modules) ? data.modules : [];
  } catch (err) {
    console.error("Nepodařilo se načíst manifest modulů", err);
    showToast("Nepodařilo se načíst seznam modulů.", { type: "error" });
    return [];
  }
}

async function loadModule(entry) {
  const { id, entry: path } = entry;
  if (!id || !path || !path.endsWith("index.js")) return null;
  try {
    const mod = await import(path);
    const config = await loadModuleConfig(id);
    const translations = await loadModuleTranslations(id);
    const definition = mod.default || mod;
    if (definition && typeof definition.register === "function") {
      await definition.register({ config, translations });
    }
    if (definition && definition.meta && !definition.id) {
      definition.id = id;
    }
    registerModule(id, {
      ...(definition || {}),
      config,
      translations,
    });
    return { id, config, translations };
  } catch (err) {
    console.error("Chyba při načítání modulu", id, err);
    showToast(`Modul ${id} se nepodařilo načíst.`, { type: "error" });
    return null;
  }
}

export async function loadAllModules() {
  const manifest = await fetchManifest();
  const results = [];
  for (const entry of manifest) {
    const loaded = await loadModule(entry);
    if (loaded) results.push(loaded);
  }
  return results;
}

export default { loadAllModules };
