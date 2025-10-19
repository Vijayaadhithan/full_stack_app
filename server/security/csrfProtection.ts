import type { Request, RequestHandler } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const DEFAULT_IGNORE_METHODS = ["GET", "HEAD", "OPTIONS"];
const TOKEN_SEPARATOR = ".";
const SECRET_SESSION_KEY = "__csrfSecret";

type CsrfRequest = Request & {
  session?: Request["session"] & {
    [SECRET_SESSION_KEY]?: string;
  };
};

type CsrfOptions = {
  ignoreMethods?: string[];
};

declare global {
  namespace Express {
    interface Request {
      csrfToken: () => string;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    [SECRET_SESSION_KEY]?: string;
  }
}

const TOKEN_HEADER_NAMES = [
  "csrf-token",
  "xsrf-token",
  "x-csrf-token",
  "x-xsrf-token",
];

function normalizeMethod(method: string | undefined): string {
  return (method ?? "GET").toUpperCase();
}

function ensureSecret(req: CsrfRequest): string {
  if (!req.session) {
    throw new Error(
      "Session middleware must be mounted before CSRF protection middleware.",
    );
  }

  if (typeof req.session[SECRET_SESSION_KEY] === "string") {
    return req.session[SECRET_SESSION_KEY]!;
  }

  const secret = randomBytes(32).toString("hex");
  req.session[SECRET_SESSION_KEY] = secret;
  return secret;
}

function createToken(secret: string): string {
  const nonceBuffer = randomBytes(32);
  const nonce = nonceBuffer.toString("hex");
  const signature = createHmac("sha256", secret)
    .update(nonceBuffer)
    .digest("hex");
  return `${nonce}${TOKEN_SEPARATOR}${signature}`;
}

function constantTimeCompare(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(provided, "hex");
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function verifyToken(secret: string, token: string): boolean {
  const [nonce, providedSignature] = token.split(TOKEN_SEPARATOR);
  if (!nonce || !providedSignature) {
    return false;
  }

  if (
    nonce.length % 2 !== 0 ||
    providedSignature.length % 2 !== 0 ||
    !/^[a-f0-9]+$/i.test(nonce) ||
    !/^[a-f0-9]+$/i.test(providedSignature)
  ) {
    return false;
  }

  const nonceBuffer = Buffer.from(nonce, "hex");
  const expectedSignature = createHmac("sha256", secret)
    .update(nonceBuffer)
    .digest("hex");

  return constantTimeCompare(expectedSignature, providedSignature);
}

function extractToken(req: Request): string | undefined {
  for (const headerName of TOKEN_HEADER_NAMES) {
    const rawHeader = req.headers[headerName];
    if (typeof rawHeader === "string" && rawHeader.trim()) {
      return rawHeader.trim();
    }
    if (Array.isArray(rawHeader) && rawHeader.length > 0) {
      const candidate = rawHeader.find((value) => value && value.trim().length);
      if (candidate) {
        return candidate.trim();
      }
    }
  }

  const body = req.body as Record<string, unknown> | undefined;
  if (body && typeof body === "object") {
    const bodyToken = body._csrf;
    if (typeof bodyToken === "string" && bodyToken.trim()) {
      return bodyToken.trim();
    }
  }

  const query = req.query as Record<string, unknown> | undefined;
  if (query && typeof query === "object") {
    const queryToken = query._csrf;
    if (typeof queryToken === "string" && queryToken.trim()) {
      return queryToken.trim();
    }
  }

  return undefined;
}

function attachTokenGenerator(req: CsrfRequest, secret: string): void {
  req.csrfToken = () => createToken(secret);
}

function createCsrfError(message: string): Error & {
  code: string;
  status: number;
} {
  const error = new Error(message) as Error & {
    code: string;
    status: number;
  };
  error.code = "EBADCSRFTOKEN";
  error.status = 403;
  return error;
}

export function createCsrfProtection(options?: CsrfOptions): RequestHandler {
  const ignoredMethods =
    options?.ignoreMethods?.map((method) => method.toUpperCase()) ?? [];
  const ignoreSet = new Set([
    ...DEFAULT_IGNORE_METHODS.map((method) => method.toUpperCase()),
    ...ignoredMethods,
  ]);

  return (req, _res, next) => {
    let secret: string;
    try {
      secret = ensureSecret(req as CsrfRequest);
    } catch (err) {
      return next(err);
    }

    attachTokenGenerator(req as CsrfRequest, secret);

    const method = normalizeMethod(req.method);
    if (ignoreSet.has(method)) {
      return next();
    }

    const providedToken = extractToken(req);
    if (!providedToken) {
      return next(createCsrfError("Missing CSRF token"));
    }

    if (!verifyToken(secret, providedToken)) {
      return next(createCsrfError("Invalid CSRF token"));
    }

    return next();
  };
}
