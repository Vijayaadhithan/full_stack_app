import React from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import MapLink from "@/components/location/MapLink";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Order } from "@shared/schema";
import { motion } from "framer-motion";
import { Package, ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { formatIndianDisplay } from "@shared/date-utils";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/language-context";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

type OrderStatusFilter = "all" | Order["status"];

type OrderWithShop = Order & {
  shop?: {
    name: string | null;
    phone: string | null;
    email: string | null;
    latitude: number | null;
    longitude: number | null;
    address?: string | null;
  };
};

export default function Orders() {
  const { t } = useLanguage();
  const [statusFilter, setStatusFilter] = React.useState<OrderStatusFilter>(
    "all",
  );
  const orderStatusOptions: { value: OrderStatusFilter; label: string }[] = [
    { value: "all", label: t("all") },
    { value: "pending", label: t("order_status_sent_to_shop") },
    {
      value: "awaiting_customer_agreement",
      label: t("order_status_awaiting_customer_agreement"),
    },
    { value: "confirmed", label: t("confirmed") },
    { value: "processing", label: t("processing") },
    { value: "packed", label: t("packed") },
    { value: "dispatched", label: t("dispatched") },
    { value: "shipped", label: t("shipped") },
    { value: "delivered", label: t("delivered") },
    { value: "cancelled", label: t("cancelled") },
    { value: "returned", label: t("returned") },
  ];

  const orderStatusLabels: Record<Order["status"], string> = {
    pending: t("order_status_sent_to_shop"),
    awaiting_customer_agreement: t("order_status_awaiting_customer_agreement"),
    cancelled: t("cancelled"),
    confirmed: t("confirmed"),
    processing: t("processing"),
    packed: t("packed"),
    dispatched: t("dispatched"),
    shipped: t("shipped"),
    delivered: t("delivered"),
    returned: t("returned"),
  };
  const { data: orders, isLoading } = useQuery<OrderWithShop[]>({
    queryKey: ["/api/orders/customer", statusFilter],
    queryFn: async () => {
      const query =
        statusFilter === "all"
          ? ""
          : `?status=${encodeURIComponent(statusFilter)}`;
      const res = await apiRequest("GET", `/api/orders/customer${query}`);
      return res.json();
    },
  });

  return (
    <DashboardLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-5xl mx-auto space-y-6 p-6"
      >
        <div className="space-y-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold">{t("customer_orders_title")}</h1>
            <Link href="/customer">
              <Button variant="ghost" className="justify-start">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("back_to_dashboard")}
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("customer_orders_hint")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <motion.aside
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Card>
              <CardContent className="space-y-4 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("status")}
                </p>
                <div className="grid gap-2">
                  {orderStatusOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={
                        statusFilter === option.value ? "secondary" : "ghost"
                      }
                      onClick={() => setStatusFilter(option.value)}
                      className="h-11 justify-start"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.aside>

          <div>
            {isLoading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : !orders || orders.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    {t("customer_orders_empty")}
                  </p>
                  <Link href="/customer/browse-shops">
                    <Button className="mt-4">{t("browse_shops")}</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const hasShopCoordinates =
                    order.shop?.latitude != null &&
                    order.shop?.longitude != null;
                  return (
                    <motion.div
                      key={order.id}
                      variants={itemVariants}
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <Card className="transition-shadow duration-200 ease-out hover:shadow-md">
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-primary" />
                                <h3 className="font-semibold">
                                  {t("order")} #{order.id}
                                </h3>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {t("order_id")}: {order.id}{" "}
                                <span className="mx-1">•</span>{" "}
                                {order.orderDate
                                  ? `${t("order_date_label")}: ${formatIndianDisplay(
                                      order.orderDate,
                                      "datetime",
                                    )}`
                                  : t("recently")}
                              </p>
                            </div>
                            <div className="flex flex-col items-end justify-between">
                              <p className="font-semibold">₹{order.total}</p>
                              <p className="text-sm text-muted-foreground">
                                {orderStatusLabels[order.status] ||
                                  order.status}
                              </p>
                              <Link href={`/customer/order/${order.id}`}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2"
                                >
                                  {t("view_details")}{" "}
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                          {order.deliveryMethod === "pickup" &&
                            (order.shop?.address || hasShopCoordinates) && (
                              <div className="mt-4 text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                                <span>
                                  {order.shop?.address
                                    ? t("pickup_location_with_address").replace(
                                        "{address}",
                                        order.shop.address,
                                      )
                                    : t("pickup_location_available")}
                                </span>
                                <MapLink
                                  latitude={order.shop?.latitude}
                                  longitude={order.shop?.longitude}
                                />
                              </div>
                            )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
