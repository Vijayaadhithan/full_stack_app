import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import MapLink from "@/components/location/MapLink";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { PaymentMethodType } from "@shared/schema";
import { PaymentMethodSelector } from "@/components/payment-method-selector";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Booking, Service, Review } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { motion } from "framer-motion";
import {
  Star,
  Calendar as CalendarIcon,
  Clock,
  MapPin as LocationIcon,
  Loader2,
} from "lucide-react";
import { formatIndianDisplay, formatInIndianTime } from "@shared/date-utils";
import { describeSlotLabel } from "@/lib/time-slots";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { Input } from "@/components/ui/input"; // Added Input for datetime-local

type BookingWithService = Booking & {
  service: Service;
  provider?: {
    id: number;
    name: string;
    phone: string;
    upiId?: string;
    upiQrCodeUrl?: string;
    addressStreet?: string;
    addressCity?: string;
    addressState?: string;
    addressPostalCode?: string;
    addressCountry?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};
type BookingsResponse =
  | BookingWithService[]
  | { bookings: BookingWithService[] };

type BookingStatusFilter =
  | "all"
  | "pending"
  | "accepted"
  | "rejected"
  | "completed";
type CustomerBookingStatus = Booking["status"];

const BOOKING_STATUS_BADGE_CLASSES: Partial<
  Record<CustomerBookingStatus, string>
> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  rescheduled: "bg-violet-50 text-violet-700 border-violet-200",
  rescheduled_by_provider: "bg-violet-50 text-violet-700 border-violet-200",
  rescheduled_pending_provider_approval:
    "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-sky-50 text-sky-700 border-sky-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-300",
  awaiting_payment: "bg-blue-50 text-blue-700 border-blue-200",
  en_route: "bg-blue-50 text-blue-700 border-blue-200",
  disputed: "bg-amber-100 text-amber-800 border-amber-200",
};

const getBookingStatusBadgeClass = (status: CustomerBookingStatus) =>
  `border ${
    BOOKING_STATUS_BADGE_CLASSES[status] ||
    "bg-slate-100 text-slate-700 border-slate-200"
  }`;

function hasWrappedBookings(
  data: BookingsResponse | undefined,
): data is { bookings: BookingWithService[] } {
  return (
    typeof data === "object" &&
    data !== null &&
    "bookings" in data &&
    Array.isArray((data as { bookings: unknown }).bookings)
  );
}

