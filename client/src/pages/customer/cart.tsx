import React from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Product, Promotion, PaymentMethodType } from "@shared/schema";
import { featureFlags, platformFees } from "@shared/config";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Minus, Plus, Trash2, Tag, Check, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentMethodSelector } from "@/components/payment-method-selector";
import { DeliveryMethodSelector } from "@/components/delivery-method-selector";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToastAction } from "@/components/ui/toast";
import { useLocation } from "wouter";
import { getVerificationError, parseApiError } from "@/lib/api-error";

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

type ShopInfo = {
  pickupAvailable?: boolean;
  deliveryAvailable?: boolean;
  catalogModeEnabled?: boolean;
  openOrderMode?: boolean;
  allowPayLater?: boolean;
  payLaterEligibilityForCustomer?: {
    eligible: boolean;
    isKnownCustomer: boolean;
    isWhitelisted: boolean;
  };
};

export default function Cart() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(
    null,
  );
  const [discountAmount, setDiscountAmount] = useState(0);
  const [shopId, setShopId] = useState<number | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">(
    "pickup",
  );
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodType>("upi");

  const { data: shopInfo } = useQuery<ShopInfo>({
    queryKey: ["shop-info", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/${shopId}`);
      if (!res.ok) throw new Error("Failed to fetch shop info");
      return res.json();
    },
  });

  const { data: cartItems, isLoading } = useQuery<CartItem[]>({
    // Ensure correct type
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

  useEffect(() => {
    if (shopInfo) {
      if (shopInfo.pickupAvailable && !shopInfo.deliveryAvailable) {
        setDeliveryMethod("pickup");
      } else if (!shopInfo.pickupAvailable && shopInfo.deliveryAvailable) {
        setDeliveryMethod("delivery");
      }
    }
  }, [shopInfo]);

  useEffect(() => {
    if (deliveryMethod === "delivery" && paymentMethod === "cash") {
      setPaymentMethod("upi");
    }
  }, [deliveryMethod, paymentMethod]);

  const openOrderEnabled = Boolean(
    shopInfo?.catalogModeEnabled || shopInfo?.openOrderMode,
  );
  const payLaterEligibility = shopInfo?.payLaterEligibilityForCustomer;
  const payLaterEnabled = Boolean(shopInfo?.allowPayLater);
  const payLaterAvailable =
    payLaterEnabled && (payLaterEligibility?.eligible ?? true);
  const openOrderWarning =
    openOrderEnabled &&
    (cartItems?.some((item) => Number(item.product.stock ?? 0) <= 0) ?? false);
  const payLaterDisabledReason = !payLaterEnabled
    ? "Pay Later is disabled for this shop."
    : payLaterEligibility && !payLaterEligibility.eligible
      ? "Pay Later is limited to repeat or whitelisted customers. Ask the shop owner to whitelist you."
      : undefined;

  useEffect(() => {
    if (!payLaterAvailable && paymentMethod === "pay_later") {
      setPaymentMethod("upi");
    }
  }, [payLaterAvailable, paymentMethod]);

  console.log("Cart items:", cartItems); // Debug log

  const updateCartMutation = useMutation<
    unknown,
    Error,
    { productId: number; quantity: number },
    { previousCart?: CartItem[] }
  >({
    mutationFn: async ({ productId, quantity }) => {
      const res = await apiRequest("POST", "/api/cart", {
        productId,
        quantity,
      });
      if (!res.ok) {
        throw new Error("Failed to update cart");
      }
      return res.json();
    },
    onMutate: async ({ productId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/cart"] });
      const previousCart = queryClient.getQueryData<CartItem[]>(["/api/cart"]);

      if (previousCart) {
        const optimisticCart = previousCart
          .map((item) =>
            item.product.id === productId ? { ...item, quantity } : item,
          )
          .filter((item) => item.quantity > 0);
        queryClient.setQueryData(["/api/cart"], optimisticCart);
      }

      return { previousCart };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(["/api/cart"], context.previousCart);
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeFromCartMutation = useMutation<
    unknown,
    Error,
    number,
    { previousCart?: CartItem[] }
  >({
    mutationFn: async (productId: number) => {
      const res = await apiRequest("DELETE", `/api/cart/${productId}`);
      if (!res.ok) {
        throw new Error("Failed to remove from cart");
      }
    },
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/cart"] });
      const previousCart = queryClient.getQueryData<CartItem[]>(["/api/cart"]);
      if (previousCart) {
        queryClient.setQueryData<CartItem[]>(
          ["/api/cart"],
          previousCart.filter((item) => item.product.id !== productId),
        );
      }
      return { previousCart };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Removed from cart",
        description: "Product has been removed from your cart.",
      });
    },
    onError: (error: Error, _productId, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(["/api/cart"], context.previousCart);
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch available promotions for the shop
  const { data: availablePromotions, isLoading: isLoadingPromotions } =
    useQuery<Promotion[]>({
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
      (total: number, item: CartItem) =>
        total + parseFloat(item.product.price) * item.quantity,
      0,
    ) ?? 0; // Use nullish coalescing for default value

  const platformFee = featureFlags.platformFeesEnabled ? platformFees.productOrder : 0;

  // Calculate the final total after applying promotion and adding platform fee (if enabled)
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
        if (
          promotion.maxDiscount &&
          discount > parseFloat(promotion.maxDiscount.toString())
        ) {
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
        description:
          error instanceof Error ? error.message : "Failed to apply promotion",
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
      if (!cartItems || cartItems.length === 0) {
        // Explicit check
        throw new Error("Cart is empty");
      }

      const orderData = {
        items: cartItems.map((item: CartItem) => ({
          // Explicit type
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
        })),
        total: totalAmount.toString(),
        subtotal: subtotal.toString(),
        discount: discountAmount.toString(),
        promotionId: selectedPromotion?.id,
        deliveryMethod,
        paymentMethod,
      };

      const res = await apiRequest("POST", "/api/orders", orderData);

      if (!res.ok) {
        throw new Error("Failed to create order");
      }

      return res.json();
    },
    onSuccess: async (data) => {
      console.log("Order created:", data);

      if (selectedPromotion) {
        try {
          await apiRequest(
            "POST",
            `/api/promotions/${selectedPromotion.id}/apply`,
            {
              orderId: data.order.id,
            },
          );
        } catch (error) {
          console.error("Error updating promotion usage:", error);
        }
      }
      toast({
        title: "Order sent to shop",
        description: "The shop will confirm the final bill amount soon.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      setIsCheckingOut(false);
    },
    onError: (error: Error) => {
      setIsCheckingOut(false);
      const verificationError = getVerificationError(error);
      if (verificationError) {
        toast({
          title: "Verification required",
          description: verificationError.message,
          variant: "destructive",
          action: (
            <ToastAction
              altText="Open profile settings"
              onClick={() => navigate("/customer/profile")}
            >
              Go to profile
            </ToastAction>
          ),
        });
        return;
      }

      const parsed = parseApiError(error);
      toast({
        title: "Checkout failed",
        description: parsed.message,
        variant: "destructive",
      });
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
    <TooltipProvider>
      <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto space-y-6"
      >
        <h1 className="text-2xl font-bold">Shopping Cart</h1>

        {isLoading ? (
          <div className="grid gap-6">
            <Card>
              <CardContent className="divide-y">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={index}
                    className="py-4 first:pt-6 last:pb-6 flex gap-4"
                  >
                    <Skeleton className="w-24 h-24 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-56" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-32" />
                    </div>
                    <div className="space-y-2 text-right">
                      <Skeleton className="h-5 w-16 ml-auto" />
                      <Skeleton className="h-10 w-10 ml-auto rounded-md" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
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
                {cartItems?.map(
                  (
                    item: CartItem, // Explicit type
                  ) => (
                    <motion.div
                      key={item.product.id}
                      className="py-4 first:pt-6 last:pb-6"
                    >
                      <div className="flex gap-4">
                        <img
                          src={
                            item.product.images?.[0] ||
                            "https://via.placeholder.com/100"
                          }
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
                              disabled={
                                item.quantity <= 1 ||
                                updateCartMutation.isPending
                              }
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center">
                              {item.quantity}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() =>
                                updateCartMutation.mutate({
                                  productId: item.product.id,
                                  quantity: item.quantity + 1,
                                })
                              }
                              disabled={
                                updateCartMutation.isPending ||
                                (!openOrderEnabled &&
                                  item.quantity >=
                                    Number(item.product.stock ?? 0))
                              }
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            ₹
                            {(
                              parseFloat(item.product.price) * item.quantity
                            ).toFixed(2)}
                          </p>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() =>
                              removeFromCartMutation.mutate(item.product.id)
                            }
                            disabled={removeFromCartMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ),
                )}
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
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : !availablePromotions?.length ? (
                    <p className="text-sm text-muted-foreground">
                      No promotions available for this shop
                    </p>
                  ) : (
                    <RadioGroup
                      value={
                        selectedPromotion ? String(selectedPromotion.id) : ""
                      }
                      onValueChange={(value) => {
                        if (value === "") {
                          handlePromotionSelect(null);
                        } else {
                          const promotion = availablePromotions.find(
                            (p) => p.id === parseInt(value),
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
                                {promotion.usageLimit -
                                  (promotion.usedCount || 0)}{" "}
                                uses remaining
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

            {shopInfo && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Delivery Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <DeliveryMethodSelector
                    value={deliveryMethod}
                    onChange={(value) => setDeliveryMethod(value)}
                    pickupAvailable={shopInfo.pickupAvailable}
                    deliveryAvailable={shopInfo.deliveryAvailable}
                  />
                </CardContent>
              </Card>
            )}

            {openOrderWarning && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm flex gap-3">
                <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">Open order request</p>
                  <p className="text-amber-800">
                    Stock counts are not enforced for this shop. The shop owner will confirm availability before processing your order.
                  </p>
                </div>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentMethodSelector
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  allowPayLater={payLaterEnabled}
                  disableCash={deliveryMethod === "delivery"}
                  payLaterDisabledReason={payLaterDisabledReason}
                />
                {paymentMethod === "pay_later" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Pay Later orders are placed as pending approval. The shop owner will approve credit before processing.
                  </p>
                )}
                {deliveryMethod === "delivery" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Cash on delivery is disabled. Choose UPI or Pay Later.
                  </p>
                )}
              </CardContent>
            </Card>

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

                {featureFlags.platformFeesEnabled &&
                featureFlags.platformFeeBreakdownEnabled ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      Platform Service Fee
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground focus:outline-none"
                            aria-label="Learn more about the platform service fee"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-sm">
                          This small fee helps us operate the platform and provide
                          you with support.
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    <span>₹{platformFee.toFixed(2)}</span>
                  </div>
                ) : null}

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
                    !cartItems ||
                    cartItems.length === 0
                  }
                >
                  Place Order
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>
      </DashboardLayout>
    </TooltipProvider>
  );
}
