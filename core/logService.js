export function logInfo(source, message, data) {
  console.info(`[INFO] [${source}] ${message}`, data || "");
}

export function logWarn(source, message, data) {
  console.warn(`[WARN] [${source}] ${message}`, data || "");
}

export function logError(source, message, error, data) {
  console.error(`[ERROR] [${source}] ${message}`, error || "", data || "");
}
