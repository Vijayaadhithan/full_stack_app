import React from "react";
import { Link, useLocation } from "wouter";
import { useAppMode } from "@/contexts/UserContext";
import {
  Home,
  LogOut,
  Menu,
  User,
  ShoppingCart,
  Heart,
  Star,
  Boxes,
  Receipt,
  CalendarCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { NotificationsCenter } from "@/components/notifications-center";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";

interface MainNavProps {
  rightSlot?: React.ReactNode;
}

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

export function MainNav({ rightSlot }: MainNavProps) {
  const { user, logoutMutation } = useAuth();
  const { appMode } = useAppMode();
  const [location] = useLocation();
  const isAuthenticated = Boolean(user);

  const navItems = React.useMemo<NavItem[]>(() => {
    if (!user) return [];

    if (appMode === "CUSTOMER") {
      return [
        { label: "Dashboard", href: "/customer", icon: Home },
        { label: "Cart", href: "/customer/cart", icon: ShoppingCart },
        { label: "Wishlist", href: "/customer/wishlist", icon: Heart },
        { label: "My Reviews", href: "/customer/my-reviews", icon: Star },
        { label: "Profile", href: "/customer/profile", icon: User },
      ];
    }

    if (appMode === "SHOP") {
      return [
        { label: "Dashboard", href: "/shop", icon: Home },
        { label: "Orders", href: "/shop/orders", icon: Receipt },
        { label: "Products", href: "/shop/products", icon: Boxes },
        { label: "Profile", href: "/shop/profile", icon: User },
      ];
    }

    if (appMode === "PROVIDER") {
      return [
        { label: "Dashboard", href: "/provider", icon: Home },
        { label: "Services", href: "/provider/services", icon: Boxes },
        { label: "Bookings", href: "/provider/bookings", icon: CalendarCheck },
        { label: "Reviews", href: "/provider/reviews", icon: Star },
        { label: "Profile", href: "/provider/profile", icon: User },
      ];
    }

    return [{ label: "Dashboard", href: "/", icon: Home }];
  }, [user, appMode]);

  const handleLogout = React.useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  const isLoggingOut = logoutMutation.isPending;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-auto min-h-16 flex-wrap items-center gap-2 px-3 sm:px-4 md:flex-nowrap md:px-6">
        {navItems.length > 0 && (
          <Sheet>
            <SheetTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0">
              <SheetHeader className="px-4 py-4 text-left">
                <SheetTitle className="text-base font-semibold">
                  Navigation
                </SheetTitle>
                {user?.name && (
                  <p className="text-sm text-muted-foreground truncate">
                    {user.name}
                    {user.role ? ` · ${user.role}` : ""}
                  </p>
                )}
              </SheetHeader>
              <Separator />
              <nav className="flex-1 space-y-1 px-2 py-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className="w-full justify-start"
                      >
                        <Icon className="mr-3 h-5 w-5" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
              </nav>
              <Separator />
              <div className="space-y-3 px-4 py-4">
                {rightSlot && (
                  <div className="flex items-center justify-start">
                    {rightSlot}
                  </div>
                )}
                {isAuthenticated && (
                  <div className="py-2">
                    <ProfileSwitcher />
                  </div>
                )}
                {isAuthenticated ? (
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="justify-start"
                  >
                    <LogOut className="mr-2 h-5 w-5" />
                    Sign out
                  </Button>
                ) : (
                  <Button variant="default" asChild className="justify-start">
                    <Link href="/auth">Sign in</Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        )}

        <Link
          href={navItems[0]?.href ?? "/"}
          className="text-base sm:text-lg font-semibold leading-none tracking-tight whitespace-nowrap flex-shrink-0"
        >
          DoorStepTN
        </Link>

        {navItems.length > 0 && (
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="flex items-center gap-2"
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:gap-3 md:w-auto md:flex-nowrap">
          {rightSlot && <div className="hidden md:flex">{rightSlot}</div>}
          {isAuthenticated ? (
            <>
              {/* Mode Switcher for all authenticated users */}
              <div className="hidden sm:block">
                <ProfileSwitcher />
              </div>
              <NotificationsCenter />
              <div className="hidden items-center gap-2 truncate sm:flex">
                <User className="h-5 w-5" />
                <span className="max-w-[160px] truncate">{user?.name}</span>
              </div>
              <Button
                size="icon"
                variant="outline"
                onClick={handleLogout}
                disabled={isLoggingOut}
                aria-label="Sign out"
                className="sm:hidden"
              >
                <LogOut className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="hidden sm:inline-flex"
              >
                <LogOut className="mr-2 h-5 w-5" />
                Sign out
              </Button>
            </>
          ) : (
            <Button variant="default" asChild>
              <Link href="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
