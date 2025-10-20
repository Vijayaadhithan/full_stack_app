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
import { Server as HttpsServer } from "https";
import { getNetworkConfig } from "../config/network";
// Import your email service here
//import { sendEmail } from "./emailService";
import { startBookingExpirationJob } from "./jobs/bookingExpirationJob";
import { startPaymentReminderJob } from "./jobs/paymentReminderJob";
import { ensureDefaultAdmin } from "./bootstrap";
import { reportError } from "./monitoring/errorReporter";
import { trackRequestStart } from "./monitoring/metrics";

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

function mountStaticAssets() {
  if (staticAssetsMounted) return;

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
    return;
  }

  logger.info({ staticAssetsDir }, "Serving static client assets");

  app.use(express.static(staticAssetsDir));
  app.get("*", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }

    const requestPath = req.path || req.originalUrl || "";
    if (requestPath.startsWith("/api") || requestPath.startsWith("/uploads/")) {
      return next();
    }

    res.sendFile(indexHtmlPath);
  });

  staticAssetsMounted = true;
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

const helmetConfig: HelmetOptions = {
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "no-referrer" },
  frameguard: { action: "deny" },
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  ...(isProduction
    ? {
        hsts: { maxAge: 60 * 60 * 24 * 365, includeSubDomains: true, preload: true },
      }
    : {
        contentSecurityPolicy: false,
        hsts: false,
      }),
};

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
app.use(express.json());
app.use(
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

// Initialize scheduled jobs
export async function startServer(port?: number) {
  // Initialize scheduled jobs
  if (process.env.NODE_ENV !== "test") {
    startBookingExpirationJob(dbStorage);
    startPaymentReminderJob(dbStorage);
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

    const errorForLog = err instanceof Error ? err : new Error(message);
    logger.error(
      {
        err: errorForLog,
        errorId,
        status,
        path: req.originalUrl,
        method: req.method,
      },
      "Unhandled request error",
    );

    if (isProduction) {
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
  return server;
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
