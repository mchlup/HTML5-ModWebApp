// core/moduleLoader.js

import { registerModule } from "./moduleRegistry.js";
import { loadModuleConfig } from "./configManager.js";
import { loadModuleTranslations } from "./languageManager.js";
import { showToast } from "./uiService.js";

/**
 * Načte manifest modulů z backendu (config/modules.php).
 * Backend už řeší práva, povolené moduly atd.
 */
async function fetchManifest() {
  try {
    const res = await fetch("./config/modules.php", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    const data = await res.json();
    return Array.isArray(data.modules) ? data.modules : [];
  } catch (err) {
    console.error("Nepodařilo se načíst manifest modulů", err);
    showToast("Nepodařilo se načíst seznam modulů.", { type: "error" });
    return [];
  }
}

/**
 * Sestaví URL k JS souboru modulu.
 *
 * POZOR: moduleLoader.js je v /core/, a proto musíme použít '../modules',
 * aby to vyšlo na /modules/<id>/index.js (ne /core/modules/...).
 */
function buildModuleUrl(entry) {
  const id = entry && entry.id;
  if (!id) {
    throw new Error("Chybí id modulu v manifestu.");
  }
  // Výsledná URL: /html5/modules/<id>/index.js
  return `../modules/${id}/index.js`;
}

/**
 * Načte jeden modul:
 *  - konfiguraci (configManager)
 *  - překlady (languageManager)
 *  - JS modul (dynamic import z ../modules/<id>/index.js)
 * a zavolá jeho register() pokud existuje.
 */
async function loadModule(entry) {
  const id = entry && entry.id;
  if (!id) {
    console.warn("Manifest položka modulu nemá id:", entry);
    return null;
  }

  try {
    const [config, translations, moduleImpl] = await Promise.all([
      // Konfigurace modulu z backendu / runtime; nevadí, když selže
      loadModuleConfig(id).catch(() => null),
      // Překlady modulu podle aktuálního jazyka
      loadModuleTranslations(id).catch(() => null),
      // Vlastní modul z ../modules/<id>/index.js
      import(buildModuleUrl(entry)),
    ]);

    const mod = moduleImpl.default || moduleImpl;
    const registerFn = mod && typeof mod.register === "function" ? mod.register : null;

    if (registerFn) {
      // Předáme konfig a překlady modulům, které o ně stojí (např. BALP),
      // ostatní (např. config) argumenty ignorují.
      registerFn({
        id,
        meta: entry || {},
        config,
        translations,
      });
    } else {
      // Fallback – modul neexportuje register(), ale má třeba meta/render,
      // takže ho zaregistrujeme ručně.
      registerModule(id, {
        id,
        meta: { ...(mod.meta || {}), ...(entry || {}) },
        render: mod.render || mod.defaultRender || (() => null),
        config,
        translations,
      });
    }

    return { id, meta: entry, config, translations };
  } catch (err) {
    console.error(`Chyba při načítání modulu "${id}"`, err);
    showToast(`Nepodařilo se načíst modul „${id}“.`, { type: "error" });
    return null;
  }
}

/**
 * Načte a zaregistruje všechny moduly z manifestu.
 */
export async function loadAllModules() {
  const manifest = await fetchManifest();
  const results = [];

  for (const entry of manifest) {
    const loaded = await loadModule(entry);
    if (loaded) {
      results.push(loaded);
    }
  }

  return results;
}

export default { loadAllModules };
