import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Product, Promotion } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Minus, Plus, Trash2, CreditCard, Tag, RefreshCw, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

type CartItem = {
  product: Product;
  quantity: number;
};

export default function Cart() {
  const { toast } = useToast();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [shopId, setShopId] = useState<number | null>(null);

  const { data: cartItems, isLoading } = useQuery<CartItem[]>({ // Ensure correct type
    queryKey: ["/api/cart"],
    // onSuccess removed
  });

  // Use useEffect to handle side effects after data fetching
  useEffect(() => {
    if (cartItems && cartItems.length > 0) {
      setShopId(cartItems[0].product.shopId);
    } else {
      setShopId(null); // Reset shopId if cart is empty or undefined
    }
  }, [cartItems]);

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

  // Fetch available promotions for the shop
  const { data: availablePromotions, isLoading: isLoadingPromotions } = useQuery<Promotion[]>({
    queryKey: ["/api/promotions/active", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      if (!shopId) return [];
      const res = await apiRequest("GET", `/api/promotions/active/${shopId}`);
      if (!res.ok) throw new Error("Failed to fetch promotions");
      return res.json();
    },
  });

  // Calculate the subtotal from cart items
  const subtotal =
    cartItems?.reduce(
      (total: number, item: CartItem) => total + parseFloat(item.product.price) * item.quantity,
      0
    ) ?? 0; // Use nullish coalescing for default value

  // Platform fee is fixed at 3rs
  const platformFee = 3;

  // Calculate the final total after applying promotion and adding platform fee
  const totalAmount = subtotal - discountAmount + platformFee;

  // Handle promotion selection
  const handlePromotionSelect = async (promotion: Promotion | null) => {
    if (!promotion) {
      setSelectedPromotion(null);
      setDiscountAmount(0);
      return;
    }

    try {
      // Calculate discount based on promotion type
      let discount = 0;
      if (promotion.type === "percentage") {
        discount = (parseFloat(promotion.value.toString()) / 100) * subtotal;
        // Apply max discount cap if specified
        if (promotion.maxDiscount && discount > parseFloat(promotion.maxDiscount.toString())) {
          discount = parseFloat(promotion.maxDiscount.toString());
        }
      } else {
        // Fixed amount discount
        discount = parseFloat(promotion.value.toString());
        // Ensure discount doesn't exceed the subtotal
        if (discount > subtotal) {
          discount = subtotal;
        }
      }

      setSelectedPromotion(promotion);
      setDiscountAmount(discount);
    } catch (error) {
      console.error("Error applying promotion:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to apply promotion",
        variant: "destructive",
      });
    }
  };

  // Reset promotion selection when shop changes
  useEffect(() => {
    setSelectedPromotion(null);
    setDiscountAmount(0);
  }, [shopId]);

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!cartItems || cartItems.length === 0) { // Explicit check
        throw new Error("Cart is empty");
      }

      const orderData = {
        items: cartItems.map((item: CartItem) => ({ // Explicit type
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
        })),
        total: totalAmount.toString(),
        subtotal: subtotal.toString(),
        discount: discountAmount.toString(),
        promotionId: selectedPromotion?.id,
      };

      const res = await apiRequest("POST", "/api/orders", orderData);

      if (!res.ok) {
        throw new Error("Failed to create order");
      }

      return res.json();
    },
    onSuccess: async (data) => {
      console.log("Order created:", data); // Debug log

      // Handle Razorpay payment
      // If a promotion was used, update its usage count
      if (selectedPromotion) {
        try {
          await apiRequest("POST", `/api/promotions/${selectedPromotion.id}/apply`, {
            orderId: data.order.id,
          });
        } catch (error) {
          console.error("Error updating promotion usage:", error);
        }
      }

      const options = {
        key: "rzp_test_WIK4gEdE7PPhgw", // Using the provided test key directly
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

  // Format promotion display
  const formatPromotionValue = (promotion: Promotion) => {
    if (promotion.type === "percentage") {
      return `${promotion.value}% off`;
    } else {
      return `₹${promotion.value} off`;
    }
  };

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
                {cartItems?.map((item: CartItem) => ( // Explicit type
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

            {/* Promotions Section */}
            {shopId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Tag className="h-4 w-4 mr-2" />
                    Available Promotions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingPromotions ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : !availablePromotions?.length ? (
                    <p className="text-sm text-muted-foreground">
                      No promotions available for this shop
                    </p>
                  ) : (
                    <RadioGroup
                      value={selectedPromotion ? String(selectedPromotion.id) : ""}
                      onValueChange={(value) => {
                        if (value === "") {
                          handlePromotionSelect(null);
                        } else {
                          const promotion = availablePromotions.find(
                            (p) => p.id === parseInt(value)
                          );
                          if (promotion) handlePromotionSelect(promotion);
                        }
                      }}
                      className="space-y-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="" id="no-promotion" />
                        <Label htmlFor="no-promotion">No promotion</Label>
                      </div>

                      {availablePromotions.map((promotion) => (
                        <div
                          key={promotion.id}
                          className="flex items-start space-x-2 border rounded-md p-2"
                        >
                          <RadioGroupItem
                            value={String(promotion.id)}
                            id={`promotion-${promotion.id}`}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <Label
                                htmlFor={`promotion-${promotion.id}`}
                                className="font-medium"
                              >
                                {promotion.name}
                              </Label>
                              <Badge variant="outline">
                                {formatPromotionValue(promotion)}
                              </Badge>
                            </div>
                            {promotion.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {promotion.description}
                              </p>
                            )}
                            {promotion.usageLimit && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {promotion.usageLimit - (promotion.usedCount || 0)} uses remaining
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center">
                      <Check className="h-4 w-4 mr-1" />
                      Discount
                      {selectedPromotion && (
                        <span className="text-xs ml-1">
                          ({selectedPromotion.name})
                        </span>
                      )}
                    </span>
                    <span>-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-muted-foreground">
                  <span>Platform Fee</span>
                  <span>₹{platformFee.toFixed(2)}</span>
                </div>

                <Separator />

                <div className="flex justify-between font-medium">
                  <span>Total Amount</span>
                  <span>₹{totalAmount.toFixed(2)}</span>
                </div>

                <Button
                  className="w-full mt-4"
                  onClick={() => {
                    setIsCheckingOut(true);
                    createOrderMutation.mutate();
                  }}
                  disabled={
                    isCheckingOut ||
                    createOrderMutation.isPending ||
                    !cartItems || cartItems.length === 0 // Explicit check
                  }
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
