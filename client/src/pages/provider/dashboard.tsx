// src/pages/provider/dashboard.tsx

import React, { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Loader2,
  Plus,
  Star,
  Bell,
  Settings,
  Users,
  Clock,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Fan,
  Droplets,
  Plug,
  Wrench,
  Phone,
  MessageCircle,
  MapPin,
  IndianRupee,
  Calendar as CalendarIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { Booking, Review, Service } from "@shared/schema";
import { formatIndianDisplay, formatInIndianTime } from "@shared/date-utils";
import { describeSlotLabel } from "@/lib/time-slots";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { getVerificationError, parseApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { SERVICE_CATEGORY_OPTIONS } from "@/lib/service-categories";
import { z } from "zod";

type BookingProximityInfo = {
  nearestBookingId: number;
  nearestBookingDate: string | null;
  distanceKm: number;
  message: string;
};

type ProviderBookingService =
  | Service
  | {
    name: string;
    price?: string | number | null;
    category?: string | null;
  };

type ProviderBookingCustomer = {
  id: number;
  name: string | null;
  phone: string | null;
  addressStreet?: string | null;
  addressLandmark?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostalCode?: string | null;
  addressCountry?: string | null;
};

type ProviderBookingAddress = {
  addressStreet?: string | null;
  addressLandmark?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostalCode?: string | null;
  addressCountry?: string | null;
} | null;

type ProviderBooking = Booking & {
  service?: ProviderBookingService | null;
  customer?: ProviderBookingCustomer | null;
  relevantAddress?: ProviderBookingAddress;
};

type PendingBooking = ProviderBooking & {
  proximityInfo?: BookingProximityInfo | null;
};

type CustomerEarnings = {
  name: string;
  total: number;
  count: number;
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const normalizePhoneNumber = (phone?: string | null): string | null => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
};

const buildWhatsAppHref = (
  phone?: string | null,
  message?: string,
): string | null => {
  const digits = normalizePhoneNumber(phone);
  if (!digits) return null;
  if (message && message.trim().length > 0) {
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/${digits}`;
};

const readServicePrice = (
  service?: ProviderBookingService | null,
): number | null => {
  if (!service || !("price" in service)) return null;
  const raw = service.price;
  const value =
    typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  return Number.isFinite(value) ? value : null;
};

const formatRupees = (amount?: number | null): string => {
  if (amount == null || !Number.isFinite(amount)) return "Price TBD";
  return `₹${currencyFormatter.format(amount)}`;
};

const INDIAN_DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const getIndianDayKey = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const key = formatInIndianTime(date, "yyyy-MM-dd");
  return INDIAN_DAY_KEY_REGEX.test(key) ? key : null;
};

const getIndianMonthKey = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  return formatInIndianTime(date, "yyyy-MM");
};

const resolveLandmark = (address?: ProviderBookingAddress): string => {
  if (!address) return "Location not shared";
  const landmark = address.addressLandmark?.trim();
  if (landmark) return landmark;
  const street = address.addressStreet?.trim();
  if (street) return street;
  const city = address.addressCity?.trim();
  if (city) return city;
  const state = address.addressState?.trim();
  if (state) return state;
  return "Location not shared";
};

const formatAddressLine = (address?: ProviderBookingAddress): string => {
  if (!address) return "Address not shared";
  const parts = [
    address.addressStreet,
    address.addressCity,
    address.addressState,
    address.addressPostalCode,
  ]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join(", ") : "Address not shared";
};

const resolveServiceIcon = (
  service?: ProviderBookingService | null,
): React.ElementType => {
  const label = [
    service?.name ?? "",
    "category" in (service ?? {}) ? service?.category ?? "" : "",
  ]
    .join(" ")
    .toLowerCase();

  if (label.includes("fan")) return Fan;
  if (
    label.includes("tap") ||
    label.includes("plumb") ||
    label.includes("pipe") ||
    label.includes("water")
  ) {
    return Droplets;
  }
  if (
    label.includes("electric") ||
    label.includes("wire") ||
    label.includes("light") ||
    label.includes("ac")
  ) {
    return Plug;
  }
  return Wrench;
};

// ─── PENDING BOOKING REQUESTS COMPONENT ───────────────────────────────
function PendingBookingRequestsList({
  showFooterAction = true,
}: {
  showFooterAction?: boolean;
}) {
  const { toast } = useToast();
  const [selectedBooking, setSelectedBooking] = useState<PendingBooking | null>(
    null,
  );
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"accept" | "reject" | null>(
    null,
  );
  const [actionComment, setActionComment] = useState("");

  const { data: pendingBookings, isLoading } = useQuery<PendingBooking[]>({
    queryKey: ["/api/bookings/provider/pending"],
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      comments,
    }: {
      id: number;
      status: string;
      comments: string;
    }) => {
      // 'comments' from input is the rejection reason if status is 'rejected'
      const payload: { status: string; rejectionReason?: string } = { status };
      if (status === "rejected") {
        payload.rejectionReason = comments;
      }
      // Corrected endpoint to PATCH /api/bookings/:id/status
      const res = await apiRequest(
        "PATCH",
        `/api/bookings/${id}/status`,
        payload,
      );
      const updatedBookingData = await res.json();
      // Pass along the original input 'comments' as it's needed for the rejection email
      return { responseData: updatedBookingData, inputComments: comments };
    },
    onSuccess: async (result) => {
      // 'result' is { responseData: { booking: updatedBookingData, message: string }, inputComments: comments }
      const { responseData, inputComments } = result;
      const updatedBooking = responseData.booking; // Access the nested booking object

      // Existing success logic
      queryClient.invalidateQueries({
        queryKey: ["/api/bookings/provider/pending"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/bookings/provider/history"],
      });
      toast({
        title: "Success",
        description: `Booking ${updatedBooking.status === "accepted" ? "accepted" : "rejected"} successfully`,
      });
      setActionDialogOpen(false);
      setSelectedBooking(null);
      setActionComment("");

    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAction = () => {
    if (!selectedBooking || !actionType) return;
    updateBookingMutation.mutate({
      id: selectedBooking.id,
      status: actionType === "accept" ? "accepted" : "rejected",
      comments: actionComment,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!pendingBookings || pendingBookings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You have no pending booking requests
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {pendingBookings.map((booking) => {
        const serviceName = booking.service?.name ?? "Service";
        const serviceCategory =
          booking.service && "category" in booking.service
            ? booking.service.category
            : null;
        const ServiceIcon = resolveServiceIcon(booking.service);
        const priceValue = readServicePrice(booking.service);
        const priceLabel = formatRupees(priceValue);
        const customerName = booking.customer?.name?.trim() || "Customer";
        const phoneDigits = normalizePhoneNumber(booking.customer?.phone);
        const callHref = phoneDigits ? `tel:${phoneDigits}` : null;
        const whatsappMessage = `Hello ${customerName === "Customer" ? "there" : customerName}, I am coming in 10 mins for ${serviceName}.`;
        const whatsappHref = buildWhatsAppHref(
          booking.customer?.phone,
          whatsappMessage,
        );
        const landmark = resolveLandmark(booking.relevantAddress);
        const addressLine = formatAddressLine(booking.relevantAddress);
        const whenLabel = booking.bookingDate
          ? `${formatIndianDisplay(booking.bookingDate, "date")}${booking.timeSlotLabel
            ? ` • ${describeSlotLabel(booking.timeSlotLabel) ?? ""}`
            : ""
          }`
          : "Date not set";
        const locationTypeLabel =
          booking.serviceLocation === "provider"
            ? "At your location"
            : "At customer location";
        const expiresInDays = booking.expiresAt
          ? Math.ceil(
            (new Date(booking.expiresAt).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          )
          : null;

        return (
          <div
            key={booking.id}
            className="rounded-xl border bg-background p-4 shadow-sm"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Where
                  </p>
                  <p className="text-3xl font-bold sm:text-4xl">
                    {landmark}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{addressLine}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {locationTypeLabel}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 text-amber-800"
                  >
                    Call to confirm
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {whenLabel}
                  </div>
                  {expiresInDays !== null && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        Expires in {expiresInDays}{" "}
                        {expiresInDays === 1 ? "day" : "days"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <ServiceIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      What
                    </p>
                    <p className="text-lg font-semibold">{serviceName}</p>
                    {serviceCategory && (
                      <p className="text-sm text-muted-foreground">
                        {serviceCategory}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Money
                  </p>
                  <p className="text-2xl font-bold">{priceLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    Estimated cash
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {callHref ? (
                  <Button
                    asChild
                    className="h-14 flex-1 justify-center gap-3 bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700 [&_svg]:size-6"
                  >
                    <a href={callHref}>
                      <Phone />
                      Call now
                    </a>
                  </Button>
                ) : (
                  <Button
                    disabled
                    className="h-14 flex-1 justify-center gap-3 bg-emerald-200 text-base font-semibold text-emerald-900 [&_svg]:size-6"
                  >
                    <Phone />
                    Call now
                  </Button>
                )}
                {whatsappHref ? (
                  <Button
                    asChild
                    variant="outline"
                    className="h-14 flex-1 justify-center gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <a href={whatsappHref} target="_blank" rel="noreferrer">
                      <MessageCircle />
                      WhatsApp
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled
                    className="h-14 flex-1 justify-center gap-2 border-emerald-100 text-emerald-400"
                  >
                    <MessageCircle />
                    WhatsApp
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {customerName}
                  {booking.customer?.phone ? ` • ${booking.customer.phone}` : ""}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1"
                    onClick={() => {
                      setSelectedBooking(booking);
                      setActionType("accept");
                      setActionDialogOpen(true);
                    }}
                  >
                    <CheckCircle className="h-3 w-3" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1"
                    onClick={() => {
                      setSelectedBooking(booking);
                      setActionType("reject");
                      setActionDialogOpen(true);
                    }}
                  >
                    <XCircle className="h-3 w-3" />
                    Reject
                  </Button>
                </div>
              </div>

              {booking.proximityInfo && (
                <div className="flex items-center text-xs text-blue-700">
                  <AlertCircle className="h-3 w-3 mr-1 text-blue-500" />
                  <span>{booking.proximityInfo.message}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "accept" ? "Accept" : "Reject"} Booking Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Service</p>
              <p className="text-sm">{selectedBooking?.service?.name}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Date & Time</p>
              <p className="text-sm">
                {selectedBooking?.bookingDate
                  ? formatIndianDisplay(selectedBooking.bookingDate, "datetime")
                  : "Date not set"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Comments</p>
              <Textarea
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                placeholder={
                  actionType === "accept"
                    ? "Add any instructions for the customer"
                    : "Provide a reason for rejection"
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setActionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={updateBookingMutation.isPending}
            >
              {updateBookingMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {actionType === "accept" ? "Accept" : "Reject"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showFooterAction ? (
        <Button variant="outline" size="sm" asChild className="w-full">
          <Link href="/provider/bookings?status=pending">
            View All Requests
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

// ─── BOOKING HISTORY COMPONENT ─────────────────────────────────────────
function BookingHistoryList({
  showFooterAction = true,
}: {
  showFooterAction?: boolean;
}) {
  const { data: bookingHistoryData, isLoading } = useQuery<{
    data: (Booking & { service?: Service })[];
    total: number;
    totalPages: number;
  }>({
    queryKey: ["/api/bookings/provider/history"],
  });

  const bookingHistory = bookingHistoryData?.data;

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

  const recentHistory = bookingHistory.slice(0, 3);

  return (
    <div className="space-y-3">
      {recentHistory.map((booking) => (
        <div
          key={booking.id}
          className="flex items-center justify-between border rounded-md p-3"
        >
          <div>
            <p className="font-medium">{booking.service?.name}</p>
            <p className="text-sm text-muted-foreground">
              {booking.bookingDate
                ? `${formatIndianDisplay(booking.bookingDate, "date")}${booking.timeSlotLabel
                  ? ` • ${describeSlotLabel(booking.timeSlotLabel) ?? ""}`
                  : ""
                }`
                : "Date not set"}
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
            variant={booking.status === "accepted" ? "default" : "destructive"}
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
      {showFooterAction ? (
        <Button variant="outline" size="sm" asChild className="w-full">
          <Link href="/provider/bookings">View Full History</Link>
        </Button>
      ) : null}
    </div>
  );
}

// ─── ANIMATION & FORM CONSTANTS ─────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const serviceFormSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  price: z.string().min(1, "Price is required"),
  duration: z.coerce.number().min(15, "Duration must be at least 15 minutes"),
  isAvailable: z.boolean().default(true),
  isAvailableNow: z.boolean().default(true),
  availabilityNote: z.string().optional().nullable(),
});
type ServiceFormData = z.infer<typeof serviceFormSchema>;

// ─── PROVIDER DASHBOARD PAGE ─────────────────────────────────────────────
export default function ProviderDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const providerProfileAddress = [
    user?.addressStreet,
    user?.addressCity,
    user?.addressState,
    user?.addressPostalCode,
    user?.addressCountry,
  ]
    .filter(Boolean)
    .join(", ");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "availability">("basic");
  const [availabilityTarget, setAvailabilityTarget] = useState<boolean | null>(
    null,
  );

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      price: "",
      duration: 15,
      isAvailable: true,
      isAvailableNow: true,
      availabilityNote: "",
    },
  });

  const servicesQueryKey = [`/api/services/provider/${user?.id}`];
  const bookingsQueryKey = [`/api/bookings/provider/${user?.id}`];

  // Fetch services, bookings and reviews
  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: servicesQueryKey,
    enabled: !!user?.id,
  });
  const { data: bookings, isLoading: bookingsLoading } = useQuery<
    ProviderBooking[]
  >({
    queryKey: bookingsQueryKey,
    enabled: !!user?.id,
  });
  const { data: reviews, isLoading: reviewsLoading } = useQuery<Review[]>({
    queryKey: [`/api/reviews/provider/${user?.id}`],
    enabled: !!user?.id,
  });

  // Metrics
  const pendingBookingsCount = bookings
    ? bookings.filter((b) => b.status === "pending").length
    : 0;
  const activeBookingStatuses: Booking["status"][] = [
    "accepted",
    "rescheduled",
    "rescheduled_by_provider",
    "en_route",
  ];
  const averageRating =
    reviews && reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;
  const hasServices = (services?.length ?? 0) > 0;
  const isWorkingToday = services
    ? services.some((service) => service.isAvailableNow !== false)
    : true;

  const todayIndianKey = getIndianDayKey(new Date());
  const currentMonthKey = getIndianMonthKey(new Date());

  const upcomingBookings = bookings
    ? bookings
      .filter(
        (b) => {
          if (!activeBookingStatuses.includes(b.status)) return false;
          if (!todayIndianKey) return false;
          const bookingKey = getIndianDayKey(b.bookingDate);
          return !!bookingKey && bookingKey >= todayIndianKey;
        },
      )
      .sort(
        (a, b) =>
          new Date(a.bookingDate).getTime() -
          new Date(b.bookingDate).getTime(),
      )
      .slice(0, 5)
    : [];

  const earningsSummary = useMemo(() => {
    const base = {
      todayEarnings: 0,
      monthEarnings: 0,
      topCustomers: [] as CustomerEarnings[],
    };
    if (!bookings || !todayIndianKey || !currentMonthKey) return base;

    const earningsStatuses = new Set<Booking["status"]>([
      "completed",
      "awaiting_payment",
    ]);
    const totalsByCustomer = new Map<string, CustomerEarnings>();
    let todayTotal = 0;
    let monthTotal = 0;

    bookings.forEach((booking) => {
      if (!earningsStatuses.has(booking.status)) return;
      const amount = readServicePrice(booking.service);
      if (amount == null) return;

      const bookingDayKey = getIndianDayKey(booking.bookingDate);
      if (bookingDayKey && bookingDayKey === todayIndianKey) {
        todayTotal += amount;
      }

      const bookingMonthKey = getIndianMonthKey(booking.bookingDate);
      if (bookingMonthKey && bookingMonthKey === currentMonthKey) {
        monthTotal += amount;
      }

      const customerName = booking.customer?.name?.trim() || "Customer";
      const key = booking.customer?.id
        ? `customer-${booking.customer.id}`
        : `booking-${booking.id}`;
      const entry = totalsByCustomer.get(key) ?? {
        name: customerName,
        total: 0,
        count: 0,
      };
      entry.total += amount;
      entry.count += 1;
      totalsByCustomer.set(key, entry);
    });

    const topCustomers = Array.from(totalsByCustomer.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);

    return {
      todayEarnings: todayTotal,
      monthEarnings: monthTotal,
      topCustomers,
    };
  }, [bookings, todayIndianKey, currentMonthKey]);
  const { todayEarnings, monthEarnings, topCustomers } = earningsSummary;

  // Mutations
  const updateAvailabilityMutation = useMutation({
    mutationFn: async (nextStatus: boolean) => {
      const res = await apiRequest("PATCH", "/api/provider/availability", {
        isAvailableNow: nextStatus,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update availability");
      }
      return res.json();
    },
    onMutate: async (nextStatus) => {
      setAvailabilityTarget(nextStatus);
      await queryClient.cancelQueries({ queryKey: servicesQueryKey });
      const previous = queryClient.getQueryData<Service[]>(servicesQueryKey);
      if (previous) {
        queryClient.setQueryData(
          servicesQueryKey,
          previous.map((service) => ({
            ...service,
            isAvailableNow: nextStatus,
          })),
        );
      }
      return { previous };
    },
    onSuccess: (_data, nextStatus) => {
      toast({
        title: nextStatus ? "You're working today" : "Requests paused",
        description: nextStatus
          ? "Customers can send you new booking requests."
          : "Customers will see you as busy.",
      });
    },
    onError: (error: Error, _nextStatus, context) => {
      if (context?.previous) {
        queryClient.setQueryData(servicesQueryKey, context.previous);
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setAvailabilityTarget(null);
      queryClient.invalidateQueries({ queryKey: servicesQueryKey });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const res = await apiRequest("POST", "/api/services", {
        ...data,
        providerId: user?.id,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create service");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: servicesQueryKey,
      });
      toast({ title: "Success", description: "Service created successfully" });
      form.reset();
      setDialogOpen(false);
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
              altText="Open profile"
              onClick={() => navigate("/provider/profile")}
            >
              Go to profile
            </ToastAction>
          ),
        });
        setDialogOpen(false);
        return;
      }

      const parsed = parseApiError(error);
      toast({
        title: "Error",
        description: parsed.message,
        variant: "destructive",
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<ServiceFormData>;
    }) => {
      const res = await apiRequest("PATCH", `/api/services/${id}`, data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update service");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: servicesQueryKey,
      });
      toast({ title: "Success", description: "Service updated successfully" });
      setDialogOpen(false);
      setEditingService(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: number) => {
      const res = await apiRequest("DELETE", `/api/services/${serviceId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete service");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: servicesQueryKey,
      });
      toast({ title: "Success", description: "Service deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ServiceFormData) => {
    try {
      if (editingService) {
        await updateServiceMutation.mutateAsync({
          id: editingService.id,
          data,
        });
      } else {
        await createServiceMutation.mutateAsync(data);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({
        queryKey: servicesQueryKey,
      });
      setDialogOpen(false);
      form.reset();
      setEditingService(null);
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="p-6 space-y-8"
      >
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold">
            {t("dashboard_greeting").replace("{name}", user?.name ?? "")}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Link href="/provider/profile">
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                {t("go_to_profile")}
              </Button>
            </Link>
            <Button
              onClick={() => {
                setEditingService(null);
                form.reset();
                setActiveTab("basic");
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> {t("add_service")}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Availability */}
          <motion.div variants={item}>
            <Card
              className={cn(
                "border-2",
                isWorkingToday
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-red-200 bg-red-50/40",
              )}
            >
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("availability")}
                    </p>
                    <h2 className="text-2xl font-bold">
                      {isWorkingToday ? "I am Working Today" : "I am Busy"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      One tap to pause all new requests. Applies to every service.
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 md:w-auto">
                    <div className="flex w-full max-w-lg items-center gap-2 rounded-full bg-background/80 p-1 shadow-sm">
                      <Button
                        type="button"
                        disabled={
                          servicesLoading ||
                          !hasServices ||
                          updateAvailabilityMutation.isPending
                        }
                        onClick={() => updateAvailabilityMutation.mutate(true)}
                        className={cn(
                          "h-16 flex-1 rounded-full text-lg font-semibold",
                          isWorkingToday
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
                        )}
                      >
                        {availabilityTarget === true &&
                          updateAvailabilityMutation.isPending && (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          )}
                        I am Working Today
                      </Button>
                      <Button
                        type="button"
                        disabled={
                          servicesLoading ||
                          !hasServices ||
                          updateAvailabilityMutation.isPending
                        }
                        onClick={() => updateAvailabilityMutation.mutate(false)}
                        className={cn(
                          "h-16 flex-1 rounded-full text-lg font-semibold",
                          !isWorkingToday
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-red-100 text-red-700 hover:bg-red-200",
                        )}
                      >
                        {availabilityTarget === false &&
                          updateAvailabilityMutation.isPending && (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          )}
                        I am Busy
                      </Button>
                    </div>
                    {!servicesLoading && !hasServices && (
                      <p className="text-xs text-muted-foreground">
                        Add at least one service to go online.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Metrics */}
          <div className="grid gap-4 sm:grid-cols-2">
            <motion.div variants={item}>
              <Card className="border-emerald-200/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("earnings_today")}
                </CardTitle>
                <IndianRupee className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatRupees(todayEarnings)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Completed + awaiting payment
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="border-sky-200/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("earnings_month")}
                </CardTitle>
                <IndianRupee className="h-4 w-4 text-sky-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatRupees(monthEarnings)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total completed jobs
                </p>
              </CardContent>
            </Card>
            </motion.div>
            <motion.div variants={item}>
              <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("pending_requests")}
                </CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingBookingsCount}</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("average_rating")}
                </CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {averageRating ? averageRating.toFixed(1) : "N/A"}
                </div>
              </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        <motion.div variants={item}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("pending_requests")}</CardTitle>
              <Link href="/provider/bookings?status=pending">
                <Button variant="ghost" size="sm">
                  {t("view_all")}
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <PendingBookingRequestsList showFooterAction={false} />
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Earnings by customer */}
        <motion.div variants={item}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="h-5 w-5 text-emerald-600" />
                {t("earnings_by_customer")}
              </CardTitle>
              <Link href="/provider/earnings">
                <Button variant="ghost" size="sm">
                  {t("view_all")}
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {topCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("earnings_empty_state")}
                </p>
              ) : (
                <div className="space-y-3">
                  {topCustomers.map((customer, index) => (
                    <div
                      key={`${customer.name}-${index}`}
                      className="flex items-center justify-between border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {customer.count}{" "}
                          {customer.count === 1
                            ? t("job_single")
                            : t("job_plural")}
                        </p>
                      </div>
                      <div className="text-lg font-semibold">
                        {formatRupees(customer.total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card>
              <CardHeader className="flex justify-between items-center">
                <CardTitle>Recent Booking History</CardTitle>
                <Link href="/provider/bookings">
                  <Button variant="ghost" size="sm">
                    {t("view_all")}
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <BookingHistoryList showFooterAction={false} />
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Upcoming Bookings & Recent Reviews */}
        <div className="grid gap-6 md:grid-cols-2">
          <motion.div variants={item}>
            <Card>
              <CardHeader className="flex justify-between items-center">
                <CardTitle>Upcoming Bookings</CardTitle>
                <Link href="/provider/bookings?status=accepted">
                  <Button variant="ghost" size="sm">
                    {t("view_all")}
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {bookingsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : !upcomingBookings || upcomingBookings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No upcoming bookings
                  </p>
                ) : (
                  <div className="space-y-4">
                    {upcomingBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <Users className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {booking.service?.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <CalendarIcon className="inline h-4 w-4 mr-1 align-text-bottom" />
                              {formatIndianDisplay(
                                booking.bookingDate || "",
                                "date",
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <Clock className="inline h-4 w-4 mr-1 align-text-bottom" />
                              {booking.timeSlotLabel
                                ? describeSlotLabel(booking.timeSlotLabel)
                                : formatIndianDisplay(
                                    booking.bookingDate || "",
                                    "time",
                                  )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {booking.timeSlotLabel
                              ? describeSlotLabel(booking.timeSlotLabel)
                              : formatIndianDisplay(
                                  booking.bookingDate || "",
                                  "time",
                                )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card>
              <CardHeader className="flex justify-between items-center">
                <CardTitle>Recent Reviews</CardTitle>
                <Link href="/provider/reviews">
                  <Button variant="ghost" size="sm">
                    {t("view_all")}
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {reviewsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : !reviews || reviews.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No reviews yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {reviews.slice(0, 5).map((review) => (
                      <div key={review.id} className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <Star
                              key={i}
                              className="h-4 w-4 fill-yellow-400 text-yellow-400"
                            />
                          ))}
                        </div>
                        <p className="text-sm">{review.review}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Reviewed on:{" "}
                          {formatIndianDisplay(review.createdAt || "", "date")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Services Offered */}
        <motion.div variants={item}>
          <Card>
            <CardHeader className="flex justify-between items-center">
              <CardTitle>{t("my_services")}</CardTitle>
              <Button
                onClick={() => {
                  setEditingService(null);
                  form.reset();
                  setActiveTab("basic");
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> {t("add_service")}
              </Button>
            </CardHeader>
            <CardContent>
              {servicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : !services || services.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    {t("provider_services_empty")}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingService(null);
                      form.reset();
                      setActiveTab("basic");
                      setDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" /> {t("add_service")}
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {services.slice(0, 4).map((service) => (
                    <Card key={service.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{service.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {service.description}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingService(service);
                                form.reset({
                                  name: service.name,
                                  description: service.description ?? "",
                                  category: service.category,
                                  price: service.price?.toString() ?? "",
                                  duration: service.duration,
                                  isAvailable: service.isAvailable ?? true,
                                  isAvailableNow:
                                    service.isAvailableNow ?? true,
                                  availabilityNote: service.availabilityNote ?? "",
                                });
                                setActiveTab("basic"); // Reset to basic tab when opening for edit
                                setDialogOpen(true);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Are you sure?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will
                                    permanently delete your service.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      deleteServiceMutation.mutate(service.id)
                                    }
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{t("service_price")}</span>
                            <span className="font-medium">
                              ₹{service.price}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>{t("service_duration")}</span>
                            <span>
                              {service.duration} {t("minutes")}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>{t("service_category")}</span>
                            <span>{service.category}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Location</span>
                            <span className="text-right">
                              {providerProfileAddress || (
                                <span className="text-muted-foreground">
                                  Set your address in profile
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>{t("status")}</span>
                            <span
                              className={
                                service.isAvailable &&
                                  service.isAvailableNow !== false
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {service.isAvailable &&
                                service.isAvailableNow !== false
                                ? t("status_online")
                                : t("status_paused")}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {services && services.length > 4 && (
                <div className="mt-4 text-center">
                  <Link href="/provider/services">
                    <Button variant="outline">{t("view_all")}</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Service Creation / Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
              <DialogTitle>
                {editingService ? "Edit Service" : "Add New Service"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <Tabs
                  value={activeTab}
                  onValueChange={(value) =>
                    setActiveTab(value as "basic" | "availability")
                  }
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">{t("basic_info")}</TabsTrigger>
                    <TabsTrigger value="availability">
                      {t("availability")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("service_name")}</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("service_description")}</FormLabel>
                            <FormControl>
                              <Textarea {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("service_category")}</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t("select_category")}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {SERVICE_CATEGORY_OPTIONS.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {t(option.labelKey)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("service_price")} (₹)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="e.g., 500"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="duration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("service_duration")} ({t("minutes")})
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="e.g., 60"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="availability">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-muted/40">
                        <div>
                          <h3 className="text-lg font-medium">
                            {t("service_availability_advanced")}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t("service_availability_hint")}
                          </p>
                        </div>
                        <FormField
                          control={form.control}
                          name="isAvailableNow"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormLabel className="font-semibold">
                                {field.value
                                  ? t("available_now")
                                  : t("offline")}
                              </FormLabel>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="availabilityNote"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("availability_note_optional")}</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={t("availability_note_placeholder")}
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                        {t("service_location_profile_note")}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    {t("cancel")}
                  </Button>
                  <Button type="submit">
                    {editingService ? t("update_service") : t("create_service")}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

      </motion.div>
    </DashboardLayout>
  );
}