export default function Bookings() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [selectedBooking, setSelectedBooking] = useState<BookingWithService>();
  // const [rescheduleDate, setRescheduleDate] = useState<Date>();
  // const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const [newRescheduleDateTime, setNewRescheduleDateTime] =
    useState<string>(""); // New state for datetime-local
  const [rescheduleComments, setRescheduleComments] = useState<string>(""); // Added for comments
  // const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodType>("upi");
  const [disputeReason, setDisputeReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>("all");
  const [timeFilter, setTimeFilter] = useState<"upcoming" | "past">("upcoming");

  const bookingStatusFilterOptions: {
    value: BookingStatusFilter;
    label: string;
  }[] = [
    { value: "all", label: t("all") },
    { value: "pending", label: t("pending") },
    { value: "accepted", label: t("accepted") },
    { value: "rejected", label: t("rejected") },
    { value: "completed", label: t("completed") },
  ];

  const bookingStatusLabels: Record<CustomerBookingStatus, string> = {
    pending: t("pending"),
    accepted: t("accepted"),
    rejected: t("rejected"),
    rescheduled: t("rescheduled"),
    rescheduled_by_provider: t("rescheduled_by_provider"),
    completed: t("completed"),
    cancelled: t("cancelled"),
    expired: t("expired"),
    rescheduled_pending_provider_approval: t(
      "rescheduled_pending_provider_approval",
    ),
    awaiting_payment: t("awaiting_payment"),
    en_route: t("en_route"),
    disputed: t("disputed"),
  };

  const getBookingLocationLabel = (booking: BookingWithService) => {
    if (booking.serviceLocation === "customer") {
      return t("service_at_your_location");
    }
    const providerAddress = [
      booking.provider?.addressStreet,
      booking.provider?.addressCity,
    ]
      .filter(Boolean)
      .join(", ");
    if (providerAddress) {
      return t("provider_location_with_address").replace(
        "{address}",
        providerAddress,
      );
    }
    return t("service_at_provider_location");
  };

  const handleCopyUpiId = async (upiId?: string | null) => {
    if (!upiId) {
      toast({
        title: t("upi_id_unavailable_title"),
        description: t("upi_id_unavailable_description"),
        variant: "destructive",
      });
      return;
    }

    const notifySuccess = () => toast({ title: t("upi_id_copied") });
    const notifyManual = () =>
      toast({
        title: t("upi_id_copy_manual_title"),
        description: t("upi_id_copy_manual_description"),
      });
    const notifyFailure = () =>
      toast({
        title: t("upi_id_copy_failed_title"),
        description: t("upi_id_copy_failed_description"),
        variant: "destructive",
      });

    const fallbackCopy = () => {
      if (typeof document === "undefined" || !document.body) {
        throw new Error("Clipboard unavailable");
      }

      const textarea = document.createElement("textarea");
      textarea.value = upiId;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      textarea.style.pointerEvents = "none";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);

      const selection = document.getSelection();
      const previousRange =
        selection && selection.rangeCount > 0
          ? selection.getRangeAt(0).cloneRange()
          : null;

      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const successful = document.execCommand
        ? document.execCommand("copy")
        : false;

      document.body.removeChild(textarea);

      if (previousRange && selection) {
        selection.removeAllRanges();
        selection.addRange(previousRange);
      }

      if (!successful) {
        throw new Error("Fallback copy failed");
      }
    };

    const isWindowDefined = typeof window !== "undefined";
    const isLocalhost =
      isWindowDefined &&
      ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    const isSecureEnvironment = isWindowDefined
      ? window.isSecureContext ?? isLocalhost
      : false;

    const canUseClipboardApi =
      typeof navigator !== "undefined" &&
      !!navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function" &&
      (isWindowDefined ? isSecureEnvironment : true);

    if (canUseClipboardApi) {
      try {
        await navigator.clipboard.writeText(upiId);
        notifySuccess();
        return;
      } catch {
        // fall through to fallback copy
      }
    }

    try {
      fallbackCopy();
      notifySuccess();
    } catch {
      if (isWindowDefined && typeof window.prompt === "function") {
        window.prompt(t("upi_id_copy_prompt"), upiId);
        notifyManual();
      } else {
        notifyFailure();
      }
    }
  };

  // Fetch bookings
  const { data: bookings, isLoading } = useQuery<BookingsResponse>({
    queryKey: ["/api/bookings", statusFilter],
    queryFn: async () => {
      const query =
        statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const res = await apiRequest("GET", `/api/bookings${query}`);
      return res.json();
    },
  });

  // REMOVED: Fetch available slots for rescheduling (providerAvailability query and related useEffects)
  // const { data: providerAvailability, isLoading: isLoadingAvailability } = useQuery<string[], Error>({
  //   queryKey: ["/api/services", selectedBooking?.serviceId, "availability", rescheduleDate ? rescheduleDate.toISOString().split('T')[0] : undefined],
  //   queryFn: async () => {
  //     if (!selectedBooking?.serviceId || !rescheduleDate) return [];
  //     const dateStr = rescheduleDate.toISOString().split('T')[0];
  //     const response = await apiRequest("GET", `/api/services/${selectedBooking.serviceId}/availability?date=${dateStr}`);
  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(errorData.message || "Failed to fetch availability");
  //     }
  //     return response.json();
  //   },
  //   enabled: !!selectedBooking?.serviceId && !!rescheduleDate,
  // });

  // REMOVED: useEffect for providerAvailability
  // useEffect(() => {
  //   if (providerAvailability) {
  //     setAvailableTimes(providerAvailability);
  //     if (providerAvailability.length > 0) {
  //       setRescheduleTime(providerAvailability[0]); // Default to the first available time
  //     } else {
  //       setRescheduleTime("");
  //     }
  //   }
  // }, [providerAvailability]);

  // REMOVED: useEffect for providerAvailability error handling
  // useEffect(() => {
  //   if (providerAvailability === undefined) return;

  //   const queryState = queryClient.getQueryState([
  //     "/api/services",
  //     selectedBooking?.serviceId,
  //     "availability",
  //     rescheduleDate ? rescheduleDate.toISOString().split('T')[0] : undefined,
  //   ]);
  //   const error = queryState?.error;

  //   if (error) {
  //     toast({
  //       title: "Error fetching availability",
  //       description: error instanceof Error ? error.message : "Failed to fetch availability",
  //       variant: "destructive",
  //     });
  //     setAvailableTimes([]);
  //     setRescheduleTime("");
  //   }
  // }, [providerAvailability, queryClient, rescheduleDate, selectedBooking?.serviceId]);

  // Fetch all reviews left by the logged-in customer
  const { data: customerReviews } = useQuery<Review[]>({
    queryKey: ["/api/reviews/customer"],
  });

  // Fetch existing reviews for selected service when leaving/editing a review
  const { data: existingReviews } = useQuery<Review[]>({
    queryKey: ["/api/reviews/service", selectedBooking?.serviceId],
    enabled: !!selectedBooking?.serviceId,
  });

  // Derive the user's review for the selected booking
  const userReview = existingReviews?.find(
    (r) =>
      r.serviceId === selectedBooking?.serviceId &&
      r.bookingId === selectedBooking?.id,
  );

  // When editing, populate rating & text
  useEffect(() => {
    if (userReview) {
      setRating(userReview.rating);
      setReview(userReview.review || "");
    }
  }, [userReview]);

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (bookingId: number) =>
      apiRequest("PATCH", `/api/bookings/${bookingId}`, {
        status: "cancelled",
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/service"] });
      toast({
        title: t("booking_cancelled_title"),
        description: t("booking_cancelled_description"),
      });
    },
  });

  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: ({
      bookingId,
      date,
      time,
      comments, // Added comments
    }: {
      bookingId: number;
      date: Date; // Changed to Date object
      time: string;
      comments?: string; // Added comments
    }) => {
      // Combine date and time
      const newBookingDate = new Date(date);
      const [hours, minutes] = time.split(":").map(Number);
      newBookingDate.setHours(hours, minutes, 0, 0);

      return apiRequest("PATCH", `/api/bookings/${bookingId}`, {
        bookingDate: newBookingDate.toISOString(), // Send as ISO string
        comments: comments, // Send comments
      }).then((r) => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/service"] });
      toast({
        title: t("reschedule_requested_title"),
        description: t("reschedule_requested_description"),
      });
      setSelectedBooking(undefined); // Close dialog
      setNewRescheduleDateTime("");
      setRescheduleComments(""); // Reset comments
    },
    onError: (error: any) => {
      toast({
        title: t("reschedule_failed_title"),
        description: error.message || t("reschedule_failed_description"),
        variant: "destructive",
      });
      setRescheduleComments(""); // Reset comments on error as well
    },
  });

  // Review create/update mutation
  const reviewMutation = useMutation({
    mutationFn: (data: {
      serviceId: number;
      rating: number;
      review: string;
      bookingId?: number;
      id?: number;
    }) => {
      if (data.id) {
        // Use the customer-specific update endpoint
        return apiRequest("PUT", `/api/reviews/${data.id}/customer`, {
          rating: data.rating,
          review: data.review,
        }).then((r) => r.json());
      }
      return apiRequest("POST", "/api/reviews", data).then((r) => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/reviews/service/", selectedBooking?.serviceId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/customer"] });
      if (selectedBooking?.provider?.id) {
        queryClient.invalidateQueries({
          queryKey: [`/api/reviews/provider/${selectedBooking.provider.id}`],
        });
      }
      toast({
        title: userReview
          ? t("review_updated_title")
          : t("review_submitted_title"),
        description: t("review_thank_you"),
      });
      setSelectedBooking(undefined); // Close the review dialog
      setRating(5);
      setReview("");
    },
    onError: (error: any) => {
      // Log the full error object for detailed debugging
      console.error("Review submission error:", error);
      // Display error message to the user
      const errorMessage =
        error.response?.data?.message || t("review_submit_failed_description");
      toast({
        title: t("review_submit_failed_title"),
        description: errorMessage,
        variant: "destructive",
      });
      setRescheduleComments(""); // Reset comments on error as well
    },
  });

  // Submit payment reference mutation
  const paymentMutation = useMutation({
    mutationFn: async ({
      bookingId,
      paymentReference,
    }: {
      bookingId: number;
      paymentReference: string;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/bookings/${bookingId}/customer-complete`,
        { paymentReference },
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || t("payment_submit_failed"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("payment_submitted_waiting_confirmation") });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      setPaymentReference("");
      setPaymentMethod("upi");
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateReferenceMutation = useMutation({
    mutationFn: async ({
      bookingId,
      paymentReference,
    }: {
      bookingId: number;
      paymentReference: string;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/bookings/${bookingId}/update-reference`,
        { paymentReference },
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || t("payment_reference_update_failed"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("payment_reference_updated") });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
    },
    onError: (e: Error) =>
      toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const disputeMutation = useMutation({
    mutationFn: async ({
      bookingId,
      reason,
    }: {
      bookingId: number;
      reason: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/bookings/${bookingId}/report-dispute`,
        { reason },
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || t("report_issue_failed"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("issue_reported") });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
    },
    onError: (e: Error) =>
      toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const handleCancel = (booking: BookingWithService) => {
    if (window.confirm(t("cancel_booking_confirm"))) {
      cancelMutation.mutate(booking.id);
    }
  };

  const handleReschedule = () => {
    if (!selectedBooking || !newRescheduleDateTime) return;

    // Basic validation for datetime-local input (e.g., not empty)
    // More sophisticated validation (e.g., ensuring it's in the future) can be added here or on the backend
    if (new Date(newRescheduleDateTime) <= new Date()) {
      toast({
        title: t("invalid_datetime_title"),
        description: t("invalid_datetime_description"),
        variant: "destructive",
      });
      return;
    }

    const newDate = new Date(newRescheduleDateTime);
    const timeString = newRescheduleDateTime.split("T")[1];

    rescheduleMutation.mutate({
      bookingId: selectedBooking.id,
      date: newDate,
      time: timeString,
      comments: rescheduleComments,
    });
  };

  const handleReview = () => {
    if (!selectedBooking?.serviceId) return;
    reviewMutation.mutate({
      serviceId: selectedBooking.serviceId,
      rating,
      review,
      bookingId: selectedBooking.id,
      ...(userReview && { id: userReview.id }),
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <span className="loading loading-spinner" />
        </div>
      </DashboardLayout>
    );
  }

  // Normalize API response to always work with an array
  const bookingsData = Array.isArray(bookings)
    ? bookings
    : hasWrappedBookings(bookings)
    ? bookings.bookings
    : [];

  const INDIAN_DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  const getIndianDayKey = (date: Date | string | null | undefined) => {
    if (!date) return null;
    const key = formatInIndianTime(date, "yyyy-MM-dd");
    return INDIAN_DAY_KEY_REGEX.test(key) ? key : null;
  };
  const todayIndianKey = getIndianDayKey(new Date());
  const isArchivedBookingStatus = (status: CustomerBookingStatus) =>
    status === "completed" ||
    status === "cancelled" ||
    status === "rejected" ||
    status === "expired";

  const upcomingBookings = bookingsData.filter(
    (b) => {
      if (isArchivedBookingStatus(b.status)) return false;
      if (!todayIndianKey) return false;
      const bookingKey = getIndianDayKey(b.bookingDate);
      return !!bookingKey && bookingKey >= todayIndianKey;
    },
  );
  const pastBookings = bookingsData.filter(
    (b) => {
      if (isArchivedBookingStatus(b.status)) return true;
      if (!todayIndianKey) return false;
      const bookingKey = getIndianDayKey(b.bookingDate);
      return !!bookingKey && bookingKey < todayIndianKey;
    },
  );

  return (
    <DashboardLayout>
      <motion.div
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.1 } },
        }}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto space-y-6"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{t("customer_bookings_title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("customer_bookings_subtitle")}
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <motion.aside
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            <Card>
              <CardContent className="space-y-4 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("when")}
                  </p>
                  <div className="grid gap-2">
                    <Button
                      type="button"
                      variant={timeFilter === "upcoming" ? "secondary" : "ghost"}
                      onClick={() => setTimeFilter("upcoming")}
                      className="h-11 justify-start"
                    >
                      {t("upcoming")}
                    </Button>
                    <Button
                      type="button"
                      variant={timeFilter === "past" ? "secondary" : "ghost"}
                      onClick={() => setTimeFilter("past")}
                      className="h-11 justify-start"
                    >
                      {t("past")}
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("status")}
                  </p>
                  <div className="grid gap-2">
                    {bookingStatusFilterOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={
                          statusFilter === option.value ? "secondary" : "ghost"
                        }
                        onClick={() => setStatusFilter(option.value)}
                        className="h-11 justify-start"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.aside>
          <div className="space-y-4">
            {timeFilter === "upcoming" && (
              <div className="grid gap-4">
                {upcomingBookings?.map((booking) => {
                  const canCompleteAndPay =
                    booking.status === "accepted" ||
                    booking.status === "en_route";

                  return (
                    <motion.div
                      key={booking.id}
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        show: { opacity: 1, y: 0 },
                      }}
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <Card className="transition-shadow duration-200 ease-out hover:shadow-md">
                        <CardContent className="pt-6">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold">
                                  {booking.service.name}
                                </h3>
                                <Badge
                                  variant="outline"
                                  className={getBookingStatusBadgeClass(
                                    booking.status,
                                  )}
                                >
                                  {bookingStatusLabels[booking.status] ||
                                    booking.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                <CalendarIcon className="inline h-4 w-4 mr-1 align-text-bottom" />
                                {formatIndianDisplay(
                                  booking.bookingDate,
                                  "date",
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                <Clock className="inline h-4 w-4 mr-1 align-text-bottom" />
                                {booking.timeSlotLabel
                                  ? describeSlotLabel(booking.timeSlotLabel)
                                  : formatIndianDisplay(
                                      booking.bookingDate,
                                      "time",
                                    )}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <LocationIcon className="h-4 w-4" />
                                <span>{getBookingLocationLabel(booking)}</span>
                                {booking.serviceLocation === "provider" ? (
                                  <MapLink
                                    latitude={booking.provider?.latitude}
                                    longitude={booking.provider?.longitude}
                                  />
                                ) : null}
                              </div>
                              {booking.provider && (
                                <div className="mt-2 text-sm text-muted-foreground border-t pt-2">
                                  <p>
                                    <strong>{t("provider_label")}:</strong>{" "}
                                    {booking.provider.name}
                                  </p>
                                  <p>
                                    <strong>{t("phone_label")}:</strong>{" "}
                                    {booking.provider.phone}
                                  </p>
                                </div>
                              )}
                              {booking.status === "rejected" && (
                                <p className="mt-2 text-sm text-destructive">
                                  <strong>{t("reason")}:</strong>{" "}
                                  {booking.rejectionReason ||
                                    t("no_reason_provided")}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 md:justify-end">
                              {canCompleteAndPay && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      onClick={() => {
                                        setSelectedBooking(booking);
                                        setPaymentMethod("upi");
                                        setPaymentReference(
                                          booking.paymentReference || "",
                                        );
                                      }}
                                    >
                                      {t("booking_mark_complete_pay")}
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>
                                        {t("submit_payment_title")}
                                      </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 pt-4">
                                      <PaymentMethodSelector
                                        value={paymentMethod}
                                        onChange={setPaymentMethod}
                                      />
                                      {paymentMethod === "upi" ? (
                                        <>
                                          <div className="flex items-center gap-2">
                                            <p>
                                            {t("send_payment_to_upi")}{" "}
                                              <strong>
                                                {booking.provider?.upiId}
                                              </strong>
                                            </p>
                                            <Button
                                              type="button"
                                              size="sm"
                                              onClick={() =>
                                                handleCopyUpiId(
                                                  booking.provider?.upiId,
                                                )
                                              }
                                            >
                                              {t("copy")}
                                            </Button>
                                          </div>
                                          {booking.provider?.upiQrCodeUrl && (
                                            <img
                                              src={booking.provider.upiQrCodeUrl}
                                              alt="QR"
                                              className="h-32"
                                            />
                                          )}
                                          <Input
                                            placeholder={t(
                                              "transaction_reference_placeholder",
                                            )}
                                            value={paymentReference}
                                            onChange={(e) =>
                                              setPaymentReference(
                                                e.target.value,
                                              )
                                            }
                                          />
                                        </>
                                      ) : (
                                        <p>{t("cash_payment_note")}</p>
                                      )}
                                      <Button
                                        onClick={() =>
                                          paymentMutation.mutate({
                                            bookingId: booking.id,
                                            paymentReference:
                                              paymentMethod === "cash"
                                                ? "CASH"
                                                : paymentReference,
                                          })
                                        }
                                        className="w-full"
                                        disabled={
                                          paymentMethod === "upi" &&
                                          !paymentReference
                                        }
                                      >
                                        {paymentMutation.isPending && (
                                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        )}
                                        {t("submit_confirm_payment")}
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                              {booking.status === "awaiting_payment" && (
                                <>
                                  <p className="text-sm">
                                    {t("reference_label")}:{" "}
                                    {booking.paymentReference}
                                  </p>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedBooking(booking);
                                          setPaymentReference(
                                            booking.paymentReference || "",
                                          );
                                        }}
                                      >
                                        {t("edit_reference")}
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>
                                          {t("update_payment_reference_title")}
                                        </DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4 pt-4">
                                        <Input
                                          value={paymentReference}
                                          onChange={(e) =>
                                            setPaymentReference(
                                              e.target.value,
                                            )
                                          }
                                          placeholder={t(
                                            "transaction_reference_placeholder",
                                          )}
                                        />
                                        <Button
                                          onClick={() =>
                                            updateReferenceMutation.mutate({
                                              bookingId: booking.id,
                                              paymentReference,
                                            })
                                          }
                                          className="w-full"
                                        >
                                          {updateReferenceMutation.isPending && (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                          )}
                                          {t("save")}
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="destructive"
                                        onClick={() => {
                                          setSelectedBooking(booking);
                                        }}
                                      >
                                        {t("report_issue")}
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>{t("report_issue")}</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4 pt-4">
                                        <Textarea
                                          value={disputeReason}
                                          onChange={(e) =>
                                            setDisputeReason(e.target.value)
                                          }
                                          placeholder={t("issue_placeholder")}
                                        />
                                        <Button
                                          onClick={() =>
                                            disputeMutation.mutate({
                                              bookingId: booking.id,
                                              reason: disputeReason,
                                            })
                                          }
                                          className="w-full"
                                        >
                                          {disputeMutation.isPending && (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                          )}
                                          {t("submit")}
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </>
                              )}
                              {booking.status === "pending" && (
                                <>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        onClick={() =>
                                          setSelectedBooking(booking)
                                        }
                                      >
                                        {t("reschedule")}
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>
                                          {t("reschedule_booking_title")}
                                        </DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4 pt-4">
                                        {/* REMOVED: Calendar and Time Select */}
                                        {/* <Calendar
                                          mode="single"
                                          selected={rescheduleDate}
                                          onSelect={setRescheduleDate}
                                          disabled={(date) =>
                                            isBefore(date, addDays(new Date(), 1)) || // Disable past dates and today
                                            isAfter(date, addDays(new Date(), 30))  // Disable dates more than 30 days out
                                          }
                                        />
                                        {rescheduleDate && (
                                          <div className="space-y-2 pt-2">
                                            <Label htmlFor="reschedule-time">Select Time</Label>
                                            {isLoadingAvailability && <p>Loading available times...</p>}
                                            {!isLoadingAvailability && availableTimes.length === 0 && rescheduleDate && (
                                              <p className="text-sm text-muted-foreground">
                                                No available time slots for the selected date. Please choose another date.
                                              </p>
                                            )}
                                            {availableTimes.length > 0 && (
                                              <Select onValueChange={setRescheduleTime} value={rescheduleTime}>
                                                <SelectTrigger id="reschedule-time">
                                                  <SelectValue placeholder="Select a time" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {availableTimes.map((time) => (
                                                    <SelectItem key={time} value={time}>
                                                      {time}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            )}
                                          </div>
                                        )} */}
                                        <div>
                                          <Label htmlFor="newRescheduleDateTime">
                                            {t("new_date_time_label")}
                                          </Label>
                                          <Input
                                            type="datetime-local"
                                            id="newRescheduleDateTime"
                                            value={newRescheduleDateTime}
                                            onChange={(e) =>
                                              setNewRescheduleDateTime(
                                                e.target.value,
                                              )
                                            }
                                            className="mt-1"
                                          />
                                        </div>
                                        <div className="mt-4">
                                          <Label htmlFor="rescheduleComments">
                                            {t("reschedule_reason_optional")}
                                          </Label>
                                          <Textarea
                                            id="rescheduleComments"
                                            value={rescheduleComments}
                                            onChange={(e) =>
                                              setRescheduleComments(
                                                e.target.value,
                                              )
                                            }
                                            placeholder={t(
                                              "reschedule_reason_placeholder",
                                            )}
                                            className="mt-1"
                                          />
                                        </div>
                                        <Button
                                          className="w-full mt-4"
                                          onClick={handleReschedule}
                                          disabled={
                                            !newRescheduleDateTime ||
                                            rescheduleMutation.isPending
                                          }
                                        >
                                          {rescheduleMutation.isPending
                                            ? t("confirming")
                                            : t("confirm_reschedule")}
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                  <Button
                                    variant="destructive"
                                    onClick={() => handleCancel(booking)}
                                  >
                                    {t("cancel")}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {timeFilter === "past" && (
              <div className="grid gap-4">
                {pastBookings?.map((booking) => {
                  const canCompleteAndPay =
                    booking.status === "accepted" ||
                    booking.status === "en_route";

                  return (
                    <motion.div
                      key={booking.id}
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        show: { opacity: 1, y: 0 },
                      }}
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <Card className="transition-shadow duration-200 ease-out hover:shadow-md">
                        <CardContent className="pt-6">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold">
                                  {booking.service.name}
                                </h3>
                                <Badge
                                  variant="outline"
                                  className={getBookingStatusBadgeClass(
                                    booking.status,
                                  )}
                                >
                                  {bookingStatusLabels[booking.status] ||
                                    booking.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                <CalendarIcon className="inline h-4 w-4 mr-1 align-text-bottom" />
                                {formatIndianDisplay(
                                  booking.bookingDate,
                                  "date",
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                <Clock className="inline h-4 w-4 mr-1 align-text-bottom" />
                                {booking.timeSlotLabel
                                  ? describeSlotLabel(booking.timeSlotLabel)
                                  : formatIndianDisplay(
                                      booking.bookingDate,
                                      "time",
                                    )}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LocationIcon className="h-4 w-4" />
                                <span>{getBookingLocationLabel(booking)}</span>
                              </div>
                              {booking.provider && (
                                <div className="mt-2 text-sm text-muted-foreground border-t pt-2">
                                  <p>
                                    <strong>{t("provider_label")}:</strong>{" "}
                                    {booking.provider.name}
                                  </p>
                                  <p>
                                    <strong>{t("phone_label")}:</strong>{" "}
                                    {booking.provider.phone}
                                  </p>
                                </div>
                              )}
                              {booking.status === "rejected" && (
                                <p className="mt-2 text-sm text-destructive">
                                  <strong>{t("reason")}:</strong>{" "}
                                  {booking.rejectionReason ||
                                    t("no_reason_provided")}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 md:justify-end">
                              {canCompleteAndPay && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      onClick={() => {
                                        setSelectedBooking(booking);
                                        setPaymentMethod("upi");
                                        setPaymentReference(
                                          booking.paymentReference || "",
                                        );
                                      }}
                                    >
                                      {t("booking_mark_complete_pay")}
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>
                                        {t("submit_payment_title")}
                                      </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 pt-4">
                                      <PaymentMethodSelector
                                        value={paymentMethod}
                                        onChange={setPaymentMethod}
                                      />
                                      {paymentMethod === "upi" ? (
                                        <>
                                          <div className="flex items-center gap-2">
                                            <p>
                                            {t("send_payment_to_upi")}{" "}
                                              <strong>
                                                {booking.provider?.upiId}
                                              </strong>
                                            </p>
                                            <Button
                                              type="button"
                                              size="sm"
                                              onClick={() =>
                                                handleCopyUpiId(
                                                  booking.provider?.upiId,
                                                )
                                              }
                                            >
                                              {t("copy")}
                                            </Button>
                                          </div>
                                          {booking.provider?.upiQrCodeUrl && (
                                            <img
                                              src={booking.provider.upiQrCodeUrl}
                                              alt="QR"
                                              className="h-32"
                                            />
                                          )}
                                          <Input
                                            placeholder={t(
                                              "transaction_reference_placeholder",
                                            )}
                                            value={paymentReference}
                                            onChange={(e) =>
                                              setPaymentReference(
                                                e.target.value,
                                              )
                                            }
                                          />
                                        </>
                                      ) : (
                                        <p>{t("cash_payment_note")}</p>
                                      )}
                                      <Button
                                        onClick={() =>
                                          paymentMutation.mutate({
                                            bookingId: booking.id,
                                            paymentReference:
                                              paymentMethod === "cash"
                                                ? "CASH"
                                                : paymentReference,
                                          })
                                        }
                                        className="w-full"
                                        disabled={
                                          paymentMethod === "upi" &&
                                          !paymentReference
                                        }
                                      >
                                        {paymentMutation.isPending && (
                                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        )}
                                        {t("submit_confirm_payment")}
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                              {booking.status === "awaiting_payment" && (
                                <>
                                  <p className="text-sm">
                                    {t("reference_label")}:{" "}
                                    {booking.paymentReference}
                                  </p>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedBooking(booking);
                                          setPaymentReference(
                                            booking.paymentReference || "",
                                          );
                                        }}
                                      >
                                        {t("edit_reference")}
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>
                                          {t("update_payment_reference_title")}
                                        </DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4 pt-4">
                                        <Input
                                          value={paymentReference}
                                          onChange={(e) =>
                                            setPaymentReference(
                                              e.target.value,
                                            )
                                          }
                                          placeholder={t(
                                            "transaction_reference_placeholder",
                                          )}
                                        />
                                        <Button
                                          onClick={() =>
                                            updateReferenceMutation.mutate({
                                              bookingId: booking.id,
                                              paymentReference,
                                            })
                                          }
                                          className="w-full"
                                        >
                                          {updateReferenceMutation.isPending && (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                          )}
                                          {t("save")}
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="destructive"
                                        onClick={() => {
                                          setSelectedBooking(booking);
                                        }}
                                      >
                                        {t("report_issue")}
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>{t("report_issue")}</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4 pt-4">
                                        <Textarea
                                          value={disputeReason}
                                          onChange={(e) =>
                                            setDisputeReason(e.target.value)
                                          }
                                          placeholder={t("issue_placeholder")}
                                        />
                                        <Button
                                          onClick={() =>
                                            disputeMutation.mutate({
                                              bookingId: booking.id,
                                              reason: disputeReason,
                                            })
                                          }
                                          className="w-full"
                                        >
                                          {disputeMutation.isPending && (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                          )}
                                          {t("submit")}
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </>
                              )}
                              {/* Review Button for Completed Bookings */}
                              {booking.status === "completed" && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      onClick={() => setSelectedBooking(booking)}
                                    >
                                      {customerReviews?.some(
                                        (r) => r.bookingId === booking.id,
                                      )
                                        ? t("edit_review")
                                        : t("leave_review")}
                                    </Button>
                                  </DialogTrigger>
                                  {/* The DialogContent is handled below, outside the map */}
                                </Dialog>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Review Dialog - Linked to the trigger in Past Bookings */}
        <Dialog
          open={!!selectedBooking && selectedBooking.status === "completed"}
          onOpenChange={(open) => !open && setSelectedBooking(undefined)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("review_title_with_service").replace(
                  "{service}",
                  selectedBooking?.service.name ?? "",
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>{t("your_rating")}</Label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Button
                      key={value}
                      variant="ghost"
                      size="sm"
                      className={`p-0 ${value <= rating ? "text-yellow-500" : "text-gray-300"}`}
                      onClick={() => setRating(value)}
                    >
                      <Star className="h-6 w-6 fill-current" />
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>{t("your_review")}</Label>
                <Textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder={t("review_placeholder")}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleReview}
                disabled={reviewMutation.isPending || !review} // Disable if submitting or no review text
              >
                {reviewMutation.isPending
                  ? t("submitting")
                  : userReview
                    ? t("update_review")
                    : t("submit_review")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </DashboardLayout>
  );
}
