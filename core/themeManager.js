import { emit } from "./eventBus.js";
import { get, set } from "./storageManager.js";

const THEME_KEY = "app_theme_v2";
const THEMES = { LIGHT: "light", DARK: "dark" };

function apply(theme) {
  const next = theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
  document.body.classList.remove("theme-dark", "theme-light");
  document.body.classList.add(next === THEMES.DARK ? "theme-dark" : "theme-light");
  set(THEME_KEY, next, { raw: true });
  emit("theme:changed", next);
}

export function getTheme() {
  const stored = get(THEME_KEY, { raw: true });
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
