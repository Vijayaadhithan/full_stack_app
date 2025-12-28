import React from 'react';
import { ShopLayout } from "@/components/layout/shop-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Order, ProductReview } from "@shared/schema";
import { useLanguage } from "@/contexts/language-context";

interface DashboardStats {
  pendingOrders: number;
  ordersInProgress: number;
  completedOrders: number;
  totalProducts: number;
  lowStockItems: number;
  earningsToday: number;
  earningsMonth: number;
  earningsTotal: number;
  customerSpendTotals: {
    customerId: number;
    name: string | null;
    phone: string | null;
    totalSpent: number;
    orderCount: number;
  }[];
  itemSalesTotals: {
    productId: number;
    name: string | null;
    quantity: number;
    totalAmount: number;
  }[];
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
import { useShopContext } from "@/hooks/use-shop-context";

export default function ShopDashboard() {
  const {
    user,
    shopId: shopContextId,
    isWorker,
    shopName,
    permissionsLoading,
    hasPermission,
    workerResponsibilities,
  } = useShopContext();
  const { t } = useLanguage();

  const waitingOnPermissions = isWorker && permissionsLoading;
  const canAddProduct = hasPermission("products:write");
  const canViewOrders = hasPermission("orders:read");
  const canProcessOrders = hasPermission("orders:update");
  const canManagePromotions = hasPermission("promotions:manage");
  const canViewAnalytics = hasPermission("analytics:view");
  const allowedOrdersAccess = !isWorker || canViewOrders;

  const { data: stats, isLoading: isLoadingStats } = useQuery<DashboardStats>({
    queryKey: ["/api/shops/dashboard-stats", shopContextId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/shops/dashboard-stats");
      return res.json();
    },
    enabled: Boolean(shopContextId) && !waitingOnPermissions,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/shop/recent", shopContextId],
    enabled: Boolean(shopContextId) && allowedOrdersAccess && !waitingOnPermissions,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/orders/shop/recent");
      return res.json();
    },
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery<ProductReview[]>({
    queryKey: ["/api/reviews/shop", shopContextId],
    enabled: Boolean(shopContextId) && !waitingOnPermissions,
    queryFn: async () => {
      if (!shopContextId) return [];
      const res = await apiRequest("GET", `/api/reviews/shop/${shopContextId}`);
      return res.json();
    },
  });

  const formatCurrency = (value: number | null | undefined) => {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) return "₹0.00";
    return `₹${numeric.toFixed(2)}`;
  };

  if (waitingOnPermissions) {
    return (
      <ShopLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </ShopLayout>
    );
  }

  if (!shopContextId) {
    return (
      <ShopLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold">{t("shop_dashboard_title")}</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              {isWorker
                ? t("shop_dashboard_worker_unlinked")
                : t("shop_dashboard_no_shop")}
            </CardContent>
          </Card>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {t("shop_dashboard_welcome").replace(
                "{name}",
                shopName || user?.name || t("not_available"),
              )}
            </h1>
            <p className="text-muted-foreground">
              {t("shop_dashboard_subtitle")}
            </p>
          </div>
          {canAddProduct && (
            <Link href="/shop/products">
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {t("add_product")}
              </Button>
            </Link>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {t("total_products")}
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
                {t("pending_orders")}
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
                {t("orders_in_progress")}
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
                {t("completed_orders")}
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
                {t("low_stock_items")}
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
              <CardTitle className="text-sm font-medium">
                {t("average_rating")}
              </CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {reviews?.length
                  ? (
                      reviews.reduce((acc, rev) => acc + rev.rating, 0) /
                      reviews.length
                    ).toFixed(1)
                  : t("not_available")}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {t("earnings_today")}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.earningsToday)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {t("earnings_month")}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.earningsMonth)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {t("earnings_total")}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.earningsTotal)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("earnings_by_customer")}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !stats?.customerSpendTotals?.length ? (
                <p className="text-center text-muted-foreground py-6">
                  {t("earnings_empty_state")}
                </p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                  {stats.customerSpendTotals.map((customer) => (
                    <div
                      key={customer.customerId}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {customer.name ||
                            `${t("customer")} #${customer.customerId}`}
                        </p>
                        {customer.phone && (
                          <p className="text-xs text-muted-foreground">
                            {customer.phone}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(customer.totalSpent)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {customer.orderCount} {t("orders")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("items_sold_title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !stats?.itemSalesTotals?.length ? (
                <p className="text-center text-muted-foreground py-6">
                  {t("items_sold_empty")}
                </p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                  {stats.itemSalesTotals.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {item.name ?? t("unknown_item")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("items_sold_quantity")}: {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {formatCurrency(item.totalAmount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {isWorker && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("shop_dashboard_my_permissions")}</CardTitle>
              </CardHeader>
              <CardContent>
                {workerResponsibilities && workerResponsibilities.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {workerResponsibilities.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {t("shop_dashboard_no_permissions")}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("shop_dashboard_quick_actions")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(canViewOrders || canProcessOrders) && (
                    <Link href="/shop/orders">
                      <Button size="sm">{t("shop_dashboard_view_orders")}</Button>
                    </Link>
                  )}
                  {canProcessOrders && (
                    <Link href="/shop/orders">
                      <Button size="sm" variant="secondary">
                        {t("shop_dashboard_process_payments")}
                      </Button>
                    </Link>
                  )}
                  {canAddProduct && (
                    <Link href="/shop/products">
                      <Button size="sm">{t("add_product")}</Button>
                    </Link>
                  )}
                  {canManagePromotions && (
                    <Link href="/shop/promotions">
                      <Button size="sm">{t("shop_dashboard_create_promotion")}</Button>
                    </Link>
                  )}
                  {canViewAnalytics && (
                    <Link href="/shop">
                      <Button size="sm" variant="outline">
                        {t("shop_dashboard_view_analytics")}
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("shop_dashboard_recent_orders")}</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : isWorker && !allowedOrdersAccess ? (
                <p className="text-center text-muted-foreground py-6">
                  {t("shop_dashboard_orders_permission_denied")}
                </p>
              ) : !orders?.length ? (
                <p className="text-center text-muted-foreground py-6">
                  {t("shop_dashboard_no_orders")}
                </p>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {t("order")} #{order.id}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {order.orderDate
                            ? formatIndianDisplay(order.orderDate, "date")
                            : t("not_available")}{" "}
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
                      {t("shop_dashboard_view_all_orders")}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("shop_dashboard_recent_reviews")}</CardTitle>
            </CardHeader>
            <CardContent>
              {reviewsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : !reviews?.length ? (
                <p className="text-center text-muted-foreground py-6">
                  {t("shop_dashboard_no_reviews")}
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
                      {t("shop_dashboard_view_all_reviews")}
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
