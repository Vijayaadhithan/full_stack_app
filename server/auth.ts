import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { sendEmail, getWelcomeEmailContent } from './emailService'; // Added for sending emails
import { User as SelectUser } from "@shared/schema";
import { insertUserSchema } from "@shared/schema";
import dotenv from 'dotenv';
dotenv.config();

declare module "express-session" {
  interface SessionData {
    returnTo?: string;
    signupRole?: SelectUser['role']; // Added for Google OAuth role selection
  }
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn("Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are not set. Google Sign-In will not work.");
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPasswordInternal(password: string) { // Exported for use in password reset
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
          callbackURL: `${process.env.APP_BASE_URL}/auth/google/callback`,
          scope: ["profile", "email"],
          proxy: true,
        },
        async (req: any, accessToken: string, refreshToken: string, profile: any, done: any) => { // req added for role selection
          // Check if the profile, profile.id, or profile.emails are undefined or empty
          if (!profile || !profile.id || !profile.emails || profile.emails.length === 0 || !profile.emails[0].value) {
            console.log('[Google OAuth] Profile data is incomplete or user backed out. Failing authentication.');
            // Signal authentication failure. This should trigger the failureRedirect.
            return done(null, false, { message: 'Google profile data incomplete or authentication aborted by user.' });
          }
          console.log('[Google OAuth] Received profile:', JSON.stringify(profile, null, 2)); // Log entire profile
          try {
            console.log(`[Google OAuth] Attempting to find user by Google ID: ${profile.id}`);
            let user = await storage.getUserByGoogleId(profile.id);
            console.log('[Google OAuth] User found by Google ID:', user ? JSON.stringify(user, null, 2) : 'null');
            if (user) {
              return done(null, user);
            }

            if (profile.emails && profile.emails.length > 0) {
              const email = profile.emails[0].value;
              console.log(`[Google OAuth] Attempting to find user by email: ${email}`);
              user = await storage.getUserByEmail(email);
              console.log('[Google OAuth] User found by email:', user ? JSON.stringify(user, null, 2) : 'null');
              if (user) {
                // Link Google ID to existing user
                console.log(`[Google OAuth] Linking Google ID ${profile.id} to existing user ${user.id} with email ${email}`);
                user.googleId = profile.id;
                // Potentially mark email as verified if Google says so
                // user.emailVerified = profile.emails[0].verified;
                await storage.updateUser(user.id, { googleId: profile.id, emailVerified: profile.emails[0].verified });
                return done(null, user);
              }
            }
            
            // Create new user
            console.log('[Google OAuth] No existing user found by Google ID or email. Proceeding to create a new user.');
            const signupRoleFromSession = req.session.signupRole;
            if (req.session.signupRole) {
              delete req.session.signupRole; // Clean up session
            }

            const newUser = {
              username: profile.displayName || profile.emails?.[0].value || profile.id, // Ensure username is unique or handle collision
              role: signupRoleFromSession || "customer" as SelectUser['role'], // Use role from session or default
              name: profile.displayName || '',
              email: profile.emails?.[0].value || '',
              emailVerified: profile.emails?.[0].verified || false, // Capture email_verified status
              profilePicture: profile.photos?.[0].value,
              googleId: profile.id,
            };
            console.log('[Google OAuth] New user data before username check:', JSON.stringify(newUser, null, 2));

            // Check if username already exists, if so, append a random string or handle differently
            let existingUserWithUsername = await storage.getUserByUsername(newUser.username);
            let attempt = 0;
            while (existingUserWithUsername && attempt < 5) {
              console.log(`[Google OAuth] Username ${newUser.username} already exists. Attempting to generate a new one.`);
              newUser.username = `${profile.displayName || profile.id}_${randomBytes(3).toString('hex')}`;
              existingUserWithUsername = await storage.getUserByUsername(newUser.username);
              attempt++;
            }
            if (existingUserWithUsername) {
              console.error(`[Google OAuth] Failed to generate a unique username for ${profile.displayName || profile.id} after several attempts.`);
              return done(new Error("Failed to generate a unique username after several attempts."));
            }
            console.log(`[Google OAuth] Final username for new user: ${newUser.username}`);

            // Since password is required by schema, generate a random one or handle differently
            // For now, we'll skip creating user if password cannot be set or is not needed for Google-only auth
            // This part needs careful consideration based on your app's user model and auth flow
            // For this example, we assume a password is not strictly needed if only Google auth is used for this user
            // Or, you might decide to not store a password for Google-authenticated users if they only log in via Google.
            // However, the current schema requires a password. We'll create a placeholder.
            const userToCreate = {
              ...newUser,
              password: await hashPasswordInternal(randomBytes(16).toString('hex')),
              phone: "" // Ensure phone is provided or handled if it's a required field with no default
            };
            console.log('[Google OAuth] Creating user with data:', JSON.stringify(userToCreate, null, 2));
            const createdUser = await storage.createUser(userToCreate);
            console.log('[Google OAuth] Successfully created new user:', JSON.stringify(createdUser, null, 2));

            // Send welcome email (no verification link needed as Google verifies email)
            const emailContent = getWelcomeEmailContent(createdUser.name || createdUser.username);
            await sendEmail({
              to: createdUser.email,
              subject: emailContent.subject,
              text: emailContent.text,
              html: emailContent.html,
            });

            return done(null, createdUser);
          } catch (err) {
            console.error('[Google OAuth] Error during Google authentication:', err);
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
      return res.status(400).json({ message: "Invalid input", errors: validationResult.error.errors });
    }

    const validatedData = validationResult.data;

    const existingUser = await storage.getUserByUsername(validatedData.username!);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    if (validatedData.role === 'shop' && !validatedData.shopProfile) {
      return res.status(400).json({ message: "Shop profile is required for shop role" });
    }

    const userToCreate = {
      ...validatedData,
      password: await hashPasswordInternal(validatedData.password!),
            emailVerified: false, // Email not verified yet for local registration
    };

    const user = await storage.createUser(userToCreate);

    // Send welcome email with verification link
    // TODO: Generate a proper verification token and link
    const verificationToken = randomBytes(32).toString('hex');
    // Store this token with user ID and expiry in DB for verification
    // For now, just a placeholder link structure
    const verificationLink = `${process.env.APP_BASE_URL || 'http://localhost:5000'}/verify-email?token=${verificationToken}&userId=${user.id}`;
    
    const emailContent = getWelcomeEmailContent(user.name || user.username, verificationLink);
    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    req.login(user, (err) => {
      if (err) return next(err);
      return res.status(201).json(user);
    });
  });

