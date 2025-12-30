import IORedis from "ioredis";
import logger from "../logger";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
    if (!connection) {
        connection = new IORedis(REDIS_URL, {
            maxRetriesPerRequest: null, // Required by BullMQ
            enableReadyCheck: false,
        });

        logger.info({ url: REDIS_URL }, "[Redis] Initializing connection for BullMQ");
    }
    return connection;
}

export async function closeRedisConnection(): Promise<void> {
    if (connection) {
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
