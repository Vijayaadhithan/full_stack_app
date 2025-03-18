import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  ShoppingCart, 
  Settings, 
  BarChart3, 
  Gift, 
  Star,
  Box,
  TrendingUp
} from "lucide-react";

export function ShopLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();

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
      name: "Analytics",
      href: "/shop/analytics",
      icon: TrendingUp,
    },
    {
      name: "Settings",
      href: "/shop/profile",
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
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
      <div className="pl-64">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}