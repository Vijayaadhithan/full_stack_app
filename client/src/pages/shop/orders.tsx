import React from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import MapLink from "@/components/location/MapLink";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useWorkerPermissions } from "@/hooks/use-worker-permissions";
import { useLanguage } from "@/contexts/language-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatIndianDisplay } from "@shared/date-utils"; // Import IST utility
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Truck, CheckCircle2, LayoutGrid, List } from "lucide-react";
import { Order, ReturnRequest } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";
//const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
type OrderWithDetails = Order & {
  customer?: {
    name: string;
    phone: string;
    email: string;
    latitude?: number | null;
    longitude?: number | null;
    address?: string | null;
  } | null;
  items: {
    id: number;
    productId: number;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  deliveryMethod?: "delivery" | "pickup" | null;
  shippingAddress?: string | null;
  billingAddress?: string | null;
};

type ActiveBoardLane = "new" | "packing" | "ready";

type ActiveBoardOrder = {
  id: number;
  status: Order["status"];
  total: number;
  paymentStatus: Order["paymentStatus"] | null;
  deliveryMethod: Order["deliveryMethod"] | null;
  orderDate: string | null;
  customerName: string | null;
  items: {
    id: number;
    productId: number | null;
    name: string;
    quantity: number;
  }[];
};

type ActiveBoardResponse = Record<ActiveBoardLane, ActiveBoardOrder[]>;

type PayLaterWhitelistEntry = {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
};

type PayLaterWhitelistResponse = {
  allowPayLater: boolean;
  customers: PayLaterWhitelistEntry[];
  payLaterWhitelist: number[];
};

const orderStatusSchema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "processing",
    "packed",
    "dispatched",
    "delivered",
    "cancelled",
  ]),
  comments: z.string().optional(),
  trackingInfo: z.string().optional(),
});

type OrderStatusData = z.infer<typeof orderStatusSchema>;

const boardColumns: Record<
  ActiveBoardLane,
  {
    title: string;
    helper: string;
    targetStatus: OrderStatusData["status"];
    accent: string;
  }
> = {
  new: {
    title: "New",
    helper: "Fresh orders waiting to be accepted",
    targetStatus: "pending",
    accent: "border-blue-200/70 bg-blue-50/60",
  },
  packing: {
    title: "Packing",
    helper: "Bag items and verify quantities",
    targetStatus: "processing",
    accent: "border-amber-200/70 bg-amber-50/60",
  },
  ready: {
    title: "Ready / Dispatched",
    helper: "Handoff to pickup or delivery",
    targetStatus: "dispatched",
    accent: "border-emerald-200/70 bg-emerald-50/60",
  },
};

