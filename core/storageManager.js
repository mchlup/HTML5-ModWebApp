const local = typeof window !== "undefined" ? window.localStorage : null;
const session = typeof window !== "undefined" ? window.sessionStorage : null;

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch (err) {
    return value;
  }
}

export function get(key, { storage = "local", raw = false } = {}) {
  const store = storage === "session" ? session : local;
  if (!store) return null;
  try {
    const val = store.getItem(key);
    return raw ? val : safeParse(val);
  } catch (err) {
    return null;
  }
}

export function set(key, value, { storage = "local", raw = false } = {}) {
  const store = storage === "session" ? session : local;
  if (!store) return;
  try {
    const val = raw ? value : JSON.stringify(value);
    store.setItem(key, val);
  } catch (err) {
    console.warn("Storage write failed", err);
  }
}

export function remove(key, { storage = "local" } = {}) {
  const store = storage === "session" ? session : local;
  if (!store) return;
  try {
    store.removeItem(key);
  } catch (err) {
    console.warn("Storage remove failed", err);
  }
}

export default { get, set, remove };
