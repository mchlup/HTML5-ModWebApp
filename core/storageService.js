const STORAGE_PREFIX = "app_storage_v1::";

function buildKey(scope, key) {
  return STORAGE_PREFIX + scope + "::" + key;
}

export function getValue(scope, key, defaultValue = null) {
  const fullKey = buildKey(scope, key);
  try {
    const raw = localStorage.getItem(fullKey);
    if (raw === null || raw === undefined) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("storageService.getValue error", scope, key, err);
    return defaultValue;
  }
}

export function setValue(scope, key, value) {
  const fullKey = buildKey(scope, key);
  try {
    if (value === undefined) {
      localStorage.removeItem(fullKey);
      return;
    }
    localStorage.setItem(fullKey, JSON.stringify(value));
  } catch (err) {
    console.warn("storageService.setValue error", scope, key, err);
  }
}

// syntactic sugar

export function getModuleConfig(moduleId, key, defaultValue = null) {
  return getValue(`module:${moduleId}`, key, defaultValue);
}

export function setModuleConfig(moduleId, key, value) {
  return setValue(`module:${moduleId}`, key, value);
}

export function getUserSetting(userId, key, defaultValue = null) {
  return getValue(`user:${userId}`, key, defaultValue);
}

export function setUserSetting(userId, key, value) {
  return setValue(`user:${userId}`, key, value);
}
