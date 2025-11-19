const ROLE_DEFAULT_LEVEL = {
  "super-admin": "manage",
  admin: "manage",
  manager: "manage",
  user: "read",
  viewer: "read",
};

const LEVEL_PRIORITY = {
  none: 0,
  read: 1,
  manage: 2,
};

const ACTION_LEVEL = {
  view: "read",
  read: "read",
  list: "read",
  export: "read",
  create: "manage",
  edit: "manage",
  update: "manage",
  delete: "manage",
  manage: "manage",
  configure: "manage",
};

function normalizeLevel(level) {
  if (level === "manage") return "manage";
  if (level === "read") return "read";
  return "none";
}

function resolveLevelForModule(user, moduleId) {
  if (!user) return "none";
  if (user.role === "super-admin") return "manage";
  if (!moduleId) {
    return normalizeLevel(ROLE_DEFAULT_LEVEL[user.role] || "read");
  }

  const userPermissions = (user.permissions && user.permissions[moduleId]) || null;
  if (userPermissions) {
    return normalizeLevel(userPermissions);
  }

  const moduleProfile =
    user.modules && user.modules[moduleId] && user.modules[moduleId].level
      ? user.modules[moduleId].level
      : null;
  if (moduleProfile) {
    return normalizeLevel(moduleProfile);
  }

  return normalizeLevel(ROLE_DEFAULT_LEVEL[user.role] || "read");
}

export function getPermissionLevel(user, moduleId) {
  return resolveLevelForModule(user, moduleId);
}

export function canAccessModule(user, moduleId) {
  return LEVEL_PRIORITY[resolveLevelForModule(user, moduleId)] > 0;
}

export function canPerformAction(user, moduleId, action) {
  const userLevel = resolveLevelForModule(user, moduleId);
  const requiredLevel = normalizeLevel(ACTION_LEVEL[action] || "read");
  return LEVEL_PRIORITY[userLevel] >= LEVEL_PRIORITY[requiredLevel];
}

export function hasPermission(user, permission, context = {}) {
  if (!context.moduleId) {
    return user && user.role === "super-admin";
  }
  return canPerformAction(user, context.moduleId, permission);
}
