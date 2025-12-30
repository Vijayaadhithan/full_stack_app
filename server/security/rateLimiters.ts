import rateLimit, { type Options, type RateLimitRequestHandler } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedisClient } from "../cache";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

// Reusable defaults so our sensitive endpoints behave consistently.
const defaultSensitiveConfig: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
};

const disableRateLimiters =
  String(process.env.DISABLE_RATE_LIMITERS || "").toLowerCase() === "true";

function noopLimiter(): RateLimitRequestHandler {
  const handler = ((_, __, next) => next()) as RateLimitRequestHandler;
  handler.resetKey = () => { };
  handler.getKey = async () => undefined;
  return handler;
}

function buildLimiter(options: Partial<Options>): RateLimitRequestHandler {
  if (disableRateLimiters) {
    return noopLimiter();
  }
  const config = {
    ...defaultSensitiveConfig,
    ...options,
  } as Options;

  if (process.env.REDIS_URL) {
    config.store = new RedisStore({
      sendCommand: async (...args: string[]) => {
        const client = await getRedisClient();
        if (client) {
          return client.sendCommand(args);
        }
        throw new Error("Redis client not available");
      },
    });
  }

  return rateLimit(config);
}

export const loginLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 10,
  message: { message: "Too many login attempts. Try again later." },
});

export const registerLimiter = buildLimiter({
  windowMs: ONE_HOUR_MS,
  max: 10,
  message: { message: "Too many signups from this IP. Try later." },
});

export const verifyEmailLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 30,
});

export const googleAuthLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 20,
});

export const deleteAccountLimiter = buildLimiter({
  windowMs: ONE_HOUR_MS,
  max: 5,
});

export const requestPasswordResetLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 5,
  message: { message: "Too many password reset requests. Try later." },
});

export const resetPasswordLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 10,
});

export const adminLoginRateLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 10,
});

export const emailLookupLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 30,
});

export const magicLinkRequestLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 5,
  message: { message: "Too many magic link requests. Try later." },
});

export const magicLinkLoginLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 20,
});

export const usernameLookupLimiter = buildLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 30,
});
