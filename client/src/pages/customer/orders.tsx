import React from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import MapLink from "@/components/location/MapLink";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Order } from "@shared/schema";
import { AnimatePresence, motion } from "framer-motion";
import { Package, ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { formatIndianDisplay } from "@shared/date-utils";
import { apiRequest } from "@/lib/queryClient";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

type OrderStatusFilter = "all" | Order["status"];

const ORDER_STATUS_OPTIONS: {
  value: OrderStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "packed", label: "Packed" },
  { value: "dispatched", label: "Dispatched" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
];

const ORDER_STATUS_LABELS: Record<Order["status"], string> = {
  pending: "Pending",
  cancelled: "Cancelled",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  dispatched: "Dispatched",
  shipped: "Shipped",
  delivered: "Delivered",
  returned: "Returned",
};

const ORDER_TRACK_STEPS: Order["status"][] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
];

const getOrderProgressIndex = (status: Order["status"]) => {
  const index = ORDER_TRACK_STEPS.indexOf(status);
  return index >= 0 ? index : 1;
};

const ConfettiBurst = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {Array.from({ length: 12 }).map((_, index) => (
      <motion.span
        key={index}
        className="absolute h-1.5 w-1.5 rounded-full"
        style={{
          backgroundColor: index % 2 === 0 ? "#22c55e" : "#3b82f6",
          left: `${(index / 12) * 100}%`,
          top: "50%",
        }}
        initial={{ opacity: 1, y: 0, x: 0 }}
        animate={{
          opacity: [1, 0.9, 0],
          y: [-10 - index * 2, -30 - index * 2],
          x: [0, (index % 2 === 0 ? 1 : -1) * 12],
        }}
        transition={{
          duration: 1.1,
          delay: index * 0.04,
          repeat: Infinity,
          repeatDelay: 5,
        }}
      />
    ))}
  </div>
);

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
  const [statusFilter, setStatusFilter] = React.useState<OrderStatusFilter>(
    "all",
  );
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
        className="max-w-4xl mx-auto space-y-6 p-6"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">My Orders</h1>
            <Link href="/customer">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as OrderStatusFilter)
            }
          >
            <SelectTrigger className="w-full md:w-[220px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !orders || orders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">You have no orders yet</p>
              <Link href="/customer/browse-shops">
                <Button className="mt-4">Browse Shops</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const hasShopCoordinates =
                order.shop?.latitude != null &&
                order.shop?.longitude != null;
              const progressIndex = getOrderProgressIndex(order.status);
              const isDelivered = order.status === "delivered";
              return (
                <motion.div key={order.id} variants={itemVariants}>
                  <Card>
                    <CardContent className="p-6 relative overflow-hidden">
                      <AnimatePresence>{isDelivered ? <ConfettiBurst /> : null}</AnimatePresence>
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">
                              Order #{order.id}
                            </h3>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Order ID: {order.id} <span className="mx-1">•</span>{" "}
                            Placed{" "}
                            {order.orderDate
                              ? formatIndianDisplay(
                                  order.orderDate,
                                  "datetime",
                                )
                              : "recently"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end justify-between">
                          <p className="font-semibold">₹{order.total}</p>
                          <p className="text-sm text-muted-foreground">
                            {ORDER_STATUS_LABELS[order.status] || order.status}
                          </p>
                          <Link href={`/customer/order/${order.id}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2"
                            >
                              View Details{" "}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        {ORDER_TRACK_STEPS.map((step, index) => {
                          const isActive = index <= progressIndex;
                          return (
                            <React.Fragment key={step}>
                              <div className="flex items-center gap-1">
                                <div
                                  className={`h-2.5 w-2.5 rounded-full border ${isActive ? "bg-primary border-primary" : "border-muted-foreground/40"}`}
                                />
                                <span
                                  className={isActive ? "text-foreground" : ""}
                                >
                                  {ORDER_STATUS_LABELS[step] || step}
                                </span>
                              </div>
                              {index !== ORDER_TRACK_STEPS.length - 1 && (
                                <div
                                  className={`h-px w-6 ${isActive ? "bg-primary" : "bg-muted"}`}
                                />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                      {order.deliveryMethod === "pickup" &&
                        (order.shop?.address || hasShopCoordinates) && (
                          <div className="mt-4 text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                            <span>
                              {order.shop?.address
                                ? `Pickup: ${order.shop.address}`
                                : "Pickup location available"}
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
      </motion.div>
    </DashboardLayout>
  );
}
