import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAdmin } from "@/hooks/use-admin";
import { useAdminPerformanceMetrics } from "@/hooks/use-admin-performance-metrics";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, isFetching, logoutMutation } = useAdmin();
  const [location, setLocation] = useLocation();
  useAdminPerformanceMetrics();

  useEffect(() => {
    if (!isFetching && !admin) {
      setLocation("/admin/login");
    }
    // Force password change before accessing other admin pages
    if (!isFetching && admin?.mustChangePassword && location !== "/admin/change-password") {
      setLocation("/admin/change-password");
    }
  }, [isFetching, admin, location, setLocation]);

  if (isFetching) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!admin) return null;

  const permissions = new Set(admin.permissions || []);
  const has = (perm: string) => permissions.has(perm);

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-100 p-4 space-y-2">
        <nav className="flex flex-col space-y-2">
          <Link href="/admin/dashboard">Dashboard</Link>
          {has("manage_users") && <Link href="/admin/users">Users</Link>}
          {has("view_all_orders") && <Link href="/admin/orders">Orders</Link>}
          {has("view_all_orders") && (
            <Link href="/admin/shop-analytics">Shop Analytics</Link>
          )}
          {has("view_all_bookings") && <Link href="/admin/bookings">Bookings</Link>}
          {has("manage_admins") && <Link href="/admin/admins">Admins</Link>}
          {has("view_health") && <Link href="/admin/health">Health</Link>}
          {(has("view_health") || has("view_all_orders")) && (
            <Link href="/admin/monitoring">Monitoring</Link>
          )}
        </nav>
        <Button onClick={() => logoutMutation.mutate()}>Logout</Button>
      </aside>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
