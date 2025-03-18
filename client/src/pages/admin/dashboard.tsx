import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { User, Order, Booking } from "@shared/schema";
import { Loader2, Users, ShoppingBag, Calendar, AlertCircle } from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
  });

  const getUsersByRole = (role: string) => {
    return users?.filter(u => u.role === role).length || 0;
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="space-y-2">
                  <p>Monitor and manage user accounts</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Customers: {getUsersByRole("customer")}</p>
                    <p>Providers: {getUsersByRole("provider")}</p>
                    <p>Shop Owners: {getUsersByRole("shop")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Orders Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="space-y-2">
                  <p>Monitor all shop orders</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Pending: {orders?.filter(o => o.status === "pending").length || 0}</p>
                    <p>Completed: {orders?.filter(o => o.status === "delivered").length || 0}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Bookings Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bookingsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="space-y-2">
                  <p>Monitor service bookings</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Today: {
                      bookings?.filter(b => 
                        new Date(b.bookingDate).toDateString() === new Date().toDateString()
                      ).length || 0
                    }</p>
                    <p>Pending: {bookings?.filter(b => b.status === "pending").length || 0}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>Monitor platform performance</p>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <p className="text-sm text-muted-foreground">All systems operational</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
