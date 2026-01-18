const isDebugEnabled =
    import.meta.env.DEV ||
    `${import.meta.env.VITE_ENABLE_DEBUG_LOGS ?? ""}`.toLowerCase() === "true";

export const debugLog = (...args: unknown[]): void => {
    if (isDebugEnabled) {
        console.log(...args);
    }
};

export const debugWarn = (...args: unknown[]): void => {
    if (isDebugEnabled) {
        console.warn(...args);
    }
};
