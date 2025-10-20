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
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  logger.warn(
    "Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are not set. Google Sign-In will not work.",
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
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.trim().length === 0) {
    logger.error(
      "SESSION_SECRET is not configured. Refusing to start authentication without a secret.",
    );
    throw new Error("SESSION_SECRET environment variable must be set.");
  }

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

  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          passReqToCallback: true, // Added to access req in callback for role selection
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL: `${process.env.APP_BASE_URL || "http://localhost:5000"}/auth/google/callback`,
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
        language: validatedData.language ?? "en",
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
        averageRating: "0",
        totalReviews: 0,
      };

      const user = await storage.createUser(userToCreate);

      const verificationToken = await generateEmailVerificationToken(user.id);
      const verificationLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email?token=${verificationToken}&userId=${user.id}`;

      const welcomeContent = getWelcomeEmailContent(
        user.name || user.username,
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
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
