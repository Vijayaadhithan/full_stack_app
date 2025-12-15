import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams, Link } from "wouter";
import { ArrowLeft, Send, Store } from "lucide-react";
import type { PublicShop } from "@/types/public-shop";
import { getVerificationError, parseApiError } from "@/lib/api-error";
import { ToastAction } from "@/components/ui/toast";

type DeliveryMethod = "delivery" | "pickup";

export default function QuickOrder() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const shopId = id ? Number(id) : NaN;

  const [orderText, setOrderText] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup");

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
                <RadioGroup
                  value={deliveryMethod}
                  onValueChange={(value) => setDeliveryMethod(value as DeliveryMethod)}
                >
                  {deliveryOptions.pickupAvailable && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pickup" id="pickup" />
                      <Label htmlFor="pickup">Pickup</Label>
                    </div>
                  )}
                  {deliveryOptions.deliveryAvailable && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="delivery" id="delivery" />
                      <Label htmlFor="delivery">Delivery</Label>
                    </div>
                  )}
                </RadioGroup>
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

