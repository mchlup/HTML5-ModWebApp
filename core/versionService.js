export const APP_VERSION = "0.9.0";

export function getAppVersion() {
  return APP_VERSION;
}

/**
 * Spustí případné migrace aplikace.
 * context.storage / context.sessionStorage lze přepsat při testování,
 * jinak se použije window.localStorage / window.sessionStorage.
 */
export function runMigrations(context = {}) {
  const storage = context.storage || window.localStorage;
  const VERSION_KEY = "html5.appVersion";

  let previousVersion = null;
  try {
    previousVersion = storage.getItem(VERSION_KEY);
  } catch {
    // storage nemusí být dostupné (např. private mode) – migrace prostě přeskočíme
  }

  // Zatím nemáme konkrétní kroky migrace – jen si uložíme aktuální verzi
  if (!previousVersion || previousVersion !== APP_VERSION) {
    try {
      storage.setItem(VERSION_KEY, APP_VERSION);
    } catch {
      // ignorujeme chybu zápisu
    }
  }
}
