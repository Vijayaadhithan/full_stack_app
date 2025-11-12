import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import MapLink from "@/components/location/MapLink";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { PaymentMethodType } from "@shared/schema";
import { PaymentMethodSelector } from "@/components/payment-method-selector";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Booking, Service, Review } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Star,
  Calendar as CalendarIcon,
  Clock,
  MapPin as LocationIcon,
  Loader2,
} from "lucide-react";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { formatIndianDisplay } from "@shared/date-utils";
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

type BookingStatusFilter = "all" | "pending" | "accepted" | "rejected";
type CustomerBookingStatus = Booking["status"];

const BOOKING_STATUS_FILTER_OPTIONS: {
  value: BookingStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

const BOOKING_STATUS_LABELS: Record<CustomerBookingStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  rescheduled: "Rescheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  rescheduled_pending_provider_approval: "Awaiting Provider Approval",
  awaiting_payment: "Awaiting Payment",
  disputed: "Disputed",
};

const BOOKING_STATUS_BADGE_CLASSES: Partial<
  Record<CustomerBookingStatus, string>
> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  rescheduled: "bg-violet-50 text-violet-700 border-violet-200",
  rescheduled_pending_provider_approval:
    "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-sky-50 text-sky-700 border-sky-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-300",
  awaiting_payment: "bg-blue-50 text-blue-700 border-blue-200",
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

  const handleCopyUpiId = async (upiId?: string | null) => {
    if (!upiId) {
      toast({
        title: "UPI ID unavailable",
        description: "This provider has not shared a UPI ID yet.",
        variant: "destructive",
      });
      return;
    }

    const notifySuccess = () => toast({ title: "UPI ID copied to clipboard" });
    const notifyManual = () =>
      toast({
        title: "Copy manually",
        description: "Clipboard access is blocked. Copy from the prompt shown.",
      });
    const notifyFailure = () =>
      toast({
        title: "Unable to copy UPI ID",
        description: "Please copy it manually.",
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
        window.prompt("Copy the UPI ID below", upiId);
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
    queryKey: ["/api/reviews/service/", selectedBooking?.serviceId],
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
      toast({
        title: "Booking cancelled",
        description: "Your booking has been cancelled successfully.",
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
      toast({
        title: "Reschedule Requested",
        description:
          "Your reschedule request has been sent to the provider for confirmation.",
      });
      setSelectedBooking(undefined); // Close dialog
      setNewRescheduleDateTime("");
      setRescheduleComments(""); // Reset comments
    },
    onError: (error: any) => {
      toast({
        title: "Reschedule Failed",
        description: error.message || "Could not reschedule booking.",
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
        title: userReview ? "Review updated" : "Review submitted",
        description: "Thank you for your feedback!",
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
        error.response?.data?.message ||
        "Failed to submit review. Please try again.";
      toast({
        title: "Submission Failed",
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
        throw new Error(body.message || "Failed to submit payment");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Payment submitted, awaiting provider confirmation" });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      setPaymentReference("");
      setPaymentMethod("upi");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
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
        throw new Error(body.message || "Failed to update reference");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Payment reference updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
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
        throw new Error(body.message || "Failed to report issue");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Issue reported" });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleCancel = (booking: BookingWithService) => {
    if (
      window.confirm(
        "Are you sure you want to cancel this booking? This action cannot be undone.",
      )
    ) {
      cancelMutation.mutate(booking.id);
    }
  };

  const handleReschedule = () => {
    if (!selectedBooking || !newRescheduleDateTime) return;

    // Basic validation for datetime-local input (e.g., not empty)
    // More sophisticated validation (e.g., ensuring it's in the future) can be added here or on the backend
    if (new Date(newRescheduleDateTime) <= new Date()) {
      toast({
        title: "Invalid Date/Time",
        description: "Please select a future date and time for rescheduling.",
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

  const upcomingBookings = bookingsData.filter(
    (b) =>
      b.status !== "cancelled" &&
      b.status !== "completed" &&
      isAfter(new Date(b.bookingDate), new Date()),
  );
  const pastBookings = bookingsData.filter(
    (b) =>
      b.status === "completed" ||
      isBefore(new Date(b.bookingDate), new Date()),
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
        <h1 className="text-2xl font-bold">My Bookings</h1>
        <Tabs defaultValue="upcoming">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as BookingStatusFilter)
              }
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {BOOKING_STATUS_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upcoming */}
          <TabsContent value="upcoming">
            <div className="grid gap-4">
              {upcomingBookings?.map((booking) => (
                <motion.div
                  key={booking.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0 },
                  }}
                >
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">
                              {booking.service.name}
                            </h3>
                            <Badge
                              variant="outline"
                              className={getBookingStatusBadgeClass(booking.status)}
                            >
                              {BOOKING_STATUS_LABELS[booking.status] || booking.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <CalendarIcon className="inline h-4 w-4 mr-1 align-text-bottom" />
                            {formatIndianDisplay(booking.bookingDate, "date")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            <Clock className="inline h-4 w-4 mr-1 align-text-bottom" />
                            {formatIndianDisplay(booking.bookingDate, "time")}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <LocationIcon className="h-4 w-4" />
                            <span>
                              {booking.serviceLocation === "customer"
                                ? "Service at Your Location"
                                : booking.provider?.addressStreet
                                  ? `Provider Location: ${booking.provider.addressStreet}, ${booking.provider.addressCity}`
                                  : "Service at Provider's Location"}
                            </span>
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
                                <strong>Provider:</strong>{" "}
                                {booking.provider.name}
                              </p>
                              <p>
                                <strong>Phone:</strong> {booking.provider.phone}
                              </p>
                            </div>
                          )}
                          {booking.status === "rejected" && (
                            <p className="mt-2 text-sm text-destructive">
                              <strong>Reason:</strong>{" "}
                              {booking.rejectionReason || "No reason provided"}
                            </p>
                          )}
                        </div>
                        <div className="space-x-2">
                          {booking.status === "accepted" && (
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
                                  Mark Service as Complete & Pay
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Submit Payment</DialogTitle>
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
                                          Send payment to UPI ID:{" "}
                                          <strong>{booking.provider?.upiId}</strong>
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
                                          Copy
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
                                        placeholder="Transaction reference"
                                        value={paymentReference}
                                        onChange={(e) =>
                                          setPaymentReference(e.target.value)
                                        }
                                      />
                                    </>
                                  ) : (
                                    <p>
                                      You chose to pay in cash directly to the provider.
                                    </p>
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
                                      paymentMethod === "upi" && !paymentReference
                                    }
                                  >
                                    {paymentMutation.isPending && (
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    )}
                                    Submit and Confirm Payment
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                          {booking.status === "awaiting_payment" && (
                            <>
                              <p className="text-sm">
                                Reference: {booking.paymentReference}
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
                                    Edit Reference
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>
                                      Update Payment Reference
                                    </DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 pt-4">
                                    <Input
                                      value={paymentReference}
                                      onChange={(e) =>
                                        setPaymentReference(e.target.value)
                                      }
                                      placeholder="Transaction reference"
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
                                      Save
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
                                    Report Issue
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Report Issue</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 pt-4">
                                    <Textarea
                                      value={disputeReason}
                                      onChange={(e) =>
                                        setDisputeReason(e.target.value)
                                      }
                                      placeholder="Describe the issue"
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
                                      Submit
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
                                    onClick={() => setSelectedBooking(booking)}
                                  >
                                    Reschedule
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>
                                      Reschedule Booking
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
                                        New Date and Time
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
                                        Reason for Rescheduling (Optional)
                                      </Label>
                                      <Textarea
                                        id="rescheduleComments"
                                        value={rescheduleComments}
                                        onChange={(e) =>
                                          setRescheduleComments(e.target.value)
                                        }
                                        placeholder="Enter any comments for the provider..."
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
                                        ? "Confirming..."
                                        : "Confirm Reschedule"}
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <Button
                                variant="destructive"
                                onClick={() => handleCancel(booking)}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* Past */}
          <TabsContent value="past">
            <div className="grid gap-4">
              {pastBookings?.map((booking) => (
                <motion.div
                  key={booking.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0 },
                  }}
                >
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">
                              {booking.service.name}
                            </h3>
                            <Badge
                              variant="outline"
                              className={getBookingStatusBadgeClass(booking.status)}
                            >
                              {BOOKING_STATUS_LABELS[booking.status] || booking.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <CalendarIcon className="inline h-4 w-4 mr-1 align-text-bottom" />
                            {formatIndianDisplay(booking.bookingDate, "date")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            <Clock className="inline h-4 w-4 mr-1 align-text-bottom" />
                            {formatIndianDisplay(booking.bookingDate, "time")}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <LocationIcon className="h-4 w-4" />
                            <span>
                              {booking.serviceLocation === "customer"
                                ? "Service at Your Location"
                                : booking.provider?.addressStreet
                                  ? `Provider Location: ${booking.provider.addressStreet}, ${booking.provider.addressCity}`
                                  : "Service at Provider's Location"}
                            </span>
                          </div>
                          {booking.provider && (
                            <div className="mt-2 text-sm text-muted-foreground border-t pt-2">
                              <p>
                                <strong>Provider:</strong>{" "}
                                {booking.provider.name}
                              </p>
                              <p>
                                <strong>Phone:</strong> {booking.provider.phone}
                              </p>
                            </div>
                          )}
                          {booking.status === "rejected" && (
                            <p className="mt-2 text-sm text-destructive">
                              <strong>Reason:</strong>{" "}
                              {booking.rejectionReason || "No reason provided"}
                            </p>
                          )}
                        </div>
                        <div className="space-x-2">
                          {booking.status === "accepted" && (
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
                                  Mark Service as Complete & Pay
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Submit Payment</DialogTitle>
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
                                          Send payment to UPI ID:{" "}
                                          <strong>{booking.provider?.upiId}</strong>
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
                                          Copy
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
                                        placeholder="Transaction reference"
                                        value={paymentReference}
                                        onChange={(e) =>
                                          setPaymentReference(e.target.value)
                                        }
                                      />
                                    </>
                                  ) : (
                                    <p>
                                      You chose to pay in cash directly to the provider.
                                    </p>
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
                                      paymentMethod === "upi" && !paymentReference
                                    }
                                  >
                                    {paymentMutation.isPending && (
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    )}
                                    Submit and Confirm Payment
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                          {booking.status === "awaiting_payment" && (
                            <>
                              <p className="text-sm">
                                Reference: {booking.paymentReference}
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
                                    Edit Reference
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>
                                      Update Payment Reference
                                    </DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 pt-4">
                                    <Input
                                      value={paymentReference}
                                      onChange={(e) =>
                                        setPaymentReference(e.target.value)
                                      }
                                      placeholder="Transaction reference"
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
                                      Save
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
                                    Report Issue
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Report Issue</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 pt-4">
                                    <Textarea
                                      value={disputeReason}
                                      onChange={(e) =>
                                        setDisputeReason(e.target.value)
                                      }
                                      placeholder="Describe the issue"
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
                                      Submit
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
                                    ? "Edit Review"
                                    : "Leave Review"}
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
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Review Dialog - Linked to the trigger in Past Bookings */}
        <Dialog
          open={!!selectedBooking && selectedBooking.status === "completed"}
          onOpenChange={(open) => !open && setSelectedBooking(undefined)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Leave a Review for {selectedBooking?.service.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Rating</Label>
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
                <Label>Review</Label>
                <Textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Share your experience..."
                />
              </div>
              <Button
                className="w-full"
                onClick={handleReview}
                disabled={reviewMutation.isPending || !review} // Disable if submitting or no review text
              >
                {reviewMutation.isPending
                  ? "Submitting..."
                  : userReview
                    ? "Update Review"
                    : "Submit Review"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </DashboardLayout>
  );
}
