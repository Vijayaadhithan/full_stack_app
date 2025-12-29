import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  CalendarClock,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  anyPermissions?: string[];
};

const pageMeta: Record<string, { title: string; description: string }> = {
  "/admin/dashboard": {
    title: "Admin Command Center",
    description: "Live business pulse, system health, and operational highlights.",
  },
  "/admin/users": {
    title: "Platform Users",
    description: "Manage identities, access, and customer/shop status signals.",
  },
  "/admin/orders": {
    title: "Orders & Revenue",
    description: "Track sales, fulfillment, and payment performance at scale.",
  },
  "/admin/shop-analytics": {
    title: "Shop Analytics",
    description: "Compare shop performance and prioritize high-impact partners.",
  },
  "/admin/bookings": {
    title: "Bookings Ops",
    description: "Supervise service bookings, disputes, and provider activity.",
  },
  "/admin/admins": {
    title: "Admin Security",
    description: "Control admin access, roles, and audit history.",
  },
  "/admin/health": {
    title: "System Health",
    description: "Environment checks, jobs, and dependency signals.",
  },
  "/admin/monitoring": {
    title: "Monitoring & Logs",
    description: "Latency, errors, frontend telemetry, and live incident context.",
  },
};

const navSections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/admin/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Users", href: "/admin/users", icon: Users, permission: "manage_users" },
      { label: "Orders", href: "/admin/orders", icon: ShoppingBag, permission: "view_all_orders" },
      {
        label: "Shop Analytics",
        href: "/admin/shop-analytics",
        icon: Store,
        permission: "view_all_orders",
      },
      {
        label: "Bookings",
        href: "/admin/bookings",
        icon: CalendarClock,
        permission: "view_all_bookings",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Monitoring",
        href: "/admin/monitoring",
        icon: Activity,
        anyPermissions: ["view_health", "view_all_orders"],
      },
      {
        label: "Health",
        href: "/admin/health",
        icon: HeartPulse,
        permission: "view_health",
      },
    ],
  },
  {
    label: "Security",
    items: [
      { label: "Admins", href: "/admin/admins", icon: Shield, permission: "manage_admins" },
    ],
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, isFetching, logoutMutation } = useAdmin();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isFetching && !admin) {
      setLocation("/admin/login");
    }
    // Force password change before accessing other admin pages
    if (!isFetching && admin?.mustChangePassword && location !== "/admin/change-password") {
      setLocation("/admin/change-password");
    }
  }, [isFetching, admin, location, setLocation]);

  const permissions = new Set(admin?.permissions ?? []);
  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.permission) return permissions.has(item.permission);
        if (item.anyPermissions) {
          return item.anyPermissions.some((perm) => permissions.has(perm));
        }
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  if (isFetching) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!admin) return null;

  const has = (perm: string) => permissions.has(perm);
  const currentMeta = pageMeta[location] ?? {
    title: "Admin Console",
    description: "Secure operations workspace for DoorStep.",
  };

  const renderNav = (onNavigate?: () => void) => (
    <nav className="space-y-5">
      {filteredSections.map((section) => (
        <div key={section.label} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {section.label}
          </p>
          <div className="space-y-1">
            {section.items.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onNavigate?.()}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    "hover:bg-muted/60 hover:text-foreground",
                    isActive && "bg-muted text-foreground shadow-sm",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="hidden h-screen w-72 flex-col border-r bg-background/95 p-5 backdrop-blur lg:flex">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                DS
              </div>
              <div>
                <div className="text-sm font-semibold">DoorStep Admin</div>
                <div className="text-xs text-muted-foreground">Operations Console</div>
              </div>
            </div>
            <div className="rounded-xl border bg-background p-3 shadow-sm">
              <div className="text-xs text-muted-foreground">Signed in as</div>
              <div className="mt-1 truncate text-sm font-semibold">{admin.email}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{permissions.size} permissions</Badge>
                {admin.mustChangePassword ? (
                  <Badge variant="destructive">Password reset required</Badge>
                ) : (
                  <Badge variant="outline">Session active</Badge>
                )}
              </div>
            </div>
          </div>
          <Separator className="my-5" />
          <div className="flex-1 overflow-y-auto pr-1">{renderNav()}</div>
          <Separator className="my-5" />
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
            <div className="text-xs text-muted-foreground">
              Monitor in real time from <span className="font-semibold">/admin/monitoring</span>.
            </div>
          </div>
        </aside>
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b bg-background/85 px-4 py-3 backdrop-blur lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="lg:hidden">
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">Open admin menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[18rem] px-4 py-5 sm:w-[20rem]">
                    <SheetHeader>
                      <SheetTitle>Admin Menu</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-6">{renderNav(() => setMobileOpen(false))}</div>
                    <Separator className="my-6" />
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => logoutMutation.mutate()}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </SheetContent>
                </Sheet>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Admin Console
                  </p>
                  <h1 className="text-lg font-semibold">{currentMeta.title}</h1>
                  <p className="text-xs text-muted-foreground">{currentMeta.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(has("view_health") || has("view_all_orders")) && (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/monitoring">Monitoring</Link>
                  </Button>
                )}
                {has("view_health") && (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/health">System Health</Link>
                  </Button>
                )}
                <Badge variant="outline">{permissions.size} perms</Badge>
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 lg:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
