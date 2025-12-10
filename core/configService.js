import {
  loadAppDefinition,
  ensureRuntimeConfig as loadAppConfig,
  saveRuntimeConfig as saveAppConfig,
  setRuntimeConfig as setAppConfigCache,
} from "./configManager.js";

// Tento soubor je ponechán pro zpětnou kompatibilitu; veškerá funkčnost
// je delegována do sjednoceného configManageru.

export { loadAppDefinition, loadAppConfig, saveAppConfig, setAppConfigCache };

export default {
  loadAppDefinition,
  loadAppConfig,
  saveAppConfig,
  setAppConfigCache,
};
