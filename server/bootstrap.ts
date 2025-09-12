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

  // Check if an admin with env email exists
  const adminByEmail = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, envEmail))
    .limit(1);

  const anyAdmin = await db.select().from(adminUsers).limit(1);
  const needsSeed = anyAdmin.length === 0 && adminByEmail.length === 0;

  if (!needsSeed && adminByEmail.length > 0) {
    // Update password for envEmail admin to match envPassword so you can sign in
    const hashedPassword = await hashPasswordInternal(envPassword);
    await db
      .update(adminUsers)
      .set({ hashedPassword })
      .where(eq(adminUsers.email, envEmail));
    logger.info(
      `Admin bootstrap: ensured password for ${envEmail} based on ADMIN_PASSWORD env.`,
    );
    return;
  }

  if (!needsSeed && adminByEmail.length === 0) {
    logger.info(
      "Admin bootstrap: existing admin(s) found, but none with ADMIN_EMAIL; creating additional admin for convenience.",
    );
  } else {
    logger.warn("Admin bootstrap: no admins found. Seeding defaults...");
  }

  // Seed permissions
  const requiredPermissions = [
    { action: "view_health", description: "View platform health" },
    { action: "manage_users", description: "Manage platform users" },
    { action: "view_all_orders", description: "View all orders" },
    { action: "view_all_bookings", description: "View all bookings" },
    { action: "manage_admins", description: "Manage admin accounts and roles" },
    { action: "manage_reviews", description: "Manage reviews" },
  ];

  // Insert permissions if missing
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

  // Ensure Super Admin role
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

  // Link role to all permissions
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

  // Create admin user for the env email
  const email = envEmail;
  const hashedPassword = await hashPasswordInternal(envPassword);
  const [admin] = await db
    .insert(adminUsers)
    .values({ email, hashedPassword, roleId: role.id })
    .returning();

  logger.warn(
    `Admin bootstrap: created default admin ${admin.email}. Change the password via the UI or set ADMIN_EMAIL/ADMIN_PASSWORD env vars.`,
  );
}
