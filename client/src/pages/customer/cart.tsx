import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Minus, Plus, Trash2, CreditCard } from "lucide-react";
import { useState } from "react";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

type CartItem = {
  product: Product;
  quantity: number;
};

export default function Cart() {
  const { toast } = useToast();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const { data: cartItems, isLoading } = useQuery<CartItem[]>({
    queryKey: ["/api/cart"],
  });

  console.log("Cart items:", cartItems); // Debug log

  const updateCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: number; quantity: number }) => {
      const res = await apiRequest("POST", "/api/cart", { productId, quantity });
      if (!res.ok) {
        throw new Error("Failed to update cart");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeFromCartMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await apiRequest("DELETE", `/api/cart/${productId}`);
      if (!res.ok) {
        throw new Error("Failed to remove from cart");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Removed from cart",
        description: "Product has been removed from your cart.",
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

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!cartItems?.length) {
        throw new Error("Cart is empty");
      }

      const res = await apiRequest("POST", "/api/orders", {
        items: cartItems.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
        })),
        total: cartItems.reduce(
          (total, item) => total + parseFloat(item.product.price) * item.quantity,
          0
        ).toString(),
      });

      if (!res.ok) {
        throw new Error("Failed to create order");
      }

      return res.json();
    },
    onSuccess: (data) => {
      console.log("Order created:", data); // Debug log

      // Handle Razorpay payment
      const options = {
        key: "rzp_test_1234567890", // Test mode key
        amount: parseInt(data.razorpayOrder.amount),
        currency: data.razorpayOrder.currency,
        name: "Your Shop Name",
        description: "Order payment",
        order_id: data.razorpayOrder.id,
        handler: async (response: any) => {
          console.log("Payment response:", response); // Debug log
          try {
            const res = await apiRequest("POST", `/api/orders/${data.order.id}/payment`, {
              razorpayPaymentId: response.razorpay_payment_id,
            });

            if (!res.ok) {
              throw new Error("Failed to confirm payment");
            }

            toast({
              title: "Payment successful",
              description: "Your order has been placed successfully.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
            setIsCheckingOut(false);
          } catch (error) {
            toast({
              title: "Payment confirmation failed",
              description: error instanceof Error ? error.message : "Please contact support",
              variant: "destructive",
            });
          }
        },
        prefill: {
          name: "Customer Name",
          email: "customer@example.com",
        },
        theme: {
          color: "#000000",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    },
    onError: (error: Error) => {
      toast({
        title: "Checkout failed",
        description: error.message,
        variant: "destructive",
      });
      setIsCheckingOut(false);
    },
  });

  const totalAmount = cartItems?.reduce(
    (total, item) => total + parseFloat(item.product.price) * item.quantity,
    0
  ) || 0;

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto space-y-6"
      >
        <h1 className="text-2xl font-bold">Shopping Cart</h1>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !cartItems?.length ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Your cart is empty</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            <Card>
              <CardContent className="divide-y">
                {cartItems?.map((item) => (
                  <motion.div
                    key={item.product.id}
                    className="py-4 first:pt-6 last:pb-6"
                  >
                    <div className="flex gap-4">
                      <img
                        src={item.product.images?.[0] || "https://via.placeholder.com/100"}
                        alt={item.product.name}
                        className="w-24 h-24 object-cover rounded"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.product.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          ₹{item.product.price} × {item.quantity}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() =>
                              updateCartMutation.mutate({
                                productId: item.product.id,
                                quantity: item.quantity - 1,
                              })
                            }
                            disabled={item.quantity <= 1 || updateCartMutation.isPending}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() =>
                              updateCartMutation.mutate({
                                productId: item.product.id,
                                quantity: item.quantity + 1,
                              })
                            }
                            disabled={updateCartMutation.isPending}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          ₹{(parseFloat(item.product.price) * item.quantity).toFixed(2)}
                        </p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeFromCartMutation.mutate(item.product.id)}
                          disabled={removeFromCartMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between mb-4">
                  <span className="font-semibold">Total Amount</span>
                  <span className="font-semibold">₹{totalAmount.toFixed(2)}</span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setIsCheckingOut(true);
                    createOrderMutation.mutate();
                  }}
                  disabled={isCheckingOut || createOrderMutation.isPending || !cartItems?.length}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Proceed to Checkout
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}