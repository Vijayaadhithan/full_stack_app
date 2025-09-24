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
// Import your email service here
//import { sendEmail } from "./emailService";
import { startBookingExpirationJob } from "./jobs/bookingExpirationJob";
import { startPaymentReminderJob } from "./jobs/paymentReminderJob";
import { ensureDefaultAdmin } from "./bootstrap";
import { reportError } from "./monitoring/errorReporter";
import { trackRequestStart } from "./monitoring/metrics";

config();
// Read allowed CORS origins from environment variable (comma separated)
// Allow requests from production frontend and local development
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
].filter(Boolean) as string[];

const isProduction = process.env.NODE_ENV === "production";

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
app.use(cors({ origin: allowedOrigins, credentials: true }));
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

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      resolve();
    });
  });
  return server;
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
