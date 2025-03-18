import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export default function CustomerDashboard() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="grid gap-4">
        <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Book Services</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Find and book services from our providers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shop Products</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Browse and purchase products from our shops</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <p>View and manage your service bookings</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
