const DEFAULT_SUPPLIER_MODULE_ID = 'suppliers';
const DEFAULT_SUPPLIER_TABLE = 'app_suppliers';

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

export function resolveSupplierBinding(runtimeConfig = {}) {
  const config = runtimeConfig.moduleConfig?.[DEFAULT_SUPPLIER_MODULE_ID] || {};
  const primaryModuleId = (config.primaryModuleId || DEFAULT_SUPPLIER_MODULE_ID).trim();
  const tableName = (config.tableName || DEFAULT_SUPPLIER_TABLE).trim();
  const aliases = normalizeList(config.aliases || config.clientModules);
  const unique = Array.from(new Set([primaryModuleId, ...aliases]));

  return {
    primaryModuleId,
    tableName,
    aliases: unique,
  };
}

export function matchesSupplierModule(moduleId, runtimeConfig = {}) {
  if (!moduleId) return false;
  const { aliases } = resolveSupplierBinding(runtimeConfig);
  return aliases.includes(moduleId);
}

export function getSupplierTableName(runtimeConfig = {}) {
  return resolveSupplierBinding(runtimeConfig).tableName;
}

export default {
  resolveSupplierBinding,
  matchesSupplierModule,
  getSupplierTableName,
};
