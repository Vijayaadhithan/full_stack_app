import type { UserRole } from "@shared/schema";

type RoleUser = {
  role?: UserRole | null;
  hasShopProfile?: boolean;
  hasProviderProfile?: boolean;
};

export function isShopUser(user?: RoleUser | null): boolean {
  return Boolean(user && (user.role === "shop" || user.hasShopProfile));
}

export function isProviderUser(user?: RoleUser | null): boolean {
  return Boolean(user && (user.role === "provider" || user.hasProviderProfile));
}

export function isWorkerUser(user?: RoleUser | null): boolean {
  return Boolean(user && user.role === "worker");
}

export function isAdminUser(user?: RoleUser | null): boolean {
  return Boolean(user && user.role === "admin");
}

export function isCustomerUser(user?: RoleUser | null): boolean {
  return Boolean(user);
}

export function hasRoleAccess(
  user: RoleUser | null | undefined,
  roles: readonly string[],
): boolean {
  if (!user) {
    return false;
  }

  const role = user.role ?? undefined;
  if (role && roles.includes(role)) {
    return true;
  }

  // Every authenticated user is a customer by default.
  if (roles.includes("customer")) {
    return true;
  }

  if (roles.includes("shop") && isShopUser(user)) {
    return true;
  }

  if (roles.includes("provider") && isProviderUser(user)) {
    return true;
  }

  if (roles.includes("worker") && isWorkerUser(user)) {
    return true;
  }

  if (roles.includes("admin") && isAdminUser(user)) {
    return true;
  }

  return false;
}
