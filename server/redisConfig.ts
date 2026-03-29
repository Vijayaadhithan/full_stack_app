const TRUTHY_ENV_VALUES = new Set(["true", "1", "yes", "on"]);
const REDIS_CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
]);
const REDIS_CONNECTION_ERROR_MESSAGES = [
  "socket closed unexpectedly",
  "connection is closed",
  "connect econnrefused",
  "connect econnreset",
  "connect etimedout",
  "read econnreset",
  "write epipe",
];

type RedisErrorLike = {
  code?: unknown;
  message?: unknown;
  cause?: unknown;
  errors?: unknown;
  aggregateErrors?: unknown;
};

function normalizeEnv(value: string | undefined): string {
  return value ? value.trim().toLowerCase() : "";
}

export function isTruthyEnv(value: string | undefined): boolean {
  return TRUTHY_ENV_VALUES.has(normalizeEnv(value));
}

export function isRedisDisabled(): boolean {
  return isTruthyEnv(process.env.DISABLE_REDIS);
}

export function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  return url && url.length > 0 ? url : null;
}

export function isRedisConfigured(): boolean {
  return !isRedisDisabled() && getRedisUrl() !== null;
}

export function redactRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return "redis://***";
  }
}

export function isRedisConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as RedisErrorLike;
  if (
    typeof candidate.code === "string" &&
    REDIS_CONNECTION_ERROR_CODES.has(candidate.code.toUpperCase())
  ) {
    return true;
  }

  if (typeof candidate.message === "string") {
    const message = candidate.message.toLowerCase();
    if (
      REDIS_CONNECTION_ERROR_MESSAGES.some((fragment) =>
        message.includes(fragment),
      )
    ) {
      return true;
    }
  }

  if (candidate.cause && isRedisConnectionError(candidate.cause)) {
    return true;
  }

  const aggregateErrors = Array.isArray(candidate.aggregateErrors)
    ? candidate.aggregateErrors
    : Array.isArray(candidate.errors)
      ? candidate.errors
      : [];

  return aggregateErrors.some((entry) => isRedisConnectionError(entry));
}