// TODO: Add a new route for email verification
app.get("/api/verify-email", async (req, res) => {
  const { token, userId } = req.query;
  if (!token || !userId) {
    return res.status(400).send("Missing verification token or user ID.");
  }
  // TODO: Implement token verification logic against stored token in DB
  // 1. Find user by userId
  // 2. Check if token matches and is not expired
  // 3. If valid, mark user's email as verified (e.g., user.emailVerified = true)
  // 4. Delete or invalidate the token
  // For now, simulate success:
  try {
    const id = parseInt(userId as string);
    const user = await storage.getUser(id);
    if (user /* && verifyTokenInDB(token, id) */) { // Placeholder for actual token verification
      await storage.updateUser(id, { emailVerified: true });
      // Redirect to a success page or login page
      return res.send("Email verified successfully! You can now log in."); 
    } else {
      return res.status(400).send("Invalid or expired verification link.");
    }
  } catch (error) {
    console.error("Email verification error:", error);
    return res.status(500).send("Error verifying email.");
  }
});


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
      const role = req.query.role as SelectUser['role'];
      // Basic validation for role. Consider using a predefined list or enum for roles.
      const validRoles: SelectUser['role'][] = ["customer", "provider", "shop"];
      if (role && validRoles.includes(role)) {
        req.session.signupRole = role;
      } else {
        // Default to 'customer' or handle invalid/missing role as an error
        req.session.signupRole = "customer"; 
        console.log(`[Google OAuth] Role not provided or invalid, defaulting to 'customer'. Provided: ${req.query.role}`);
      }
      passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
    });

    app.get(
      "/auth/google/callback",
      passport.authenticate("google", {
        // successRedirect: "/", // Redirect to a success page or dashboard
        failureRedirect: "/auth", // Redirect back to login page on failure
        failureMessage: true 
      }),
      (req, res) => {
        // Successful authentication, redirect home or to a specific page.
        // req.user is available here
        console.log('[Google OAuth] Authentication successful, redirecting user');
        const redirectUrl = req.session.returnTo || `/${req.user?.role || 'customer'}`;
        delete req.session.returnTo;
        res.redirect(redirectUrl);
      }
    );
  } else {
    app.get("/auth/google", (req, res) => res.status(503).send("Google OAuth is not configured."));
    app.get("/auth/google/callback", (req, res) => res.status(503).send("Google OAuth is not configured."));
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
          return res.status(500).json({ message: "Account deleted, but failed to log out." });
        }
        req.session.destroy(() => {
          res.status(200).json({ message: "Account and all data deleted successfully." });
        });
      });
    } catch (error) {
      console.error("Error deleting user account:", error);
      res.status(500).json({ message: "Failed to delete account." });
    }
  });
}
