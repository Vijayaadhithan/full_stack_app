import { randomUUID } from "node:crypto";
import logger from "../logger";

type RedisClient = {
  connect(): Promise<void>;
  on(event: "error" | "end", listener: (err?: unknown) => void): void;
  set(
    key: string,
    value: string,
    options?: { NX?: boolean; PX?: number },
  ): Promise<string | null>;
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
};

const LOCK_KEY_PREFIX = (process.env.JOB_LOCK_PREFIX || "locks:jobs").trim();
const REDIS_URL = process.env.REDIS_URL?.trim();

const RELEASE_LOCK_LUA =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
const REFRESH_LOCK_LUA =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end";

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

function isRedisDisabled(): boolean {
  if ((process.env.NODE_ENV ?? "").toLowerCase() === "test") return true;
  return isTruthyEnv(process.env.DISABLE_REDIS);
}

function isJobLockDisabled(): boolean {
  return isTruthyEnv(process.env.DISABLE_JOB_LOCK);
}

function buildLockKey(name: string): string {
  const normalized = name.trim();
  return `${LOCK_KEY_PREFIX}:${normalized}`;
}

async function loadRedisModule(): Promise<{ createClient?: unknown } | null> {
  try {
    return await import("redis");
  } catch (err) {
    if (!loggedMissingModule) {
      logger.warn(
        { err },
        "[JobLock] Failed to load redis module; distributed job locks disabled.",
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
  if (now < nextRetryAt) {
    return null;
  }

  if (isRedisDisabled() || isJobLockDisabled()) {
    if (!loggedDisabled) {
      logger.info(
        "[JobLock] Disabled via DISABLE_REDIS/DISABLE_JOB_LOCK; running jobs without distributed lock.",
      );
      loggedDisabled = true;
    }
    nextRetryAt = Number.POSITIVE_INFINITY;
    return null;
  }

  if (!REDIS_URL) {
    if (!loggedMissingUrl) {
      logger.info(
        "[JobLock] REDIS_URL not set; running jobs without distributed lock.",
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
          "[JobLock] Failed to load redis client; distributed job locks disabled.",
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
        logger.warn({ err }, "[JobLock] Redis connection error");
      });

      client.on("end", () => {
        logger.warn("[JobLock] Redis connection closed; distributed locks unavailable");
        redisClient = null;
      });

      await client.connect();
      redisClient = client;
      nextRetryAt = 0;
      logger.info("[JobLock] Connected to Redis; distributed job locks enabled");
      return client;
    } catch (err) {
      nextRetryAt = Date.now() + 60_000; // avoid log spam
      logger.warn(
        { err },
        "[JobLock] Failed to connect to Redis; distributed locks temporarily unavailable",
      );
      return null;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

async function tryAcquireLock(params: {
  client: RedisClient;
  key: string;
  token: string;
  ttlMs: number;
}): Promise<boolean> {
  const { client, key, token, ttlMs } = params;
  const result = await client.set(key, token, { NX: true, PX: ttlMs });
  return result === "OK";
}

async function releaseLock(params: {
  client: RedisClient;
  key: string;
  token: string;
}): Promise<void> {
  const { client, key, token } = params;
  await client.eval(RELEASE_LOCK_LUA, { keys: [key], arguments: [token] });
}

async function refreshLock(params: {
  client: RedisClient;
  key: string;
  token: string;
  ttlMs: number;
}): Promise<boolean> {
  const { client, key, token, ttlMs } = params;
  const result = await client.eval(REFRESH_LOCK_LUA, {
    keys: [key],
    arguments: [token, String(ttlMs)],
  });
  return Number(result) > 0;
}

export async function withJobLock<T>(
  params: {
    name: string;
    ttlMs: number;
    refreshMs?: number;
    failOpen?: boolean;
  },
  fn: () => Promise<T>,
): Promise<{ acquired: boolean; result?: T }> {
  const key = buildLockKey(params.name);
  const client = await getRedisClient();
  const defaultFailOpen =
    ((process.env.NODE_ENV ?? "").toLowerCase() !== "production") ||
    isTruthyEnv(process.env.JOB_LOCK_FAIL_OPEN);
  const failOpen = params.failOpen ?? defaultFailOpen;

  if (!client) {
    if (failOpen) {
      return { acquired: true, result: await fn() };
    }
    return { acquired: false };
  }

  const token = randomUUID();
  try {
    const acquired = await tryAcquireLock({
      client,
      key,
      token,
      ttlMs: params.ttlMs,
    });
    if (!acquired) return { acquired: false };

    const refreshEveryMs =
      params.refreshMs ?? Math.max(1_000, Math.floor(params.ttlMs / 2));
    let refreshTimer: NodeJS.Timeout | null = null;

    if (Number.isFinite(refreshEveryMs) && refreshEveryMs > 0) {
      refreshTimer = setInterval(async () => {
        try {
          const ok = await refreshLock({
            client,
            key,
            token,
            ttlMs: params.ttlMs,
          });
          if (!ok) {
            clearInterval(refreshTimer as NodeJS.Timeout);
            refreshTimer = null;
          }
        } catch (err) {
          logger.warn({ err, key }, "[JobLock] Failed to refresh lock");
        }
      }, refreshEveryMs);
      refreshTimer.unref();
    }

    try {
      return { acquired: true, result: await fn() };
    } finally {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
      try {
        await releaseLock({ client, key, token });
      } catch (err) {
        logger.warn({ err, key }, "[JobLock] Failed to release lock");
      }
    }
  } catch (err) {
    logger.warn({ err, key }, "[JobLock] Lock attempt failed");
    if (failOpen) {
      return { acquired: true, result: await fn() };
    }
    return { acquired: false };
  }
}

export function __resetJobLockForTesting() {
  redisClient = null;
  connectPromise = null;
  nextRetryAt = 0;
  loggedMissingUrl = false;
  loggedMissingModule = false;
  loggedDisabled = false;
}
