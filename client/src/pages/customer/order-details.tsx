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
import { useLanguage } from "@/contexts/language-context";
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
  Loader2,
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
type ReturnRequestForm = {
  reason: string;
  items: { productId: number; quantity: number }[];
};

const buildReturnRequestSchema = (t: (key: string) => string) =>
  z.object({
    reason: z.string().min(10, t("return_reason_min_error")),
    items: z.array(
      z.object({
        productId: z.number(),
        quantity: z.number().min(1),
      }),
    ),
  });

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
  const { t } = useLanguage();
  const numericId = id ? Number(id) : NaN;
  const returnRequestSchema = React.useMemo(
    () => buildReturnRequestSchema(t),
    [t],
  );

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
      if (!res.ok) throw new Error(t("shop_info_fetch_failed"));
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

    const notifySuccess = () => toast({ title: t("upi_id_copied") });
    const notifyFailure = () =>
      toast({
        title: t("upi_id_copy_failed_title"),
        description: t("upi_id_copy_failed_description"),
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
      if (!res.ok) throw new Error(t("payment_reference_submit_failed"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
      toast({ title: t("payment_reference_submitted") });
      setReference("");
    },
    onError: (e: Error) => {
      toast({
        title: t("error"),
        description: e.message,
        variant: "destructive",
      });
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
            : t("payment_method_update_failed");
        throw new Error(message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
      toast({ title: t("payment_method_updated") });
    },
    onError: (e: Error) => {
      toast({
        title: t("error"),
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const agreeFinalBillMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/orders/${id}/agree-final-bill`,
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          data && typeof data === "object" && "message" in data
            ? String((data as any).message)
            : t("final_bill_confirm_failed");
        throw new Error(message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}/timeline`] });
      toast({
        title: t("final_bill_confirmed_title"),
        description: t("final_bill_confirmed_description"),
      });
    },
    onError: (e: Error) => {
      toast({
        title: t("error"),
        description: e.message,
        variant: "destructive",
      });
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
        title: t("return_request_submitted_title"),
        description: t("return_request_submitted_description"),
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
      toast({ title: t("review_submitted_title") });
      setSelectedProduct(null);
      setReviewText("");
      setRating(5);
    },
    onError: (err: Error) => {
      let message = err.message;
      if (message.includes("Duplicate review")) {
        message = t("duplicate_review_message");
      }
      toast({
        title: t("error"),
        description: message,
        variant: "destructive",
      });
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
    awaiting_customer_agreement: (
      <AlertCircle className="h-5 w-5 text-amber-500" />
    ),
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
    if (status === "awaiting_customer_agreement") {
      return t("order_status_awaiting_customer_agreement");
    }
    if (status === "pending") {
      return t("order_status_sent_to_shop");
    }
    if (order?.deliveryMethod === "pickup") {
      if (status === "shipped") return t("order_status_ready_to_collect");
      if (status === "dispatched") return t("order_status_ready_to_collect");
      if (status === "delivered") return t("order_status_collected");
    } else {
      if (status === "shipped" || status === "dispatched") {
        return t("dispatched");
      }
    }
    return t(status);
  };

  const shopCoordinatesAvailable =
    order?.shop?.latitude != null && order?.shop?.longitude != null;
  const customerCoordinatesAvailable =
    order?.customer?.latitude != null && order?.customer?.longitude != null;
  const isAwaitingShopQuote = order?.status === "pending";
  const isAwaitingCustomerAgreement =
    order?.status === "awaiting_customer_agreement";
  const canChoosePayment =
    order?.paymentStatus === "pending" && order?.status === "confirmed";
  const isPayLater = order?.paymentMethod === "pay_later";
  const payLaterEligibility = shopInfo?.payLaterEligibilityForCustomer;
  const payLaterEnabled = Boolean(shopInfo?.allowPayLater);
  const payLaterAvailable =
    payLaterEnabled && (payLaterEligibility?.eligible ?? true);
  const payLaterDisabledReason = !payLaterEnabled
    ? t("pay_later_disabled")
    : payLaterEligibility && !payLaterEligibility.eligible
      ? t("pay_later_limited")
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
      t("whatsapp_order_label").replace("{orderId}", String(order.id)),
      locationUrl
        ? isDelivery
          ? t("whatsapp_delivery_location").replace("{url}", locationUrl)
          : t("whatsapp_pickup_location").replace("{url}", locationUrl)
        : null,
      !locationUrl && address
        ? isDelivery
          ? t("whatsapp_delivery_address").replace("{address}", address)
          : t("whatsapp_pickup_address").replace("{address}", address)
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
            {t("back_to_orders")}
          </Button>
          <h1 className="text-2xl font-bold">
            {t("order_number").replace("{id}", String(order?.id ?? ""))}
          </h1>
        </div>

        {order?.shopId &&
          (isAwaitingShopQuote ||
            isAwaitingCustomerAgreement ||
            canChoosePayment) && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {isAwaitingShopQuote
                    ? t("order_status_sent_to_shop")
                    : isAwaitingCustomerAgreement
                      ? t("agree_final_bill_title")
                      : order.orderType === "text_order"
                        ? t("choose_payment_method_title")
                        : isPayLater
                          ? t("pay_later_title")
                          : t("complete_payment_title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isAwaitingShopQuote ? (
                  <p className="text-sm">
                    {t("order_sent_to_shop_help")}
                  </p>
                ) : isAwaitingCustomerAgreement ? (
                  <div className="space-y-3">
                    <p className="text-sm">
                      {t("final_bill_shared_help")}
                    </p>
                    <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {t("final_bill_label")}
                        </p>
                        <p className="text-2xl font-semibold">
                          ₹{order?.total}
                        </p>
                      </div>
                      <Button
                        onClick={() => agreeFinalBillMutation.mutate()}
                        disabled={agreeFinalBillMutation.isPending}
                        className="h-12 px-6 text-base"
                      >
                        {agreeFinalBillMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {t("agree")}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("payment_options_after_agree")}
                    </p>
                  </div>
                ) : canChoosePayment ? (
                  <>
                    {order.orderType === "text_order" && (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {t("choose_payment_method_help")}
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
                              <div className="font-medium leading-tight">
                                {t("payment_method_cash")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t("payment_method_cash_help")}
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
                              <div className="font-medium leading-tight">
                                {t("payment_method_upi")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t("payment_method_upi_help")}
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
                                  {t("payment_method_pay_later")}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {t("payment_method_pay_later_help")}
                                </div>
                              </div>
                            </button>
                          )}
                        </div>

                        {!order.shop?.upiId?.trim() && (
                          <p className="text-xs text-muted-foreground">
                            {t("payment_method_upi_unavailable")}
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
                        {t("pay_later_pending_help")}
                      </p>
                    ) : order.paymentMethod === "upi" ? (
                      order.shop?.upiId?.trim() ? (
                        <>
                          <div>
                            <p className="font-medium">
                              {t("payment_step_one")
                                .replace("{amount}", `₹${order?.total ?? ""}`)
                                .replace("{upiId}", order?.shop?.upiId ?? "")}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={copyUpiIdToClipboard}
                            >
                              {t("copy_upi_id")}
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <Input
                              value={reference}
                              onChange={(e) => setReference(e.target.value)}
                              placeholder={t("transaction_id_placeholder")}
                            />
                            <Button
                              size="sm"
                              onClick={() => submitPaymentMutation.mutate()}
                              disabled={submitPaymentMutation.isPending || !reference}
                            >
                              {submitPaymentMutation.isPending && (
                                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                              )}
                              {t("submit_confirmation")}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm">
                          {t("upi_not_configured_help")}
                        </p>
                      )
                    ) : order.paymentMethod === "cash" ? (
                      <p className="font-medium">
                        {t("pay_in_cash")
                          .replace("{amount}", `₹${order?.total ?? ""}`)
                          .replace(
                            "{timing}",
                            order.deliveryMethod === "delivery"
                              ? t("pay_on_delivery")
                              : t("pay_on_pickup"),
                          )}
                      </p>
                    ) : (
                      <p className="text-sm">
                        {t("payment_pending_help")}
                      </p>
                    )}
                  </>
                ) : null}
              </CardContent>
            </Card>
          )}

        {order?.paymentStatus === "verifying" && (
          <Card>
            <CardContent>
              {isPayLater ? (
                <p className="text-sm">
                  {t("pay_later_approved_help")}
                </p>
              ) : (
                <p className="text-sm">
                  {t("payment_verification_in_progress")}
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
                  ? t("customer_contact_title")
                  : t("shop_contact_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("delivery_method_label")}
                </span>
                <span className="font-medium">
                  {order.deliveryMethod === "delivery"
                    ? t("delivery_method_delivery")
                    : order.deliveryMethod === "pickup"
                      ? t("delivery_method_pickup")
                      : t("not_specified")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("name_label")}
                </span>
                <span className="font-medium">
                  {order.deliveryMethod === "delivery"
                    ? order.customer?.name || t("not_provided")
                    : order.shop?.name || t("not_provided")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("mobile_label")}
                </span>
                <span className="font-medium">
                  {order.deliveryMethod === "delivery"
                    ? order.customer?.phone || t("not_provided")
                    : order.shop?.phone || t("not_provided")}
                </span>
              </div>
              <div>
                <p className="text-muted-foreground">{t("address_label")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {order.deliveryMethod === "delivery"
                      ? order.customer?.address || t("not_provided")
                      : order.shop?.address || t("not_provided")}
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
                        {t("send_location_whatsapp")}
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
            <CardTitle>{t("order_items")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order?.orderType === "text_order" ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {order.orderText?.trim().length
                  ? order.orderText
                  : t("no_items_provided")}
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
                      {t("leave_review")}
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("order_timeline_title")}</CardTitle>
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
                <CardTitle>{t("return_request")}</CardTitle>
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
                          <FormLabel>{t("return_reason_label")}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t("return_reason_placeholder")}
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
                      {t("submit_return_request")}
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
                {t("order_contact_help").replace(
                  "{phone}",
                  order.shop?.phone ?? "",
                )}
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
