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

export function isCustomerUser(user?: RoleUser | null): boolean {
  return Boolean(user);
}
