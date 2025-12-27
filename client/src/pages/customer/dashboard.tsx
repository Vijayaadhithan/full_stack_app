import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Droplet,
  ShoppingBag,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  ShoppingCart,
  Package,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Booking } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatIndianDisplay } from "@shared/date-utils"; // Import IST utility
import { describeSlotLabel } from "@/lib/time-slots";
import { useLanguage } from "@/contexts/language-context";

type GlobalSearchResult = {
  type: "service" | "product" | "shop";
  id: number;
  name: string | null;
  description?: string | null;
  price?: string | number | null;
  image?: string | null;
  providerId?: number | null;
  providerName?: string | null;
  productId?: number | null;
  shopId?: number | null;
  shopName?: string | null;
  location?: { city?: string | null; state?: string | null } | null;
  distanceKm?: number | null;
};

type GlobalSearchResponse = {
  query: string;
  results: GlobalSearchResult[];
};

type BuyAgainService = {
  serviceId: number;
  providerId: number | null;
  name: string | null;
  price: string | number | null;
  image: string | null;
  timesBooked: number;
  lastBookedAt: string | null;
  providerName: string | null;
};

type BuyAgainProduct = {
  productId: number;
  shopId: number | null;
  name: string | null;
  price: string | number | null;
  image: string | null;
  timesOrdered: number;
  lastOrderedAt: string | null;
  shopName: string | null;
};

type BuyAgainResponse = {
  services: BuyAgainService[];
  products: BuyAgainProduct[];
};

type CombinedRecommendation =
  | (BuyAgainService & { type: "service"; lastUsedAt: Date | null })
  | (BuyAgainProduct & { type: "product"; lastUsedAt: Date | null });

