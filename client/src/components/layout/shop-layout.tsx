import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { NotificationsCenter } from "@/components/notifications-center";
import { 
  Package, 
  ShoppingCart, 
  Settings, 
  BarChart3, 
  Gift, 
  Star,
  Box,
  TrendingUp,
  LogOut
} from "lucide-react";

export function ShopLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  const navigation = [
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
      name: "Reviews",
      href: "/shop/reviews",
      icon: Star,
    },
    {
      name: "Settings",
      href: "/shop/profile",
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top header with notifications */}
      <div className="fixed top-0 right-0 left-64 h-16 bg-background border-b flex items-center justify-end px-6 z-10">
        <div className="flex items-center space-x-4">
          <NotificationsCenter />
          <div className="flex items-center gap-2">
            <span>{user?.name}</span>
          </div>
          <Button
            variant="outline"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed top-0 left-0 bottom-0 w-64 bg-card border-r">
        <div className="p-6">
          <h2 className="text-lg font-semibold">{user?.shopProfile?.shopName || "My Shop"}</h2>
        </div>
        <nav className="space-y-1 px-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start"
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="pl-64 pt-16">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}