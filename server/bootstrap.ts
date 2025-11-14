import { db, runWithPrimaryReads } from "./db";
import {
  adminUsers,
  adminRoles,
  adminPermissions,
  adminRolePermissions,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import logger from "./logger";
import { hashPasswordInternal } from "./auth";
import { sanitizeAndValidateSecret } from "./security/secretValidators";

const bootstrapDeps = {
  db,
  runWithPrimaryReads,
};

export function __setBootstrapDepsForTesting(
  overrides: Partial<typeof bootstrapDeps>,
) {
  Object.assign(bootstrapDeps, overrides);
}

/**
 * Ensure at least one admin account exists along with a Super Admin role
 * and the base permission set used throughout the admin UI.
 */
export async function ensureDefaultAdmin() {
  const rawEmail = process.env.ADMIN_EMAIL;
  const rawPassword = process.env.ADMIN_PASSWORD;

  if (!rawEmail || !rawPassword) {
    const message =
      "ADMIN_EMAIL and ADMIN_PASSWORD must be configured before bootstrapping an admin account.";
    logger.error(message);
    throw new Error(message);
  }

  const envEmail = rawEmail.trim().toLowerCase();
  const envPassword = sanitizeAndValidateSecret(
    "ADMIN_PASSWORD",
    rawPassword,
    {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSymbol: true,
      disallowedPatterns: [/^admin12345$/i, /^password/i, /^changeme/i],
      environment: process.env.NODE_ENV ?? "development",
    },
  );

  if (
    envEmail.length === 0 ||
    envPassword.length === 0 ||
    envEmail === "admin@example.com"
  ) {
    const message =
      "Refusing to bootstrap admin with insecure default credentials. Provide strong ADMIN_EMAIL and ADMIN_PASSWORD values.";
    logger.error(message);
    throw new Error(message);
  }

  await bootstrapDeps.runWithPrimaryReads(async () => {
    // 1) Seed permissions (idempotent)
    const requiredPermissions = [
      { action: "view_health", description: "View platform health" },
      { action: "manage_users", description: "Manage platform users" },
      { action: "view_all_orders", description: "View all orders" },
      { action: "view_all_bookings", description: "View all bookings" },
      { action: "manage_admins", description: "Manage admin accounts and roles" },
      { action: "manage_reviews", description: "Manage reviews" },
      { action: "manage_settings", description: "Manage platform settings" },
    ];
    for (const perm of requiredPermissions) {
      const exists = await bootstrapDeps.db
        .select()
        .from(adminPermissions)
        .where(eq(adminPermissions.action, perm.action))
        .limit(1);
      if (exists.length === 0) {
        await bootstrapDeps.db.insert(adminPermissions).values(perm);
      }
    }

    // 2) Ensure Super Admin role exists
    const roleName = "Super Admin";
    let role = (
      await bootstrapDeps.db.select().from(adminRoles).where(eq(adminRoles.name, roleName)).limit(1)
    )[0];
    if (!role) {
      [role] = await bootstrapDeps.db
        .insert(adminRoles)
        .values({ name: roleName, description: "Full access to all actions" })
        .returning();
    }

    // 3) Link Super Admin to all permissions (idempotent)
    const perms = await bootstrapDeps.db.select().from(adminPermissions);
    for (const p of perms) {
      const link = await bootstrapDeps.db
        .select()
        .from(adminRolePermissions)
        .where(and(eq(adminRolePermissions.roleId, role.id), eq(adminRolePermissions.permissionId, p.id)))
        .limit(1);
      if (link.length === 0) {
        await bootstrapDeps.db.insert(adminRolePermissions).values({ roleId: role.id, permissionId: p.id });
      }
    }

    // 4) Ensure env admin exists and is assigned Super Admin + has password set
    const byEmail = await bootstrapDeps.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, envEmail))
      .limit(1);

    const hashedPassword = await hashPasswordInternal(envPassword);
    if (byEmail.length > 0) {
      const existing = byEmail[0];
      await bootstrapDeps.db
        .update(adminUsers)
        .set({ hashedPassword, roleId: existing.roleId ?? role.id })
        .where(eq(adminUsers.id, existing.id));
      logger.info(
        `Admin bootstrap: ensured ${envEmail} exists and has Super Admin role.`,
      );
    } else {
      await bootstrapDeps.db
        .insert(adminUsers)
        .values({ email: envEmail, hashedPassword, roleId: role.id });
      logger.info(
        `Admin bootstrap: created admin ${envEmail}. Rotate credentials if this was an initial setup secret.`,
      );
    }
  });
}