// Component to display booking requests with status tracking
function BookingRequestsList() {
  const { t } = useLanguage();
  const { data: bookingRequests, isLoading } = useQuery<
    (Booking & { service: any })[]
  >({
    queryKey: ["/api/bookings/customer/requests"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!bookingRequests || bookingRequests.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground mb-4">
          {t("customer_booking_requests_empty")}
        </p>
        <Button variant="outline" asChild>
          <Link href="/customer/browse-services">
            {t("customer_booking_requests_cta")}
          </Link>
        </Button>
      </div>
    );
  }

  // Filter to show only pending requests
  const pendingRequests = bookingRequests.filter(
    (booking) => booking.status === "pending",
  );

  return (
    <div className="space-y-4">
      {pendingRequests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("customer_booking_requests_pending_empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {pendingRequests.map((booking) => (
            <div
              key={booking.id}
              className="flex items-center justify-between border rounded-md p-3"
            >
              <div>
                <p className="font-medium">{booking.service?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatIndianDisplay(booking.bookingDate, "date")}{" "}
                  {booking.timeSlotLabel
                    ? `• ${describeSlotLabel(booking.timeSlotLabel)}`
                    : `• ${formatIndianDisplay(booking.bookingDate, "time")}`}
                </p>
                <div className="flex items-center mt-1">
                  <Clock className="h-3 w-3 mr-1 text-yellow-500" />
                  <span className="text-xs">
                    {t("customer_booking_requests_waiting")}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t("pending")}
              </Badge>
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" asChild className="w-full">
        <Link href="/customer/bookings">
          {t("customer_booking_requests_view_all")}
        </Link>
      </Button>
    </div>
  );
}

// Component to display booking history (accepted/rejected/expired)
function BookingHistoryList() {
  const { t } = useLanguage();
  const { data: bookingHistory, isLoading } = useQuery<
    (Booking & { service: any })[]
  >({
    queryKey: ["/api/bookings/customer/history"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!bookingHistory || bookingHistory.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("customer_booking_history_empty")}
      </p>
    );
  }

  // Show only the most recent 3 history items
  const recentHistory = bookingHistory.slice(0, 3);

  const historyStatusLabels: Record<string, string> = {
    accepted: t("accepted"),
    rejected: t("rejected"),
    expired: t("expired"),
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {recentHistory.map((booking) => {
          const statusLabel =
            historyStatusLabels[booking.status] || booking.status;

          return (
            <div
              key={booking.id}
              className="flex items-center justify-between border rounded-md p-3"
            >
              <div>
                <p className="font-medium">{booking.service?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatIndianDisplay(booking.bookingDate, "date")}{" "}
                  {booking.timeSlotLabel
                    ? `• ${describeSlotLabel(booking.timeSlotLabel)}`
                    : `• ${formatIndianDisplay(booking.bookingDate, "time")}`}
                </p>
                <div className="flex items-center mt-1">
                  {booking.status === "accepted" && (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                      <span className="text-xs">{t("accepted")}</span>
                    </>
                  )}
                  {booking.status === "rejected" && (
                    <>
                      <XCircle className="h-3 w-3 mr-1 text-red-500" />
                      <span className="text-xs">{t("rejected")}</span>
                    </>
                  )}
                  {booking.status === "expired" && (
                    <>
                      <AlertCircle className="h-3 w-3 mr-1 text-orange-500" />
                      <span className="text-xs">{t("expired")}</span>
                    </>
                  )}
                </div>
              </div>
              <Badge
                variant={
                  booking.status === "accepted" ? "default" : "destructive"
                }
                className="flex items-center gap-1"
              >
                {booking.status === "accepted" && (
                  <CheckCircle className="h-3 w-3" />
                )}
                {booking.status === "rejected" && (
                  <XCircle className="h-3 w-3" />
                )}
                {booking.status === "expired" && (
                  <AlertCircle className="h-3 w-3" />
                )}
                {statusLabel}
              </Badge>
            </div>
          );
        })}
      </div>
      <Button variant="outline" size="sm" asChild className="w-full">
        <Link href="/customer/bookings">
          {t("customer_booking_history_view_all")}
        </Link>
      </Button>
    </div>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const profileLocation = useMemo(() => {
    const lat = Number(user?.latitude);
    const lng = Number(user?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return { latitude: lat, longitude: lng };
  }, [user?.latitude, user?.longitude]);

  useEffect(() => {
    const handle = setTimeout(
      () => setDebouncedSearch(searchTerm.trim()),
      350,
    );
    return () => clearTimeout(handle);
  }, [searchTerm]);

  const formatPrice = (value?: string | number | null) => {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return `₹${new Intl.NumberFormat("en-IN").format(numeric)}`;
    }
    return `₹${value}`;
  };

  const formatDistance = (distance?: number | null) => {
    if (distance === null || distance === undefined) return null;
    return t("distance_km_away").replace("{distance}", distance.toFixed(1));
  };

  const {
    data: globalSearch,
    isFetching: isSearchLoading,
    error: searchError,
  } = useQuery<GlobalSearchResponse, Error>({
    queryKey: [
      "/api/search/global",
      debouncedSearch,
      profileLocation?.latitude,
      profileLocation?.longitude,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("q", debouncedSearch);
      if (profileLocation) {
        params.set("lat", profileLocation.latitude.toString());
        params.set("lng", profileLocation.longitude.toString());
      }
      const response = await apiRequest(
        "GET",
        `/api/search/global?${params.toString()}`,
      );
      return response.json();
    },
    enabled: debouncedSearch.length >= 2,
  });

  useEffect(() => {
    if (searchError) {
      toast({
        title: t("search_failed_title"),
        description: searchError.message,
        variant: "destructive",
      });
    }
  }, [searchError, toast, t]);

  const {
    data: buyAgainData,
    isLoading: isBuyAgainLoading,
    error: buyAgainError,
  } = useQuery<BuyAgainResponse, Error>({
    queryKey: ["/api/recommendations/buy-again"],
  });

  useEffect(() => {
    if (buyAgainError) {
      toast({
        title: t("buy_again_load_failed"),
        description: buyAgainError.message,
        variant: "destructive",
      });
    }
  }, [buyAgainError, toast, t]);

  const addToCartMutation = useMutation<unknown, Error, number>({
    mutationFn: async (productId: number) => {
      const res = await apiRequest("POST", "/api/cart", {
        productId,
        quantity: 1,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: t("added_to_cart_title"),
        description: t("added_to_cart_description"),
      });
    },
    onError: (error) => {
      toast({
        title: t("add_to_cart_failed_title"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const recommendations = useMemo<CombinedRecommendation[]>(() => {
    if (!buyAgainData) return [];
    const serviceEntries: CombinedRecommendation[] = buyAgainData.services.map(
      (service) => ({
        ...service,
        type: "service" as const,
        lastUsedAt: service.lastBookedAt
          ? new Date(service.lastBookedAt)
          : null,
      }),
    );
    const productEntries: CombinedRecommendation[] = buyAgainData.products.map(
      (product) => ({
        ...product,
        type: "product" as const,
        lastUsedAt: product.lastOrderedAt
          ? new Date(product.lastOrderedAt)
          : null,
      }),
    );

    return [...serviceEntries, ...productEntries]
      .sort((a, b) => {
        const aCount =
          a.type === "service" ? a.timesBooked : a.timesOrdered ?? 0;
        const bCount =
          b.type === "service" ? b.timesBooked : b.timesOrdered ?? 0;
        if (bCount !== aCount) return bCount - aCount;
        const aTime = a.lastUsedAt?.getTime() ?? 0;
        const bTime = b.lastUsedAt?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 4);
  }, [buyAgainData]);

  const quickTiles = [
    {
      title: t("dashboard_tile_repair"),
      subtitle: t("dashboard_tile_repair_subtitle"),
      href: "/customer/browse-services",
      icon: Droplet,
      bg: "bg-gradient-to-br from-sky-100 via-white to-sky-200",
      iconBg: "bg-white/70",
      iconColor: "text-sky-700",
      orb: "bg-sky-200/70",
    },
    {
      title: t("dashboard_tile_buy"),
      subtitle: t("dashboard_tile_buy_subtitle"),
      href: "/customer/browse-products",
      icon: ShoppingBag,
      bg: "bg-gradient-to-br from-amber-100 via-white to-amber-200",
      iconBg: "bg-white/70",
      iconColor: "text-amber-700",
      orb: "bg-amber-200/70",
    },
    {
      title: t("dashboard_tile_bookings"),
      subtitle: t("dashboard_tile_bookings_subtitle"),
      href: "/customer/bookings",
      icon: Calendar,
      bg: "bg-gradient-to-br from-emerald-100 via-white to-emerald-200",
      iconBg: "bg-white/70",
      iconColor: "text-emerald-700",
      orb: "bg-emerald-200/70",
    },
    {
      title: t("dashboard_tile_orders"),
      subtitle: t("dashboard_tile_orders_subtitle"),
      href: "/customer/orders",
      icon: Package,
      bg: "bg-gradient-to-br from-rose-100 via-white to-rose-200",
      iconBg: "bg-white/70",
      iconColor: "text-rose-700",
      orb: "bg-rose-200/70",
    },
  ];

  const tileContainerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const tileItemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="space-y-6 p-6"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">
            {t("dashboard_greeting").replace("{name}", user?.name ?? "")}
          </h1>
          <p className="text-muted-foreground">
            {t("dashboard_subtitle")}
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            {t("dashboard_quick_title")}
          </h2>
          <motion.div
            variants={tileContainerVariants}
            initial="hidden"
            animate="show"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {quickTiles.map((tile) => (
              <motion.div
                key={tile.title}
                variants={tileItemVariants}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link href={tile.href} className="block h-full">
                  <Card
                    className={`group relative h-44 cursor-pointer overflow-hidden border-0 shadow-sm transition-shadow duration-200 ease-out hover:shadow-lg ${tile.bg}`}
                  >
                    <CardContent className="flex h-full flex-col justify-between p-6">
                      <div className="flex items-center justify-between">
                        <div
                          className={`rounded-2xl p-3 shadow-sm ${tile.iconBg}`}
                        >
                          <tile.icon
                            className={`h-8 w-8 ${tile.iconColor}`}
                            aria-hidden="true"
                          />
                        </div>
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {t("dashboard_tile_tap")}
                        </span>
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-slate-900">
                          {tile.title}
                        </p>
                        <p className="text-sm text-slate-600">
                          {tile.subtitle}
                        </p>
                      </div>
                    </CardContent>
                    <div
                      className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl ${tile.orb}`}
                    />
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <Card className="shadow-sm transition-shadow duration-200 ease-out hover:shadow-md">
          <CardHeader className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>{t("dashboard_search_title")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("dashboard_search_subtitle")}
              </p>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Sparkles className="h-4 w-4" />
              {t("badge_new")}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t("dashboard_search_placeholder")}
                  className="pl-9"
                />
              </div>
              {profileLocation && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {t("dashboard_location_hint")}
                </div>
              )}
            </div>

            {debouncedSearch.length < 2 ? (
              <p className="text-sm text-muted-foreground">
                {t("dashboard_search_prompt")}
              </p>
            ) : isSearchLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("dashboard_search_loading")}
              </div>
            ) : (globalSearch?.results ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("dashboard_search_empty")}
              </p>
            ) : (
              <div className="space-y-3">
                {globalSearch?.results.slice(0, 6).map((result) => {
                  const price = formatPrice(result.price ?? null);
                  const distanceLabel = formatDistance(result.distanceKm);
                  const link =
                    result.type === "service"
                      ? `/customer/book-service/${result.id}`
                      : result.type === "product"
                        ? result.shopId != null
                          ? `/customer/shops/${result.shopId}/products/${result.productId ?? result.id}`
                          : "/customer/browse-products"
                        : `/customer/shops/${result.id}`;

                  return (
                    <Card
                      key={`${result.type}-${result.id}`}
                      className="border-muted"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                            {result.image ? (
                              <img
                                src={result.image}
                                alt={result.name ?? t("search_result_alt_fallback")}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Search className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {result.type === "service"
                                  ? t("search_type_service")
                                  : result.type === "product"
                                    ? t("search_type_product")
                                    : t("search_type_shop")}
                              </Badge>
                              {distanceLabel && (
                                <Badge variant="secondary" className="text-xs">
                                  {distanceLabel}
                                </Badge>
                              )}
                            </div>
                            <p className="font-medium leading-tight line-clamp-1">
                              {result.name ?? t("search_no_name")}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {result.description ||
                                result.location?.city ||
                                result.location?.state ||
                                t("search_tap_details")}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {price && <span>{price}</span>}
                              {result.type === "service" && result.providerName && (
                                <span>{result.providerName}</span>
                              )}
                              {result.type !== "service" &&
                                (result.shopName || result.location?.city) && (
                                  <span>
                                    {result.shopName ?? result.location?.city}
                                  </span>
                                )}
                            </div>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={link}>
                              {result.type === "service"
                                ? t("search_action_book")
                                : result.type === "product"
                                  ? t("search_action_view")
                                  : t("search_action_open")}
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm transition-shadow duration-200 ease-out hover:shadow-md">
          <CardHeader className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>{t("dashboard_buy_again_title")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("dashboard_buy_again_subtitle")}
              </p>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Sparkles className="h-4 w-4" />
              {t("badge_personalized")}
            </Badge>
          </CardHeader>
          <CardContent>
            {isBuyAgainLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("dashboard_buy_again_loading")}
              </div>
            ) : recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("dashboard_buy_again_empty")}
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {recommendations.map((item) => {
                  const price = formatPrice(item.price);
                  const lastUsedLabel =
                    item.lastUsedAt && !Number.isNaN(item.lastUsedAt.getTime())
                      ? t("dashboard_buy_again_last").replace(
                          "{date}",
                          format(item.lastUsedAt, "dd MMM"),
                        )
                      : null;
                  const countLabel =
                    item.type === "service"
                      ? item.timesBooked
                      : item.timesOrdered;

                  return (
                    <Card key={`${item.type}-${item.type === "service" ? item.serviceId : item.productId}`}>
                      <CardContent className="p-4">
                        <div className="flex gap-3 items-start">
                          <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name ?? t("dashboard_buy_again_alt")}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {item.type === "service"
                                  ? t("search_type_service")
                                  : t("search_type_product")}
                              </Badge>
                              <span>×{countLabel}</span>
                            </div>
                            <p className="font-medium leading-tight line-clamp-1">
                              {item.name ?? t("dashboard_buy_again_recent_label")}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {item.type === "service"
                                ? item.providerName ??
                                  t("dashboard_buy_again_provider_fallback")
                                : item.shopName ??
                                  t("dashboard_buy_again_shop_fallback")}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {price && <span>{price}</span>}
                              {lastUsedLabel && <span>{lastUsedLabel}</span>}
                            </div>
                          </div>
                          {item.type === "service" ? (
                            <Button size="sm" asChild className="mt-1">
                              <Link href={`/customer/book-service/${item.serviceId}`}>
                                {t("dashboard_buy_again_book")}
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="mt-1"
                              onClick={() => addToCartMutation.mutate(item.productId)}
                              disabled={addToCartMutation.isPending}
                            >
                              {addToCartMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <ShoppingCart className="h-4 w-4 mr-1" />
                                  {t("dashboard_buy_again_add")}
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-shadow duration-200 ease-out hover:shadow-md">
            <CardHeader>
              <CardTitle>{t("dashboard_booking_requests_title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingRequestsList />
            </CardContent>
          </Card>

          <Card className="transition-shadow duration-200 ease-out hover:shadow-md">
            <CardHeader>
              <CardTitle>{t("dashboard_booking_history_title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingHistoryList />
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
