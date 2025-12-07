import type { Response } from "express";
import { setInterval, clearInterval } from "node:timers";
import logger from "./logger";
import Redis from "ioredis";

type SseEvent =
  | { event: "connected"; data: { connected: true } }
  | { event: "heartbeat"; data: Record<string, never> }
  | { event: "invalidate"; data: { keys: string[] } };

type SseConnection = {
  res: Response;
  heartbeat: NodeJS.Timeout | null;
};

const HEARTBEAT_INTERVAL_MS = 30_000;

const connections = new Map<number, Set<SseConnection>>();

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
  connections.forEach((set, userId) => {
    if (set.delete(connection) && set.size === 0) {
      connections.delete(userId);
    }
  });
}

function createHeartbeat(connection: SseConnection) {
  const interval = setInterval(() => {
    writeEvent(connection, { event: "heartbeat", data: {} });
  }, HEARTBEAT_INTERVAL_MS);
  interval.unref();
  return interval;
}

export function registerRealtimeClient(res: Response, userId: number) {
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

const REDIS_URL = process.env.REDIS_URL;
const CHANNEL = "realtime:events";

let publisher: any = null;
let subscriber: any = null;

const disableFlag = (process.env.DISABLE_REDIS ?? "").toLowerCase();
const redisDisabled =
  (process.env.NODE_ENV ?? "").toLowerCase() === "test" ||
  disableFlag === "true" ||
  disableFlag === "1" ||
  disableFlag === "yes" ||
  disableFlag === "on";

if (REDIS_URL && !redisDisabled) {
  try {
    publisher = new Redis(REDIS_URL);
    subscriber = new Redis(REDIS_URL);

    subscriber.subscribe(CHANNEL, (err: unknown) => {
      if (err) {
        logger.error({ err }, "Failed to subscribe to realtime channel");
      } else {
        logger.info("Subscribed to realtime channel");
      }
    });

    subscriber.on("message", (channel: string, message: string) => {
      if (channel === CHANNEL) {
        try {
          const { recipients, keys } = JSON.parse(message);
          localBroadcastInvalidation(recipients, keys);
        } catch (err) {
          logger.warn({ err }, "Failed to parse realtime message");
        }
      }
    });

    logger.info("Redis realtime Pub/Sub initialized");
  } catch (err) {
    logger.warn({ err }, "Failed to initialize Redis for realtime");
    publisher = null;
    subscriber = null;
  }
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

  const uniqueTargets: number[] = [];
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    if (!uniqueTargets.includes(target)) {
      uniqueTargets.push(target);
    }
  }

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
  if (publisher) {
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
  "/api/orders/shop",
  "/api/orders/shop/recent",
  "/api/returns/shop",
  "shopDashboardStats",
];

export function notifyNotificationChange(userId: number | null | undefined) {
  if (userId == null) return;
  broadcastInvalidation(userId, NOTIFICATION_KEYS);
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
