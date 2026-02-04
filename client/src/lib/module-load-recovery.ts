const MODULE_LOAD_ERROR_RELOAD_KEY = "module_load_error_reload_attempted";

const MODULE_LOAD_ERROR_PATTERNS = [
  "importing a module script failed",
  "failed to fetch dynamically imported module",
  "failed to load module script",
  "chunkloaderror",
  "loading chunk",
];

export function isModuleLoadError(error: unknown): boolean {
  if (!error) {
    return false;
  }
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return MODULE_LOAD_ERROR_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

export function attemptModuleReloadOnce(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const storage = window.sessionStorage;
    if (storage.getItem(MODULE_LOAD_ERROR_RELOAD_KEY)) {
      return false;
    }
    storage.setItem(MODULE_LOAD_ERROR_RELOAD_KEY, "true");
    return true;
  } catch {
    return false;
  }
}
