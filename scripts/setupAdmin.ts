import { db } from "../server/db";
import {
  adminPermissions,
  adminRoles,
  adminRolePermissions,
  adminUsers,
} from "@shared/schema";
import { hashPasswordInternal } from "../server/auth";
import { eq } from "drizzle-orm";

async function main() {
  const basePermissions = [
    { action: "manage_users", description: "Manage platform users" },
    { action: "view_all_orders", description: "View all orders" },
    { action: "manage_admins", description: "Manage admin accounts" },
    { action: "view_health", description: "View system health" },
    { action: "view_all_bookings", description: "View all bookings" },
    { action: "manage_reviews", description: "Manage reviews" },
    { action: "manage_settings", description: "Manage platform settings" },
  ];

  for (const perm of basePermissions) {
    await db.insert(adminPermissions).values(perm).onConflictDoNothing();
  }

  const [masterRole] = await db
    .insert(adminRoles)
    .values({ name: "master", description: "Master Admin" })
    .onConflictDoNothing()
    .returning();

  const permissions = await db.select().from(adminPermissions);
  for (const perm of permissions) {
    await db
      .insert(adminRolePermissions)
      .values({ roleId: masterRole.id, permissionId: perm.id })
      .onConflictDoNothing();
  }

  const email = process.env.MASTER_ADMIN_EMAIL || "admin@example.com";
  const password = process.env.MASTER_ADMIN_PASSWORD || "changeme";
  const hashedPassword = await hashPasswordInternal(password);

  const existing = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(adminUsers).values({
      email,
      hashedPassword,
      roleId: masterRole.id,
    });
    console.log("Master admin created");
  } else {
    console.log("Admin already exists");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
