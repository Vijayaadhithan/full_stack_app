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

type NavItem = {
  href: string;
  labelTa: string;
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
  const [location] = useLocation();

  if (!user?.role) return null;

  const role = user.role === "worker" ? "shop" : user.role;

  const items: NavItem[] = (() => {
    if (role === "customer") {
      return [
        { href: "/customer", labelTa: "முகப்பு", icon: Home },
        { href: "/customer/browse-shops", labelTa: "கடைகள்", icon: Store },
        { href: "/customer/orders", labelTa: "ஆர்டர்கள்", icon: Receipt },
        { href: "/customer/cart", labelTa: "கூடை", icon: ShoppingCart },
        { href: "/customer/profile", labelTa: "சுயவிவரம்", icon: User },
      ];
    }

    if (role === "provider") {
      return [
        { href: "/provider", labelTa: "முகப்பு", icon: Home },
        { href: "/provider/services", labelTa: "சேவைகள்", icon: Boxes },
        { href: "/provider/bookings", labelTa: "முன்பதிவு", icon: CalendarCheck },
        { href: "/provider/reviews", labelTa: "மதிப்பீடுகள்", icon: Star },
        { href: "/provider/profile", labelTa: "சுயவிவரம்", icon: User },
      ];
    }

    if (role === "shop") {
      return [
        { href: "/shop", labelTa: "முகப்பு", icon: Home },
        { href: "/shop/orders", labelTa: "ஆர்டர்கள்", icon: Receipt },
        { href: "/shop/products", labelTa: "பொருட்கள்", icon: Boxes },
        { href: "/shop/inventory", labelTa: "கையிருப்பு", icon: ShoppingCart },
        { href: "/shop/profile", labelTa: "அமைப்புகள்", icon: User },
      ];
    }

    return [{ href: `/${role}`, labelTa: "முகப்பு", icon: Home }];
  })();

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:hidden",
        "pb-[env(safe-area-inset-bottom)]",
      )}
      aria-label="Bottom navigation"
    >
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-1 px-2 py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = (item.isActive ?? ((loc) => defaultIsActive(loc, item.href)))(
            location,
          );
          return (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span className="leading-none">{item.labelTa}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

