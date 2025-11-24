import { emit } from "./eventBus.js";
import { get, set } from "./storageManager.js";
import { STORAGE_KEYS } from "./constants.js";

async function fetchTranslations(moduleName, langCode) {
  try {
    const mod = await import(`../modules/${moduleName}/lang_${langCode}.js`);
    return mod.default || mod.translations || null;
  } catch (err) {
    return null;
  }
}

export function getLanguage() {
  const stored = get(STORAGE_KEYS.LANGUAGE, { raw: true });
  return stored || "cs";
}

export function setLanguage(langCode) {
  const code = langCode || "cs";
  set(STORAGE_KEYS.LANGUAGE, code, { raw: true });
  emit("language:changed", code);
}

export async function loadModuleTranslations(moduleName, langCode) {
  if (!moduleName) return null;
  const code = langCode || getLanguage();
  return fetchTranslations(moduleName, code);
}

export default {
  getLanguage,
  setLanguage,
  loadModuleTranslations,
};
