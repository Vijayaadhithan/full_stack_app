import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express, type Request, type Response } from "express";
import { z } from "zod";
import session from "express-session";
import logger from "./logger";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { sendEmail, getWelcomeEmailContent } from "./emailService";
import {
  User as SelectUser,
  type InsertUser,
  emailVerificationTokens as emailVerificationTokensTable,
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import dotenv from "dotenv";
import {
  loginLimiter,
  registerLimiter,
  verifyEmailLimiter,
  googleAuthLimiter,
  deleteAccountLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
} from "./security/rateLimiters";
import { sanitizeUser } from "./security/sanitizeUser";
import {
  normalizeUsername,
  normalizeEmail,
  normalizePhone,
} from "./utils/identity";
import { sanitizeAndValidateSecret } from "./security/secretValidators";
dotenv.config();

declare module "express-session" {
  interface SessionData {
    returnTo?: string;
    signupRole?: SelectUser["role"]; // Added for Google OAuth role selection
  }
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const GOOGLE_CALLBACK_BASE_URL =
  process.env.GOOGLE_CALLBACK_BASE_URL?.trim() ||
  process.env.APP_BASE_URL?.trim() ||
  null;

const normalizedGoogleCallbackBaseUrl = GOOGLE_CALLBACK_BASE_URL
  ? GOOGLE_CALLBACK_BASE_URL.replace(/\/$/, "")
  : null;

type OtpRecord = {
  hash: string;
  expiresAt: number;
  attempts: number;
};

type OtpErrorReason = "missing" | "expired" | "too_many_attempts" | "mismatch";

type OtpValidationResult =
  | { valid: true }
  | {
      valid: false;
      reason: OtpErrorReason;
    };

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const otpStore = new Map<string, OtpRecord>();

function createOtpForPhone(phone: string) {
  const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
  const hash = createHash("sha256").update(otp).digest("hex");
  otpStore.set(phone, {
    hash,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
  return otp;
}

function validateOtpForPhone(phone: string, otp: string): OtpValidationResult {
  const entry = otpStore.get(phone);
  if (!entry) {
    return { valid: false, reason: "missing" };
  }
  if (entry.expiresAt < Date.now()) {
    otpStore.delete(phone);
    return { valid: false, reason: "expired" };
  }
  if (entry.attempts >= MAX_OTP_ATTEMPTS) {
    otpStore.delete(phone);
    return { valid: false, reason: "too_many_attempts" };
  }

  const hashedAttempt = createHash("sha256").update(otp).digest("hex");
  const isMatch = timingSafeEqual(
    Buffer.from(entry.hash, "hex"),
    Buffer.from(hashedAttempt, "hex"),
  );
  entry.attempts += 1;
  if (!isMatch) {
    otpStore.set(phone, entry);
    return { valid: false, reason: "mismatch" };
  }
  otpStore.delete(phone);
  return { valid: true };
}

function describeOtpError(reason: OtpErrorReason) {
  switch (reason) {
    case "expired":
      return "The code expired. Please request a new OTP.";
    case "mismatch":
      return "Incorrect OTP. Please try again.";
    case "too_many_attempts":
      return "Too many OTP attempts. Request a new code.";
    case "missing":
    default:
      return "Please request an OTP to continue.";
  }
}

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  logger.warn(
    "Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are not set. Google Sign-In will not work.",
  );
} else if (!normalizedGoogleCallbackBaseUrl) {
  logger.warn(
    "APP_BASE_URL (or GOOGLE_CALLBACK_BASE_URL) is not set. Google OAuth callback URL cannot be determined.",
  );
}

const googleRoleQuerySchema = z
  .object({
    role: z.string().trim().optional(),
  })
  .strict();

const verifyEmailQuerySchema = z
  .object({
    token: z.string().trim().min(1),
    userId: z.coerce.number().int().positive(),
  })
  .strict();

const PUBLIC_REGISTRATION_ROLES = ["customer", "provider", "shop"] as const;
type PublicRegistrationRole = (typeof PUBLIC_REGISTRATION_ROLES)[number];

const usernameRegex = /^[a-z0-9._-]+$/i;

const registrationSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(8, "Phone number must be at least 8 digits")
      .max(20, "Phone number must be at most 20 digits")
      .regex(/^\d+$/, "Phone number must contain digits only"),
    otp: z
      .string()
      .trim()
      .min(4, "Enter the code sent to your phone")
      .max(6, "Enter the code sent to your phone"),
    pin: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "PIN must be 4 digits"),
    role: z.enum(PUBLIC_REGISTRATION_ROLES).default("customer"),
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(100, "Name must be at most 100 characters"),
    language: z.string().trim().max(10).optional(),
    shopName: z.string().trim().max(120).optional(),
    email: z.string().trim().email("Invalid email address").optional(),
  })
  .strict();

const legacyRegistrationSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(32, "Username must be at most 32 characters")
      .regex(
        usernameRegex,
        "Username can only contain letters, numbers, dots, underscores, and hyphens",
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(64, "Password must be at most 64 characters long"),
    role: z.enum(PUBLIC_REGISTRATION_ROLES).default("customer"),
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(100, "Name must be at most 100 characters"),
    phone: z.string().trim().max(20).optional().default(""),
    email: z.string().trim().email("Invalid email address").optional(),
    language: z.string().trim().max(10).optional(),
  })
  .strict();

const otpRequestSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(8, "Phone number must be at least 8 digits")
      .max(20, "Phone number must be at most 20 digits")
      .regex(/^\d+$/, "Phone number must contain digits only"),
  })
  .strict();

declare global {
  namespace Express {
    interface User extends Omit<SelectUser, "password"> {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPasswordInternal(password: string) {
  // Exported for use in password reset
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(
  supplied: string,
  stored: string | null | undefined,
) {
  if (typeof stored !== "string" || stored.length === 0) {
    return false;
  }

  const parts = stored.split(".");
  if (parts.length !== 2) {
    logger.warn("Stored password hash has unexpected format");
    return false;
  }

  const [hashed, salt] = parts;
  if (!hashed || !salt) {
    return false;
  }

  try {
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    if (hashedBuf.length !== suppliedBuf.length) {
      return false;
    }
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    logger.warn({ err: error }, "Password comparison failed");
    return false;
  }
}

async function generateEmailVerificationToken(userId: number) {
  // In in-memory mode there is no backing users table for FK checks, so skip DB insert.
  if (process.env.USE_IN_MEMORY_DB === "true") {
    return randomBytes(32).toString("hex");
  }
  const token = randomBytes(32).toString("hex");
  const hashedToken = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(emailVerificationTokensTable).values({
    userId,
    token: hashedToken,
    expiresAt,
  });
  return token;
}

export function initializeAuth(app: Express) {
  const sessionSecret = sanitizeAndValidateSecret(
    "SESSION_SECRET",
    process.env.SESSION_SECRET,
    {
      minLength: 32,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSymbol: true,
      disallowedPatterns: [/secret/i, /password/i, /changeme/i, /admin/i],
      environment: process.env.NODE_ENV ?? "development",
    },
  );

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  };

  const cookieOptions = sessionSettings.cookie!;

  const configuredSameSite = process.env.SESSION_COOKIE_SAMESITE?.toLowerCase();
  if (configuredSameSite === "false" || configuredSameSite === "disabled") {
    cookieOptions.sameSite = false;
  } else if (configuredSameSite === "strict" || configuredSameSite === "lax") {
    cookieOptions.sameSite = configuredSameSite;
  } else if (configuredSameSite === "none") {
    cookieOptions.sameSite = "none";
    const secureOverride = process.env.SESSION_COOKIE_SECURE;
    if (secureOverride === "true") {
      cookieOptions.secure = true;
    } else if (secureOverride === "false") {
      cookieOptions.secure = false;
    } else {
      cookieOptions.secure = true;
    }
  }

  const cookieDomain = process.env.SESSION_COOKIE_DOMAIN;
  if (cookieDomain) {
    cookieOptions.domain = cookieDomain;
  }

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      {
        usernameField: "phone",
        passwordField: "pin",
        passReqToCallback: true,
      },
      async (
        reqOrIdentifier: any,
        maybeIdentifier: string,
        maybePin: string,
        maybeDone: any,
      ) => {
        // Support both signatures: (username, password, done) and (req, username, password, done)
        let req: any = reqOrIdentifier;
        let identifier = maybeIdentifier;
        let pin = maybePin;
        let done = maybeDone;
        if (typeof reqOrIdentifier === "string" || typeof reqOrIdentifier === "function") {
          req = undefined;
          identifier = reqOrIdentifier as unknown as string;
          pin = maybeIdentifier as unknown as string;
          done = maybePin as any;
        }

        const providedIdentifier =
          req?.body?.phone ??
          req?.body?.identifier ??
          req?.body?.username ??
          identifier ??
          "";
        const secret = req?.body?.pin ?? req?.body?.password ?? pin ?? "";

        const normalizedPhone = normalizePhone(providedIdentifier);
        const normalizedEmail = normalizeEmail(providedIdentifier);
        const normalizedUsername = normalizeUsername(providedIdentifier);

        let userRecord =
          normalizedPhone !== null
            ? await storage.getUserByPhone(normalizedPhone)
            : undefined;
        if (!userRecord && normalizedEmail) {
          userRecord = await storage.getUserByEmail(normalizedEmail);
        }
        if (!userRecord && normalizedUsername) {
          userRecord = await storage.getUserByUsername(normalizedUsername);
        }
        if (
          !userRecord ||
          !(await comparePasswords(secret, (userRecord as SelectUser).password))
        ) {
          return done(null, false);
        }
        // Block suspended users from logging in
        if ((userRecord as any)?.isSuspended) {
          return done(null, false);
        }
        const sanitizedUser = sanitizeUser(userRecord);
        return done(null, sanitizedUser ?? false);
      },
    ),
  );

  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && normalizedGoogleCallbackBaseUrl) {
    passport.use(
      new GoogleStrategy(
        {
          passReqToCallback: true, // Added to access req in callback for role selection
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL: `${normalizedGoogleCallbackBaseUrl}/auth/google/callback`,
          scope: ["profile", "email"],
          proxy: true,
        },
        async (
          req: any,
          accessToken: string,
          refreshToken: string,
          profile: any,
          done: any,
        ) => {
          // req added for role selection
          // Check if the profile, profile.id, or profile.emails are undefined or empty
          if (
            !profile ||
            !profile.id ||
            !profile.emails ||
            profile.emails.length === 0 ||
            !profile.emails[0].value
          ) {
            logger.info(
              "[Google OAuth] Profile data is incomplete or user backed out. Failing authentication.",
            );
            // Signal authentication failure. This should trigger the failureRedirect.
            return done(null, false, {
              message:
                "Google profile data incomplete or authentication aborted by user.",
            });
          }
          logger.info(`[Google OAuth] Received profile for ${profile.id}`);
          try {
            logger.info(
              `[Google OAuth] Attempting to find user by Google ID: ${profile.id}`,
            );
            let user = await storage.getUserByGoogleId(profile.id);
            logger.info(
              "[Google OAuth] User found by Google ID:",
              user ? user.id : "null",
            );
            if (user) {
              // Block suspended users
              if ((user as any)?.isSuspended) {
                return done(null, false, { message: "Account suspended" });
              }
              const safeUser = sanitizeUser(user);
              return done(null, safeUser ?? false);
            }

            if (profile.emails && profile.emails.length > 0) {
              const email = profile.emails[0].value;
              logger.info(
                `[Google OAuth] Attempting to find user by email: ${email}`,
              );
              user = await storage.getUserByEmail(email);
              logger.info(
                "[Google OAuth] User found by email:",
                user ? user.id : "null",
              );
              if (user) {
                // Link Google ID to existing user
                logger.info(
                  `[Google OAuth] Linking Google ID ${profile.id} to existing user ${user.id} with email ${email}`,
                );
                user.googleId = profile.id;
                // Potentially mark email as verified if Google says so
                // user.emailVerified = profile.emails[0].verified;
                await storage.updateUser(user.id, {
                  googleId: profile.id,
                  emailVerified: profile.emails[0].verified,
                });
                if ((user as any)?.isSuspended) {
                  return done(null, false, { message: "Account suspended" });
                }
                const safeUser = sanitizeUser(user);
                return done(null, safeUser ?? false);
              }
            }

            // Create new user
            logger.info(
              "[Google OAuth] No existing user found by Google ID or email. Proceeding to create a new user.",
            );
            const signupRoleFromSession = req.session.signupRole;
            if (req.session.signupRole) {
              delete req.session.signupRole; // Clean up session
            }

            const newUser = {
              username:
                profile.displayName || profile.emails?.[0].value || profile.id, // Ensure username is unique or handle collision
              role: signupRoleFromSession || ("customer" as SelectUser["role"]), // Use role from session or default
              name: profile.displayName || "",
              email: profile.emails?.[0].value || "",
              emailVerified: profile.emails?.[0].verified || false, // Capture email_verified status
              profilePicture: profile.photos?.[0].value,
              googleId: profile.id,
              phone: "",
            };
            logger.info(
              `[Google OAuth] New user data before username check for ${newUser.username}`,
            );

            // Check if username already exists, if so, append a random string or handle differently
            let normalizedGoogleUsername =
              normalizeUsername(newUser.username) ??
              normalizeUsername(profile.id) ??
              profile.id.toLowerCase();
            let existingUserWithUsername = normalizedGoogleUsername
              ? await storage.getUserByUsername(normalizedGoogleUsername)
              : undefined;
            let attempt = 0;
            while (existingUserWithUsername && attempt < 5) {
              logger.info(
                `[Google OAuth] Username ${newUser.username} already exists. Attempting to generate a new one.`,
              );
              const generated = `${profile.displayName || profile.id}_${randomBytes(3).toString("hex")}`;
              normalizedGoogleUsername =
                normalizeUsername(generated) ?? `${profile.id}_${attempt}`;
              existingUserWithUsername = await storage.getUserByUsername(
                normalizedGoogleUsername,
              );
              attempt++;
            }
            if (existingUserWithUsername) {
              logger.error(
                `[Google OAuth] Failed to generate a unique username for ${profile.displayName || profile.id} after several attempts.`,
              );
              return done(
                new Error(
                  "Failed to generate a unique username after several attempts.",
                ),
              );
            }
            const finalNormalizedUsername =
              normalizedGoogleUsername ??
              normalizeUsername(profile.id) ??
              profile.id.toLowerCase();
            newUser.username = finalNormalizedUsername;
            const normalizedGoogleEmail = normalizeEmail(newUser.email);
            if (normalizedGoogleEmail) {
              newUser.email = normalizedGoogleEmail;
            }
            const normalizedGooglePhone =
              normalizePhone(profile._json?.phone_number) ??
              normalizePhone(profile.id);
            newUser.phone =
              normalizedGooglePhone ??
              Math.floor(1_000_000_000 + Math.random() * 9_000_000_000).toString();
            logger.info(
              `[Google OAuth] Final username for new user: ${newUser.username}`,
            );

            // Since password is required by schema, generate a random one or handle differently
            // For now, we'll skip creating user if password cannot be set or is not needed for Google-only auth
            // This part needs careful consideration based on your app's user model and auth flow
            // For this example, we assume a password is not strictly needed if only Google auth is used for this user
            // Or, you might decide to not store a password for Google-authenticated users if they only log in via Google.
            // However, the current schema requires a password. We'll create a placeholder.
            const userToCreate = {
              ...newUser,
              password: await hashPasswordInternal(
                randomBytes(16).toString("hex"),
              ),
              phone: newUser.phone,
              averageRating: "0",
              totalReviews: 0,
            };
            logger.info("[Google OAuth] Creating user");
            const createdUser = await storage.createUser(userToCreate);
            logger.info(
              "[Google OAuth] Successfully created new user:",
              createdUser.id,
            );

            // Send welcome email (no verification link needed as Google verifies email)
            const emailContent = getWelcomeEmailContent(
              createdUser.name || createdUser.username,
              FRONTEND_URL,
            );
            if (createdUser.email) {
              await sendEmail({
                to: createdUser.email,
                subject: emailContent.subject,
                text: emailContent.text,
                html: emailContent.html,
              });
            } else {
              logger.warn(
                "[Google OAuth] Skipping welcome email because created user has no email address.",
              );
            }

            const safeUser = sanitizeUser(createdUser);
            return done(null, safeUser ?? false);
          } catch (err) {
            logger.error(
              "[Google OAuth] Error during Google authentication:",
              err,
            );
            return done(err);
          }
        },
      ),
    );
  }

  passport.serializeUser((user: Express.User, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      const safeUser = sanitizeUser(user);
      return done(null, safeUser ?? false);
    } catch (error) {
      return done(error as Error);
    }
  });
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/request-otp", otpRequestLimiter, async (req, res) => {
    const parsed = otpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid phone number" });
    }
    const normalizedPhone = normalizePhone(parsed.data.phone);
    if (!normalizedPhone) {
      return res.status(400).json({ message: "Phone number is invalid" });
    }
    const otp = createOtpForPhone(normalizedPhone);
    const existingUser = await storage.getUserByPhone(normalizedPhone);
    logger.info("[Auth] OTP generated for phone %s", normalizedPhone);
    return res.json({
      success: true,
      userExists: Boolean(existingUser),
      otpPreview:
        process.env.NODE_ENV === "production" ? undefined : otp,
    });
  });

  app.post("/api/register", registerLimiter, otpVerifyLimiter, async (req, res, next) => {
    const parsedNew = registrationSchema.safeParse(req.body);
    const parsedLegacy = parsedNew.success
      ? null
      : legacyRegistrationSchema.safeParse(req.body);

    if (!parsedNew.success && !parsedLegacy?.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: parsedLegacy?.error?.errors ?? parsedNew.error.errors,
      });
    }

    if (parsedLegacy?.success) {
      const { username, password, role, name, phone, email, language } =
        parsedLegacy.data;
      const normalizedUsername = normalizeUsername(username);
      const normalizedEmail = email ? normalizeEmail(email) : null;
      const normalizedPhone = normalizePhone(phone);

      if (!normalizedUsername) {
        return res.status(400).json({ message: "Username is invalid" });
      }

      const existingUser = await storage.getUserByUsername(normalizedUsername);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      if (normalizedEmail) {
        const existingEmail = await storage.getUserByEmail(normalizedEmail);
        if (existingEmail) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }

      if (normalizedPhone) {
        const existingByPhone = await storage.getUserByPhone(normalizedPhone);
        if (existingByPhone) {
          return res.status(400).json({ message: "Phone number already in use" });
        }
      }

      try {
        const userToCreate: InsertUser = {
          username: normalizedUsername,
          password: await hashPasswordInternal(password),
          role,
          name: name.trim(),
          phone: normalizedPhone ?? "",
          email: normalizedEmail ?? "",
          language: language ?? "en",
          emailVerified: false,
          averageRating: "0",
          totalReviews: 0,
        };

        const user = await storage.createUser(userToCreate);
        const safeUser = sanitizeUser(user);
        if (!safeUser) {
          return res
            .status(500)
            .json({ message: "Unable to create user. Please try again." });
        }

        req.login(safeUser as Express.User, (err) => {
          if (err) return next(err);
          return res.status(201).json(safeUser);
        });
      } catch (error) {
        logger.error({ err: error }, "Failed to register user");
        return res.status(500).json({ message: "Failed to register user" });
      }
      return;
    }

    if (!parsedNew.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: parsedNew.error.errors,
      });
    }

    const { phone, otp, pin, role, name, language, shopName, email } =
      parsedNew.data;
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ message: "Phone number is invalid" });
    }
    const trimmedOtp = otp.trim();

    const existingByPhone = await storage.getUserByPhone(normalizedPhone);
    if (existingByPhone) {
      return res.status(400).json({ message: "Phone number already in use" });
    }

    const otpResult = validateOtpForPhone(normalizedPhone, trimmedOtp);
    if (!otpResult.valid) {
      return res.status(400).json({
        message: describeOtpError(otpResult.reason),
      });
    }

    const normalizedEmail = email ? normalizeEmail(email) : null;
    if (normalizedEmail) {
      const existingEmail = await storage.getUserByEmail(normalizedEmail);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    let usernameBase =
      normalizeUsername(name.replace(/\s+/g, "")) ??
      (normalizedPhone ? `user${normalizedPhone.slice(-4)}` : "user");
    if (!usernameBase || usernameBase.length < 3) {
      usernameBase = `user${randomBytes(2).toString("hex")}`;
    }
    let username = usernameBase;
    let attempt = 1;
    while (await storage.getUserByUsername(username)) {
      username = `${usernameBase}${attempt}`;
      attempt += 1;
      if (attempt > 20) {
        usernameBase = `${usernameBase}${randomBytes(2).toString("hex")}`;
      }
    }

    const cleanedName = name.trim();
    const resolvedShopName =
      role === "shop"
        ? shopName?.trim() || `${cleanedName}'s Shop`
        : null;

    try {
      const userToCreate: InsertUser = {
        username,
        password: await hashPasswordInternal(pin),
        role,
        name: cleanedName,
        phone: normalizedPhone,
        email: normalizedEmail ?? "",
        language: language ?? "en",
        emailVerified: false,
        averageRating: "0",
        totalReviews: 0,
      };

      if (role === "shop" && resolvedShopName) {
        userToCreate.shopProfile = {
          shopName: resolvedShopName,
          businessType: "general",
          description: "Update your shop description in profile settings",
          catalogModeEnabled: false,
          openOrderMode: false,
          allowPayLater: false,
          workingHours: {
            from: "09:00",
            to: "18:00",
            days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
          },
        };
      }

      const user = await storage.createUser(userToCreate);
      const safeUser = sanitizeUser(user);
      if (!safeUser) {
        return res
          .status(500)
          .json({ message: "Unable to create user. Please try again." });
      }

      req.login(safeUser as Express.User, (err) => {
        if (err) return next(err);
        return res.status(201).json(safeUser);
      });
    } catch (error) {
      logger.error({ err: error }, "Failed to register user");
      return res.status(500).json({ message: "Failed to register user" });
    }
  });

  // TODO: Add a new route for email verification
  app.get("/api/verify-email", verifyEmailLimiter, verifyEmailHandler);

  app.post(
    "/api/login",
    loginLimiter,
    passport.authenticate("local"),
    (req, res) => {
      const safeUser = sanitizeUser(req.user as Express.User);
      if (!safeUser) {
        return res
          .status(500)
          .json({ message: "Unable to complete login. Please try again." });
      }
      res.status(200).json(safeUser);
    },
  );

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.json(null);
    }

    const safeUser = sanitizeUser(req.user as Express.User);
    if (!safeUser) {
      return res.json(null);
    }

    res.json(safeUser);
  });

  // Google OAuth Routes
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    app.get("/auth/google", googleAuthLimiter, (req, res, next) => {
      const parsedQuery = googleRoleQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({
          message: "Invalid role selection",
          errors: parsedQuery.error.flatten(),
        });
      }
      const role = parsedQuery.data.role as PublicRegistrationRole | undefined;
      // Basic validation for role. Consider using a predefined list or enum for roles.
      if (role && PUBLIC_REGISTRATION_ROLES.includes(role)) {
        req.session.signupRole = role;
      } else {
        // Default to 'customer' or handle invalid/missing role as an error
        req.session.signupRole = "customer";
        logger.info(
          `[Google OAuth] Role not provided or invalid, defaulting to 'customer'. Provided: ${role ?? "undefined"}`,
        );
      }
      passport.authenticate("google", { scope: ["profile", "email"] })(
        req,
        res,
        next,
      );
    });

    app.get(
      "/auth/google/callback",
      googleAuthLimiter,
      passport.authenticate("google", {
        // successRedirect: "/", // Redirect to a success page or dashboard
        failureRedirect: `${FRONTEND_URL}/auth`,
        failureMessage: true,
      }),
      (req, res) => {
        // Successful authentication, redirect home or to a specific page.
        // req.user is available here
        logger.info(
          "[Google OAuth] Authentication successful, redirecting user",
        );
        const rolePath = `/${req.user?.role || "customer"}`;
        const redirectUrl = new URL(rolePath, FRONTEND_URL).toString();
        delete req.session.returnTo;
        res.redirect(redirectUrl);
      },
    );
  } else {
    app.get("/auth/google", (req, res) =>
      res.status(503).send("Google OAuth is not configured."),
    );
    app.get("/auth/google/callback", (req, res) =>
      res.status(503).send("Google OAuth is not configured."),
    );
  }

  app.post("/api/delete-account", deleteAccountLimiter, async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const userId = req.user.id;
      await storage.deleteUserAndData(userId);
      req.logout((err) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Account deleted, but failed to log out." });
        }
        req.session.destroy(() => {
          res
            .status(200)
            .json({ message: "Account and all data deleted successfully." });
        });
      });
    } catch (error) {
      logger.error({ err: error }, "Error deleting user account");
      res.status(500).json({ message: "Failed to delete account." });
    }
  });
}

export function setupAuth(app: Express) {
  initializeAuth(app);
  registerAuthRoutes(app);
}
export async function verifyEmailHandler(req: Request, res: Response) {
  const parsedQuery = verifyEmailQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).send("Missing or invalid verification details.");
  }
  const { token, userId } = parsedQuery.data;
  try {
    const hashedToken = createHash("sha256").update(token).digest("hex");
    const tokenRecords = await db
      .select()
      .from(emailVerificationTokensTable)
      .where(
        and(
          eq(emailVerificationTokensTable.token, hashedToken),
          eq(emailVerificationTokensTable.userId, userId),
        ),
      )
      .limit(1);
    const tokenEntry = tokenRecords[0];
    if (!tokenEntry || tokenEntry.expiresAt < new Date()) {
      return res.status(400).send("Invalid or expired verification link.");
    }
    await storage.updateUser(userId, { emailVerified: true });
    await db
      .delete(emailVerificationTokensTable)
      .where(eq(emailVerificationTokensTable.token, hashedToken));
    return res.send("Email verified successfully! You can now log in.");
  } catch (error) {
    logger.error("Email verification error:", error);
    return res.status(500).send("Error verifying email.");
  }
}
