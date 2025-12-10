const DB_CONFIG_STORAGE_KEY = "config_module_db_v1";

const DEFAULT_DATABASE_CONFIG = {
  driver: "postgres",
  host: "",
  port: 5432,
  database: "",
  username: "",
  password: "",
  ssl: false,
};

let cachedConfig = null;

function cloneConfig(cfg) {
  return JSON.parse(JSON.stringify(cfg));
}

function normalizePort(port) {
  const parsed = parseInt(port, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_DATABASE_CONFIG.port;
}

function readStoredConfig() {
  if (typeof localStorage === "undefined") {
    return cloneConfig(DEFAULT_DATABASE_CONFIG);
  }
  try {
    const raw = localStorage.getItem(DB_CONFIG_STORAGE_KEY);
    if (!raw) {
      return cloneConfig(DEFAULT_DATABASE_CONFIG);
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_DATABASE_CONFIG,
      ...parsed,
      port: normalizePort(parsed.port),
    };
  } catch (err) {
    console.warn("Chyba při čtení db_config.js:", err);
    return cloneConfig(DEFAULT_DATABASE_CONFIG);
  }
}

function persistConfig(cfg) {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(DB_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch (err) {
    console.warn("Chyba při ukládání db_config.js:", err);
  }
}

export function loadDatabaseConfig(options = {}) {
  if (!cachedConfig || options.forceReload) {
    cachedConfig = readStoredConfig();
  }
  return cloneConfig(cachedConfig);
}

export function saveDatabaseConfig(nextConfig = {}) {
  const normalized = {
    ...DEFAULT_DATABASE_CONFIG,
    ...nextConfig,
  };
  normalized.port = normalizePort(normalized.port);
  cachedConfig = normalized;
  persistConfig(cachedConfig);
  return cloneConfig(cachedConfig);
}

export function resetDatabaseConfig() {
  cachedConfig = cloneConfig(DEFAULT_DATABASE_CONFIG);
  persistConfig(cachedConfig);
  return cloneConfig(cachedConfig);
}

export function getDefaultDatabaseConfig() {
  return cloneConfig(DEFAULT_DATABASE_CONFIG);
}