export default function ShopOrders() {
  const { user } = useAuth();
  const { has: can } = useWorkerPermissions();
  const canManagePayLater = user?.role === "shop" || can("orders:update");
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(
    null,
  );
  const [actionType, setActionType] = useState<"update" | "return" | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [draggedOrder, setDraggedOrder] = useState<{
    orderId: number;
    lane: ActiveBoardLane;
  } | null>(null);
  const [newWhitelistPhone, setNewWhitelistPhone] = useState("");

  const { data: orders, isLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ["orders", "shop", selectedStatus],
    enabled: !!user?.id,
    queryFn: async () => {
      const url =
        selectedStatus === "all"
          ? "/api/orders/shop"
          : `/api/orders/shop?status=${selectedStatus}`;
      const res = await apiRequest("GET", url);
      if (!res.ok) throw new Error("Network response was not ok");
      return res.json();
    },
  });

  const { data: activeBoard, isLoading: boardLoading } =
    useQuery<ActiveBoardResponse>({
      queryKey: ["orders", "shop", "active-board"],
      enabled: !!user?.id,
      queryFn: async () => {
        const res = await apiRequest("GET", "/api/shops/orders/active");
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(
            (error as { message?: string }).message ||
              "Failed to fetch active orders",
          );
        }
        return res.json();
      },
    });

  const { data: returns } = useQuery<ReturnRequest[]>({
    queryKey: ["/api/returns/shop", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/returns/shop");
      if (!res.ok) throw new Error("Network response was not ok");
      return res.json();
    },
  });

  const { data: payLaterWhitelist, isLoading: whitelistLoading } =
    useQuery<PayLaterWhitelistResponse, Error>({
      queryKey: ["pay-later-whitelist"],
      enabled: !!user?.id,
      queryFn: async () => {
        try {
          const res = await apiRequest(
            "GET",
            "/api/shops/pay-later/whitelist",
          );
          if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(
              (error as { message?: string }).message ||
                "Failed to load Pay Later whitelist",
            );
          }
          return res.json();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to load Pay Later whitelist";
          toast({
            title: "Unable to load Khata list",
            description: message,
            variant: "destructive",
          });
          throw error instanceof Error
            ? error
            : new Error("Failed to load Pay Later whitelist");
        }
      },
    });

  const addWhitelistMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("POST", "/api/shops/pay-later/whitelist", {
        phone,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(
          (error as { message?: string }).message ||
            "Failed to whitelist customer",
        );
      }
      return res.json() as Promise<PayLaterWhitelistResponse>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["pay-later-whitelist"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setNewWhitelistPhone("");
      toast({
        title: "Khata customer added",
        description:
          "Customer can now place Pay Later orders pending your approval.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not whitelist customer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeWhitelistMutation = useMutation({
    mutationFn: async (customerId: number) => {
      const res = await apiRequest(
        "DELETE",
        `/api/shops/pay-later/whitelist/${customerId}`,
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(
          (error as { message?: string }).message ||
            "Failed to remove customer",
        );
      }
      return res.json() as Promise<PayLaterWhitelistResponse>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["pay-later-whitelist"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Removed from Khata",
        description:
          "The customer will need approval again before using Pay Later.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update Khata list",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<OrderStatusData>({
    resolver: zodResolver(orderStatusSchema),
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      data,
    }: {
      orderId: number;
      data: OrderStatusData;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/orders/${orderId}/status`,
        data,
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update order status");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders", "shop"] });
      queryClient.invalidateQueries({
        queryKey: ["orders", "shop", "active-board"],
      });
      if (variables.orderId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/orders/${variables.orderId}`],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/orders/customer"] });
      toast({
        title: t("success"),
        description: t("order_status_updated"),
      });
      setSelectedOrder(null);
      setActionType(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest(
        "POST",
        `/api/orders/${orderId}/confirm-payment`,
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to confirm payment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", "shop"] });
      queryClient.invalidateQueries({
        queryKey: ["orders", "shop", "active-board"],
      });
      toast({ title: t("success"), description: "Payment confirmed" });
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approvePayLaterMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest(
        "POST",
        `/api/orders/${orderId}/approve-pay-later`,
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to approve Pay Later");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", "shop"] });
      queryClient.invalidateQueries({
        queryKey: ["orders", "shop", "active-board"],
      });
      toast({
        title: t("success"),
        description: "Pay Later approved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReturnRequest = useMutation({
    mutationFn: async ({
      returnId,
      action,
      comments,
    }: {
      returnId: number;
      action: "approve" | "reject";
      comments?: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/returns/${returnId}/${action}`,
        { comments },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to process return request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/returns/shop", user?.id],
      });
      toast({
        title: t("success"),
        description: t("return_request_processed"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "packed":
        return <Package className="h-4 w-4" />;
      case "dispatched":
        return <Truck className="h-4 w-4" />;
      case "delivered":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const boardData: ActiveBoardResponse = activeBoard ?? {
    new: [],
    packing: [],
    ready: [],
  };

  const handleDropOnLane = (lane: ActiveBoardLane) => {
    if (!draggedOrder) return;
    if (draggedOrder.lane === lane) {
      setDraggedOrder(null);
      return;
    }
    const targetStatus = boardColumns[lane].targetStatus;
    updateOrderStatusMutation.mutate({
      orderId: draggedOrder.orderId,
      data: { status: targetStatus },
    });
    setDraggedOrder(null);
  };

  const renderBoardCard = (order: ActiveBoardOrder, lane: ActiveBoardLane) => {
    const visibleItems = order.items.slice(0, 4);
    const remaining = order.items.length - visibleItems.length;

    return (
      <div
        key={order.id}
        draggable
        onDragStart={() => setDraggedOrder({ orderId: order.id, lane })}
        onDragEnd={() => setDraggedOrder(null)}
        className={`rounded-lg border bg-card p-3 shadow-sm transition hover:-translate-y-0.5 ${
          draggedOrder?.orderId === order.id ? "ring-2 ring-primary" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Order #{order.id}</p>
            <p className="text-xs text-muted-foreground">
              {order.customerName || "Customer"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">₹{order.total}</p>
            <p className="text-[11px] text-muted-foreground">
              {order.orderDate
                ? formatIndianDisplay(order.orderDate, "time")
                : "—"}
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="font-medium">{item.name}</span>
              <span className="text-muted-foreground">× {item.quantity}</span>
            </div>
          ))}
          {remaining > 0 && (
            <p className="text-xs text-muted-foreground">
              +{remaining} more item{remaining > 1 ? "s" : ""}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Package className="h-4 w-4" />
            {order.deliveryMethod === "delivery" ? "Delivery" : "Pickup"}
          </span>
          <Badge variant="outline" className="text-[11px]">
            {order.status}
          </Badge>
        </div>
      </div>
    );
  };

  const renderBoardView = () => {
    const hasActiveOrders =
      boardData.new.length + boardData.packing.length + boardData.ready.length >
      0;

    if (boardLoading) {
      return (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(boardColumns) as ActiveBoardLane[]).map((lane) => {
          const config = boardColumns[lane];
          const ordersForLane = boardData[lane] ?? [];

          return (
            <div
              key={lane}
              className="rounded-xl border bg-background shadow-sm overflow-hidden"
            >
              <div
                className={`flex items-center justify-between border-b px-4 py-3 ${config.accent}`}
              >
                <div>
                  <p className="text-sm font-semibold">{config.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {config.helper}
                  </p>
                </div>
                <Badge variant="secondary">{ordersForLane.length}</Badge>
              </div>
              <div
                className="space-y-3 p-3 min-h-[200px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnLane(lane);
                }}
              >
                {!ordersForLane.length ? (
                  <div className="flex h-full min-h-[140px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                    {hasActiveOrders
                      ? "Drag an order here"
                      : "No active orders yet"}
                  </div>
                ) : (
                  ordersForLane.map((order) => renderBoardCard(order, lane))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderOrdersList = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (!orders?.length) {
      return (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">{t("no_orders")}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold">
                    {t("order")} #{order.id}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {order.orderDate
                      ? formatIndianDisplay(order.orderDate, "date")
                      : "N/A"}{" "}
                    {/* Use formatIndianDisplay */}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">₹{order.total}</p>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(order.status)}
                    <span className="text-sm">{t(order.status)}</span>
                    {order.paymentMethod === "pay_later" && (
                      <Badge variant="outline">Pay Later</Badge>
                    )}
                    {order.paymentStatus === "verifying" && (
                      <Badge className="bg-yellow-200 text-yellow-900">
                        Verification Needed
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">
                    {t("customer_details")}
                  </h4>
                  <p className="text-sm">{order.customer?.name ?? "N/A"}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.customer?.phone ?? "N/A"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.customer?.email ?? "N/A"}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Delivery Details</h4>
                  <p className="text-sm">
                    {order.deliveryMethod === "delivery"
                      ? "Home Delivery"
                      : order.deliveryMethod === "pickup"
                        ? "In-Store Pickup"
                        : "Not specified"}
                  </p>
                  {order.deliveryMethod === "delivery" ? (
                    <div className="text-sm text-muted-foreground whitespace-pre-line flex flex-col gap-2">
                      <span>
                        {order.shippingAddress?.trim().length
                          ? order.shippingAddress
                          : "No shipping address provided"}
                      </span>
                      <MapLink
                        latitude={order.customer?.latitude}
                        longitude={order.customer?.longitude}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Provide the order at your shop counter when the customer
                      arrives.
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-2">{t("order_items")}</h4>
                  <div className="space-y-2">
                    {order.items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center"
                      >
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} × ₹{item.price}
                          </p>
                        </div>
                        <p className="font-semibold">₹{item.total}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {order.paymentMethod === "pay_later" &&
                  order.paymentStatus === "pending" && (
                    <div className="p-4 rounded-md bg-blue-50 border text-sm space-y-2">
                      <p className="font-medium text-blue-900">
                        Pay Later (Khata) pending approval
                      </p>
                      <p className="text-blue-900/80">
                        Approve credit to confirm availability and move the order forward.
                      </p>
                      {(user?.role === "shop" || can("orders:update")) && (
                        <Button
                          size="sm"
                          onClick={() => approvePayLaterMutation.mutate(order.id)}
                          disabled={approvePayLaterMutation.isPending}
                        >
                          {approvePayLaterMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Approve Pay Later
                        </Button>
                      )}
                    </div>
                  )}

                {(order.paymentStatus === "verifying" ||
                  (order.paymentMethod === "cash" &&
                    order.paymentStatus === "pending")) && (
                  <div className="p-4 rounded-md bg-yellow-100 border text-sm space-y-2">
                    {order.paymentMethod === "upi" && (
                      <p className="font-medium">
                        Payment Reference: {order.paymentReference}
                      </p>
                    )}
                    {order.paymentMethod === "pay_later" && (
                      <p className="text-xs text-muted-foreground">
                        Mark as paid once the customer settles the balance.
                      </p>
                    )}
                    {(user?.role === "shop" || can("orders:update")) && (
                      <Button
                        size="sm"
                        onClick={() => confirmPaymentMutation.mutate(order.id)}
                      >
                        Confirm Payment
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Dialog
                    open={
                      actionType === "update" && selectedOrder?.id === order.id
                    }
                    onOpenChange={(open) => {
                      if (!open) {
                        setActionType(null);
                        setSelectedOrder(null);
                      }
                    }}
                  >
                    {(user?.role === "shop" || can("orders:update")) && (
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedOrder(order);
                            setActionType("update");
                          }}
                        >
                          {t("update_status")}
                        </Button>
                      </DialogTrigger>
                    )}
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("update_order_status")}</DialogTitle>
                      </DialogHeader>
                      <Form {...form}>
                        <form
                          onSubmit={form.handleSubmit((data) => {
                            if (selectedOrder) {
                              updateOrderStatusMutation.mutate({
                                orderId: selectedOrder.id,
                                data,
                              });
                            }
                          })}
                          className="space-y-4"
                        >
                          <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("status")}</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue
                                        placeholder={t("select_status")}
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="confirmed">
                                      {t("confirmed")}
                                    </SelectItem>
                                    <SelectItem value="packed">
                                      {t("packed")}
                                    </SelectItem>
                                    <SelectItem value="dispatched">
                                      {t("dispatched")}
                                    </SelectItem>
                                    <SelectItem value="delivered">
                                      {t("delivered")}
                                    </SelectItem>
                                    <SelectItem value="cancelled">
                                      {t("cancelled")}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {form.watch("status") === "cancelled" && (
                            <FormField
                              control={form.control}
                              name="comments"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("cancellation_reason")}</FormLabel>
                                  <FormControl>
                                    <Textarea {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {form.watch("status") === "dispatched" && (
                            <FormField
                              control={form.control}
                              name="trackingInfo"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("tracking_info")}</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          <Button type="submit" className="w-full">
                            {updateOrderStatusMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {t("update_status")}
                          </Button>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{t("order_management")}</h1>
          <div className="flex gap-4">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder={t("filter_by_status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_orders")}</SelectItem>
                <SelectItem value="confirmed">{t("confirmed")}</SelectItem>
                <SelectItem value="packed">{t("packed")}</SelectItem>
                <SelectItem value="dispatched">{t("dispatched")}</SelectItem>
                <SelectItem value="delivered">{t("delivered")}</SelectItem>
                <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Khata / Pay Later approvals</h2>
                <p className="text-sm text-muted-foreground">
                  Whitelist trusted customers so they can request Pay Later without prior orders. Every Pay Later order stays pending until you approve credit.
                </p>
              </div>
              <Badge
                variant={payLaterWhitelist?.allowPayLater ? "secondary" : "outline"}
                className="whitespace-nowrap"
              >
                {payLaterWhitelist?.allowPayLater
                  ? "Pay Later enabled"
                  : "Pay Later disabled"}
              </Badge>
            </div>

            {!payLaterWhitelist?.allowPayLater && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Turn on Pay Later in your shop profile to accept Khata requests.
              </div>
            )}

            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newWhitelistPhone.trim();
                if (!trimmed) return;
                addWhitelistMutation.mutate(trimmed);
              }}
            >
              <Input
                placeholder="Customer phone number"
                value={newWhitelistPhone}
                onChange={(e) => setNewWhitelistPhone(e.target.value)}
                disabled={
                  addWhitelistMutation.isPending || !canManagePayLater
                }
              />
              <Button
                type="submit"
                disabled={
                  addWhitelistMutation.isPending ||
                  !newWhitelistPhone.trim() ||
                  !canManagePayLater
                }
              >
                {addWhitelistMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Whitelist customer
              </Button>
            </form>

            <div className="space-y-2">
              {whitelistLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading Khata customers...
                </p>
              ) : !payLaterWhitelist ? (
                <p className="text-sm text-amber-800">
                  Unable to load Khata list right now. Please try again.
                </p>
              ) : !payLaterWhitelist.customers.length ? (
                <p className="text-sm text-muted-foreground">
                  No whitelisted customers yet.
                </p>
              ) : (
                payLaterWhitelist.customers.map(
                  (customer: PayLaterWhitelistEntry) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">
                        {customer.name || `Customer #${customer.id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {customer.phone || customer.email || "No contact info"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        removeWhitelistMutation.mutate(customer.id)
                      }
                      disabled={
                        removeWhitelistMutation.isPending || !canManagePayLater
                      }
                    >
                      {removeWhitelistMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">{t("orders")}</TabsTrigger>
            <TabsTrigger value="returns">{t("returns")}</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  Drag cards to update status without opening order details.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md border bg-muted/60 p-1">
                <Button
                  variant={viewMode === "board" ? "default" : "ghost"}
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setViewMode("board")}
                >
                  <LayoutGrid className="h-4 w-4" />
                  KDS Board
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                  List view
                </Button>
              </div>
            </div>
            {viewMode === "board" ? renderBoardView() : renderOrdersList()}
          </TabsContent>

          <TabsContent value="returns">
            {!returns?.length ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    {t("no_return_requests")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {returns.map((returnRequest) => (
                  <Card key={returnRequest.id}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold">
                            {t("return_request")} #{returnRequest.id}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {returnRequest.createdAt
                              ? formatIndianDisplay(
                                  returnRequest.createdAt,
                                  "date",
                                )
                              : "N/A"}{" "}
                            {/* Use formatIndianDisplay */}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {(user?.role === 'shop' || can('returns:manage')) && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              handleReturnRequest.mutate({
                                returnId: returnRequest.id,
                                action: "approve",
                              })
                            }
                            disabled={returnRequest.status !== "requested"}
                          >
                            {t("approve_return")}
                          </Button>
                          )}
                          {(user?.role === 'shop' || can('returns:manage')) && (
                          <Button
                            variant="outline"
                            className="text-red-600"
                            onClick={() =>
                              handleReturnRequest.mutate({
                                returnId: returnRequest.id,
                                action: "reject",
                              })
                            }
                            disabled={returnRequest.status !== "requested"}
                          >
                            {t("reject_return")}
                          </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p>
                          <span className="font-medium">{t("reason")}:</span>{" "}
                          {returnRequest.reason}
                        </p>
                        <p>
                          <span className="font-medium">
                            {t("description")}:
                          </span>{" "}
                          {returnRequest.description}
                        </p>
                        <p>
                          <span className="font-medium">{t("status")}:</span>{" "}
                          {t(returnRequest.status)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
