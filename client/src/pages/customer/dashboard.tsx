import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  ShoppingBag,
  Calendar,
  Package,
  Store,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  ShoppingCart,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Booking } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatIndianDisplay } from "@shared/date-utils"; // Import IST utility
import { User } from "lucide-react"; // Import User icon
import { motion } from "framer-motion";

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

const container = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

// Component to display booking requests with status tracking
function BookingRequestsList() {
  const { toast } = useToast();

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
          You have no booking requests
        </p>
        <Button variant="outline" asChild>
          <Link href="/customer/browse-services">Book a Service</Link>
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
          You have no pending booking requests
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
                  {formatIndianDisplay(booking.bookingDate, "datetime")}{" "}
                  {/* Use formatIndianDisplay */}
                </p>
                <div className="flex items-center mt-1">
                  <Clock className="h-3 w-3 mr-1 text-yellow-500" />
                  <span className="text-xs">Awaiting response</span>
                </div>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Pending
              </Badge>
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" asChild className="w-full">
        <Link href="/customer/bookings">View All Bookings</Link>
      </Button>
    </div>
  );
}

// Component to display booking history (accepted/rejected/expired)
function BookingHistoryList() {
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
        You have no booking history yet
      </p>
    );
  }

  // Show only the most recent 3 history items
  const recentHistory = bookingHistory.slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {recentHistory.map((booking) => (
          <div
            key={booking.id}
            className="flex items-center justify-between border rounded-md p-3"
          >
            <div>
              <p className="font-medium">{booking.service?.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatIndianDisplay(booking.bookingDate, "date")}{" "}
                {/* Use formatIndianDisplay */}
              </p>
              <div className="flex items-center mt-1">
                {booking.status === "accepted" && (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                    <span className="text-xs">Accepted</span>
                  </>
                )}
                {booking.status === "rejected" && (
                  <>
                    <XCircle className="h-3 w-3 mr-1 text-red-500" />
                    <span className="text-xs">Rejected</span>
                  </>
                )}
                {booking.status === "expired" && (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1 text-orange-500" />
                    <span className="text-xs">Expired</span>
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
              {booking.status === "rejected" && <XCircle className="h-3 w-3" />}
              {booking.status === "expired" && (
                <AlertCircle className="h-3 w-3" />
              )}
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </Badge>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" asChild className="w-full">
        <Link href="/customer/bookings">View Full History</Link>
      </Button>
    </div>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
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
    return `${distance.toFixed(1)} km away`;
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
        title: "Search failed",
        description: searchError.message,
        variant: "destructive",
      });
    }
  }, [searchError, toast]);

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
        title: "Could not load Buy Again",
        description: buyAgainError.message,
        variant: "destructive",
      });
    }
  }, [buyAgainError, toast]);

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
        title: "Added to cart",
        description: "We added that item back into your cart.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to add to cart",
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

  return (
    <DashboardLayout>
      <motion.div
        initial="hidden"
        animate="show"
        variants={container}
        className="space-y-6 p-4 sm:p-6"
      >
        <motion.div
          variants={item}
          className="relative overflow-hidden rounded-3xl border bg-gradient-to-r from-primary/10 via-primary/5 to-emerald-50 p-6 shadow-sm"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.18),transparent_32%)]" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Welcome back
              </p>
              <h1 className="text-2xl font-bold leading-tight">
                {user?.name ?? "Customer"}
              </h1>
              <p className="text-muted-foreground">
                Quick actions and live updates for your account.
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { label: "Reorder", href: "/customer/orders", icon: ShoppingBag },
                { label: "Track", href: "/customer/orders", icon: Package },
                { label: "Favorites", href: "/customer/wishlist", icon: Sparkles },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <motion.div
                    key={action.label}
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="min-w-[150px]"
                  >
                    <Link href={action.href}>
                      <div className="flex items-center gap-2 rounded-2xl border bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
                        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{action.label}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            Quick access
                          </p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>

        <motion.div variants={item}>
          <Card className="shadow-sm">
            <CardHeader className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Universal Search</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Find services, products, and shops in one search.
                </p>
              </div>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                New
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Try “cleaning” or “salon”"
                    className="pl-9"
                  />
                </div>
                {profileLocation && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    Using your saved location for distance and relevance
                  </div>
                )}
              </div>

              {debouncedSearch.length < 2 ? (
                <p className="text-sm text-muted-foreground">
                  Start typing to see nearby services, products, and shops together.
                </p>
              ) : isSearchLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching across the marketplace...
                </div>
              ) : (globalSearch?.results ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No matches found. Try a different keyword.
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
                                  alt={result.name ?? "Result"}
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
                                    ? "Service"
                                    : result.type === "product"
                                      ? "Product"
                                      : "Shop"}
                                </Badge>
                                {distanceLabel && (
                                  <Badge variant="secondary" className="text-xs">
                                    {distanceLabel}
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium leading-tight line-clamp-1">
                                {result.name ?? "Untitled"}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {result.description ||
                                  result.location?.city ||
                                  result.location?.state ||
                                  "Tap to view details"}
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
                                  ? "Book"
                                  : result.type === "product"
                                    ? "View"
                                    : "Open"}
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
        </motion.div>

        <motion.div variants={item}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Browse Services",
                href: "/customer/browse-services",
                icon: Calendar,
                blurb: "Find trusted pros",
              },
              {
                title: "Browse Shops",
                href: "/customer/browse-shops",
                icon: Store,
                blurb: "Explore local stores",
              },
              {
                title: "Shop Products",
                href: "/customer/browse-products",
                icon: ShoppingBag,
                blurb: "Add to cart fast",
              },
              {
                title: "My Bookings",
                href: "/customer/bookings",
                icon: Calendar,
                blurb: "Manage slots",
              },
              {
                title: "My Orders",
                href: "/customer/orders",
                icon: Package,
                blurb: "Track packages",
              },
              {
                title: "My Profile",
                href: "/customer/profile",
                icon: User,
                blurb: "Account & payments",
              },
            ].map((tile) => {
              const Icon = tile.icon;
              return (
                <Link key={tile.title} href={tile.href}>
                  <Card className="group cursor-pointer border bg-gradient-to-br from-white via-white to-primary/5 p-0 transition-all hover:-translate-y-1 hover:shadow-lg">
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Go
                        </span>
                        <div className="rounded-full bg-primary/10 p-2 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-lg font-semibold">{tile.title}</p>
                        <p className="text-sm text-muted-foreground">{tile.blurb}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </motion.div>

        <motion.div variants={item}>
          <Card className="shadow-sm">
            <CardHeader className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Buy or Book Again</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Jump back into the items and services you use the most.
                </p>
              </div>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                Personalized
              </Badge>
            </CardHeader>
            <CardContent>
              {isBuyAgainLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your recent picks...
                </div>
              ) : recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  We&apos;ll highlight your frequent orders and bookings once you&apos;ve placed a few.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {recommendations.map((item) => {
                    const price = formatPrice(item.price);
                    const lastUsedLabel =
                      item.lastUsedAt && !Number.isNaN(item.lastUsedAt.getTime())
                        ? `Last: ${format(item.lastUsedAt, "dd MMM")}`
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
                                  alt={item.name ?? "Recent item"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-xs">
                                  {item.type === "service" ? "Service" : "Product"}
                                </Badge>
                                <span>×{countLabel}</span>
                              </div>
                              <p className="font-medium leading-tight line-clamp-1">
                                {item.name ?? "Recently used"}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {item.type === "service"
                                  ? item.providerName ?? "Your provider"
                                  : item.shopName ?? "From your local shop"}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                {price && <span>{price}</span>}
                                {lastUsedLabel && <span>{lastUsedLabel}</span>}
                              </div>
                            </div>
                            {item.type === "service" ? (
                              <Button size="sm" asChild className="mt-1">
                                <Link href={`/customer/book-service/${item.serviceId}`}>
                                  Book again
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
                                    Add
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
        </motion.div>

        <motion.div variants={item} className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Booking Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingRequestsList />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Booking History</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingHistoryList />
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
