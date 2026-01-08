import React from "react";
import { Link, useLocation } from "wouter";
import {
  Boxes,
  CalendarCheck,
  Home,
  Receipt,
  ShoppingCart,
  Store,
  Star,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-context";
import { useAppMode } from "@/contexts/UserContext";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  isActive?: (location: string) => boolean;
};

function defaultIsActive(location: string, href: string) {
  if (href === "/") return location === "/";
  if (location === href) return true;
  return location.startsWith(`${href}/`);
}

export function BottomNav() {
  const { user } = useAuth();
  const { appMode } = useAppMode();
  const { t } = useLanguage();
  const [location] = useLocation();

  if (!user) return null;

  const items: NavItem[] = (() => {
    if (appMode === "CUSTOMER") {
      return [
        { href: "/customer", labelKey: "nav_home", icon: Home },
        { href: "/customer/browse-shops", labelKey: "nav_shops", icon: Store },
        { href: "/customer/browse-products", labelKey: "nav_products", icon: Boxes },
        { href: "/customer/orders", labelKey: "nav_orders", icon: Receipt },
        { href: "/customer/cart", labelKey: "nav_cart", icon: ShoppingCart },
        { href: "/customer/profile", labelKey: "nav_profile", icon: User },
      ];
    }

    if (appMode === "PROVIDER") {
      return [
        { href: "/provider", labelKey: "nav_home", icon: Home },
        { href: "/provider/services", labelKey: "nav_services", icon: Boxes },
        { href: "/provider/bookings", labelKey: "nav_bookings", icon: CalendarCheck },
        { href: "/provider/reviews", labelKey: "nav_reviews", icon: Star },
        { href: "/provider/profile", labelKey: "nav_profile", icon: User },
      ];
    }

    if (appMode === "SHOP") {
      return [
        { href: "/shop", labelKey: "nav_home", icon: Home },
        { href: "/shop/orders", labelKey: "nav_orders", icon: Receipt },
        { href: "/shop/products", labelKey: "nav_products", icon: Boxes },
        { href: "/shop/inventory", labelKey: "nav_inventory", icon: ShoppingCart },
        { href: "/shop/profile", labelKey: "nav_settings", icon: User },
      ];
    }

    return [{ href: "/", labelKey: "nav_home", icon: Home }];
  })();

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:hidden",
        "pb-[env(safe-area-inset-bottom)]",
      )}
      aria-label="Bottom navigation"
    >
      <div
        className={cn(
          "mx-auto grid max-w-xl gap-1 px-2 py-2",
          items.length === 6
            ? "grid-cols-6"
            : items.length === 4
              ? "grid-cols-4"
              : items.length === 1
                ? "grid-cols-1"
                : "grid-cols-5",
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = (item.isActive ?? ((loc) => defaultIsActive(loc, item.href)))(
            location,
          );
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className="leading-none">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
