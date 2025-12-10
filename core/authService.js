import { set as setStore, get as getStore } from './storageManager.js';
import { STORAGE_KEYS } from "./constants.js";
import { setRuntimeConfig } from './configManager.js';
import { showToast } from './uiService.js';

export function getCsrfToken() {
  return getStore(STORAGE_KEYS.CSRF_TOKEN) || '';
}

export async function requestWithCsrf(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getCsrfToken();
  if (token) headers.set('X-CSRF-Token', token);
  return fetch(url, { ...options, headers, credentials: 'same-origin' });
}

export async function apiJson(url, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  // pokud posíláme JSON payload, nastavíme Content-Type, pokud už není
  if (options.body && typeof options.body !== "string") {
    options = {
      ...options,
      body: JSON.stringify(options.body),
    };
  }
  if (options.body && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await requestWithCsrf(url, {
    credentials: "include",
    ...options,
    headers,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // nevalidní / prázdný JSON – necháme data = null
  }

  if (!response.ok || (data && data.success === false)) {
    const message = (data && data.message) || `HTTP ${response.status}`;
    const error = new Error(message);

    // rozlišení typických stavů – nadřazené vrstvy na to mohou reagovat (logout / redirect)
    if (response.status === 401) {
      error.code = "UNAUTHORIZED";
    } else if (response.status === 403) {
      error.code = "FORBIDDEN";
    }

    throw error;
  }

  return data;
}

export async function login(username, password) {
  try {
    const response = await fetch('./config/login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username: username?.trim(), password }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data?.message || 'Neplatné přihlašovací údaje');
    }
    if (data.csrfToken) {
      setStore(STORAGE_KEYS.CSRF_TOKEN, data.csrfToken);
    }
    setRuntimeConfig({
      enabledModules: data.enabledModules || [],
      moduleConfig: {},
      users: [],
      permissions: data.permissions || data.user?.permissions || {},
      dbAvailable: Boolean(data.dbAvailable),
    });
    return { user: data.user, enabledModules: data.enabledModules, permissions: data.permissions };
  } catch (err) {
    console.error('Přihlášení selhalo', err);
    showToast(err instanceof Error ? err.message : 'Nepodařilo se přihlásit.', { type: 'error' });
    throw err;
  }
}

export async function loadCurrentUser() {
  try {
    const res = await fetch('./config/session.php', { credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok || !data.success) return null;
    if (data.csrfToken) {
      setStore(STORAGE_KEYS.CSRF_TOKEN, data.csrfToken);
    }
    setRuntimeConfig({
      enabledModules: data.enabledModules || [],
      moduleConfig: {},
      users: [],
      permissions: data.permissions || data.user?.permissions || {},
      dbAvailable: Boolean(data.dbAvailable),
    });
    return { user: data.user, enabledModules: data.enabledModules, permissions: data.permissions };
  } catch (err) {
    console.warn('Chyba při ověřování session:', err);
    showToast('Nepodařilo se ověřit přihlášení.', { type: 'error' });
    return null;
  }
}

export default { loadCurrentUser, login, requestWithCsrf, getCsrfToken, apiJson };
