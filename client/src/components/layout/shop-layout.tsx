import React from "react";
import { Link, useLocation } from "wouter";
import {
  Package,
  ShoppingCart,
  Settings,
  BarChart3,
  Gift,
  Star,
  Box,
  LogOut,
  Menu,
  User,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationsCenter } from "@/components/notifications-center";
import { useAuth } from "@/hooks/use-auth";

type NavConfig = {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  shopOnly?: boolean;
  hideForWorker?: boolean;
};

const NAV_ITEMS: NavConfig[] = [
  {
    name: "Dashboard",
    href: "/shop",
    icon: BarChart3,
  },
  {
    name: "Products",
    href: "/shop/products",
    icon: Package,
  },
  {
    name: "Orders",
    href: "/shop/orders",
    icon: ShoppingCart,
  },
  {
    name: "Inventory",
    href: "/shop/inventory",
    icon: Box,
  },
  {
    name: "Promotions",
    href: "/shop/promotions",
    icon: Gift,
  },
  {
    name: "Workers",
    href: "/shop/workers",
    icon: Settings,
    shopOnly: true,
  },
  {
    name: "Reviews",
    href: "/shop/reviews",
    icon: Star,
  },
  {
    name: "Settings",
    href: "/shop/profile",
    icon: Settings,
    hideForWorker: true,
  },
];

export function ShopLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false);

  const navigation = React.useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (item.shopOnly && user?.role !== "shop") {
        return false;
      }
      if (item.hideForWorker && user?.role === "worker") {
        return false;
      }
      return true;
    });
  }, [user?.role]);

  const handleLogout = React.useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  const isLoggingOut = logoutMutation.isPending;

  const renderNavItems = (onNavigate?: () => void) =>
    navigation.map((item) => {
      const Icon = item.icon;
      const isActive = location === item.href;
      return (
        <Link key={item.name} href={item.href}>
          <Button
            variant={isActive ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={onNavigate}
          >
            <Icon className="mr-3 h-5 w-5" />
            {item.name}
          </Button>
        </Link>
      );
    });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-64 md:flex-col md:border-r md:bg-card">
        <div className="border-b p-6">
          <h2 className="text-lg font-semibold">
            {user?.shopProfile?.shopName || "My Shop"}
          </h2>
          {user?.name && (
            <p className="mt-1 text-sm text-muted-foreground">{user.name}</p>
          )}
        </div>
        <ScrollArea className="flex-1">
          <nav className="space-y-1 px-3 py-4">{renderNavItems()}</nav>
        </ScrollArea>
      </aside>

      <div className="flex w-full flex-col md:pl-64">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-between gap-2 px-3 sm:px-4 md:px-6">
            <div className="flex items-center gap-2">
              {navigation.length > 0 && (
                <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
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
                        {user?.shopProfile?.shopName || "My Shop"}
                      </SheetTitle>
                      {user?.name && (
                        <p className="text-sm text-muted-foreground truncate">
                          {user.name}
                        </p>
                      )}
                    </SheetHeader>
                    <Separator />
                    <ScrollArea className="flex-1">
                      <div className="space-y-1 px-2 py-4">
                        {renderNavItems(() => setIsMobileNavOpen(false))}
                      </div>
                    </ScrollArea>
                    <Separator />
                    <div className="space-y-3 px-4 py-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsMobileNavOpen(false);
                          handleLogout();
                        }}
                        disabled={isLoggingOut}
                        className="justify-start"
                      >
                        <LogOut className="mr-2 h-5 w-5" />
                        Sign out
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              <span className="text-base font-semibold leading-none">
                {user?.shopProfile?.shopName || "My Shop"}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
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
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
