import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Truck, CheckCircle2 } from "lucide-react";
import { Order, ReturnRequest } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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

export default function ShopOrders() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery<OrderWithDetails[]>({
    queryKey: [`/api/orders/shop/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: returns } = useQuery<ReturnRequest[]>({
    queryKey: [`/api/returns/shop/${user?.id}`],
    enabled: !!user?.id,
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, trackingInfo }: { orderId: number; status: string; trackingInfo?: string }) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status, trackingInfo });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update order status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/shop/${user?.id}`] });
      toast({
        title: "Success",
        description: "Order status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveReturnMutation = useMutation({
    mutationFn: async (returnId: number) => {
      const res = await apiRequest("POST", `/api/returns/${returnId}/approve`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to approve return");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/returns/shop/${user?.id}`] });
      toast({
        title: "Success",
        description: "Return request approved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Order Management</h1>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : !orders?.length ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">No orders yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold">Order #{order.id}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.orderDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₹{order.total}</p>
                          <p className="text-sm text-muted-foreground">{order.items.length} items</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{order.customer.name}</p>
                            <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              defaultValue={order.status}
                              onValueChange={(status) =>
                                updateOrderStatusMutation.mutate({ orderId: order.id, status })
                              }
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Update status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="confirmed">Confirm Order</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="packed">Packed</SelectItem>
                                <SelectItem value="shipped">Shipped</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="cancelled">Cancel Order</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="border rounded-lg p-4 space-y-2">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Qty: {item.quantity} × ₹{item.price}
                                </p>
                              </div>
                              <p className="font-semibold">₹{item.total}</p>
                            </div>
                          ))}
                        </div>

                        {order.status === "shipped" && (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter tracking number"
                              onChange={(e) =>
                                updateOrderStatusMutation.mutate({
                                  orderId: order.id,
                                  status: order.status,
                                  trackingInfo: e.target.value,
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="returns" className="space-y-6">
            {!returns?.length ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">No return requests</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {returns.map((returnRequest) => (
                  <Card key={returnRequest.id}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold">Return Request #{returnRequest.id}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(returnRequest.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          onClick={() => approveReturnMutation.mutate(returnRequest.id)}
                          disabled={returnRequest.status !== "requested"}
                        >
                          {approveReturnMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Approve Return"
                          )}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <p><span className="font-medium">Reason:</span> {returnRequest.reason}</p>
                        <p><span className="font-medium">Description:</span> {returnRequest.description}</p>
                        <p><span className="font-medium">Status:</span> {returnRequest.status}</p>
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
