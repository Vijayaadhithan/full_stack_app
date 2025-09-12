import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, isFetching, logoutMutation } = useAdmin();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isFetching && !admin) {
      setLocation("/admin/login");
    }
  }, [isFetching, admin, setLocation]);

  if (isFetching) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!admin) return null;

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-100 p-4 space-y-2">
        <nav className="flex flex-col space-y-2">
          <Link href="/admin/dashboard">Dashboard</Link>
          <Link href="/admin/users">Users</Link>
          <Link href="/admin/orders">Orders</Link>
          <Link href="/admin/bookings">Bookings</Link>
          <Link href="/admin/admins">Admins</Link>
          <Link href="/admin/health">Health</Link>
        </nav>
        <Button onClick={() => logoutMutation.mutate()}>Logout</Button>
      </aside>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
