import { ShopLayout } from "@/components/layout/shop-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Order, Product, ProductReview } from "@shared/schema";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export default function ShopAnalytics() {
  const { user } = useAuth();

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: [`/api/orders/shop/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: [`/api/products/shop/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: reviews } = useQuery<ProductReview[]>({
    queryKey: [`/api/reviews/shop/${user?.id}`],
    enabled: !!user?.id,
  });

  // Calculate total revenue
  const totalRevenue = orders?.reduce((sum, order) => sum + parseFloat(order.total), 0) || 0;

  // Calculate daily revenue data for the chart
  const dailyRevenue = orders?.reduce((acc, order) => {
    const date = new Date(order.orderDate).toLocaleDateString();
    acc[date] = (acc[date] || 0) + parseFloat(order.total);
    return acc;
  }, {} as Record<string, number>);

  const revenueData = Object.entries(dailyRevenue || {}).map(([date, total]) => ({
    date,
    total,
  }));

  // Calculate product performance
  const productPerformance = products?.map(product => {
    const productOrders = orders?.filter(order => 
      order.items?.some(item => item.productId === product.id)
    ) || [];
    const totalSold = productOrders.reduce((sum, order) => 
      sum + (order.items?.find(item => item.productId === product.id)?.quantity || 0), 
    0);
    const revenue = productOrders.reduce((sum, order) => {
      const item = order.items?.find(item => item.productId === product.id);
      return sum + (item ? parseFloat(item.price) * item.quantity : 0);
    }, 0);
    
    return {
      name: product.name,
      sold: totalSold,
      revenue,
    };
  });

  return (
    <ShopLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Analytics & Performance</h1>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                From {orders?.length || 0} orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{orders?.length ? (totalRevenue / orders.length).toFixed(2) : "0.00"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {reviews?.length
                  ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
                  : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                From {reviews?.length || 0} reviews
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="#8884d8"
                        name="Revenue"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Product Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                      <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                      <Tooltip />
                      <Bar yAxisId="left" dataKey="sold" fill="#8884d8" name="Units Sold" />
                      <Bar yAxisId="right" dataKey="revenue" fill="#82ca9d" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ShopLayout>
  );
}
