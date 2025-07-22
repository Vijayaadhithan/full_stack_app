import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express, type Request, type Response } from "express";
import session from "express-session";
import logger from "./logger";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import {
  sendEmail,
  getWelcomeEmailContent,
  getVerificationEmailContent,
} from "./emailService";
import {
  User as SelectUser,
  emailVerificationTokens as emailVerificationTokensTable,
} from "@shared/schema";
import { insertUserSchema } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import dotenv from "dotenv";
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

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPasswordInternal(password: string) {
  // Exported for use in password reset
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
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
              return done(null, user);
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
                return done(null, user);
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
            let existingUserWithUsername = await storage.getUserByUsername(
              newUser.username,
            );
            let attempt = 0;
            while (existingUserWithUsername && attempt < 5) {
              logger.info(
                `[Google OAuth] Username ${newUser.username} already exists. Attempting to generate a new one.`,
              );
              newUser.username = `${profile.displayName || profile.id}_${randomBytes(3).toString("hex")}`;
              existingUserWithUsername = await storage.getUserByUsername(
                newUser.username,
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
            );
            await sendEmail({
              to: createdUser.email,
              subject: emailContent.subject,
              text: emailContent.text,
              html: emailContent.html,
            });

            return done(null, createdUser);
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

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    const validationResult = insertUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res
        .status(400)
        .json({
          message: "Invalid input",
          errors: validationResult.error.errors,
        });
    }

    const validatedData = validationResult.data;

    const existingUser = await storage.getUserByUsername(
      validatedData.username!,
    );
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    // if (validatedData.role === 'shop' && !validatedData.shopProfile) {
    //   return res.status(400).json({ message: "Shop profile is required for shop role" });
    // }

    const userToCreate = {
      ...validatedData,
      password: await hashPasswordInternal(validatedData.password!),
      emailVerified: false, // Email not verified yet for local registration
    };

    const user = await storage.createUser(userToCreate);

    // Send welcome email with verification link
    // TODO: Generate a proper verification token and link
    const verificationToken = randomBytes(32).toString("hex");
    // Store this token with user ID and expiry in DB for verification
    // For now, just a placeholder link structure
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await db.insert(emailVerificationTokensTable).values({
      userId: user.id,
      token: verificationToken,
      expiresAt,
    });
    //const verificationToken = createVerificationToken(user.id);
    const verificationLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email?token=${verificationToken}&userId=${user.id}`;

    const welcomeContent = getWelcomeEmailContent(user.name || user.username);
    await sendEmail({
      to: user.email,
      subject: welcomeContent.subject,
      text: welcomeContent.text,
      html: welcomeContent.html,
    });

    const verifyContent = getVerificationEmailContent(
      user.name || user.username,
      verificationLink,
    );
    await sendEmail({
      to: user.email,
      subject: verifyContent.subject,
      text: verifyContent.text,
      html: verifyContent.html,
    });

    req.login(user, (err) => {
      if (err) return next(err);
      return res.status(201).json(user);
    });
  });

  // TODO: Add a new route for email verification
  app.get("/api/verify-email", verifyEmailHandler);

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

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
    app.get("/auth/google", (req, res, next) => {
      const role = req.query.role as SelectUser["role"];
      // Basic validation for role. Consider using a predefined list or enum for roles.
      const validRoles: SelectUser["role"][] = ["customer", "provider", "shop"];
      if (role && validRoles.includes(role)) {
        req.session.signupRole = role;
      } else {
        // Default to 'customer' or handle invalid/missing role as an error
        req.session.signupRole = "customer";
        logger.info(
          `[Google OAuth] Role not provided or invalid, defaulting to 'customer'. Provided: ${req.query.role}`,
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

  app.post("/api/delete-account", async (req, res) => {
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
      logger.error("Error deleting user account:", error);
      res.status(500).json({ message: "Failed to delete account." });
    }
  });
}
export async function verifyEmailHandler(req: Request, res: Response) {
  const { token, userId } = req.query;
  if (!token || !userId) {
    return res.status(400).send("Missing verification token or user ID.");
  }
  try {
    const id = parseInt(userId as string, 10);
    const tokenRecords = await db
      .select()
      .from(emailVerificationTokensTable)
      .where(
        and(
          eq(emailVerificationTokensTable.token, token as string),
          eq(emailVerificationTokensTable.userId, id),
        ),
      )
      .limit(1);
    const tokenEntry = tokenRecords[0];
    if (!tokenEntry || tokenEntry.expiresAt < new Date()) {
      return res.status(400).send("Invalid or expired verification link.");
    }
    await storage.updateUser(id, { emailVerified: true });
    await db
      .delete(emailVerificationTokensTable)
      .where(eq(emailVerificationTokensTable.token, token as string));
    return res.send("Email verified successfully! You can now log in.");
  } catch (error) {
    logger.error("Email verification error:", error);
    return res.status(500).send("Error verifying email.");
  }
}