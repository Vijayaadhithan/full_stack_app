import React from 'react';
import { ShopLayout } from "@/components/layout/shop-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Product, Order, ProductReview } from "@shared/schema";

interface DashboardStats {
  pendingOrders: number;
  ordersInProgress: number;
  completedOrders: number;
  totalProducts: number;
  lowStockItems: number;
}
import { Link } from "wouter";
import {
  Loader2,
  Package,
  ShoppingCart,
  AlertTriangle,
  Star,
  TrendingUp,
  Plus,
} from "lucide-react";
import { formatIndianDisplay } from "@shared/date-utils"; // Import IST utility
import { apiRequest } from "@/lib/queryClient";
import { useWorkerPermissions } from "@/hooks/use-worker-permissions";

export default function ShopDashboard() {
  const { user } = useAuth();
  const { has: can, isWorker, responsibilities } = useWorkerPermissions();

  const { data: stats, isLoading: isLoadingStats } = useQuery<DashboardStats>({
    queryKey: ["shopDashboardStats"],
    queryFn: () =>
      apiRequest("GET", "/api/shops/dashboard-stats").then((r: Response) =>
        r.json(),
      ),
    enabled: !!user?.id,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/shop/recent"],
    enabled: !!user?.id,
  });

  const { data: reviews } = useQuery<ProductReview[]>({
    queryKey: [`/api/reviews/shop/${user?.id}`],
    enabled: !!user?.id,
  });

  return (
    <ShopLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">
              Welcome, {user?.shopProfile?.shopName || user?.name}
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your shop today.
            </p>
          </div>
          {(user?.role === 'shop' || can('products:write')) && (
            <Link href="/shop/products">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add New Product
              </Button>
            </Link>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Products
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">{stats?.totalProducts}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Orders
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">{stats?.pendingOrders}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Orders in Progress
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">
                  {stats?.ordersInProgress}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Completed Orders
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">
                  {stats?.completedOrders}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Low Stock Items
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">{stats?.lowStockItems}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {reviews?.length
                  ? (
                      reviews.reduce((acc, rev) => acc + rev.rating, 0) /
                      reviews.length
                    ).toFixed(1)
                  : "N/A"}
              </div>
            </CardContent>
          </Card>
        </div>

        {isWorker && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>My Permissions</CardTitle>
              </CardHeader>
              <CardContent>
                {responsibilities && responsibilities.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {responsibilities.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">No assigned permissions</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(can('orders:read') || can('orders:update')) && (
                    <Link href="/shop/orders"><Button size="sm">View Orders</Button></Link>
                  )}
                  {can('orders:update') && (
                    <Link href="/shop/orders"><Button size="sm" variant="secondary">Process Payments</Button></Link>
                  )}
                  {can('products:write') && (
                    <Link href="/shop/products"><Button size="sm">Add Product</Button></Link>
                  )}
                  {can('promotions:manage') && (
                    <Link href="/shop/promotions"><Button size="sm">Create Promotion</Button></Link>
                  )}
                  {can('analytics:view') && (
                    <Link href="/shop"><Button size="sm" variant="outline">View Analytics</Button></Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : !orders?.length ? (
                <p className="text-center text-muted-foreground py-6">
                  No orders yet
                </p>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">Order #{order.id}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.orderDate
                            ? formatIndianDisplay(order.orderDate, "date")
                            : "N/A"}{" "}
                          {/* Use formatIndianDisplay */}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">₹{order.total}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {order.status}
                        </p>
                      </div>
                    </div>
                  ))}
                  <Link href="/shop/orders">
                    <Button variant="outline" className="w-full">
                      View All Orders
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              {!reviews?.length ? (
                <p className="text-center text-muted-foreground py-6">
                  No reviews yet
                </p>
              ) : (
                <div className="space-y-4">
                  {reviews.slice(0, 5).map((review) => (
                    <div key={review.id} className="space-y-1">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <Star
                            key={i}
                            className="h-4 w-4 fill-yellow-400 text-yellow-400"
                          />
                        ))}
                      </div>
                      <p className="text-sm line-clamp-2">{review.review}</p>
                    </div>
                  ))}
                  <Link href="/shop/reviews">
                    <Button variant="outline" className="w-full">
                      View All Reviews
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ShopLayout>
  );
}
