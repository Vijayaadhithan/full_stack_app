import express, { type Request, Response, NextFunction } from "express";
import helmet, { type HelmetOptions } from "helmet";
import { registerRoutes } from "./routes"; // Changed from ./routes/index
import adminRoutes from "./routes/admin";
//import { setupVite, serveStatic, log } from "./vite";
import { storage as dbStorage } from "./storage";
import { config } from "dotenv";
import logger from "./logger";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Server as HttpServer } from "node:http";
import { Server as HttpsServer } from "https";
import { getNetworkConfig } from "../config/network";
// Import your email service here
//import { sendEmail } from "./emailService";
import { startBookingExpirationJob } from "./jobs/bookingExpirationJob";
import { startPaymentReminderJob } from "./jobs/paymentReminderJob";
import { ensureDefaultAdmin } from "./bootstrap";
import { reportError } from "./monitoring/errorReporter";
import { getMonitoringSnapshot, trackRequestStart } from "./monitoring/metrics";
import { startLowStockDigestJob } from "./jobs/lowStockDigestJob";
import { closeJobQueue, getJobQueue, initializeWorker } from "./jobQueue";
import { registerPushNotificationDispatchJob } from "./jobs/pushNotificationDispatchJob";
import { getRequestMetadata } from "./requestContext";
import {
  closeRedisConnection as closeQueueRedisConnection,
  getRedisConnection,
  isQueueRedisEnabled,
} from "./queue/connection";
import { closeRealtimeConnections } from "./realtime";
import { closeConnection as closeDatabaseConnection, testConnection } from "./db";
import { closeRedisConnection as closeCacheRedisConnection } from "./services/cache.service";

config();

const networkConfig = getNetworkConfig();

if (networkConfig?.frontendUrl && !process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL = networkConfig.frontendUrl;
}

if (networkConfig?.appBaseUrl && !process.env.APP_BASE_URL) {
  process.env.APP_BASE_URL = networkConfig.appBaseUrl;
}

if (
  networkConfig?.allowedOrigins?.length &&
  !process.env.ALLOWED_ORIGINS
) {
  process.env.ALLOWED_ORIGINS = networkConfig.allowedOrigins.join(",");
}

if (networkConfig?.devServerHost && !process.env.DEV_SERVER_HOST) {
  process.env.DEV_SERVER_HOST = networkConfig.devServerHost;
}

if (networkConfig?.apiProxyTarget && !process.env.API_PROXY_TARGET) {
  process.env.API_PROXY_TARGET = networkConfig.apiProxyTarget;
}

const envConfiguredOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : [];

const configuredOrigins = [
  ...envConfiguredOrigins,
  ...(networkConfig?.allowedOrigins ?? []),
].filter((origin) => origin.length > 0);

const defaultOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

const candidateOrigins = [
  process.env.FRONTEND_URL,
  process.env.APP_BASE_URL,
  networkConfig?.frontendUrl,
  networkConfig?.appBaseUrl,
];

for (const origin of candidateOrigins) {
  if (origin && origin.trim().length > 0) {
    defaultOrigins.push(origin.trim());
  }
}

const devServerHosts = [
  process.env.DEV_SERVER_HOST,
  networkConfig?.devServerHost,
].filter((value): value is string => Boolean(value && value.trim().length > 0));

for (const host of devServerHosts) {
  const trimmed = host.trim();
  defaultOrigins.push(`http://${trimmed}:5173`);
  defaultOrigins.push(`http://${trimmed}:5000`);
}

const allowedOrigins = Array.from(
  new Set([...configuredOrigins, ...defaultOrigins]),
);
const isProduction = process.env.NODE_ENV === "production";
const wildcardRequested = allowedOrigins.includes("*");
const effectiveOrigins = allowedOrigins.filter((origin) => origin !== "*");

if (isProduction && wildcardRequested) {
  if (effectiveOrigins.length === 0) {
    const message =
      "Wildcard CORS origin is not permitted in production. Configure explicit origins.";
    logger.error({ allowedOrigins }, message);
    throw new Error(message);
  }
  logger.warn(
    { allowedOrigins: effectiveOrigins },
    "Ignoring wildcard CORS origin in production; configure explicit origins instead",
  );
}

