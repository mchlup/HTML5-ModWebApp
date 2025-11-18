export function showToast(message, options = {}) {
  const el = document.createElement("div");
  el.className = "toast-notification";
  el.textContent = message;
  document.body.appendChild(el);
  const timeout = options.timeoutMs || 2600;
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, timeout);
}

// jednoduché confirm okno, do budoucna lze nahradit vlastním dialogem
export function confirmDialog(message) {
  return Promise.resolve(window.confirm(message));
}
