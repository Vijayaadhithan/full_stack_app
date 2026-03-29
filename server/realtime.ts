import type { Response } from "express";
import { setInterval, clearInterval } from "node:timers";
import logger from "./logger";
import { getRedisClient as getSharedRedisClient } from "./cache";
import {
  getRedisUrl,
  isRedisConnectionError,
  isRedisDisabled,
  redactRedisUrl,
} from "./redisConfig";

type SseEvent =
  | { event: "connected"; data: { connected: true } }
  | { event: "heartbeat"; data: Record<string, never> }
  | { event: "invalidate"; data: { keys: string[] } };

type SseConnection = {
  res: Response;
  heartbeat: NodeJS.Timeout | null;
};

const HEARTBEAT_INTERVAL_MS = 30_000;

// Connection limits to prevent memory exhaustion
export const MAX_CONNECTIONS_PER_USER = 5;
export const MAX_TOTAL_CONNECTIONS = 10000;

const connections = new Map<number, Set<SseConnection>>();
const connectionToUser = new WeakMap<SseConnection, number>();

function getTotalConnectionCount(): number {
  let total = 0;
  connections.forEach((set) => {
    total += set.size;
  });
  return total;
}


function writeEvent(connection: SseConnection, payload: SseEvent) {
  try {
    connection.res.write(`event: ${payload.event}\n`);
    connection.res.write(`data: ${JSON.stringify(payload.data)}\n\n`);
  } catch (error) {
    logger.warn({ err: error }, "Failed to write SSE event; dropping client");
    cleanupConnection(connection);
  }
}

function cleanupConnection(connection: SseConnection) {
  if (connection.heartbeat) {
    clearInterval(connection.heartbeat);
  }
  const userId = connectionToUser.get(connection);
  if (userId !== undefined) {
    const set = connections.get(userId);
    if (set) {
      set.delete(connection);
      if (set.size === 0) {
        connections.delete(userId);
      }
    }
  }
}

function createHeartbeat(connection: SseConnection) {
  const interval = setInterval(() => {
    writeEvent(connection, { event: "heartbeat", data: {} });
  }, HEARTBEAT_INTERVAL_MS);
  interval.unref();
  return interval;
}