const corsAllowedOrigins = isProduction ? effectiveOrigins : allowedOrigins;
const allowAllOrigins =
  !isProduction && process.env.STRICT_CORS !== "true";

if (isProduction && corsAllowedOrigins.length === 0) {
  const message =
    "No CORS origins configured for production. Set ALLOWED_ORIGINS or network config.";
  logger.error(message);
  throw new Error(message);
}

type OriginMatcher = {
  value: string;
  test: (origin: string) => boolean;
};

const SPECIAL_CHARS_REGEX = /[-/\\^$*+?.()|[\]{}]/g;

function escapeRegex(input: string): string {
  return input.replace(SPECIAL_CHARS_REGEX, "\\$&");
}

const originMatchers: OriginMatcher[] = corsAllowedOrigins
  .filter((origin) => origin !== "*")
  .map((origin) => {
    if (origin.includes("*")) {
      const pattern = origin
        .split("*")
        .map((segment) => escapeRegex(segment))
        .join(".*");
      const regex = new RegExp(`^${pattern}$`);
      return {
        value: origin,
        test: (candidate: string) => regex.test(candidate),
      };
    }

    return {
      value: origin,
      test: (candidate: string) => candidate === origin,
    };
  });

const staticAssetsDir = process.env.CLIENT_DIST_DIR
  ? path.resolve(process.env.CLIENT_DIST_DIR)
  : path.resolve(process.cwd(), "dist", "public");
let staticAssetsMounted = false;
const IMMUTABLE_ASSET_PATTERN = /^assets\/.+-[A-Za-z0-9_-]{8,}\.[^/]+$/;

function getStaticCacheControl(filePath: string): string {
  const relativePath = path
    .relative(staticAssetsDir, filePath)
    .split(path.sep)
    .join("/");

  if (relativePath === "index.html") {
    return "public, max-age=0, must-revalidate";
  }

  if (IMMUTABLE_ASSET_PATTERN.test(relativePath)) {
    return "public, max-age=31536000, immutable";
  }

  if (
    relativePath === "site.webmanifest" ||
    relativePath === "firebase-messaging-sw.js"
  ) {
    return "public, max-age=0, must-revalidate";
  }

  if (
    relativePath.endsWith(".png") ||
    relativePath.endsWith(".svg") ||
    relativePath.endsWith(".webp") ||
    relativePath.endsWith(".ico")
  ) {
    return "public, max-age=86400, must-revalidate";
  }

  return "public, max-age=3600, must-revalidate";
}

function mountStaticAssets() {
  if (staticAssetsMounted) return;

  // Skip static file serving if explicitly disabled (for API-only deployments)
  if (process.env.DISABLE_STATIC_FILES === "true") {
    logger.info("Static file serving disabled via DISABLE_STATIC_FILES");
    mountFallbackRootRoute();
    return;
  }

  const indexHtmlPath = path.join(staticAssetsDir, "index.html");
  const staticDirExists = fs.existsSync(staticAssetsDir);
  const indexHtmlExists = staticDirExists && fs.existsSync(indexHtmlPath);

  if (!staticDirExists || !indexHtmlExists) {
    logger.warn(
      {
        staticAssetsDir,
        indexHtmlExists,
      },
      "Static client bundle not found; skipping static file serving",
    );
    mountFallbackRootRoute();
    return;
  }

  logger.info({ staticAssetsDir }, "Serving static client assets");

  app.use(
    express.static(staticAssetsDir, {
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        res.setHeader("Cache-Control", getStaticCacheControl(filePath));
      },
    }),
  );
  app.get("*", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }

    const requestPath = req.path || req.originalUrl || "";
    if (requestPath.startsWith("/api") || requestPath.startsWith("/uploads/")) {
      return next();
    }

    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.sendFile(indexHtmlPath);
  });

  staticAssetsMounted = true;
}

// Fallback root route for when static files are not available (API-only mode)
function mountFallbackRootRoute() {
  app.get("/", (_req, res) => {
    res.json({
      name: "DoorstepTN API",
      status: "ok",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      docs: "/api/docs",
      health: "/api/health",
      message: "Frontend not available. This server is running in API-only mode.",
    });
  });
}

