import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams, Link } from "wouter";
import { ArrowLeft, Send, Store } from "lucide-react";
import type { PublicShop } from "@/types/public-shop";
import { getVerificationError, parseApiError } from "@/lib/api-error";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { DeliveryMethodSelector } from "@/components/delivery-method-selector";

type DeliveryMethod = "delivery" | "pickup";

type CustomerOrderForSuggestions = {
  id: number;
  shopId: number | null;
  status:
    | "pending"
    | "cancelled"
    | "confirmed"
    | "processing"
    | "packed"
    | "dispatched"
    | "shipped"
    | "delivered"
    | "returned";
  orderType: "product_order" | "text_order";
  orderText: string | null;
  orderDate?: string | null;
  items: Array<{
    id: number;
    productId: number | null;
    name: string;
    quantity: number;
    price: string;
    total: string;
  }>;
};

export default function QuickOrder() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const shopId = id ? Number(id) : NaN;

  const [orderText, setOrderText] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup");
  const [monthlyList, setMonthlyList] = useState("");

  const { data: shop, isLoading: shopLoading } = useQuery<PublicShop, Error>({
    queryKey: [`/api/shops/${id}`],
    enabled: Number.isFinite(shopId),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/shops/${shopId}`);
      return res.json();
    },
  });

  const deliveryOptions = useMemo(() => {
    const pickupAvailable = shop?.pickupAvailable ?? true;
    const deliveryAvailable = shop?.deliveryAvailable ?? false;
    return { pickupAvailable, deliveryAvailable };
  }, [shop?.pickupAvailable, shop?.deliveryAvailable]);

  useEffect(() => {
    if (!shop) return;
    if (deliveryOptions.pickupAvailable && !deliveryOptions.deliveryAvailable) {
      setDeliveryMethod("pickup");
    } else if (!deliveryOptions.pickupAvailable && deliveryOptions.deliveryAvailable) {
      setDeliveryMethod("delivery");
    }
  }, [shop, deliveryOptions.pickupAvailable, deliveryOptions.deliveryAvailable]);

  const monthlyListStorageKey = useMemo(() => {
    const userKey = typeof user?.id === "number" ? user.id : "anon";
    if (!Number.isFinite(shopId)) return null;
    return `quick_order_monthly_list:${userKey}:${shopId}`;
  }, [shopId, user?.id]);

  useEffect(() => {
    if (!monthlyListStorageKey) return;
    if (typeof window === "undefined") return;
    try {
      setMonthlyList(window.localStorage.getItem(monthlyListStorageKey) ?? "");
    } catch {
      setMonthlyList("");
    }
  }, [monthlyListStorageKey]);

  const { data: customerOrders } = useQuery<CustomerOrderForSuggestions[]>({
    queryKey: ["/api/orders/customer", "all"],
    enabled: Number.isFinite(shopId),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/orders/customer");
      if (!res.ok) {
        throw new Error("Failed to fetch order history");
      }
      return res.json();
    },
  });

  const frequentItemChips = useMemo(() => {
    if (!Number.isFinite(shopId) || !customerOrders?.length) return [];
    const counts = new Map<string, number>();

    const bump = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    };

    for (const order of customerOrders) {
      if (order.shopId !== shopId) continue;
      if (order.status === "cancelled") continue;

      if (order.orderType === "product_order") {
        for (const item of order.items ?? []) {
          if (!item.name?.trim()) continue;
          if (item.quantity > 1) {
            bump(`${item.quantity} ${item.name}`);
          } else {
            bump(item.name);
          }
        }
      }

      if (order.orderType === "text_order" && order.orderText?.trim()) {
        const parts = order.orderText
          .split(/[\n,]+/g)
          .map((part) => part.trim())
          .filter(Boolean);
        for (const part of parts) {
          bump(part);
        }
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value]) => value)
      .slice(0, 12);
  }, [customerOrders, shopId]);

  const appendToOrderText = (value: string) => {
    setOrderText((prev) => {
      const trimmedPrev = prev.trim();
      if (!trimmedPrev) return value;
      const needsSeparator = !/[,\n]\s*$/.test(prev);
      return `${prev}${needsSeparator ? ", " : ""}${value}`;
    });
  };

  const saveMonthlyList = () => {
    if (!monthlyListStorageKey) return;
    const trimmed = orderText.trim();
    if (!trimmed) return;
    try {
      window.localStorage.setItem(monthlyListStorageKey, trimmed);
      setMonthlyList(trimmed);
      toast({
        title: "Monthly list saved",
        description: "You can reuse it anytime for quick ordering.",
      });
    } catch (error) {
      toast({
        title: "Could not save monthly list",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const useMonthlyList = () => {
    const trimmed = monthlyList.trim();
    if (!trimmed) return;
    setOrderText(trimmed);
    toast({
      title: "Monthly list loaded",
      description: "Review and send when ready.",
    });
  };

  const createTextOrderMutation = useMutation({
    mutationFn: async () => {
      if (!Number.isFinite(shopId)) {
        throw new Error("Invalid shop");
      }
      const trimmed = orderText.trim();
      if (!trimmed) {
        throw new Error("Please enter your items");
      }
      const res = await apiRequest("POST", "/api/orders/text", {
        shopId,
        orderText: trimmed,
        deliveryMethod,
      });
      return res.json() as Promise<{ order: { id: number } }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders", "shop"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/customer"] });
      toast({
        title: "Quick order placed",
        description: "Sent to the shop for pricing and confirmation.",
      });
      navigate(`/customer/order/${data.order.id}`);
    },
    onError: (error: Error) => {
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
        title: "Could not place quick order",
        description: parsed.message,
        variant: "destructive",
      });
    },
  });

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href={Number.isFinite(shopId) ? `/customer/shops/${shopId}` : "/customer/browse-shops"}>
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Quick Order
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {shopLoading ? (
                "Loading shop..."
              ) : shop ? (
                <>
                  Send a simple list to{" "}
                  <span className="font-medium text-foreground">
                    {shop.shopProfile?.shopName || shop.name || "this shop"}
                  </span>
                  . The shop will confirm availability and set the final bill price.
                </>
              ) : (
                "Send a simple list. The shop will confirm availability and set the final bill price."
              )}
            </div>

            {shop && (deliveryOptions.pickupAvailable || deliveryOptions.deliveryAvailable) && (
              <div className="space-y-2">
                <Label>Delivery Method</Label>
                <DeliveryMethodSelector
                  value={deliveryMethod}
                  onChange={setDeliveryMethod}
                  pickupAvailable={deliveryOptions.pickupAvailable}
                  deliveryAvailable={deliveryOptions.deliveryAvailable}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="orderText">Items</Label>
              <Textarea
                id="orderText"
                value={orderText}
                onChange={(e) => setOrderText(e.target.value)}
                placeholder='Example: "1kg Rice, 2 Sugars, 1 Hamam Soap"'
                className="min-h-28"
              />
              <p className="text-xs text-muted-foreground">
                Tip: Keep it simple. One line is enough.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Monthly list</p>
                  <p className="text-xs text-muted-foreground">
                    Save your repeat items once and reuse anytime.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={useMonthlyList}
                    disabled={!monthlyList.trim().length}
                  >
                    Use
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={saveMonthlyList}
                    disabled={!orderText.trim().length}
                  >
                    Save
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Tap to add</p>
                {frequentItemChips.length ? (
                  <div className="flex flex-wrap gap-2">
                    {frequentItemChips.map((chip) => (
                      <Button
                        key={chip}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-auto whitespace-normal rounded-full px-3 py-2 text-left"
                        onClick={() => appendToOrderText(chip)}
                      >
                        {chip}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No frequent items yet. After a couple orders, you'll see quick add
                    options here.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Based on your past orders from this shop.
                </p>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => createTextOrderMutation.mutate()}
              disabled={createTextOrderMutation.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              {createTextOrderMutation.isPending ? "Sending..." : "Send to shop"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
