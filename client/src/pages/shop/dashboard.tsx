import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Product, Order } from "@shared/schema";
import { Loader2 } from "lucide-react";

export default function ShopDashboard() {
  const { user } = useAuth();

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: [`/api/products/shop/${user?.id}`],
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/shop"],
  });

  return (
    <DashboardLayout>
      <div className="grid gap-4">
        <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="space-y-2">
                  <p>Manage your product catalog</p>
                  <p className="text-sm text-muted-foreground">
                    {products?.length || 0} products listed
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="space-y-2">
                  <p>View and manage customer orders</p>
                  <p className="text-sm text-muted-foreground">
                    {orders?.filter(o => o.status === "pending").length || 0} pending orders
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>Track and update stock levels</p>
                <p className="text-sm text-muted-foreground">
                  {products?.filter(p => p.stock < 10).length || 0} items low in stock
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shop Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>View sales and performance metrics</p>
                <p className="text-sm text-muted-foreground">
                  {orders?.length || 0} total orders
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
