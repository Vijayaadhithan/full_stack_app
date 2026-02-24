import { randomUUID } from "node:crypto";
import logger from "../logger";
import { getRedisClient as getSharedRedisClient } from "../cache";

type RedisClient = {
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

let loggedMissingUrl = false;
let loggedDisabled = false;
let loggedUnavailable = false;

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

async function getRedisClient(): Promise<RedisClient | null> {
  if (isRedisDisabled() || isJobLockDisabled()) {
    if (!loggedDisabled) {
      logger.info(
        "[JobLock] Disabled via DISABLE_REDIS/DISABLE_JOB_LOCK; running jobs without distributed lock.",
      );
      loggedDisabled = true;
    }
    return null;
  }

  if (!REDIS_URL) {
    if (!loggedMissingUrl) {
      logger.info(
        "[JobLock] REDIS_URL not set; running jobs without distributed lock.",
      );
      loggedMissingUrl = true;
    }
    return null;
  }

  const sharedClient = await getSharedRedisClient();
  if (!sharedClient) {
    if (!loggedUnavailable) {
      logger.warn(
        "[JobLock] Shared Redis client unavailable; distributed locks disabled.",
      );
      loggedUnavailable = true;
    }
    return null;
  }

  loggedUnavailable = false;
  return sharedClient as RedisClient;
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
  loggedMissingUrl = false;
  loggedDisabled = false;
  loggedUnavailable = false;
}
