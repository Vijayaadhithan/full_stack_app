import React from 'react';
import { PageHeader } from "@/components/common/page-header";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import MapLink from "@/components/location/MapLink";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Check,
  X,
  Calendar,
  Clock,
  User as UserIcon,
  AlertCircle,
  Navigation,
} from "lucide-react"; // Import UserIcon
import { MapPin as LocationIcon } from "lucide-react"; // Use a different alias for MapPin
import { Booking, Service, User } from "@shared/schema"; // Import User type
import { z } from "zod";
import { useState, useEffect, useMemo } from "react";
import { formatIndianDisplay } from "@shared/date-utils"; // Import IST utility
import { formatBookingTimeLabel } from "@/lib/time-slots";

const bookingActionSchema = z.object({
  status: z.enum(["accepted", "rejected", "rescheduled", "completed"]),
  comments: z.string().min(1, "Please provide a reason or comment"),
  rescheduleDate: z.string().optional(),
});

type BookingActionData = z.infer<typeof bookingActionSchema>;

type BookingProximityInfo = {
  nearestBookingId: number;
  nearestBookingDate: string | null;
  distanceKm: number;
  message: string;
};

type AddressLike = {
  addressStreet?: string | null;
  addressLandmark?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostalCode?: string | null;
  addressCountry?: string | null;
} | null;

type AddressFormatOptions = {
  includeLandmark?: boolean;
};

const formatAddressSegments = (
  source: AddressLike,
  options: AddressFormatOptions = {},
): string[] => {
  if (!source) return [];

  const segments: string[] = [];
  const includeLandmark = options.includeLandmark !== false;

  const pushIfPresent = (value?: string | null) => {
    if (value && value.trim()) {
      segments.push(value.trim());
    }
  };

  pushIfPresent(source.addressStreet);
  if (includeLandmark && source.addressLandmark && source.addressLandmark.trim()) {
    segments.unshift(`Landmark: ${source.addressLandmark.trim()}`);
  }
  pushIfPresent(source.addressCity);

  const stateAndPostal = [source.addressState, source.addressPostalCode]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");

  if (stateAndPostal) {
    segments.push(stateAndPostal);
  }

  pushIfPresent(source.addressCountry);

  return segments;
};

const formatCustomerAddress = (
  customer: AddressLike,
  fallback: AddressLike,
  options: AddressFormatOptions = {},
): string => {
  const customerSegments = formatAddressSegments(customer, options);
  if (customerSegments.length > 0) {
    return customerSegments.join(", ");
  }

  const fallbackSegments = formatAddressSegments(fallback, options);
  return fallbackSegments.join(", ");
};

