import { emit } from "./eventBus.js";
import { get, set } from "./storageManager.js";
import { STORAGE_KEYS } from "./constants.js";

const THEMES = { LIGHT: "light", DARK: "dark" };

function apply(theme) {
  const next = theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
  document.body.classList.remove("theme-dark", "theme-light");
  document.body.classList.add(next === THEMES.DARK ? "theme-dark" : "theme-light");
  set(STORAGE_KEYS.THEME, next, { raw: true });
  emit("theme:changed", next);
}

export function getTheme() {
  const stored = get(STORAGE_KEYS.THEME, { raw: true });
  if (stored === THEMES.DARK || stored === THEMES.LIGHT) return stored;
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return THEMES.DARK;
  }
  return THEMES.LIGHT;
}

export function setTheme(theme) {
  apply(theme);
}

export function toggleTheme() {
  const current = getTheme();
  apply(current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK);
}

export function initTheme() {
  apply(getTheme());
}

export default { getTheme, setTheme, toggleTheme, initTheme };
