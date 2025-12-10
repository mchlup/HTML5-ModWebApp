const dictionaries = {};
let currentLanguage = "cs";

export function setLanguage(lang) {
  currentLanguage = lang || "cs";
}

export function getLanguage() {
  return currentLanguage;
}

export function registerTranslations(moduleId, lang, dict) {
  if (!moduleId || !lang || !dict) return;
  const key = `${moduleId}:${lang}`;
  dictionaries[key] = {
    ...(dictionaries[key] || {}),
    ...dict,
  };
}

export function t(moduleId, key, fallback = "") {
  const lang = currentLanguage;
  const dict = dictionaries[`${moduleId}:${lang}`] || dictionaries[`${moduleId}:cs`] || {};
  if (Object.prototype.hasOwnProperty.call(dict, key)) {
    return dict[key];
  }
  return fallback;
}
