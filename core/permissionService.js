// Jednoduchý permission systém – zatím jen role + modul.

export function canAccessModule(user, moduleId) {
  if (!user) return false;
  if (user.role === "super-admin") return true;
  // sem můžeš později přidat detailnější logiku + konfiguraci z backendu/localStorage
  return true;
}

export function canPerformAction(user, moduleId, action) {
  if (!user) return false;
  if (user.role === "super-admin") return true;
  // do budoucna zde může být matrix práv, zatím vše povoleno
  return true;
}

export function hasPermission(user, permission, context) {
  // generický wrapper, zatím pouze alias na canPerformAction
  if (!context || !context.moduleId) return false;
  return canPerformAction(user, context.moduleId, permission);
}
