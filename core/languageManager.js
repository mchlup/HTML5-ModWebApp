import { emit } from "./eventBus.js";
import { get, set } from "./storageManager.js";

const LANG_KEY = "app_language_v2";

async function fetchTranslations(moduleName, langCode) {
  try {
    const mod = await import(`../modules/${moduleName}/lang_${langCode}.js`);
    return mod.default || mod.translations || null;
  } catch (err) {
    return null;
  }
}

export function getLanguage() {
  const stored = get(LANG_KEY, { raw: true });
  return stored || "cs";
}

export function setLanguage(langCode) {
  const code = langCode || "cs";
  set(LANG_KEY, code, { raw: true });
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
