const APP_VERSION = "0.9.0";

export function getAppVersion() {
  return APP_VERSION;
}

export function runMigrations(context) {
  // Zatím jen placeholder – sem se dají přidat migrace dat v localStorage nebo jiných úložištích.
  // Např. změna struktury app_config_v2 apod.
  console.log("runMigrations() – zatím bez migrací, verze aplikace:", APP_VERSION);
}
