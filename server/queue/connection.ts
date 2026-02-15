import IORedis from "ioredis";
import logger from "../logger";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let connection: IORedis | null = null;

function redactRedisUrl(url: string): string {
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

export function getRedisConnection(): IORedis {
    if (!connection) {
        connection = new IORedis(REDIS_URL, {
            maxRetriesPerRequest: null, // Required by BullMQ
            enableReadyCheck: false,
        });

        connection.on("connect", () => {
            logger.info("[Redis] BullMQ connection established");
        });

        connection.on("error", (err) => {
            logger.warn({ err }, "[Redis] BullMQ connection error");
        });

        connection.on("close", () => {
            logger.warn("[Redis] BullMQ connection closed");
        });

        connection.on("reconnecting", (delay: number) => {
            logger.info({ delay }, "[Redis] BullMQ reconnecting");
        });

        logger.info(
            { url: redactRedisUrl(REDIS_URL) },
            "[Redis] Initializing connection for BullMQ",
        );
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
