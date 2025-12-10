import { set as setStore, get as getStore } from './storageManager.js';
import { STORAGE_KEYS } from './constants.js';
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
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (hasBody && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await requestWithCsrf(url, { ...options, headers });

  let data;
  try {
    data = await response.json();
  } catch (err) {
    const message = response.ok
      ? 'Odpověď serveru není validní JSON.'
      : `Chybná odpověď serveru (${response.status}).`;
    throw new Error(message);
  }

  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }

  if (data && data.success === false) {
    const message = data.message || 'Požadavek selhal.';
    const error = new Error(message);
    if (data.code) {
      error.code = data.code;
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
