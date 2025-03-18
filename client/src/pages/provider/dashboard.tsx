import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export default function ProviderDashboard() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="grid gap-4">
        <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>My Services</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Manage your service listings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <p>View and manage customer bookings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Set your availability and working hours</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
