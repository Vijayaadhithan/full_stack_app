import rateLimit, { type Options } from "express-rate-limit";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

// Reusable defaults so our sensitive endpoints behave consistently.
const defaultSensitiveConfig: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
};

export const loginLimiter = rateLimit({
  ...defaultSensitiveConfig,
  windowMs: FIFTEEN_MINUTES_MS,
  max: 10,
  message: { message: "Too many login attempts. Try again later." },
});

export const registerLimiter = rateLimit({
  ...defaultSensitiveConfig,
  windowMs: ONE_HOUR_MS,
  max: 5,
  message: { message: "Too many signups from this IP. Try later." },
});

export const verifyEmailLimiter = rateLimit({
  ...defaultSensitiveConfig,
  windowMs: FIFTEEN_MINUTES_MS,
  max: 30,
});

export const googleAuthLimiter = rateLimit({
  ...defaultSensitiveConfig,
  windowMs: FIFTEEN_MINUTES_MS,
  max: 20,
});

export const deleteAccountLimiter = rateLimit({
  ...defaultSensitiveConfig,
  windowMs: ONE_HOUR_MS,
  max: 5,
});

export const requestPasswordResetLimiter = rateLimit({
  ...defaultSensitiveConfig,
  windowMs: FIFTEEN_MINUTES_MS,
  max: 5,
  message: { message: "Too many password reset requests. Try later." },
});

export const resetPasswordLimiter = rateLimit({
  ...defaultSensitiveConfig,
  windowMs: FIFTEEN_MINUTES_MS,
  max: 10,
});

export const adminLoginRateLimiter = rateLimit({
  ...defaultSensitiveConfig,
  windowMs: FIFTEEN_MINUTES_MS,
  max: 10,
});

export const emailLookupLimiter = rateLimit({
  ...defaultSensitiveConfig,
  windowMs: FIFTEEN_MINUTES_MS,
  max: 30,
});

export const magicLinkRequestLimiter = rateLimit({
  ...defaultSensitiveConfig,
  windowMs: FIFTEEN_MINUTES_MS,
  max: 5,
  message: { message: "Too many magic link requests. Try later." },
});

export const magicLinkLoginLimiter = rateLimit({
  ...defaultSensitiveConfig,
  windowMs: FIFTEEN_MINUTES_MS,
  max: 20,
});

export const usernameLookupLimiter = rateLimit({
  ...defaultSensitiveConfig,
  windowMs: FIFTEEN_MINUTES_MS,
  max: 30,
});
