import React, { Suspense, lazy } from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import MapLink from "@/components/location/MapLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useParams } from "wouter";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import {
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  MessageCircle,
} from "lucide-react";
import { z } from "zod";
import { formatIndianDisplay } from "@shared/date-utils";
import {
  OrderDetail,
  OrderTimelineEntry,
} from "@shared/api-contract";
import type { PaymentMethodType } from "@shared/schema";
import { apiClient } from "@/lib/apiClient";
const ProductReviewDialogLazy = lazy(() => import("./components/ProductReviewDialog"));
// Define the type for timeline updates
const returnRequestSchema = z.object({
  reason: z.string().min(10, "Please provide a detailed reason"),
  items: z.array(
    z.object({
      productId: z.number(),
      quantity: z.number().min(1),
    }),
  ),
});

type ReturnRequestForm = z.infer<typeof returnRequestSchema>;

type ShopInfoForPayment = {
  allowPayLater?: boolean;
  payLaterEligibilityForCustomer?: {
    eligible: boolean;
    isKnownCustomer: boolean;
    isWhitelisted: boolean;
  };
};

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const numericId = id ? Number(id) : NaN;

  const { data: order, isLoading: orderLoading } = useQuery<OrderDetail>({
    queryKey: [`/api/orders/${id}`],
    queryFn: () =>
      apiClient.get("/api/orders/:id", {
        params: { id: numericId },
      }),
    enabled: Number.isFinite(numericId),
  });

  const { data: timeline } = useQuery<OrderTimelineEntry[]>({
    queryKey: [`/api/orders/${id}/timeline`],
    queryFn: () =>
      apiClient.get("/api/orders/:id/timeline", {
        params: { id: numericId },
      }),
    enabled: !!order && Number.isFinite(numericId),
  });

  const shopId = order?.shopId ?? null;
  const { data: shopInfo } = useQuery<ShopInfoForPayment>({
    queryKey: ["shop-info", shopId],
    enabled: typeof shopId === "number",
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/${shopId}`);
      if (!res.ok) throw new Error("Failed to fetch shop info");
      return res.json();
    },
  });

  const form = useForm<ReturnRequestForm>({
    resolver: zodResolver(returnRequestSchema),
    defaultValues: {
      reason: "",
      items: [],
    },
  });

  const [reference, setReference] = useState("");

  const copyUpiIdToClipboard = () => {
    const upiId = order?.shop?.upiId;
    if (!upiId) {
      return;
    }

    const notifySuccess = () => toast({ title: "UPI ID copied to clipboard" });
    const notifyFailure = () =>
      toast({
        title: "Unable to copy UPI ID",
        description: "Please copy it manually.",
        variant: "destructive",
      });

    const fallbackCopy = () => {
      const textarea = document.createElement("textarea");
      textarea.value = upiId;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!successful) {
        throw new Error("Fallback copy failed");
      }
    };

    // Clipboard API requires a secure context (https or localhost). Fall back for other cases.
    if (
      typeof navigator !== "undefined" &&
      typeof window !== "undefined" &&
      window.isSecureContext &&
      navigator.clipboard
    ) {
      navigator.clipboard
        .writeText(upiId)
        .then(notifySuccess)
        .catch(() => {
          try {
            fallbackCopy();
            notifySuccess();
          } catch {
            notifyFailure();
          }
        });
    } else {
      try {
        fallbackCopy();
        notifySuccess();
      } catch {
        notifyFailure();
      }
    }
  };

  const submitPaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/orders/${id}/submit-payment-reference`,
        { paymentReference: reference },
      );
      if (!res.ok) throw new Error("Failed to submit reference");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
      toast({ title: "Payment reference submitted" });
      setReference("");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const updatePaymentMethodMutation = useMutation<
    unknown,
    Error,
    PaymentMethodType
  >({
    mutationFn: async (paymentMethod) => {
      const res = await apiRequest(
        "POST",
        `/api/orders/${id}/payment-method`,
        { paymentMethod },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          data && typeof data === "object" && "message" in data
            ? String((data as any).message)
            : "Failed to update payment method";
        throw new Error(message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
      toast({ title: "Payment method updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const returnMutation = useMutation({
    mutationFn: async (data: ReturnRequestForm) => {
      const res = await apiRequest("POST", `/api/orders/${id}/return`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
      toast({
        title: "Return request submitted",
        description: "We'll process your request and get back to you soon.",
      });
    },
  });

  const [selectedProduct, setSelectedProduct] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct || !order) return;
      const res = await apiRequest("POST", "/api/product-reviews", {
        productId: selectedProduct.id,
        orderId: order.id,
        rating,
        review: reviewText,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Review submitted" });
      setSelectedProduct(null);
      setReviewText("");
      setRating(5);
    },
    onError: (err: Error) => {
      let message = err.message;
      if (message.includes("Duplicate review")) {
        message = "You have already reviewed this product for this order.";
      }
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  if (orderLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const statusIcon: Record<OrderTimelineEntry["status"], React.ReactElement> = {
    pending: <AlertCircle className="h-5 w-5 text-yellow-500" />,
    processing: <RefreshCw className="h-5 w-5 text-blue-500" />,
    confirmed: <CheckCircle className="h-5 w-5 text-green-500" />,
    packed: <Package className="h-5 w-5 text-blue-500" />,
    dispatched: <Truck className="h-5 w-5 text-blue-500" />,
    shipped: <Truck className="h-5 w-5 text-blue-500" />,
    delivered: <Package className="h-5 w-5 text-green-500" />,
    cancelled: <AlertCircle className="h-5 w-5 text-red-500" />,
    returned: <Package className="h-5 w-5 text-purple-500" />,
  };

  const getStatusLabel = (status: OrderTimelineEntry["status"]) => {
    if (order?.deliveryMethod === "pickup") {
      if (status === "shipped") return "Ready to Collect";
      if (status === "dispatched") return "Ready to Collect";
      if (status === "delivered") return "Collected";
    } else {
      if (status === "shipped" || status === "dispatched") {
        return "Dispatched";
      }
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const shopCoordinatesAvailable =
    order?.shop?.latitude != null && order?.shop?.longitude != null;
  const customerCoordinatesAvailable =
    order?.customer?.latitude != null && order?.customer?.longitude != null;
  const numericTotal = order ? Number.parseFloat(String(order.total)) : NaN;
  const isTextOrderAwaitingQuote =
    order?.orderType === "text_order" &&
    (!Number.isFinite(numericTotal) || numericTotal <= 0);
  const isPayLater = order?.paymentMethod === "pay_later";
  const payLaterEligibility = shopInfo?.payLaterEligibilityForCustomer;
  const payLaterEnabled = Boolean(shopInfo?.allowPayLater);
  const payLaterAvailable =
    payLaterEnabled && (payLaterEligibility?.eligible ?? true);
  const payLaterDisabledReason = !payLaterEnabled
    ? "Pay Later is disabled for this shop."
    : payLaterEligibility && !payLaterEligibility.eligible
      ? "Pay Later is limited to repeat or whitelisted customers. Ask the shop owner to whitelist you."
      : undefined;

  const whatsappHref = (() => {
    if (!order) return null;
    const isDelivery = order.deliveryMethod === "delivery";
    const isPickup = order.deliveryMethod === "pickup";
    if (!isDelivery && !isPickup) {
      return null;
    }

    const rawPhone = isDelivery ? order.shop?.phone ?? "" : "";
    const digits = rawPhone.replace(/\D/g, "");
    const target =
      digits.length === 10 ? `91${digits}` : digits.length >= 11 ? digits : "";

    const locationUrl = isDelivery
      ? customerCoordinatesAvailable
        ? `https://www.google.com/maps?q=${order.customer?.latitude},${order.customer?.longitude}`
        : null
      : shopCoordinatesAvailable
        ? `https://www.google.com/maps?q=${order.shop?.latitude},${order.shop?.longitude}`
        : null;
    const address = (isDelivery ? order.customer?.address : order.shop?.address)?.trim() || "";
    const message = [
      `Order #${order.id}`,
      locationUrl
        ? isDelivery
          ? `My delivery location: ${locationUrl}`
          : `Pickup shop location: ${locationUrl}`
        : null,
      !locationUrl && address
        ? isDelivery
          ? `Delivery address: ${address}`
          : `Pickup address: ${address}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (!message) return null;
    const encoded = encodeURIComponent(message);
    return target
      ? `https://wa.me/${target}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
  })();

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
          <h1 className="text-2xl font-bold">Order #{order?.id}</h1>
        </div>

        {order?.paymentStatus === "pending" && order?.shopId && (
          <Card>
            <CardHeader>
              <CardTitle>
                {isTextOrderAwaitingQuote
                  ? "Waiting for bill price"
                  : order.orderType === "text_order"
                    ? "Choose payment method"
                    : isPayLater
                      ? "Pay Later (Khata)"
                      : "Complete Payment"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isTextOrderAwaitingQuote ? (
                <p className="text-sm">
                  The shop will review your quick order and set the final bill
                  price. You'll be notified once it's ready.
                </p>
              ) : (
                <>
                  {order.orderType === "text_order" && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Select how you want to pay. You can change it until payment
                        starts.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (order.paymentMethod === "cash") return;
                            updatePaymentMethodMutation.mutate("cash");
                          }}
                          disabled={updatePaymentMethodMutation.isPending}
                          className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                            order.paymentMethod === "cash"
                              ? "border-primary bg-primary/5"
                              : "bg-background hover:bg-muted/40"
                          }`}
                        >
                          <span className="text-2xl leading-none" aria-hidden="true">
                            💵
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium leading-tight">Cash</div>
                            <div className="text-xs text-muted-foreground">
                              Pay on pickup/delivery
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (order.paymentMethod === "upi") return;
                            updatePaymentMethodMutation.mutate("upi");
                          }}
                          disabled={
                            updatePaymentMethodMutation.isPending ||
                            !order.shop?.upiId?.trim()
                          }
                          className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                            order.paymentMethod === "upi"
                              ? "border-primary bg-primary/5"
                              : "bg-background hover:bg-muted/40"
                          } ${
                            !order.shop?.upiId?.trim() ? "opacity-50" : ""
                          }`}
                        >
                          <span className="text-2xl leading-none" aria-hidden="true">
                            📲
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium leading-tight">UPI</div>
                            <div className="text-xs text-muted-foreground">
                              Pay now and submit Txn ID
                            </div>
                          </div>
                        </button>

                        {payLaterEnabled && (
                          <button
                            type="button"
                            onClick={() => {
                              if (order.paymentMethod === "pay_later") return;
                              updatePaymentMethodMutation.mutate("pay_later");
                            }}
                            disabled={
                              updatePaymentMethodMutation.isPending ||
                              !payLaterAvailable
                            }
                            className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                              order.paymentMethod === "pay_later"
                                ? "border-primary bg-primary/5"
                                : "bg-background hover:bg-muted/40"
                            } ${!payLaterAvailable ? "opacity-50" : ""}`}
                          >
                            <span
                              className="text-2xl leading-none"
                              aria-hidden="true"
                            >
                              🧾
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium leading-tight">
                                Pay Later
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Needs shop approval
                              </div>
                            </div>
                          </button>
                        )}
                      </div>

                      {!order.shop?.upiId?.trim() && (
                        <p className="text-xs text-muted-foreground">
                          UPI is not available for this shop yet.
                        </p>
                      )}

                      {payLaterEnabled && payLaterDisabledReason && (
                        <p className="text-xs text-muted-foreground">
                          {payLaterDisabledReason}
                        </p>
                      )}
                    </div>
                  )}

                  {isPayLater ? (
                    <p className="text-sm">
                      Your Pay Later request is pending approval. The shop owner
                      will approve credit before processing your order.
                    </p>
                  ) : order.paymentMethod === "upi" ? (
                    order.shop?.upiId?.trim() ? (
                      <>
                        <div>
                          <p className="font-medium">
                            Step 1: Pay ₹{order?.total} to {order?.shop?.upiId}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyUpiIdToClipboard}
                          >
                            Copy UPI ID
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Input
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder="Transaction ID"
                          />
                          <Button
                            size="sm"
                            onClick={() => submitPaymentMutation.mutate()}
                            disabled={submitPaymentMutation.isPending || !reference}
                          >
                            {submitPaymentMutation.isPending && (
                              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            )}
                            Submit Confirmation
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm">
                        This shop has not configured UPI payments yet. Please choose
                        Cash or Pay Later.
                      </p>
                    )
                  ) : order.paymentMethod === "cash" ? (
                    <p className="font-medium">
                      Pay ₹{order?.total} in cash{" "}
                      {order.deliveryMethod === "delivery"
                        ? "on delivery."
                        : "when you pick up your order."}
                    </p>
                  ) : (
                    <p className="text-sm">
                      Payment is pending. Please check back shortly.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {order?.paymentStatus === "verifying" && (
          <Card>
            <CardContent>
              {isPayLater ? (
                <p className="text-sm">
                  Pay Later has been approved by the shop. Please settle the
                  amount on delivery or pickup.
                </p>
              ) : (
                <p className="text-sm">
                  Payment verification in progress. The shop owner has been
                  notified and will confirm your payment shortly.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {order && (
          <Card>
            <CardHeader>
              <CardTitle>
                {order.deliveryMethod === "delivery"
                  ? "Customer Contact"
                  : "Shop Contact"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Method</span>
                <span className="font-medium">
                  {order.deliveryMethod === "delivery"
                    ? "🛵 Bring to my house"
                    : order.deliveryMethod === "pickup"
                      ? "🛍️ I will come take it"
                      : "Not specified"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">
                  {order.deliveryMethod === "delivery"
                    ? order.customer?.name || "Not provided"
                    : order.shop?.name || "Not provided"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mobile</span>
                <span className="font-medium">
                  {order.deliveryMethod === "delivery"
                    ? order.customer?.phone || "Not provided"
                    : order.shop?.phone || "Not provided"}
                </span>
              </div>
              <div>
                <p className="text-muted-foreground">Address</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {order.deliveryMethod === "delivery"
                      ? order.customer?.address || "Not provided"
                      : order.shop?.address || "Not provided"}
                  </p>
                  {order.deliveryMethod === "delivery" &&
                  customerCoordinatesAvailable ? (
                    <MapLink
                      latitude={order.customer?.latitude}
                      longitude={order.customer?.longitude}
                    />
                  ) : null}
                  {whatsappHref ? (
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Send Location on WhatsApp
                      </a>
                    </Button>
                  ) : null}
                  {order.deliveryMethod === "pickup" &&
                  shopCoordinatesAvailable ? (
                    <MapLink
                      latitude={order.shop?.latitude}
                      longitude={order.shop?.longitude}
                    />
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order?.orderType === "text_order" ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {order.orderText?.trim().length
                  ? order.orderText
                  : "No items provided."}
              </div>
            ) : (
              order?.items?.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center"
                >
                  <p>
                    {item.name} × {item.quantity}
                  </p>
                  {order?.status === "delivered" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        item.productId &&
                        setSelectedProduct({
                          id: item.productId,
                          name: item.name,
                        })
                      }
                    >
                      Leave Review
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Order Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {timeline?.map((update, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 border-l-2 border-border pl-4 pb-4 last:pb-0"
                >
                  {statusIcon[update.status]}
                  <div>
                    <p className="font-medium">
                      {getStatusLabel(update.status)}
                    </p>
                    {update.trackingInfo && (
                      <p className="text-sm text-muted-foreground">
                        {update.trackingInfo}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {formatIndianDisplay(update.timestamp, "datetime")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {order?.shop?.returnsEnabled &&
          order?.status === "delivered" &&
          !order.returnRequested && (
            <Card>
              <CardHeader>
                <CardTitle>Return Request</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit((data) =>
                      returnMutation.mutate(data),
                    )}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reason for Return</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Please explain why you want to return this order..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={returnMutation.isPending}
                      className="w-full"
                    >
                      {returnMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Submit Return Request
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        {order && order.shop && (
          <Card>
            <CardContent>
              <p className="text-sm">
                For questions about your order, you can contact the shop owner
                at: {order.shop?.phone}
              </p>
            </CardContent>
          </Card>
        )}
        <Dialog
          open={!!selectedProduct}
          onOpenChange={(o) => {
            if (!o) setSelectedProduct(null);
          }}
        >
          <Suspense
            fallback={
              <DialogContent>
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              </DialogContent>
            }
          >
            {selectedProduct ? (
              <ProductReviewDialogLazy
                productName={selectedProduct.name}
                rating={rating}
                onRatingChange={setRating}
                reviewText={reviewText}
                onReviewTextChange={setReviewText}
                onSubmit={() => reviewMutation.mutate()}
                submitting={reviewMutation.isPending}
              />
            ) : null}
          </Suspense>
        </Dialog>
      </motion.div>
    </DashboardLayout>
  );
}