export default function ProviderBookings() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  // Get status from URL query parameter
  const [searchParams] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  });
  const statusFromUrl = searchParams.get("status");

  const [selectedStatus, setSelectedStatus] = useState<string>(
    statusFromUrl || "all",
  );
  const [dateFilter, setDateFilter] = useState<string>("");
  const [actionType, setActionType] = useState<
    "accept" | "reject" | "reschedule" | "complete" | null
  >(null);
  const [selectedBooking, setSelectedBooking] =
    useState<BookingWithDetails | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  // Fetch all bookings including accepted ones
  const { data: bookings, isLoading } = useQuery<BookingWithDetails[]>({
    // Use BookingWithDetails
    queryKey: ["/api/bookings/provider"],
    enabled: !!user?.id,
  });

  // Update the selected status when the URL changes
  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const status = params.get("status");
      if (status) {
        setSelectedStatus(status);
      }
    }
  }, []);

  // Set the initial status filter based on URL parameter when component mounts
  useEffect(() => {
    if (statusFromUrl) {
      setSelectedStatus(statusFromUrl);
    }
  }, [statusFromUrl]);

  const form = useForm<BookingActionData>({
    resolver: zodResolver(bookingActionSchema),
    defaultValues: {
      comments: "",
      status: "accepted", // Set a default status
    },
  });

  // Reset form when action type changes
  useEffect(() => {
    if (actionType) {
      form.reset({
        comments: "",
        status:
          actionType === "accept"
            ? "accepted"
            : actionType === "reject"
              ? "rejected"
              : actionType === "reschedule"
                ? "rescheduled"
                : "completed",
        rescheduleDate:
          actionType === "reschedule"
            ? new Date().toISOString().slice(0, 16)
            : undefined,
      });
    }
  }, [actionType, form]);

  const updateBookingMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: BookingActionData;
    }) => {
      let endpoint = `/api/bookings/${id}/status`;
      let payload: any = {
        status: data.status,
      };

      if (data.status === "completed") {
        endpoint = `/api/bookings/${id}/provider-complete`;
        payload = { comments: data.comments }; // Payload for provider-complete
      } else {
        if (data.status === "rejected" && data.comments) {
          payload.rejectionReason = data.comments;
        }
        if (data.status === "rescheduled" && data.rescheduleDate) {
          const rescheduleDate = new Date(data.rescheduleDate);
          if (Number.isNaN(rescheduleDate.getTime())) {
            throw new Error("Please provide a valid reschedule date and time.");
          }
          payload.rescheduleDate = rescheduleDate.toISOString();
          if (data.comments) {
            payload.rescheduleReason = data.comments;
          }
        }
      }

      const res = await apiRequest("PATCH", endpoint, payload);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update booking status");
      }
      const updatedBookingData = await res.json();
      return { responseData: updatedBookingData, inputData: data };
    },
    onSuccess: async (result) => {
      // result is { responseData: { booking: updatedBookingData, message: string }, inputData: data }
      const { responseData, inputData } = result;
      const updatedBooking = responseData.booking; // Access the nested booking object

      // Existing success logic
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Success",
        description: `Booking status updated to ${updatedBooking.status}`,
      });
      form.reset();
      setActionType(null);
      setSelectedBooking(null);

    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  const confirmPaymentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(
        "PATCH",
        `/api/bookings/${id}/provider-complete`,
      );
      if (!res.ok) throw new Error("Failed to confirm payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
      toast({ title: "Booking completed" });
    },
  });

  const startJobMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/bookings/${id}/en-route`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to start the job");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "On the way",
        description: "Customer has been notified that you're en route.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not start trip",
        description: error.message,
        variant: "destructive",
      });
    },
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
      if (!res.ok) throw new Error("Failed to report issue");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Issue reported" });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filteredBookings = bookings?.filter((booking) => {
    if (selectedStatus !== "all" && booking.status !== selectedStatus)
      return false;
    if (dateFilter) {
      const bookingDate = new Date(booking.bookingDate).toLocaleDateString();
      const filterDate = new Date(dateFilter).toLocaleDateString();
      if (bookingDate !== filterDate) return false;
    }
    return true;
  });

  const statusOptions = useMemo(
    () => [
      { value: "all", label: t("all") },
      { value: "pending", label: t("pending") },
      { value: "accepted", label: t("accepted") },
      { value: "en_route", label: t("en_route") },
      { value: "awaiting_payment", label: t("awaiting_payment") },
      { value: "rescheduled", label: t("rescheduled") },
      { value: "rescheduled_by_provider", label: t("rescheduled_by_provider") },
      {
        value: "rescheduled_pending_provider_approval",
        label: t("rescheduled_pending_provider_approval"),
      },
      { value: "rejected", label: t("rejected") },
      { value: "completed", label: t("completed") },
    ],
    [t],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings?.forEach((booking) => {
      counts[booking.status] = (counts[booking.status] ?? 0) + 1;
    });
    return counts;
  }, [bookings]);

  const totalBookings = bookings?.length ?? 0;
  const filteredCount = filteredBookings?.length ?? 0;
  const activeStatusLabel =
    statusOptions.find((option) => option.value === selectedStatus)?.label ??
    t("all");
  const dateFilterLabel = dateFilter
    ? formatIndianDisplay(new Date(dateFilter), "date")
    : null;

  const clearFilters = () => {
    setSelectedStatus("all");
    setDateFilter("");
  };

  const handleAction = (data: BookingActionData) => {
    if (!selectedBooking) return;

    // Set the correct status based on action type
    const status =
      actionType === "accept"
        ? "accepted"
        : actionType === "reject"
          ? "rejected"
          : actionType === "reschedule"
            ? "rescheduled"
            : "completed";

    // Ensure we have all required data
    const payload = {
      id: selectedBooking.id,
      data: {
        ...data,
        status,
        // For reschedule, ensure we have a date
        ...(status === "rescheduled" &&
          !data.rescheduleDate && {
          rescheduleDate: new Date().toISOString(),
        }),
        // For rejection, ensure we have a reason
        ...(status === "rejected" && {
          rejectionReason: data.comments,
        }),
      },
    };

    // Execute the mutation
    updateBookingMutation.mutate({
      id: payload.id,
      data: {
        status: payload.data.status as
          | "accepted"
          | "rejected"
          | "rescheduled"
          | "completed",
        comments: payload.data.comments,
        rescheduleDate: payload.data.rescheduleDate,
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={t("provider_bookings_title")}
          subtitle={t("provider_bookings_subtitle")}
          showBackButton={true}
          backDestination="/provider"
        >
          <Badge variant="secondary" className="w-fit">
            {t("bookings_showing_count").replace(
              "{count}",
              String(filteredCount),
            )}
          </Badge>
        </PageHeader>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t("booking_filters_title")}
                </CardTitle>
                <CardDescription>
                  {t("booking_filters_subtitle")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {t("booking_filters_date")}
                  </p>
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {t("booking_filters_status")}
                  </p>
                  <div className="space-y-2">
                    {statusOptions.map((option) => {
                      const count =
                        option.value === "all"
                          ? totalBookings
                          : statusCounts[option.value] ?? 0;
                      const isActive = selectedStatus === option.value;
                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant={isActive ? "default" : "outline"}
                          onClick={() => setSelectedStatus(option.value)}
                          className="w-full justify-between text-sm"
                        >
                          <span>{option.label}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${isActive
                                ? "bg-white/20 text-white"
                                : "bg-muted text-muted-foreground"
                              }`}
                          >
                            {count}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={clearFilters}
                >
                  {t("clear_filters")}
                </Button>
              </CardContent>
            </Card>
          </aside>

          <div className="space-y-4">
            {(selectedStatus !== "all" || dateFilterLabel) && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{t("filters_active_label")}</span>
                <Badge variant="outline">{activeStatusLabel}</Badge>
                {dateFilterLabel && (
                  <Badge variant="outline">{dateFilterLabel}</Badge>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : !filteredBookings?.length ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    {t("no_bookings_found")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredBookings.map((booking) => {
                  const customerLandmark =
                    booking.customer?.addressLandmark?.trim() ||
                    booking.relevantAddress?.addressLandmark?.trim() ||
                    null;
                  const formattedCustomerAddress = formatCustomerAddress(
                    booking.customer ?? null,
                    booking.relevantAddress ?? null,
                    { includeLandmark: false },
                  );

                  return (
                    <Card
                      key={booking.id}
                      className={
                        booking.status === "awaiting_payment"
                          ? "border-yellow-500 bg-yellow-50"
                          : ""
                      }
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">
                                {booking.service.name}
                              </h3>
                              <Badge
                                variant="outline"
                                className={`text-xs font-bold uppercase tracking-wide ${booking.status === "pending"
                                    ? "animate-pulse border-yellow-500 bg-yellow-300 text-black"
                                    : booking.status === "accepted"
                                      ? "border-green-700 bg-green-600 text-white"
                                      : booking.status === "rejected"
                                        ? "border-red-700 bg-red-600 text-white"
                                        : booking.status === "rescheduled"
                                          ? "border-amber-700 bg-amber-500 text-white"
                                          : booking.status ===
                                            "awaiting_payment"
                                            ? "border-yellow-400 bg-yellow-200 text-black"
                                            : booking.status === "en_route"
                                              ? "border-blue-700 bg-blue-600 text-white"
                                              : booking.status === "completed"
                                                ? "border-slate-700 bg-slate-700 text-white"
                                                : "border-gray-300 bg-gray-100 text-gray-900"
                                  }`}
                              >
                                {t(booking.status)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {formatIndianDisplay(
                                booking.bookingDate,
                                "date",
                              )}
                              <Clock className="h-4 w-4 ml-2" />
                              {formatBookingTimeLabel(
                                booking.bookingDate,
                                booking.timeSlotLabel,
                              )}
                              <span className="ml-2">
                                ({booking.service.duration} mins)
                              </span>
                            </div>
                            {/* Display Service Location */}
                            <div className="flex items-start gap-2 text-sm text-muted-foreground">
                              <LocationIcon className="h-4 w-4 mt-1 flex-shrink-0" />
                              <div>
                                {booking.serviceLocation === "customer" ? (
                                  <>
                                    <span>
                                      {t("service_at_customer_location")}
                                    </span>
                                    <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">
                                        {t("landmark_title")}
                                      </p>
                                      <p className="text-xl font-extrabold text-blue-950">
                                        {customerLandmark || t("not_provided")}
                                      </p>
                                    </div>
                                    {booking.customer ? (
                                      formattedCustomerAddress ? (
                                        <p className="font-medium">
                                          {formattedCustomerAddress}
                                        </p>
                                      ) : customerLandmark ? null : (
                                        <p className="font-medium text-muted-foreground">
                                          {t("customer_address_not_provided")}
                                        </p>
                                      )
                                    ) : (
                                      <p className="font-medium text-muted-foreground">
                                        ({t("customer_address_not_available")})
                                      </p>
                                    )}
                                    <MapLink
                                      latitude={booking.customer?.latitude}
                                      longitude={booking.customer?.longitude}
                                      className="mt-1"
                                    />
                                  </>
                                ) : (
                                  <span>
                                    {booking.providerAddress
                                      ? `${t("service_at_provider_location")}: ${booking.providerAddress}`
                                      : t("service_at_provider_location")}
                                  </span>
                                )}
                              </div>
                            </div>
                            {booking.proximityInfo && (
                              <div className="mt-2 flex items-center text-xs text-blue-700">
                                <AlertCircle className="h-4 w-4 mr-1" />
                                <span>{booking.proximityInfo.message}</span>
                              </div>
                            )}
                            {/* Display Customer Information (Name and Phone) */}
                            {booking.customer && (
                              <div className="mt-2 text-sm text-muted-foreground border-t pt-2">
                                <p className="flex items-center">
                                  <UserIcon className="h-4 w-4 mr-1" />{" "}
                                  <strong>{t("customer")}:</strong>{" "}
                                  {booking.customer.name}
                                </p>
                                <p>
                                  <strong>{t("phone")}:</strong>{" "}
                                  {booking.customer.phone}
                                </p>{" "}
                                {/* Keep phone here for all cases */}
                                {/* Address is now shown in the location section if applicable */}
                              </div>
                            )}
                            {booking.status === "rescheduled" &&
                              booking.rescheduleDate && (
                                <div className="text-sm text-yellow-600">
                                  {t("reschedule_date")}:{" "}
                                  {formatIndianDisplay(
                                    booking.rescheduleDate,
                                    "datetime",
                                  )}
                                </div>
                              )}
                            {booking.status === "rejected" &&
                              booking.rejectionReason && (
                                <div className="text-sm text-red-600">
                                  {t("reason_for_rejection")}:{" "}
                                  {booking.rejectionReason}
                                </div>
                              )}
                          </div>

                          {(booking.status === "pending" ||
                            booking.status ===
                            "rescheduled_pending_provider_approval") && (
                              <div className="flex gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className="text-green-600"
                                      onClick={() => {
                                        setActionType("accept");
                                        setSelectedBooking(booking);
                                      }}
                                    >
                                      <Check className="h-4 w-4 mr-2" />
                                      {t("accept")}
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>{t("accept_booking")}</DialogTitle>
                                    </DialogHeader>
                                    <Form {...form}>
                                      <form
                                        onSubmit={form.handleSubmit(handleAction)}
                                        className="space-y-4"
                                      >
                                        <FormField
                                          control={form.control}
                                          name="comments"
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>
                                                {t("additional_instructions")}
                                              </FormLabel>
                                              <FormControl>
                                                <Textarea
                                                  {...field}
                                                  placeholder={t(
                                                    "add_any_instructions_for_the_customer",
                                                  )}
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                        <Button type="submit" className="w-full">
                                          {t("accept_booking")}
                                        </Button>
                                      </form>
                                    </Form>
                                  </DialogContent>
                                </Dialog>

                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className="text-red-600"
                                      onClick={() => {
                                        setActionType("reject");
                                        setSelectedBooking(booking);
                                      }}
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      {t("reject")}
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>{t("reject_booking")}</DialogTitle>
                                    </DialogHeader>
                                    <Form {...form}>
                                      <form
                                        onSubmit={form.handleSubmit(handleAction)}
                                        className="space-y-4"
                                      >
                                        <FormField
                                          control={form.control}
                                          name="comments"
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>
                                                {t("reason_for_rejection")}
                                              </FormLabel>
                                              <FormControl>
                                                <Textarea
                                                  {...field}
                                                  placeholder={t(
                                                    "please_provide_a_reason_for_rejecting_this_booking",
                                                  )}
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                        <Button
                                          type="submit"
                                          variant="destructive"
                                          className="w-full"
                                        >
                                          {t("reject_booking")}
                                        </Button>
                                      </form>
                                    </Form>
                                  </DialogContent>
                                </Dialog>

                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setActionType("reschedule");
                                        setSelectedBooking(booking);
                                      }}
                                    >
                                      <Calendar className="h-4 w-4 mr-2" />
                                      {t("reschedule")}
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>
                                        {t("reschedule_booking")}
                                      </DialogTitle>
                                    </DialogHeader>
                                    <Form {...form}>
                                      <form
                                        onSubmit={form.handleSubmit(handleAction)}
                                        className="space-y-4"
                                      >
                                        <FormField
                                          control={form.control}
                                          name="rescheduleDate"
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>
                                                {t("new_date_and_time")}
                                              </FormLabel>
                                              <FormControl>
                                                <Input
                                                  type="datetime-local"
                                                  {...field}
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                        <FormField
                                          control={form.control}
                                          name="comments"
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>
                                                {t("reason_for_rescheduling")}
                                              </FormLabel>
                                              <FormControl>
                                                <Textarea
                                                  {...field}
                                                  placeholder={t(
                                                    "please_provide_a_reason_for_rescheduling",
                                                  )}
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                        <Button type="submit" className="w-full">
                                          {t("confirm_reschedule")}
                                        </Button>
                                      </form>
                                    </Form>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            )}

                          {(booking.status === "accepted" ||
                            booking.status === "rescheduled" ||
                            booking.status === "rescheduled_by_provider") && (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  className="text-blue-600"
                                  onClick={() => startJobMutation.mutate(booking.id)}
                                  disabled={startJobMutation.isPending}
                                >
                                  {startJobMutation.isPending && (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  )}
                                  <Navigation className="h-4 w-4 mr-2" />
                                  {t("start_job")}
                                </Button>
                              </div>
                            )}

                          {booking.status === "en_route" && (
                            <div className="flex items-center gap-2 text-blue-700">
                              <Navigation className="h-4 w-4" />
                              <span>{t("on_the_way_to_customer")}</span>
                            </div>
                          )}

                          {(booking.status === "accepted" ||
                            booking.status === "en_route") && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="text-green-600"
                                    onClick={() => {
                                      setActionType("complete");
                                      setSelectedBooking(booking);
                                    }}
                                  >
                                    <Check className="h-4 w-4 mr-2" />
                                    {t("complete_service")}
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>{t("complete_service")}</DialogTitle>
                                  </DialogHeader>
                                  <Form {...form}>
                                    <form
                                      onSubmit={form.handleSubmit(handleAction)}
                                      className="space-y-4"
                                    >
                                      <FormField
                                        control={form.control}
                                        name="comments"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>{t("service_notes")}</FormLabel>
                                            <FormControl>
                                              <Textarea
                                                {...field}
                                                placeholder={t(
                                                  "add_any_notes_about_the_completed_service",
                                                )}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <Button type="submit" className="w-full">
                                        {t("mark_as_complete")}
                                      </Button>
                                    </form>
                                  </Form>
                                </DialogContent>
                              </Dialog>
                            )}
                          {booking.status === "awaiting_payment" && (
                            <div className="space-x-2">
                              <p className="text-sm">
                                {t("reference_label")}: {booking.paymentReference}
                              </p>
                              <Button
                                variant="outline"
                                className="text-blue-600"
                                onClick={() =>
                                  confirmPaymentMutation.mutate(booking.id)
                                }
                              >
                                {confirmPaymentMutation.isPending && (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                )}
                                {t("confirm_payment_complete")}
                              </Button>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    onClick={() => setSelectedBooking(booking)}
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
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Update Booking type to include customer details
type BookingWithDetails = Booking & {
  service: Service;
  customer?: User | null; // Add customer details
  relevantAddress?: {
    addressStreet?: string | null;
    addressLandmark?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressPostalCode?: string | null;
    addressCountry?: string | null;
  } | null;
  proximityInfo?: BookingProximityInfo | null;
};
