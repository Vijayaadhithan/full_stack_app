import IORedis from "ioredis";
import logger from "../logger";
import {
  getRedisUrl,
  isRedisConfigured,
  isRedisConnectionError,
  redactRedisUrl,
} from "../redisConfig";

let connection: IORedis | null = null;
let closingConnection = false;

function resolveRedisUrl(): string {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    throw new Error(
      "Redis queue connection requested without REDIS_URL configured.",
    );
  }
  return redisUrl;
}

export function isQueueRedisEnabled(): boolean {
  return isRedisConfigured();
}

export function getRedisConnection(): IORedis {
  if (!connection) {
    closingConnection = false;
    const redisUrl = resolveRedisUrl();
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy: (times: number) => Math.min(times * 100, 5_000),
    });

    connection.on("connect", () => {
      logger.info("[Redis] BullMQ connection established");
    });

    connection.on("error", (err) => {
      if (isRedisConnectionError(err)) {
        logger.warn(
          { err, url: redactRedisUrl(redisUrl) },
          "[Redis] BullMQ connection unavailable; background jobs will retry when Redis returns",
        );
        return;
      }
      logger.warn({ err }, "[Redis] BullMQ connection error");
    });

    connection.on("close", () => {
      if (closingConnection) {
        logger.info("[Redis] BullMQ connection closed");
        return;
      }
      logger.warn("[Redis] BullMQ connection closed");
    });

    connection.on("reconnecting", (delay: number) => {
      logger.info({ delay }, "[Redis] BullMQ reconnecting");
    });

    logger.info(
      { url: redactRedisUrl(redisUrl) },
      "[Redis] Initializing connection for BullMQ",
    );
  }
  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    closingConnection = true;
    // Use the internal method that ioredis provides
    try {
      await (connection as any).quit();
    } catch {
      // Fallback to disconnect if quit fails
      (connection as any).disconnect?.();
    }
    connection = null;
    logger.info("[Redis] Connection closed");
  }
}
