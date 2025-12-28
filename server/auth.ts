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
  shopProfileSchema,
  emailVerificationTokens as emailVerificationTokensTable,
  checkUserSchema,
  ruralRegisterSchema,
  pinLoginSchema,
  resetPinSchema,
  shops,
  providers,
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

const registrationSchemaBase = z.object({
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
  role: z
    .enum(PUBLIC_REGISTRATION_ROLES)
    .default("customer"),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),
  phone: z
    .string()
    .trim()
    .min(8, "Phone number must be at least 8 digits")
    .max(20, "Phone number must be at most 20 digits")
    .regex(/^\d+$/, "Phone number must contain digits only"),
  email: z
    .string()
    .trim()
    .email("Invalid email address"),
  language: z.string().trim().max(10).optional(),
  bio: z.string().trim().max(1000).optional(),
  experience: z.string().trim().max(200).optional(),
  languages: z.string().trim().max(200).optional(),
  shopProfile: shopProfileSchema.optional(),
});

const registrationSchema = registrationSchemaBase
  .extend({
    emailVerified: z.boolean().optional(),
    averageRating: z.string().optional(),
    totalReviews: z.number().int().optional(),
  })
  .strict();

declare global {
  namespace Express {
    interface User extends Omit<SelectUser, "password"> {
      hasShopProfile?: boolean;
      hasProviderProfile?: boolean;
    }
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
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for rural users
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
    new LocalStrategy(async (identifier, password, done) => {
      const normalizedUsername = normalizeUsername(identifier);
      const normalizedEmail = normalizeEmail(identifier);
      const normalizedPhone = normalizePhone(identifier);

      let userRecord =
        normalizedUsername !== null
          ? await storage.getUserByUsername(normalizedUsername)
          : undefined;
      if (!userRecord && normalizedEmail) {
        userRecord = await storage.getUserByEmail(normalizedEmail);
      }
      if (!userRecord && normalizedPhone) {
        userRecord = await storage.getUserByPhone(normalizedPhone);
      }
      if (
        !userRecord ||
        !(await comparePasswords(password, (userRecord as SelectUser).password))
      ) {
        return done(null, false);
      }
      // Block suspended users from logging in
      if ((userRecord as any)?.isSuspended) {
        return done(null, false);
      }
      const sanitizedUser = sanitizeUser(userRecord);
      return done(null, sanitizedUser ?? false);
    }),
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
              phone: "", // Ensure phone is provided or handled if it's a required field with no default
              averageRating: "0",
              totalReviews: 0,
              isPhoneVerified: false,
            };
            logger.info("[Google OAuth] Creating user");
            const createdUser = await storage.createUser(userToCreate);
            logger.info(
              "[Google OAuth] Successfully created new user:",
              createdUser.id,
            );

            // Send welcome email (no verification link needed as Google verifies email)
            const emailContent = getWelcomeEmailContent(
              createdUser.name || createdUser.username || "User",
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

      // Check for shop and provider profiles
      if (safeUser) {
        const skipDbProfiles =
          process.env.NODE_ENV === "test" || process.env.USE_IN_MEMORY_DB === "true";

        if (skipDbProfiles) {
          (safeUser as any).hasShopProfile =
            user.role === "shop" || Boolean(user.shopProfile);
          (safeUser as any).hasProviderProfile = user.role === "provider";
        } else {
          // We use db directly here to check existence efficiently
          // Note: Using a count or select limit 1 is more efficient than full fetch if we only need existence
          // But for permissions, just knowing they exist is enough.
          try {
            const shopExists = await db
              .select({ id: shops.id })
              .from(shops)
              .where(eq(shops.ownerId, user.id))
              .limit(1);

            const providerExists = await db
              .select({ id: providers.id })
              .from(providers)
              .where(eq(providers.userId, user.id))
              .limit(1);

            (safeUser as any).hasShopProfile = shopExists.length > 0;
            (safeUser as any).hasProviderProfile = providerExists.length > 0;
          } catch (err) {
            logger.warn({ err }, "Failed to fetch additional profiles during deserialization");
            // Don't fail the whole request, just proceed without profile flags
          }
        }
      }

      return done(null, safeUser ?? false);
    } catch (error) {
      return done(error as Error);
    }
  });
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/register", registerLimiter, async (req, res, next) => {
    const parsedBody = registrationSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: parsedBody.error.errors,
      });
    }

    const validatedData = parsedBody.data;
    const normalizedUsername = normalizeUsername(validatedData.username);
    const normalizedEmail = normalizeEmail(validatedData.email);
    const normalizedPhone = normalizePhone(validatedData.phone);

    if (!normalizedUsername) {
      return res.status(400).json({ message: "Username is invalid" });
    }
    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is invalid" });
    }
    if (!normalizedPhone) {
      return res.status(400).json({ message: "Phone number is invalid" });
    }

    try {
      const existingUser = await storage.getUserByUsername(normalizedUsername);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(normalizedEmail);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }

      if (normalizedPhone.length > 0) {
        const existingByPhone = await storage.getUserByPhone(normalizedPhone);
        if (existingByPhone) {
          return res.status(400).json({ message: "Phone number already in use" });
        }
      }

      const userToCreate: InsertUser = {
        username: normalizedUsername,
        password: await hashPasswordInternal(validatedData.password),
        role: validatedData.role,
        name: validatedData.name.trim(),
        phone: normalizedPhone,
        email: normalizedEmail,
        language: validatedData.language ?? "ta",
        bio:
          validatedData.role === "provider"
            ? validatedData.bio?.trim() ?? null
            : null,
        experience:
          validatedData.role === "provider"
            ? validatedData.experience?.trim() ?? null
            : null,
        languages:
          validatedData.role === "provider"
            ? validatedData.languages?.trim() ?? null
            : null,
        shopProfile:
          validatedData.role === "shop"
            ? validatedData.shopProfile ?? null
            : null,
        emailVerified: false,
        isPhoneVerified: false,
        averageRating: "0",
        totalReviews: 0,
      };

      const user = await storage.createUser(userToCreate);

      const verificationToken = await generateEmailVerificationToken(user.id);
      const verificationLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email?token=${verificationToken}&userId=${user.id}`;

      const welcomeContent = getWelcomeEmailContent(
        user.name || user.username || "User",
        verificationLink,
      );
      if (user.email) {
        await sendEmail({
          to: user.email,
          subject: welcomeContent.subject,
          text: welcomeContent.text,
          html: welcomeContent.html,
        });
      } else {
        logger.warn(
          "[Auth] Skipping verification email because registered user has no email address.",
        );
      }

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

  // =====================================================
  // RURAL-FIRST AUTH ROUTES (Mobile + OTP + PIN)
  // These routes minimize SMS costs by using PIN for returning users
  // =====================================================

  // Check if a phone number exists in the system
  app.post("/api/auth/check-user", loginLimiter, async (req, res) => {
    const parsed = checkUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid phone number",
        errors: parsed.error.errors,
      });
    }

    const { phone } = parsed.data;
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      return res.status(400).json({ message: "Invalid phone format" });
    }

    try {
      const user = await storage.getUserByPhone(normalizedPhone);
      if (user) {
        return res.json({
          exists: true,
          name: user.name,
          isPhoneVerified: user.isPhoneVerified,
        });
      }
      return res.json({ exists: false });
    } catch (error) {
      logger.error({ err: error }, "Error checking user");
      return res.status(500).json({ message: "Server error" });
    }
  });

  // Rural Registration: Phone + Name + PIN (after OTP verification on client)
  app.post("/api/auth/rural-register", registerLimiter, async (req, res, next) => {
    const parsed = ruralRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: parsed.error.errors,
      });
    }

    const { phone, name, pin, initialRole, language } = parsed.data;
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      return res.status(400).json({ message: "Invalid phone format" });
    }

    try {
      // Check if phone already exists
      const existingUser = await storage.getUserByPhone(normalizedPhone);
      if (existingUser) {
        return res.status(400).json({ message: "Phone number already registered" });
      }

      // Hash the PIN using the same scrypt method as passwords
      const hashedPin = await hashPasswordInternal(pin);

      // Generate username from phone number for rural users
      const generatedUsername = `user_${normalizedPhone.replace(/\D/g, "").slice(-10)}`;

      const userToCreate: InsertUser = {
        username: generatedUsername,
        phone: normalizedPhone,
        name: name.trim(),
        pin: hashedPin,
        role: initialRole ?? "customer",
        language: language ?? "ta",
        isPhoneVerified: true, // Verified via OTP on client
        emailVerified: false,
        averageRating: "0",
        totalReviews: 0,
      };

      const user = await storage.createUser(userToCreate);

      // If they chose shop or provider, create the profile entry
      if (initialRole === "shop") {
        await db.insert(shops).values({
          ownerId: user.id,
          shopName: `${name}'s Shop`,
        });
      } else if (initialRole === "provider") {
        await db.insert(providers).values({
          userId: user.id,
        });
      }

      const safeUser = sanitizeUser(user);
      if (!safeUser) {
        return res.status(500).json({ message: "Failed to create user" });
      }

      req.login(safeUser as Express.User, (err) => {
        if (err) return next(err);
        return res.status(201).json(safeUser);
      });
    } catch (error) {
      logger.error({ err: error }, "Rural registration failed");
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  // PIN Login: Phone + PIN (no SMS cost!)
  app.post("/api/auth/login-pin", loginLimiter, async (req, res, next) => {
    const parsed = pinLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: parsed.error.errors,
      });
    }

    const { phone, pin } = parsed.data;
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      return res.status(400).json({ message: "Invalid phone format" });
    }

    try {
      const user = await storage.getUserByPhone(normalizedPhone);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (user.isSuspended) {
        return res.status(403).json({ message: "Account suspended" });
      }

      if (!user.pin) {
        return res.status(400).json({
          message: "PIN not set. Please reset your PIN.",
          needsPinReset: true,
        });
      }

      // Compare PIN using timing-safe comparison
      const isPinValid = await comparePasswords(pin, user.pin);
      if (!isPinValid) {
        return res.status(401).json({ message: "Invalid PIN" });
      }

      const safeUser = sanitizeUser(user);
      if (!safeUser) {
        return res.status(500).json({ message: "Login failed" });
      }

      req.login(safeUser as Express.User, (err) => {
        if (err) return next(err);
        return res.status(200).json(safeUser);
      });
    } catch (error) {
      logger.error({ err: error }, "PIN login failed");
      return res.status(500).json({ message: "Login failed" });
    }
  });

  // Reset PIN (after OTP verification on client)
  app.post("/api/auth/reset-pin", loginLimiter, async (req, res) => {
    const parsed = resetPinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: parsed.error.errors,
      });
    }

    const { phone, newPin } = parsed.data;
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      return res.status(400).json({ message: "Invalid phone format" });
    }

    try {
      const user = await storage.getUserByPhone(normalizedPhone);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash the new PIN
      const hashedPin = await hashPasswordInternal(newPin);

      await storage.updateUser(user.id, {
        pin: hashedPin,
        isPhoneVerified: true,
      });

      return res.json({ success: true, message: "PIN reset successfully" });
    } catch (error) {
      logger.error({ err: error }, "PIN reset failed");
      return res.status(500).json({ message: "Failed to reset PIN" });
    }
  });

  // Get user profiles (shop and provider status)
  app.get("/api/auth/profiles", async (req, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const userId = req.user.id;

      // Check if user has a shop profile
      const shopResult = await db
        .select()
        .from(shops)
        .where(eq(shops.ownerId, userId))
        .limit(1);

      // Check if user has a provider profile
      const providerResult = await db
        .select()
        .from(providers)
        .where(eq(providers.userId, userId))
        .limit(1);

      return res.json({
        hasShop: shopResult.length > 0,
        shop: shopResult[0] ?? null,
        hasProvider: providerResult.length > 0,
        provider: providerResult[0] ?? null,
      });
    } catch (error) {
      logger.error({ err: error }, "Failed to fetch profiles");
      return res.status(500).json({ message: "Failed to fetch profiles" });
    }
  });

  // Create shop profile
  app.post("/api/auth/create-shop", async (req, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { shopName, description, businessType } = req.body;

    if (!shopName || typeof shopName !== "string" || shopName.trim().length === 0) {
      return res.status(400).json({ message: "Shop name is required" });
    }

    try {
      const userId = req.user.id;

      // Check if shop already exists
      const existing = await db
        .select()
        .from(shops)
        .where(eq(shops.ownerId, userId))
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ message: "You already have a shop" });
      }

      const [shop] = await db.insert(shops).values({
        ownerId: userId,
        shopName: shopName.trim(),
        description: description?.trim(),
        businessType: businessType?.trim(),
        shopAddressStreet: req.body.shopAddressStreet?.trim() || null,
        shopAddressArea: req.body.shopAddressArea?.trim() || null,
        shopAddressCity: req.body.shopAddressCity?.trim() || null,
        shopAddressState: req.body.shopAddressState?.trim() || null,
        shopAddressPincode: req.body.shopAddressPincode?.trim() || null,
        shopLocationLat: req.body.shopLocationLat,
        shopLocationLng: req.body.shopLocationLng
      }).returning();

      return res.status(201).json(shop);
    } catch (error) {
      logger.error({ err: error }, "Failed to create shop");
      return res.status(500).json({ message: "Failed to create shop" });
    }
  });

  // Create provider profile
  app.post("/api/auth/create-provider", async (req, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { bio, skills, experience } = req.body;

    try {
      const userId = req.user.id;

      // Check if provider already exists
      const existing = await db
        .select()
        .from(providers)
        .where(eq(providers.userId, userId))
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ message: "You already have a provider profile" });
      }

      const [provider] = await db.insert(providers).values({
        userId,
        bio: bio?.trim(),
        skills: skills ?? [],
        experience: experience?.trim(),
      }).returning();

      return res.status(201).json(provider);
    } catch (error) {
      logger.error({ err: error }, "Failed to create provider profile");
      return res.status(500).json({ message: "Failed to create provider profile" });
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
