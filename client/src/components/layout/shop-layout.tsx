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
import { LanguageSelector } from "@/components/language-selector";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-context";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { isShopUser, isWorkerUser } from "@/lib/role-access";
import { useShopContext } from "@/hooks/use-shop-context";
import LogoMark from "@/components/branding/logo-mark";

type NavConfig = {
  labelKey: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  shopOnly?: boolean;
  hideForWorker?: boolean;
};

const NAV_ITEMS: NavConfig[] = [
  {
    labelKey: "dashboard",
    href: "/shop",
    icon: BarChart3,
  },
  {
    labelKey: "products",
    href: "/shop/products",
    icon: Package,
  },
  {
    labelKey: "orders",
    href: "/shop/orders",
    icon: ShoppingCart,
  },
  {
    labelKey: "inventory",
    href: "/shop/inventory",
    icon: Box,
  },
  {
    labelKey: "promotions",
    href: "/shop/promotions",
    icon: Gift,
  },
  {
    labelKey: "workers",
    href: "/shop/workers",
    icon: Settings,
    shopOnly: true,
  },
  {
    labelKey: "reviews",
    href: "/shop/reviews",
    icon: Star,
  },
  {
    labelKey: "settings",
    href: "/shop/profile",
    icon: Settings,
    hideForWorker: true,
  },
];

export function ShopLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { shopName } = useShopContext();
  const { t } = useLanguage();
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false);
  const isShopOwner = isShopUser(user);
  const isWorker = isWorkerUser(user);
  const displayShopName = shopName || t("my_shop");

  const navigation = React.useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (item.shopOnly && !isShopOwner) {
        return false;
      }
      if (item.hideForWorker && isWorker) {
        return false;
      }
      return true;
    });
  }, [isShopOwner, isWorker]);

  const handleLogout = React.useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  const isLoggingOut = logoutMutation.isPending;

  const renderNavItems = (onNavigate?: () => void) =>
    navigation.map((item) => {
      const Icon = item.icon;
      const isActive = location === item.href;
      return (
        <Link key={item.href} href={item.href}>
          <Button
            variant={isActive ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={onNavigate}
          >
            <Icon className="mr-3 h-5 w-5" />
            {t(item.labelKey)}
          </Button>
        </Link>
      );
    });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-64 md:flex-col md:border-r md:bg-card">
        <div className="border-b p-6">
          <h2 className="text-lg font-semibold">
            {displayShopName}
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
          <div className="flex h-16 items-center px-3 sm:px-4 md:px-6">
            {/* Left: Menu + Shop Name */}
            <div className="flex items-center gap-2 flex-1">
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
                        {displayShopName}
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
                      <div className="px-2 py-2">
                        <ProfileSwitcher />
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
                        {t("logout")}
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              <span className="text-base font-semibold leading-none hidden sm:inline">
                {displayShopName}
              </span>
            </div>

            {/* Center: Logo */}
            <div className="flex items-center justify-center">
              <Link href="/shop">
                <LogoMark size={40} className="rounded-lg" />
              </Link>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center justify-end gap-2 sm:gap-3 flex-1">
              <div className="hidden sm:block">
                <ProfileSwitcher />
              </div>
              <LanguageSelector />
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
                aria-label={t("logout")}
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
                {t("logout")}
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
