const listeners = {};

export function on(eventName, handler) {
  if (!listeners[eventName]) listeners[eventName] = new Set();
  listeners[eventName].add(handler);
  return () => off(eventName, handler);
}

export function off(eventName, handler) {
  const set = listeners[eventName];
  if (!set) return;
  set.delete(handler);
}

export function emit(eventName, payload) {
  const set = listeners[eventName];
  if (!set) return;
  for (const fn of Array.from(set)) {
    try {
      fn(payload);
    } catch (err) {
      console.warn("eventBus handler error", eventName, err);
    }
  }
}
