import { apiJson } from "./authService.js";

const REMOTE_LOG_URL = "./config/log.php";
const REMOTE_LOG_ENABLED = true;

async function sendRemoteLog(level, source, message, data) {
  if (!REMOTE_LOG_ENABLED) {
    return;
  }

  try {
    await apiJson(REMOTE_LOG_URL, {
      method: "POST",
      body: {
        level,
        source,
        message,
        context: data ?? null,
      },
    });
  } catch (error) {
    // remote log nesmÌ nikdy zp˘sobit p·d aplikace ñ p¯Ìpadnou chybu jen vypÌöeme do konzole
    console.warn("Remote log failed:", error);
  }
}

export function logInfo(source, message, data) {
  console.info(`[INFO] [${source}] ${message}`, data || "");
  // info logy zatÌm neposÌl·me na server ñ aù se log nezahlcuje
}

export function logWarn(source, message, data) {
  console.warn(`[WARN] [${source}] ${message}`, data || "");
  // varov·nÌ na server posÌl·me ñ ale fire-and-forget, neblokujeme UI
  void sendRemoteLog("warn", source, message, data);
}

export function logError(source, message, error, data) {
  console.error(
    `[ERROR] [${source}] ${message}`,
    error || "",
    data || "",
  );
  // chyby vûdy poöleme i na server, aby öly dohledat v systÈmov˝ch log·ch
  void sendRemoteLog("error", source, message, { error, ...(data || {}) });
}
