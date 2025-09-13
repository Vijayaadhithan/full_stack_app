import { db } from "./db";
import {
  adminUsers,
  adminRoles,
  adminPermissions,
  adminRolePermissions,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import logger from "./logger";
import { hashPasswordInternal } from "./auth";

/**
 * Ensure at least one admin account exists along with a Super Admin role
 * and the base permission set used throughout the admin UI.
 */
export async function ensureDefaultAdmin() {
  const envEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const envPassword = process.env.ADMIN_PASSWORD || "admin12345";

  // 1) Seed permissions (idempotent)
  const requiredPermissions = [
    { action: "view_health", description: "View platform health" },
    { action: "manage_users", description: "Manage platform users" },
    { action: "view_all_orders", description: "View all orders" },
    { action: "view_all_bookings", description: "View all bookings" },
    { action: "manage_admins", description: "Manage admin accounts and roles" },
    { action: "manage_reviews", description: "Manage reviews" },
  ];
  for (const perm of requiredPermissions) {
    const exists = await db
      .select()
      .from(adminPermissions)
      .where(eq(adminPermissions.action, perm.action))
      .limit(1);
    if (exists.length === 0) {
      await db.insert(adminPermissions).values(perm);
    }
  }

  // 2) Ensure Super Admin role exists
  const roleName = "Super Admin";
  let role = (
    await db.select().from(adminRoles).where(eq(adminRoles.name, roleName)).limit(1)
  )[0];
  if (!role) {
    [role] = await db
      .insert(adminRoles)
      .values({ name: roleName, description: "Full access to all actions" })
      .returning();
  }

  // 3) Link Super Admin to all permissions (idempotent)
  const perms = await db.select().from(adminPermissions);
  for (const p of perms) {
    const link = await db
      .select()
      .from(adminRolePermissions)
      .where(and(eq(adminRolePermissions.roleId, role.id), eq(adminRolePermissions.permissionId, p.id)))
      .limit(1);
    if (link.length === 0) {
      await db.insert(adminRolePermissions).values({ roleId: role.id, permissionId: p.id });
    }
  }

  // 4) Ensure env admin exists and is assigned Super Admin + has password set
  const byEmail = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, envEmail))
    .limit(1);

  const hashedPassword = await hashPasswordInternal(envPassword);
  if (byEmail.length > 0) {
    const existing = byEmail[0];
    // Update password and ensure role assignment
    await db
      .update(adminUsers)
      .set({ hashedPassword, roleId: existing.roleId ?? role.id })
      .where(eq(adminUsers.id, existing.id));
    logger.info(`Admin bootstrap: ensured ${envEmail} exists and has Super Admin role.`);
  } else {
    await db
      .insert(adminUsers)
      .values({ email: envEmail, hashedPassword, roleId: role.id });
    logger.warn(
      `Admin bootstrap: created default admin ${envEmail}. Change the password via the UI or set ADMIN_EMAIL/ADMIN_PASSWORD env vars.`,
    );
  }
}
