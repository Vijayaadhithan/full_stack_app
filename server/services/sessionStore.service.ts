import session from "express-session";
import logger from "../logger";

type RedisClient = {
  connect(): Promise<void>;
  on(
    event: "error" | "end" | "connect" | "ready",
    listener: (err?: unknown) => void,
  ): void;
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: { PX?: number; EX?: number; NX?: boolean; XX?: boolean },
  ): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
};

const REDIS_URL = process.env.REDIS_URL?.trim();

let redisClient: RedisClient | null = null;
let connectPromise: Promise<RedisClient | null> | null = null;
let nextRetryAt = 0;

let loggedMissingUrl = false;
let loggedMissingModule = false;
let loggedDisabled = false;

function isTruthyEnv(value: string | undefined): boolean {
  const normalized = value ? value.trim().toLowerCase() : "";
  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

function normalizeSessionStoreMode(value: string | undefined) {
  const normalized = value ? value.trim().toLowerCase() : "";
  if (!normalized) return null;
  if (normalized === "pg" || normalized === "postgres" || normalized === "postgresql") {
    return "postgres" as const;
  }
  if (normalized === "redis") {
    return "redis" as const;
  }
  return null;
}

function isRedisDisabled(): boolean {
  if ((process.env.NODE_ENV ?? "").toLowerCase() === "test") return true;
  return isTruthyEnv(process.env.DISABLE_REDIS);
}

function getRedisSessionKeyPrefix(): string {
  const envPrefix = process.env.SESSION_REDIS_PREFIX?.trim();
  if (envPrefix) return envPrefix;
  return "sess:";
}

function resolveDefaultSessionTtlMs(): number {
  const ttlSeconds = Number.parseInt(process.env.SESSION_TTL_SECONDS ?? "", 10);
  if (Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
    return ttlSeconds * 1000;
  }
  return 7 * 24 * 60 * 60 * 1000;
}

function resolveSessionTtlMs(sessionValue: unknown): number {
  const ttlSeconds = Number.parseInt(process.env.SESSION_TTL_SECONDS ?? "", 10);
  if (Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
    return ttlSeconds * 1000;
  }

  const cookieMaxAge =
    typeof sessionValue === "object" &&
    sessionValue !== null &&
    "cookie" in sessionValue &&
    typeof (sessionValue as any).cookie?.maxAge === "number"
      ? (sessionValue as any).cookie.maxAge
      : null;

  if (typeof cookieMaxAge === "number" && Number.isFinite(cookieMaxAge) && cookieMaxAge > 0) {
    return cookieMaxAge;
  }

  return resolveDefaultSessionTtlMs();
}

async function loadRedisModule(): Promise<{ createClient?: unknown } | null> {
  try {
    return await import("redis");
  } catch (err) {
    if (!loggedMissingModule) {
      logger.warn(
        { err },
        "[SessionStore] Failed to load redis module; Redis sessions disabled.",
      );
      loggedMissingModule = true;
    }
    return null;
  }
}

async function getRedisClient(): Promise<RedisClient | null> {
  if (redisClient) return redisClient;
  if (connectPromise) return connectPromise;

  const now = Date.now();
  if (now < nextRetryAt) return null;

  if (isRedisDisabled()) {
    if (!loggedDisabled) {
      logger.info(
        "[SessionStore] DISABLE_REDIS enabled; falling back to PostgreSQL sessions.",
      );
      loggedDisabled = true;
    }
    nextRetryAt = Number.POSITIVE_INFINITY;
    return null;
  }

  if (!REDIS_URL) {
    if (!loggedMissingUrl) {
      logger.info(
        "[SessionStore] REDIS_URL not set; falling back to PostgreSQL sessions.",
      );
      loggedMissingUrl = true;
    }
    nextRetryAt = Number.POSITIVE_INFINITY;
    return null;
  }

  connectPromise = (async () => {
    const redisModule = await loadRedisModule();
    const createClient = redisModule?.createClient;
    if (typeof createClient !== "function") {
      if (!loggedMissingModule) {
        logger.warn(
          { err: new Error("redis module does not export createClient") },
          "[SessionStore] Failed to load redis client; Redis sessions disabled.",
        );
        loggedMissingModule = true;
      }
      nextRetryAt = Number.POSITIVE_INFINITY;
      return null;
    }

    try {
      const client = (createClient as any)({
        url: REDIS_URL,
        socket: {
          reconnectStrategy: (retries: number) => Math.min(retries * 50, 2000),
        },
      }) as RedisClient;

      client.on("error", (err?: unknown) => {
        logger.warn({ err }, "[SessionStore] Redis connection error");
      });
      client.on("end", () => {
        logger.warn("[SessionStore] Redis connection closed; sessions may fail");
        redisClient = null;
      });

      await client.connect();
      redisClient = client;
      nextRetryAt = 0;
      logger.info("[SessionStore] Connected to Redis; using Redis session store");
      return client;
    } catch (err) {
      nextRetryAt = Date.now() + 60_000;
      logger.warn(
        { err },
        "[SessionStore] Failed to connect to Redis; falling back to PostgreSQL sessions",
      );
      return null;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

class RedisSessionStore extends session.Store {
  readonly prefix: string;

  constructor(params?: { prefix?: string }) {
    super();
    this.prefix = params?.prefix ?? getRedisSessionKeyPrefix();
  }

  private key(sid: string): string {
    return `${this.prefix}${sid}`;
  }

  override get(
    sid: string,
    callback: (err?: unknown, session?: session.SessionData | null) => void,
  ): void {
    void (async () => {
      const client = await getRedisClient();
      if (!client) {
        callback(null, null);
        return;
      }

      try {
        const raw = await client.get(this.key(sid));
        if (raw === null) {
          callback(null, null);
          return;
        }
        callback(null, JSON.parse(raw) as session.SessionData);
      } catch (err) {
        callback(err);
      }
    })();
  }

  override set(
    sid: string,
    sessionValue: session.SessionData,
    callback?: (err?: unknown) => void,
  ): void {
    void (async () => {
      const client = await getRedisClient();
      if (!client) {
        callback?.(new Error("Redis session store unavailable"));
        return;
      }

      try {
        const ttlMs = resolveSessionTtlMs(sessionValue);
        await client.set(this.key(sid), JSON.stringify(sessionValue), { PX: ttlMs });
        callback?.();
      } catch (err) {
        callback?.(err);
      }
    })();
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    void (async () => {
      const client = await getRedisClient();
      if (!client) {
        callback?.();
        return;
      }

      try {
        await client.del(this.key(sid));
        callback?.();
      } catch (err) {
        callback?.(err);
      }
    })();
  }

  override touch(
    sid: string,
    sessionValue: session.SessionData,
    callback?: () => void,
  ): void {
    void (async () => {
      const client = await getRedisClient();
      if (!client) {
        callback?.();
        return;
      }

      try {
        const ttlMs = resolveSessionTtlMs(sessionValue);
        await client.set(this.key(sid), JSON.stringify(sessionValue), {
          PX: ttlMs,
          XX: true,
        });
      } catch (err) {
        logger.warn({ err }, "[SessionStore] Failed to touch Redis session");
      } finally {
        callback?.();
      }
    })();
  }
}

class RedisFirstSessionStore extends session.Store {
  private readonly redisStore: RedisSessionStore;
  private readonly fallbackFactory: () => session.Store;
  private fallbackStore: session.Store | null = null;

  constructor(params: {
    redisStore: RedisSessionStore;
    fallbackFactory: () => session.Store;
  }) {
    super();
    this.redisStore = params.redisStore;
    this.fallbackFactory = params.fallbackFactory;
  }

  private getFallbackStore(): session.Store {
    if (!this.fallbackStore) {
      this.fallbackStore = this.fallbackFactory();
    }
    return this.fallbackStore;
  }

  override get(
    sid: string,
    callback: (err?: unknown, session?: session.SessionData | null) => void,
  ): void {
    this.redisStore.get(sid, (redisErr, redisSession) => {
      if (!redisErr && redisSession) {
        callback(null, redisSession);
        return;
      }

      const fallback = this.getFallbackStore();
      fallback.get(sid, (fallbackErr, fallbackSession) => {
        if (fallbackErr) {
          callback(fallbackErr);
          return;
        }

        if (!fallbackSession) {
          callback(null, null);
          return;
        }

        callback(null, fallbackSession);

        // Read-through migration: hydrate Redis with the PG session on first access.
        this.redisStore.set(sid, fallbackSession, (err) => {
          if (err) {
            logger.warn({ err }, "[SessionStore] Failed to migrate session to Redis");
          }
        });
      });
    });
  }

  override set(
    sid: string,
    sessionValue: session.SessionData,
    callback?: (err?: unknown) => void,
  ): void {
    this.redisStore.set(sid, sessionValue, (redisErr) => {
      if (!redisErr) {
        callback?.();
        return;
      }

      const fallback = this.getFallbackStore();
      fallback.set(sid, sessionValue, callback);
    });
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    this.redisStore.destroy(sid, (redisErr) => {
      const fallback = this.getFallbackStore();
      fallback.destroy(sid, (fallbackErr) => {
        if (redisErr && fallbackErr) {
          callback?.(fallbackErr);
          return;
        }
        callback?.();
      });
    });
  }

  override touch(
    sid: string,
    sessionValue: session.SessionData,
    callback?: () => void,
  ): void {
    this.redisStore.set(sid, sessionValue, (redisErr) => {
      if (!redisErr) {
        callback?.();
        return;
      }

      const fallback = this.getFallbackStore();
      if (typeof fallback.touch === "function") {
        fallback.touch(sid, sessionValue, callback);
        return;
      }

      fallback.set(sid, sessionValue, () => {
        callback?.();
      });
    });
  }
}

export function createSessionStore(params: {
  fallbackFactory: () => session.Store;
}): session.Store {
  const mode = normalizeSessionStoreMode(process.env.SESSION_STORE);

  if (mode === "postgres") {
    return params.fallbackFactory();
  }

  const redisStore = new RedisSessionStore();
  return new RedisFirstSessionStore({
    redisStore,
    fallbackFactory: params.fallbackFactory,
  });
}

export function __resetSessionStoreForTesting() {
  redisClient = null;
  connectPromise = null;
  nextRetryAt = 0;
  loggedMissingUrl = false;
  loggedMissingModule = false;
  loggedDisabled = false;
}