export function registerRealtimeClient(res: Response, userId: number): boolean {
  // Check global connection limit
  if (getTotalConnectionCount() >= MAX_TOTAL_CONNECTIONS) {
    logger.warn({ userId }, "SSE connection rejected: global limit reached");
    res.status(503).json({ message: "Server at capacity, try again later" });
    return false;
  }

  // Check per-user connection limit
  const existingUserConns = connections.get(userId);
  if (existingUserConns && existingUserConns.size >= MAX_CONNECTIONS_PER_USER) {
    logger.warn({ userId, count: existingUserConns.size }, "SSE connection rejected: per-user limit reached");
    res.status(429).json({ message: "Too many connections, close existing tabs" });
    return false;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const connection: SseConnection = {
    res,
    heartbeat: null,
  };
  connection.heartbeat = createHeartbeat(connection);
  connectionToUser.set(connection, userId);

  const existing = connections.get(userId);
  if (existing) {
    existing.add(connection);
  } else {
    connections.set(userId, new Set([connection]));
  }

  writeEvent(connection, { event: "connected", data: { connected: true } });

  const remove = () => cleanupConnection(connection);
  res.once("close", remove);
  res.once("error", remove);

  return true;
}

function broadcastToUser(userId: number, payload: SseEvent) {
  const set = connections.get(userId);
  if (!set || set.size === 0) {
    return;
  }

  set.forEach((connection) => {
    writeEvent(connection, payload);
  });
}

const CHANNEL = "realtime:events";

let publisher: any = null;
let subscriber: any = null;
let pubSubInitPromise: Promise<void> | null = null;
let loggedPubSubUnavailable = false;
let realtimeInitialized = false;
let closingSubscriber = false;

function isRealtimeRedisDisabled(): boolean {
  return (
    (process.env.NODE_ENV ?? "").toLowerCase() === "test" ||
    isRedisDisabled()
  );
}

async function ensureRealtimePubSub(): Promise<void> {
  if (realtimeInitialized || pubSubInitPromise) {
    await pubSubInitPromise;
    return;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl || isRealtimeRedisDisabled()) {
    return;
  }

  pubSubInitPromise = (async () => {
    try {
      const sharedClient = await getSharedRedisClient();
      if (!sharedClient || typeof sharedClient.duplicate !== "function") {
        if (!loggedPubSubUnavailable) {
          logger.warn(
            "[Realtime] Shared Redis client unavailable; using local-only invalidation.",
          );
          loggedPubSubUnavailable = true;
        }
        return;
      }

      publisher = sharedClient;
      const subClient = sharedClient.duplicate();
      closingSubscriber = false;
      subClient.on("error", (err: unknown) => {
        if (isRedisConnectionError(err)) {
          logger.warn(
            { err, url: redactRedisUrl(redisUrl) },
            "[Realtime] Redis subscriber unavailable; SSE invalidations will stay local until Redis returns",
          );
          return;
        }
        logger.warn({ err }, "[Realtime] Redis subscriber error");
      });
      subClient.on("reconnecting", () => {
        logger.info("[Realtime] Redis subscriber reconnecting");
      });
      subClient.on("end", () => {
        if (closingSubscriber) {
          logger.info("Realtime subscriber closed");
          return;
        }
        logger.warn("[Realtime] Redis subscriber connection closed");
      });
      await subClient.connect();
      await subClient.subscribe(CHANNEL, (message: string) => {
        try {
          const { recipients, keys } = JSON.parse(message);
          localBroadcastInvalidation(recipients, keys);
        } catch (err) {
          logger.warn({ err }, "Failed to parse realtime message");
        }
      });
      subscriber = subClient;
      realtimeInitialized = true;
      loggedPubSubUnavailable = false;
      logger.info("Redis realtime Pub/Sub initialized");
    } catch (err) {
      logger.warn({ err }, "Failed to initialize Redis for realtime");
      publisher = null;
      subscriber = null;
      realtimeInitialized = false;
    } finally {
      pubSubInitPromise = null;
    }
  })();

  await pubSubInitPromise;
}

function normalizeKeys(keys: string[]): string[] {
  return Array.from(new Set(keys)).filter((key) => key && key.length > 0);
}

function localBroadcastInvalidation(
  recipients: number | Array<number | null | undefined>,
  keys: string[],
) {
  const normalizedKeys = normalizeKeys(keys);
  if (normalizedKeys.length === 0) return;

  const targets = Array.isArray(recipients)
    ? recipients
      .map((value) => (value == null ? null : Number(value)))
      .filter((value): value is number => Number.isFinite(value))
    : [Number(recipients)].filter((value) => Number.isFinite(value));

  const uniqueTargets = Array.from(new Set(targets));

  for (let i = 0; i < uniqueTargets.length; i += 1) {
    const target = uniqueTargets[i];
    broadcastToUser(target, {
      event: "invalidate",
      data: { keys: normalizedKeys },
    });
  }
}

export function broadcastInvalidation(
  recipients: number | Array<number | null | undefined>,
  keys: string[],
) {
  if (!realtimeInitialized) {
    void ensureRealtimePubSub();
  }

  if (publisher && realtimeInitialized) {
    publisher
      .publish(CHANNEL, JSON.stringify({ recipients, keys }))
      .catch((err: unknown) => {
        logger.warn({ err }, "Failed to publish realtime event, falling back to local broadcast");
        localBroadcastInvalidation(recipients, keys);
      });
  } else {
    localBroadcastInvalidation(recipients, keys);
  }
}

const NOTIFICATION_KEYS = ["/api/notifications"];
const CUSTOMER_BOOKING_KEYS = [
  "/api/bookings",
  "/api/bookings/customer",
  "/api/bookings/customer/requests",
  "/api/bookings/customer/history",
];
const PROVIDER_BOOKING_KEYS = [
  "/api/bookings",
  "/api/bookings/provider",
  "/api/bookings/provider/pending",
  "/api/bookings/provider/history",
];
const CART_KEYS = ["/api/cart"];
const WISHLIST_KEYS = ["/api/wishlist"];
const CUSTOMER_ORDER_KEYS = ["/api/orders", "/api/orders/customer"];
const SHOP_ORDER_KEYS = [
  "orders",
  "/api/orders",
  "/api/orders/shop",
  "/api/orders/shop/recent",
  "/api/shops/orders/active",
  "/api/returns/shop",
  "/api/shops/dashboard-stats",
  "shopDashboardStats",
];

export function notifyNotificationChange(userId: number | null | undefined) {
  if (userId == null) return;
  broadcastInvalidation(userId, NOTIFICATION_KEYS);
}

export function notifyNotificationChanges(userIds: (number | null | undefined)[]) {
  const validIds = userIds.filter((id): id is number => id != null);
  if (validIds.length === 0) return;
  broadcastInvalidation(validIds, NOTIFICATION_KEYS);
}

export function notifyBookingChange(params: {
  customerId?: number | null;
  providerId?: number | null;
}) {
  const { customerId, providerId } = params;
  if (customerId != null) {
    broadcastInvalidation(customerId, CUSTOMER_BOOKING_KEYS);
  }
  if (providerId != null) {
    broadcastInvalidation(providerId, PROVIDER_BOOKING_KEYS);
    notifyNotificationChange(providerId);
  }
}

export function notifyCartChange(userId: number | null | undefined) {
  if (userId == null) return;
  broadcastInvalidation(userId, CART_KEYS);
}

export function notifyWishlistChange(userId: number | null | undefined) {
  if (userId == null) return;
  broadcastInvalidation(userId, WISHLIST_KEYS);
}

function buildOrderKeys(orderId: number | null | undefined) {
  const keys: string[] = [];
  if (orderId != null) {
    keys.push(`/api/orders/${orderId}`);
    keys.push(`/api/orders/${orderId}/timeline`);
  }
  return keys;
}

export function notifyOrderChange(params: {
  customerId?: number | null;
  shopId?: number | null;
  orderId?: number | null;
}) {
  const { customerId, shopId, orderId } = params;
  const detailKeys = buildOrderKeys(orderId);
  if (customerId != null) {
    broadcastInvalidation(customerId, [...CUSTOMER_ORDER_KEYS, ...detailKeys]);
  }

  if (shopId != null) {
    broadcastInvalidation(shopId, [...SHOP_ORDER_KEYS, ...detailKeys]);
  }
}

export async function closeRealtimeConnections() {
  for (const set of Array.from(connections.values())) {
    for (const connection of Array.from(set.values())) {
      cleanupConnection(connection);
      try {
        connection.res.end();
      } catch {
        // no-op: connection may already be closed
      }
    }
  }
  connections.clear();

  if (subscriber) {
    closingSubscriber = true;
    try {
      await subscriber.unsubscribe(CHANNEL);
    } catch (err) {
      logger.warn({ err }, "[Realtime] Failed to unsubscribe channel");
    }
    try {
      await subscriber.quit();
    } catch (err) {
      logger.warn({ err }, "[Realtime] Failed to close subscriber");
    } finally {
      subscriber = null;
    }
  }
  publisher = null;
  realtimeInitialized = false;
  closingSubscriber = false;
}

void ensureRealtimePubSub();
