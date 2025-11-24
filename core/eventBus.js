const listeners = new Map();

export function on(event, handler) {
  if (!event || typeof handler !== "function") return;
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(handler);
}

export function off(event, handler) {
  if (!event || !listeners.has(event)) return;
  if (!handler) {
    listeners.delete(event);
    return;
  }
  listeners.get(event).delete(handler);
}

export function emit(event, payload) {
  if (!event || !listeners.has(event)) return;
  listeners.get(event).forEach((handler) => {
    try {
      handler(payload);
    } catch (err) {
      console.error("EventBus handler error for", event, err);
    }
  });
}

export default {
  on,
  off,
  emit,
};