function logAccessibleAddresses(port: number, scheme: "http" | "https") {
  const networks = os.networkInterfaces();
  const urls = new Set<string>();

  for (const entries of Object.values(networks)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (!entry || entry.internal || entry.family !== "IPv4") continue;
      urls.add(`${scheme}://${entry.address}:${port}`);
    }
  }

  if (urls.size === 0) {
    logger.info("No external IPv4 addresses detected for local network access");
    return;
  }

  logger.info({ urls: Array.from(urls) }, "Local network URLs for this server");
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const READINESS_TIMEOUT_MS = parsePositiveInt(
  process.env.READINESS_TIMEOUT_MS,
  2_000,
);
const SHUTDOWN_TIMEOUT_MS = parsePositiveInt(
  process.env.SHUTDOWN_TIMEOUT_MS,
  15_000,
);
let shutdownInProgress = false;
let shutdownHooksInstalled = false;

function isRedisExpectedForRuntime(): boolean {
  if ((process.env.NODE_ENV ?? "").toLowerCase() === "test") {
    return false;
  }
  return isQueueRedisEnabled();
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref();
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function closeHttpServer(server: HttpServer | HttpsServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err?: Error) => {
      if (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ERR_SERVER_NOT_RUNNING") {
          resolve();
          return;
        }
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function runGracefulShutdown(
  signal: NodeJS.Signals,
  server: HttpServer | HttpsServer,
): Promise<void> {
  if (shutdownInProgress) {
    logger.warn({ signal }, "Shutdown already in progress");
    return;
  }
  shutdownInProgress = true;
  logger.info({ signal }, "Shutdown signal received; draining resources");

  const forceExitTimer = setTimeout(() => {
    logger.error(
      { signal, shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS },
      "Forced shutdown after timeout",
    );
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS + 2_000);
  forceExitTimer.unref();

  const shutdownTasks: Array<{ name: string; run: () => Promise<void> }> = [
    { name: "http-server", run: () => closeHttpServer(server) },
    { name: "job-queue", run: () => closeJobQueue() },
    { name: "queue-redis", run: () => closeQueueRedisConnection() },
    { name: "realtime-redis", run: () => closeRealtimeConnections() },
    { name: "cache-redis", run: () => closeCacheRedisConnection() },
    { name: "database", run: () => closeDatabaseConnection() },
  ];

  let shutdownFailed = false;
  for (const task of shutdownTasks) {
    try {
      await withTimeout(task.run(), SHUTDOWN_TIMEOUT_MS, task.name);
      logger.info({ resource: task.name }, "Shutdown step completed");
    } catch (err) {
      shutdownFailed = true;
      logger.error({ err, resource: task.name }, "Shutdown step failed");
    }
  }

  clearTimeout(forceExitTimer);
  logger.info(
    { signal, shutdownFailed },
    "Shutdown sequence complete",
  );
  process.exit(shutdownFailed ? 1 : 0);
}

function installGracefulShutdownHooks(server: HttpServer | HttpsServer): void {
  if (shutdownHooksInstalled) return;
  shutdownHooksInstalled = true;

  process.once("SIGINT", () => {
    void runGracefulShutdown("SIGINT", server);
  });
  process.once("SIGTERM", () => {
    void runGracefulShutdown("SIGTERM", server);
  });
}

const helmetConfig: HelmetOptions = {
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
  hsts: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: { action: "deny" },
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
};

const STRICT_TRANSPORT_SECURITY_HEADER =
  "max-age=31536000; includeSubDomains; preload";
const PERMISSIONS_POLICY_HEADER =
  "accelerometer=(), autoplay=(), camera=(), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(), payment=(self), usb=()";
const CONTENT_SECURITY_POLICY_HEADER = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' https://www.gstatic.com https://www.google.com/recaptcha/ https://www.recaptcha.net/recaptcha/",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://www.google.com https://www.gstatic.com https://*.tile.openstreetmap.org https://*.openstreetmap.org",
  "connect-src 'self' https://api.doorsteptn.in https://*.googleapis.com https://*.google.com https://*.gstatic.com https://*.firebaseio.com https://*.firebaseapp.com",
  "frame-src 'self' https://www.google.com/recaptcha/ https://www.recaptcha.net/recaptcha/",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self' blob: data:",
  "upgrade-insecure-requests",
].join("; ");

const MASK_PATTERNS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "session",
  "api-key",
  "apikey",
  "accesskey",
  "refresh-token",
  "refreshtoken",
];
const LOGGABLE_HEADERS = [
  "user-agent",
  "accept",
  "accept-language",
  "referer",
  "content-type",
  "content-length",
  "x-request-id",
  "x-correlation-id",
  "x-trace-id",
  "traceparent",
  "x-forwarded-for",
];
const MAX_SANITIZE_DEPTH = 3;
const MAX_STRING_LENGTH = 200;

export function shouldMaskKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return MASK_PATTERNS.some((pattern) => lowerKey.includes(pattern));
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_SANITIZE_DEPTH) return "[Truncated]";

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[buffer:${value.length}]`;
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<
      Record<string, unknown>
    >((acc, [key, val]) => {
      acc[key] = shouldMaskKey(key)
        ? "[REDACTED]"
        : sanitizeValue(val, depth + 1);
      return acc;
    }, {});
  }

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  }

  return value;
}

export function sanitizeRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  return sanitizeValue(value) as Record<string, unknown>;
}

export function sanitizeBody(body: unknown): unknown {
  if (body === undefined || body === null) return body;
  if (Buffer.isBuffer(body)) return `[buffer:${body.length}]`;
  if (typeof body === "string") {
    return body.length ? "[string body omitted]" : body;
  }
  if (typeof body === "object") {
    return sanitizeValue(body);
  }
  return body;
}

export function sanitizeHeaders(
  headers: Request["headers"],
): Record<string, string | string[]> | undefined {
  const result: Record<string, string | string[]> = {};
  for (const header of LOGGABLE_HEADERS) {
    const value = headers[header];
    if (value !== undefined) {
      result[header] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function extractStatusCode(error: unknown): number {
  if (error && typeof error === "object") {
    const candidate = (error as { status?: unknown }).status;
    const candidateCode = (error as { statusCode?: unknown }).statusCode;
    const status =
      typeof candidate === "number"
        ? candidate
        : typeof candidateCode === "number"
          ? candidateCode
          : undefined;
    if (typeof status === "number" && status >= 400 && status <= 599) {
      return status;
    }
  }

  return 500;
}

export function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Internal Server Error";
}

export const app = express();
// Security headers and proxy/IP handling
app.disable("x-powered-by");
// Trust first proxy (needed for correct client IPs behind proxies/load balancers)
app.set("trust proxy", 1);
app.use(helmet(helmetConfig));

const API_BASE_PREFIX = "/api";
const API_VERSION = "v1";
const VERSIONED_API_PREFIX = `${API_BASE_PREFIX}/${API_VERSION}`;
const UNSUPPORTED_API_VERSION_PATTERN = /^\/api\/v[0-9]+(?:\/|$)/i;

// Keep critical headers explicit so they remain stable across proxy/CDN setups.
app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", PERMISSIONS_POLICY_HEADER);
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", STRICT_TRANSPORT_SECURITY_HEADER);
    res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY_HEADER);
  }
  next();
});
app.use((req, res, next) => {
  const requestPath = req.path;

  if (
    requestPath === VERSIONED_API_PREFIX ||
    requestPath.startsWith(`${VERSIONED_API_PREFIX}/`)
  ) {
    req.url = req.url.replace(/^\/api\/v1(?=\/|$)/i, API_BASE_PREFIX);
    (res.locals as { apiVersion?: string }).apiVersion = API_VERSION;
    res.setHeader("x-api-version", API_VERSION);
    return next();
  }

  if (UNSUPPORTED_API_VERSION_PATTERN.test(requestPath)) {
    const requestedVersion = requestPath.split("/")[2] ?? "unknown";
    return res.status(400).json({
      message: `Unsupported API version '${requestedVersion}'. Supported versions: ${API_VERSION}.`,
    });
  }

  if (requestPath === API_BASE_PREFIX || requestPath.startsWith(`${API_BASE_PREFIX}/`)) {
    (res.locals as { apiVersion?: string }).apiVersion = API_VERSION;
    res.setHeader("x-api-version", API_VERSION);
    res.setHeader("Deprecation", "true");
    const sunset = process.env.API_LEGACY_SUNSET_DATE?.trim();
    if (sunset) {
      res.setHeader("Sunset", sunset);
    }
    res.append("Link", `</api/${API_VERSION}>; rel="successor-version"`);
  }

  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));
app.use(
  "/api",
  cors({
    origin: allowAllOrigins
      ? true
      : (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }
        const isAllowed = originMatchers.some((matcher) => matcher.test(origin));
        if (isAllowed) {
          return callback(null, true);
        }
        logger.warn({ origin, allowedOrigins: corsAllowedOrigins }, "Blocked CORS origin");
        return callback(new Error("Not allowed by CORS"));
      },
    credentials: true,
  }),
);
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use((req, res, next) => {
  const endTimer = trackRequestStart();
  const finalize = () => {
    const routePath = req.route?.path
      ? `${req.baseUrl || ""}${req.route.path}`
      : req.originalUrl?.split("?")[0] || req.path;
    let status = res.statusCode;
    if (!res.headersSent && !res.writableEnded) {
      status = 499;
    }
    endTimer({
      method: req.method,
      path: routePath,
      status,
    });
  };

  res.once("finish", finalize);
  res.once("close", finalize);

  next();
});
// Note: admin routes require session. We mount them AFTER setupAuth (called in registerRoutes).

if (process.env.NODE_ENV === "test" && !process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = "test-session-secret";
}

const registerRoutesPromise = registerRoutes(app).catch((error) => {
  logger.error({ err: error }, "Failed to register routes");
  throw error;
});

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Basic service info
 */
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

app.get("/api/health/system", (_req, res) => {
  const snapshot = getMonitoringSnapshot();
  res.status(200).json({
    updatedAt: snapshot.updatedAt,
    resources: snapshot.resources,
  });
});

/**
 * @openapi
 * /api/health/ready:
 *   get:
 *     summary: Readiness check
 *     responses:
 *       200:
 *         description: Service can accept traffic
 *       503:
 *         description: One or more dependencies are unavailable
 */
app.get("/api/health/ready", async (_req, res) => {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  let ready = true;

  try {
    const databaseReady = await withTimeout(
      testConnection({ quiet: true }),
      READINESS_TIMEOUT_MS,
      "database-readiness",
    );
    checks.database = {
      ok: databaseReady,
      detail: databaseReady ? "reachable" : "unreachable",
    };
    if (!databaseReady) ready = false;
  } catch (err) {
    ready = false;
    checks.database = { ok: false, detail: "unreachable" };
    logger.warn({ err }, "Database readiness probe failed");
  }

  if (isRedisExpectedForRuntime()) {
    try {
      await withTimeout(
        getRedisConnection().ping(),
        READINESS_TIMEOUT_MS,
        "redis-readiness",
      );
      checks.redis = { ok: true, detail: "reachable" };
    } catch (err) {
      ready = false;
      checks.redis = { ok: false, detail: "unreachable" };
      logger.warn({ err }, "Redis readiness probe failed");
    }

    try {
      const queue = getJobQueue();
      await withTimeout(
        queue.waitUntilReady(),
        READINESS_TIMEOUT_MS,
        "bullmq-readiness",
      );
      checks.bullmq = { ok: true, detail: "ready" };
    } catch (err) {
      ready = false;
      checks.bullmq = { ok: false, detail: "not-ready" };
      logger.warn({ err }, "BullMQ readiness probe failed");
    }
  } else {
    checks.redis = { ok: true, detail: "disabled" };
    checks.bullmq = { ok: true, detail: "disabled" };
  }

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    timestamp: Date.now(),
    checks,
  });
});

// Initialize scheduled jobs
export async function startServer(port?: number) {
  // Register handlers before starting worker so pending jobs always have processors.
  if (process.env.NODE_ENV !== "test") {
    registerPushNotificationDispatchJob(dbStorage);
    if (isQueueRedisEnabled()) {
      startBookingExpirationJob(dbStorage);
      startPaymentReminderJob(dbStorage);
      startLowStockDigestJob(dbStorage);
      initializeWorker();
    } else {
      logger.warn(
        "Redis-backed background jobs are disabled because DISABLE_REDIS is enabled or REDIS_URL is missing.",
      );
    }
  }

  const server = await registerRoutesPromise;

  // Seed default admin if none exists
  try {
    await ensureDefaultAdmin();
  } catch (e) {
    logger.error("Failed to ensure default admin:", e);
  }

  // Mount admin routes after session has been initialized in setupAuth()
  app.use("/api/admin", adminRoutes);

  mountStaticAssets();

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "EBADCSRFTOKEN"
    ) {
      logger.warn(
        {
          path: req.originalUrl,
          method: req.method,
        },
        "CSRF token validation failed",
      );
      return res.status(403).json({ message: "Invalid or missing CSRF token" });
    }
    next(err);
  });

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    const status = extractStatusCode(err);
    const message = resolveErrorMessage(err);
    const errorId = randomUUID();
    const isClientError = status >= 400 && status < 500;
    const requestMeta = getRequestMetadata();

    const errorForLog = err instanceof Error ? err : new Error(message);
    logger.error(
      {
        err: errorForLog,
        errorId,
        status,
        path: req.originalUrl,
        method: req.method,
        requestId: requestMeta?.requestId,
        correlationId: requestMeta?.correlationId,
        traceId: requestMeta?.traceId,
        spanId: requestMeta?.spanId,
      },
      "Unhandled request error",
    );

    if (isProduction) {
      const tags: Record<string, string> = {};
      if (
        typeof requestMeta?.requestId === "string" &&
        requestMeta.requestId.trim().length > 0
      ) {
        tags.requestId = requestMeta.requestId;
      }
      if (
        typeof requestMeta?.traceId === "string" &&
        requestMeta.traceId.trim().length > 0
      ) {
        tags.traceId = requestMeta.traceId;
      }

      const requestContext = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        headers: sanitizeHeaders(req.headers),
        params: sanitizeRecord(req.params),
        query: sanitizeRecord(req.query),
        body: sanitizeBody(req.body),
      };

      const reportingPromise = reportError(err, {
        errorId,
        status,
        request: requestContext,
        tags: Object.keys(tags).length > 0 ? tags : undefined,
        extras: {
          correlationId: requestMeta?.correlationId,
          spanId: requestMeta?.spanId,
          parentSpanId: requestMeta?.parentSpanId,
          traceparent: requestMeta?.traceparent,
        },
      }).catch((reportingError) => {
        logger.error(
          {
            err:
              reportingError instanceof Error
                ? reportingError
                : new Error(String(reportingError)),
            errorId,
          },
          "Failed to report error to monitoring service",
        );
      });

      void reportingPromise;
    }

    if (res.headersSent) {
      return next(err);
    }

    const responsePayload: Record<string, unknown> = {
      message:
        !isProduction || isClientError
          ? message
          : "An unexpected error occurred. Please try again later.",
    };

    if (!isProduction) {
      if (errorForLog.stack) {
        responsePayload.stack = errorForLog.stack;
      }

      if (err && typeof err === "object" && "details" in err) {
        responsePayload.details = (err as { details?: unknown }).details;
      }
    } else {
      responsePayload.errorId = errorId;
    }

    res.status(status).json(responsePayload);
  });

  const PORT = port ?? parseInt(process.env.PORT || "5000", 10);
  const HOST = process.env.HOST || process.env.SERVER_HOST || "0.0.0.0";

  const scheme: "http" | "https" = server instanceof HttpsServer ? "https" : "http";

  await new Promise<void>((resolve) => {
    server.listen(PORT, HOST, () => {
      logger.info(`Server is running on ${scheme}://${HOST}:${PORT}`);
      logAccessibleAddresses(PORT, scheme);
      resolve();
    });
  });
  installGracefulShutdownHooks(server);
  return server;
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
