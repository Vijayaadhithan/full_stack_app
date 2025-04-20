import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatIndianDisplay } from '@shared/date-utils'; // Import IST utility
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Truck, CheckCircle2 } from "lucide-react";
import { Order, ReturnRequest } from "@shared/schema";
import { z } from "zod";
import { useState, useEffect } from "react";

type OrderWithDetails = Order & {
  customer: {
    name: string;
    phone: string;
    email: string;
  };
  items: {
    id: number;
    productId: number;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
};

const orderStatusSchema = z.object({
  status: z.enum(["confirmed", "packed", "dispatched", "delivered", "cancelled"]),
  comments: z.string().optional(),
  trackingInfo: z.string().optional(),
});

type OrderStatusData = z.infer<typeof orderStatusSchema>;

export default function ShopOrders() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [actionType, setActionType] = useState<"update" | "return" | null>(null);

  const { data: orders, isLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders/shop", user?.id],
    enabled: !!user?.id,
  });

  const { data: returns } = useQuery<ReturnRequest[]>({
    queryKey: ["/api/returns/shop", user?.id],
    enabled: !!user?.id,
  });

  const form = useForm<OrderStatusData>({
    resolver: zodResolver(orderStatusSchema),
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, data }: { orderId: number; data: OrderStatusData }) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/status`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update order status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/shop", user?.id] });
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

  const handleReturnRequest = useMutation({
    mutationFn: async ({ returnId, action, comments }: { returnId: number; action: 'approve' | 'reject'; comments?: string }) => {
      const res = await apiRequest("POST", `/api/returns/${returnId}/${action}`, { comments });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to process return request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns/shop", user?.id] });
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

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">{t("orders")}</TabsTrigger>
            <TabsTrigger value="returns">{t("returns")}</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            {isLoading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : !orders?.length ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">{t("no_orders")}</p>
                </CardContent>
              </Card>
            ) : (
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
                            {order.orderDate ? formatIndianDisplay(order.orderDate, 'date') : 'N/A'} {/* Use formatIndianDisplay */}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₹{order.total}</p>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(order.status)}
                            <span className="text-sm">{t(order.status)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">{t("customer_details")}</h4>
                          <p className="text-sm">{order.customer.name}</p>
                          <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
                          <p className="text-sm text-muted-foreground">{order.customer.email}</p>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">{t("order_items")}</h4>
                          <div className="space-y-2">
                            {order.items.map((item) => (
                              <div key={item.id} className="flex justify-between items-center">
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

                        <div className="flex justify-end gap-2">
                          <Dialog
                            open={actionType === "update" && selectedOrder?.id === order.id}
                            onOpenChange={() => {
                              setActionType(null);
                              setSelectedOrder(null);
                            }}
                          >
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
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{t("update_order_status")}</DialogTitle>
                              </DialogHeader>
                              <Form {...form}>
                                <form onSubmit={form.handleSubmit((data) => {
                                  if (selectedOrder) {
                                    updateOrderStatusMutation.mutate({
                                      orderId: selectedOrder.id,
                                      data,
                                    });
                                  }
                                })} className="space-y-4">
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
            )}
          </TabsContent>

          <TabsContent value="returns">
            {!returns?.length ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">{t("no_return_requests")}</p>
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
                            {returnRequest.createdAt ? formatIndianDisplay(returnRequest.createdAt, 'date') : 'N/A'} {/* Use formatIndianDisplay */}
                          </p>
                        </div>
                        <div className="flex gap-2">
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
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p>
                          <span className="font-medium">{t("reason")}:</span>{" "}
                          {returnRequest.reason}
                        </p>
                        <p>
                          <span className="font-medium">{t("description")}:</span>{" "}
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