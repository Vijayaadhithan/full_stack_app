import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { featureFlags, platformFees } from "@shared/config";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import {
  Loader2,
  MapPin,
  Clock,
  Star,
  AlertCircle,
  Sun,
  Navigation,
  MessageCircle,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react"; // Add useMemo
import {
  format as formatBase,
  format,
  addDays,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz"; // Import date-fns-tz functions

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import MapLink from "@/components/location/MapLink";
// Remove Input import if no longer needed elsewhere
// import { Input } from "@/components/ui/input";
import { ServiceDetail } from "@shared/api-contract";
import { apiClient } from "@/lib/apiClient";
import { ToastAction } from "@/components/ui/toast";
import { getVerificationError, parseApiError } from "@/lib/api-error";
import { useLanguage } from "@/contexts/language-context";

const timeZone = "Asia/Kolkata"; // Define IST timezone
const GPS_WEAK_ACCURACY_METERS = 150;

type BroadSlotLabel = "morning" | "afternoon" | "evening";

type BookingUrgency = "now" | "today" | "tomorrow";


const SLOT_OPTIONS: Array<{
  label: BroadSlotLabel;
  title: string;
  window: string;
  startHour: number;
  endHour: number;
}> = [
    {
      label: "morning",
      title: "Morning",
      window: "9 AM - 12 PM",
      startHour: 9,
      endHour: 12,
    },
    {
      label: "afternoon",
      title: "Afternoon",
      window: "12 PM - 4 PM",
      startHour: 12,
      endHour: 16,
    },
    {
      label: "evening",
      title: "Evening",
      window: "4 PM - 8 PM",
      startHour: 16,
      endHour: 20,
    },
  ];

const getSlotStartForDate = (
  date: Date,
  slotLabel: BroadSlotLabel,
): Date | null => {
  const slot = SLOT_OPTIONS.find((option) => option.label === slotLabel);
  if (!slot) return null;

  const zoned = toZonedTime(date, timeZone);
  const slotStart = new Date(zoned);
  slotStart.setHours(slot.startHour, 0, 0, 0);
  return fromZonedTime(slotStart, timeZone);
};

const buildGoogleMapsSearchHref = (query: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const buildWhatsAppShareHref = (
  phone: string | null | undefined,
  message: string,
): string => {
  const digits = (phone ?? "").replace(/\D/g, "");
  const target =
    digits.length === 10 ? `91${digits}` : digits.length >= 11 ? digits : null;
  const encoded = encodeURIComponent(message);
  return target
    ? `https://wa.me/${target}?text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;
};

export default function BookService() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const platformFee = featureFlags.platformFeesEnabled ? platformFees.serviceBooking : 0;
  const [selectedUrgency, setSelectedUrgency] = useState<BookingUrgency | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const initial = new Date();
    initial.setHours(0, 0, 0, 0);
    return initial;
  }); // Represents the *day* selected, time part is ignored
  const [serviceLocation, setServiceLocation] = useState<
    "customer" | "provider"
  >("provider"); // Default to provider location
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<"confirm" | "sent">("confirm");
  const [lastBookingId, setLastBookingId] = useState<number | null>(null);
  const [bookingLandmark, setBookingLandmark] = useState("");
  const [isCapturingDeviceLocation, setIsCapturingDeviceLocation] =
    useState(false);
  const [lastGpsAccuracyMeters, setLastGpsAccuracyMeters] = useState<
    number | null
  >(null);

  const urgencyOptions = useMemo(
    () => [
      {
        label: "now" as const,
        title: t("urgency_now_title"),
        description: t("urgency_now_desc"),
      },
      {
        label: "today" as const,
        title: t("urgency_today_title"),
        description: t("urgency_today_desc"),
      },
      {
        label: "tomorrow" as const,
        title: t("urgency_tomorrow_title"),
        description: t("urgency_tomorrow_desc"),
      },
    ],
    [t],
  );

  type BookingService = ServiceDetail & {
    isAvailableNow?: boolean | null;
    availabilityNote?: string | null;
    allowedSlots?: BroadSlotLabel[] | null;
  };
  // Fetch service with provider info
  const { data: service, isLoading: serviceLoading } = useQuery<BookingService>({
    queryKey: [`/api/services/${id}`],
    queryFn: async () => {
      const raw = await apiClient.get("/api/services/:id", {
        params: { id: Number(id) },
      });
      const allowed =
        Array.isArray((raw as any).allowedSlots) && (raw as any).allowedSlots.length > 0
          ? (raw as any).allowedSlots.filter((s: string): s is BroadSlotLabel =>
            SLOT_OPTIONS.some((opt) => opt.label === s),
          )
          : null;
      return {
        ...(raw as BookingService),
        allowedSlots: allowed,
      };
    },
    enabled: !!id,
  });

  // Log service data when it changes
  useEffect(() => {
    if (service) {
      console.log("Service data loaded:", {
        id: service.id,
        name: service.name,
        isAvailableNow: (service as any)?.isAvailableNow,
      });
    }
  }, [service]);

  type BookedSlot = {
    timeSlotLabel: BroadSlotLabel | null;
    start?: Date | null;
    end?: Date | null;
  };

  // Fetch existing bookings for the selected date and service
  const { data: bookedSlots, isLoading: bookingsLoading } = useQuery<
    BookedSlot[]
  >({
    queryKey: [
      "/api/bookings/service",
      id,
      formatBase(selectedDate, "yyyy-MM-dd"),
    ], // Use ISO date string for consistent cache key
    queryFn: async () => {
      const dateStr = formatBase(selectedDate, "yyyy-MM-dd");
      const res = await apiRequest(
        "GET",
        `/api/bookings/service/${id}?date=${dateStr}`,
      );
      if (!res.ok) throw new Error("Failed to fetch existing bookings");
      const bookingsData = await res.json();

      return (bookingsData || []).map((booking: any) => ({
        timeSlotLabel: booking.timeSlotLabel ?? null,
        start: booking.start ? new Date(booking.start) : null,
        end: booking.end ? new Date(booking.end) : null,
      }));
    },
    enabled: !!id && !!service, // Enable when service is loaded
  });

  const effectiveMaxDailyBookings = useMemo(() => {
    const raw = service?.maxDailyBookings ?? null;
    return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 5;
  }, [service?.maxDailyBookings]);

  const perSlotCapacity = useMemo(() => {
    const allowed =
      (service?.allowedSlots as BroadSlotLabel[] | undefined | null) ??
      SLOT_OPTIONS.map((s) => s.label);
    const allowedCount = allowed.length > 0 ? allowed.length : SLOT_OPTIONS.length;
    return Math.max(1, Math.ceil(effectiveMaxDailyBookings / allowedCount));
  }, [effectiveMaxDailyBookings, service?.allowedSlots]);

  const bookedSlotCounts = useMemo(() => {
    const base = new Map<BroadSlotLabel, number>();
    for (const slot of SLOT_OPTIONS) {
      base.set(slot.label, 0);
    }

    const slots = bookedSlots ?? [];
    const unlabeledCount = slots.filter((slot) => !slot.timeSlotLabel).length;

    for (const slot of slots) {
      if (slot.timeSlotLabel) {
        base.set(
          slot.timeSlotLabel,
          (base.get(slot.timeSlotLabel) ?? 0) + 1,
        );
      }
    }

    for (const slot of SLOT_OPTIONS) {
      const label = slot.label;
      base.set(label, (base.get(label) ?? 0) + unlabeledCount);
    }

    return base;
  }, [bookedSlots]);

  useEffect(() => {
    setBookingLandmark(user?.addressLandmark ?? "");
  }, [user?.addressLandmark]);

  const providerName = service?.provider?.name ?? t("provider_label");
  const providerFullAddress = useMemo(() => {
    return [
      service?.provider?.addressStreet,
      service?.provider?.addressCity,
      service?.provider?.addressState,
      service?.provider?.addressPostalCode,
      service?.provider?.addressCountry,
    ]
      .filter(Boolean)
      .join(", ");
  }, [
    service?.provider?.addressStreet,
    service?.provider?.addressCity,
    service?.provider?.addressState,
    service?.provider?.addressPostalCode,
    service?.provider?.addressCountry,
  ]);

  const providerOnline =
    (service?.isAvailableNow ?? true) && (service?.isAvailable ?? true);
  const dailyLimitReached =
    (bookedSlots?.length ?? 0) >= effectiveMaxDailyBookings;
  const allowedSlotSet = useMemo(() => {
    const allowed =
      (service?.allowedSlots as BroadSlotLabel[] | undefined | null) ??
      SLOT_OPTIONS.map((s) => s.label);
    return new Set(allowed);
  }, [service?.allowedSlots]);
  const resolvedSlotLabel = useMemo((): BroadSlotLabel | null => {
    if (!selectedUrgency) return null;
    if (!providerOnline || dailyLimitReached) return null;

    const labels = SLOT_OPTIONS.map((slot) => slot.label);
    const now = toZonedTime(new Date(), timeZone);
    const hour = now.getHours();
    const startIndex = hour >= 16 ? 2 : hour >= 12 ? 1 : 0;

    const candidateLabels =
      selectedUrgency === "tomorrow"
        ? labels
        : selectedUrgency === "now"
          ? labels.slice(startIndex)
          : [...labels.slice(startIndex), ...labels.slice(0, startIndex)];

    for (const label of candidateLabels) {
      if (!allowedSlotSet.has(label)) continue;
      const countForLabel = bookedSlotCounts.get(label) ?? 0;
      if (countForLabel >= perSlotCapacity) continue;
      return label;
    }

    return null;
  }, [
    allowedSlotSet,
    bookedSlotCounts,
    dailyLimitReached,
    perSlotCapacity,
    providerOnline,
    selectedUrgency,
  ]);
  const resolvedSlotStart = resolvedSlotLabel
    ? getSlotStartForDate(selectedDate, resolvedSlotLabel)
    : null;
  const providerHasCoords =
    service?.provider?.latitude != null && service?.provider?.longitude != null;
  const providerMapsHref = providerHasCoords
    ? null
    : providerFullAddress
      ? buildGoogleMapsSearchHref(providerFullAddress)
      : null;
  const providerMapsUrl =
    service?.provider?.latitude != null && service?.provider?.longitude != null
      ? `https://www.google.com/maps?q=${service.provider.latitude},${service.provider.longitude}`
      : null;
  const customerMapsUrl =
    user?.latitude != null && user?.longitude != null
      ? `https://www.google.com/maps?q=${user.latitude},${user.longitude}`
      : null;
  const whatsappShareHref = useMemo(() => {
    if (!service) return null;

    const urgencyLabel =
      selectedUrgency === "now"
        ? t("urgency_now_whatsapp")
        : selectedUrgency === "today"
          ? t("urgency_today_whatsapp")
          : selectedUrgency === "tomorrow"
            ? t("urgency_tomorrow_whatsapp")
            : null;

    const parts = [
      t("whatsapp_booking_request").replace("{service}", service.name),
      urgencyLabel
        ? t("whatsapp_when_label").replace("{when}", urgencyLabel)
        : null,
      t("whatsapp_preferred_day").replace(
        "{date}",
        formatBase(selectedDate, "PPP"),
      ),
      t("whatsapp_service_location").replace(
        "{location}",
        serviceLocation === "customer"
          ? t("whatsapp_location_customer")
          : t("whatsapp_location_provider"),
      ),
      serviceLocation === "customer" && bookingLandmark.trim()
        ? t("whatsapp_landmark").replace("{landmark}", bookingLandmark.trim())
        : null,
      serviceLocation === "customer" && customerMapsUrl
        ? t("whatsapp_customer_location").replace("{url}", customerMapsUrl)
        : null,
      serviceLocation === "provider" && providerFullAddress
        ? t("whatsapp_provider_address").replace(
          "{address}",
          providerFullAddress,
        )
        : null,
      serviceLocation === "provider"
        ? providerMapsUrl
          ? t("whatsapp_provider_location").replace("{url}", providerMapsUrl)
          : providerMapsHref
            ? t("whatsapp_provider_location").replace("{url}", providerMapsHref)
            : null
        : null,
      t("whatsapp_confirm_arrival"),
    ].filter(Boolean);

    return buildWhatsAppShareHref(service.provider?.phone, parts.join("\n"));
  }, [
    bookingLandmark,
    customerMapsUrl,
    providerFullAddress,
    selectedDate,
    selectedUrgency,
    providerMapsHref,
    providerMapsUrl,
    service,
    serviceLocation,
    t,
  ]);

  // Remove getNoSlotsReason function as logic is moved to JSX
  /*
  const getNoSlotsReason = () => {
    // ... (removed function) ...
  };
  */

  const createBookingMutation = useMutation({
    mutationFn: async (data: {
      serviceId: number;
      bookingDate: string; // ISO string in UTC
      serviceLocation: "customer" | "provider";
      timeSlotLabel: BroadSlotLabel;
      // No need to send providerAddress explicitly if 'provider' is chosen
      // The backend can derive it from the service/provider ID
    }) => {
      const res = await apiRequest("POST", "/api/bookings", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || t("booking_failed_title"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/service"] });
      const bookingId = (data as any)?.booking?.id;
      setLastBookingId(typeof bookingId === "number" ? bookingId : null);
      toast({
        title: t("booking_request_sent_title"),
        description:
          data.message || t("booking_request_sent_description"),
      });
      setDialogStep("sent");
    },
    onError: (error: Error) => {
      const verificationError = getVerificationError(error);
      if (verificationError) {
        toast({
          title: t("verification_required_title"),
          description: verificationError.message,
          variant: "destructive",
          action: (
            <ToastAction
              altText={t("go_to_profile")}
              onClick={() => navigate("/customer/profile")}
            >
              {t("go_to_profile")}
            </ToastAction>
          ),
        });
        setDialogOpen(false);
        return;
      }

      const parsed = parseApiError(error);
      toast({
        title: t("booking_failed_title"),
        description: parsed.message,
        variant: "destructive",
      });
    },
  });

  type LocationUpdateResponse = { message?: string; user: unknown };

  const saveLandmarkMutation = useMutation({
    mutationFn: async (landmark: string | null) => {
      if (!user?.id) {
        throw new Error(t("user_not_loaded"));
      }
      const res = await apiRequest("PATCH", `/api/users/${user.id}`, {
        addressLandmark: landmark,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || t("save_landmark_failed_description"));
      }
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
    },
    onError: (error: Error) => {
      toast({
        title: t("save_landmark_failed_title"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveLocationMutation = useMutation({
    mutationFn: async (coords: { latitude: number; longitude: number }) => {
      const res = await apiRequest("POST", "/api/profile/location", coords);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || t("save_location_failed_description"));
      }
      return (await res.json()) as LocationUpdateResponse;
    },
    onSuccess: ({ user: updatedUser, message }) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast({
        title: t("location_saved_title"),
        description: message || t("location_saved_description"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("save_location_failed_title"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [, navigate] = useLocation();

  const handleBookingRequest = () => {
    if (!selectedUrgency) {
      toast({
        title: t("select_urgency_error"),
        variant: "destructive",
      });
      return;
    }
    if (serviceLocation === "customer" && !bookingLandmark.trim()) {
      toast({
        title: t("landmark_required_title"),
        description: t("landmark_required_description"),
        variant: "destructive",
      });
      return;
    }
    if (!providerOnline) {
      toast({
        title: t("provider_offline_title"),
        description: t("provider_offline_description"),
        variant: "destructive",
      });
      return;
    }
    if (dailyLimitReached) {
      toast({
        title: t("provider_fully_booked_title"),
        description: t("provider_fully_booked_description"),
        variant: "destructive",
      });
      return;
    }
    if (!resolvedSlotLabel || !resolvedSlotStart) {
      toast({
        title: t("no_availability_title"),
        description: t("no_availability_description"),
        variant: "destructive",
      });
      return;
    }
    setDialogStep("confirm");
    setLastBookingId(null);
    setDialogOpen(true); // Open confirmation dialog
  };

  const confirmBooking = async () => {
    if (!resolvedSlotLabel || !service || !resolvedSlotStart) return;

    const trimmedLandmark = bookingLandmark.trim();
    const existingLandmark = (user?.addressLandmark ?? "").trim();
    if (serviceLocation === "customer") {
      const hasLandmark = trimmedLandmark.length > 0;
      if (!hasLandmark) {
        toast({
          title: t("landmark_required_title"),
          description: t("landmark_required_description"),
          variant: "destructive",
        });
        return;
      }
    }
    if (
      serviceLocation === "customer" &&
      trimmedLandmark !== existingLandmark
    ) {
      try {
        await saveLandmarkMutation.mutateAsync(
          trimmedLandmark.length ? trimmedLandmark : null,
        );
      } catch (error) {
        toast({
          title: t("save_landmark_failed_title"),
          description:
            error instanceof Error
              ? error.message
              : t("save_landmark_failed_description"),
          variant: "destructive",
        });
        return;
      }
    }

    const now = new Date();
    let bookingDate =
      selectedUrgency === "now" ? now : resolvedSlotStart;
    if (selectedUrgency === "today" && bookingDate.getTime() < now.getTime()) {
      bookingDate = now;
    }

    createBookingMutation.mutate({
      serviceId: service.id,
      // Keep same-day bookings at or after the current time.
      bookingDate: bookingDate.toISOString(),
      serviceLocation: serviceLocation,
      timeSlotLabel: resolvedSlotLabel,
      // No providerAddress needed here
    });
  };

  const handleUseDeviceLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast({
        title: t("geolocation_unavailable_title"),
        description: t("geolocation_unavailable_description"),
        variant: "destructive",
      });
      return;
    }

    setIsCapturingDeviceLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsCapturingDeviceLocation(false);
        const accuracyMeters = Number(position.coords.accuracy);
        if (Number.isFinite(accuracyMeters)) {
          setLastGpsAccuracyMeters(accuracyMeters);
          if (accuracyMeters > GPS_WEAK_ACCURACY_METERS) {
            toast({
              title: t("gps_weak_title"),
              description: t("gps_weak_description"),
              variant: "destructive",
            });
          }
        } else {
          setLastGpsAccuracyMeters(null);
        }
        saveLocationMutation.mutate({
          latitude: Number(position.coords.latitude.toFixed(7)),
          longitude: Number(position.coords.longitude.toFixed(7)),
        });
      },
      (error) => {
        setIsCapturingDeviceLocation(false);
        toast({
          title: t("location_fetch_failed_title"),
          description: error.message,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
      },
    );
  };

  // Calculate average rating
  const averageRating =
    service?.reviews && service.reviews.length > 0
      ? service.reviews.reduce((acc: number, review) => acc + review.rating, 0) /
      service.reviews.length
      : 0;

  if (serviceLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!service) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl font-semibold">
            {t("service_not_found")}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {t("service_not_found_description")}
          </p>
          <Button asChild className="mt-4">
            <Link href="/customer/browse-services">
              {t("browse_services")}
            </Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="p-4 md:p-6 space-y-6"
      >
        <Card className="border-0 bg-gradient-to-br from-sky-50 via-white to-amber-50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{service.name}</CardTitle>
            <div className="flex items-center text-sm text-muted-foreground">
              <Star className="h-4 w-4 mr-1 fill-yellow-400 text-yellow-500" />
              <span>
                {averageRating.toFixed(1)} ({service.reviews?.length || 0}{" "}
                {t("reviews_label")})
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{service.description}</p>
            <div className="flex items-center text-sm">
              <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>
                {t("service_duration_label").replace(
                  "{minutes}",
                  String(service.duration),
                )}
              </span>
            </div>
            <div className="flex items-start text-sm">
              <MapPin className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground" />
              <span>
                {t("location_label")}{" "}
                {providerFullAddress || t("location_not_specified")}
              </span>
            </div>
            <div className="text-lg font-semibold">
              {t("estimated_price_label").replace(
                "{price}",
                `₹${service.price}`,
              )}
            </div>
            <div>
              <h3 className="font-medium mb-2">{t("service_provider")}</h3>
              <div className="flex items-center space-x-3">
                {/* Add provider avatar/icon if available */}
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg font-semibold">
                  {providerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{providerName}</p>
                  {/* Add link to provider profile if needed */}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle>{t("request_visit_title")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("request_visit_subtitle")}
            </p>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                  1
                </span>
                <h3 className="font-semibold">{t("step_pick_time")}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("rural_timing_note")}
              </p>
              <div className="grid gap-3">
                {urgencyOptions.map((option) => {
                  const isSelected = selectedUrgency === option.label;
                  const Icon =
                    option.label === "now"
                      ? AlertCircle
                      : option.label === "tomorrow"
                        ? Clock
                        : Sun;
                  const optionDateLabel =
                    option.label === "tomorrow"
                      ? formatBase(addDays(new Date(), 1), "PPP")
                      : formatBase(new Date(), "PPP");

                  return (
                    <Button
                      key={option.label}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => {
                        const base = new Date();
                        base.setHours(0, 0, 0, 0);
                        setSelectedUrgency(option.label);
                        setSelectedDate(
                          option.label === "tomorrow" ? addDays(base, 1) : base,
                        );
                      }}
                      disabled={!providerOnline}
                      className="w-full h-auto justify-start p-4 text-left flex items-start gap-3"
                    >
                      <Icon className="h-5 w-5 mt-0.5" aria-hidden="true" />
                      <div className="flex-1">
                        <div className="font-semibold">{option.title}</div>
                        <div
                          className={
                            isSelected
                              ? "text-xs text-primary-foreground/80"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {option.description} • {optionDateLabel}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
              {bookingsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("checking_availability")}
                </div>
              ) : null}
              {!providerOnline ? (
                <p className="text-sm text-red-600">
                  {t("provider_offline_inline")}
                </p>
              ) : dailyLimitReached ? (
                <p className="text-sm text-muted-foreground">
                  {t("daily_limit_reached").replace(
                    "{date}",
                    formatBase(selectedDate, "PPP"),
                  )}
                </p>
              ) : selectedUrgency && !resolvedSlotLabel ? (
                <p className="text-sm text-muted-foreground">
                  {t("no_availability_for_date").replace(
                    "{date}",
                    formatBase(selectedDate, "PPP"),
                  )}
                </p>
              ) : null}
              {!providerOnline && service.availabilityNote ? (
                <p className="text-xs text-muted-foreground">
                  {service.availabilityNote}
                </p>
              ) : null}
            </div>

            <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  2
                </span>
                <h3 className="font-semibold">{t("step_pick_location")}</h3>
              </div>
              <div>
                <h3 className="font-medium mb-2">
                  {t("service_location_title")}
                </h3>
                <RadioGroup
                  value={serviceLocation}
                  onValueChange={(value) =>
                    setServiceLocation(value as "customer" | "provider")
                  }
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="provider" id="provider_location" />
                    <Label htmlFor="provider_location">
                      {t("service_location_provider")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="customer" id="my_location" />
                    <Label htmlFor="my_location">
                      {t("service_location_customer")}
                    </Label>
                  </div>
                </RadioGroup>
                {serviceLocation === "provider" && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t("service_at_provider_address").replace(
                        "{address}",
                        providerFullAddress || t("location_not_specified"),
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <MapLink
                        latitude={service.provider?.latitude}
                        longitude={service.provider?.longitude}
                        label={t("view_on_map")}
                      />
                      {!providerHasCoords && providerMapsHref ? (
                        <a
                          href={providerMapsHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {t("view_on_map")}
                        </a>
                      ) : null}
                    </div>
                  </div>
                )}
                {serviceLocation === "customer" && (
                  <div className="mt-3 space-y-3 rounded-md border bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground">
                      {t("rural_landmark_note")}
                    </p>
                    {lastGpsAccuracyMeters !== null &&
                      lastGpsAccuracyMeters > GPS_WEAK_ACCURACY_METERS ? (
                      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold">
                            {t("gps_weak_inline").replace(
                              "{meters}",
                              String(Math.round(lastGpsAccuracyMeters)),
                            )}
                          </p>
                          <p>{t("gps_weak_description")}</p>
                        </div>
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label
                        htmlFor="booking_landmark"
                        className="text-base font-semibold"
                      >
                        {t("landmark_label")}{" "}
                        <span className="text-red-600">*</span>
                      </Label>
                      <Input
                        id="booking_landmark"
                        value={bookingLandmark}
                        onChange={(e) => setBookingLandmark(e.target.value)}
                        placeholder={t("landmark_placeholder")}
                        required={serviceLocation === "customer"}
                        className="h-12 text-base"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("landmark_helper")}
                      </p>
                      {serviceLocation === "customer" && !bookingLandmark.trim() ? (
                        <p className="text-xs font-medium text-red-700">
                          {t("landmark_required_inline")}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="lg"
                      variant="secondary"
                      onClick={handleUseDeviceLocation}
                      disabled={
                        isCapturingDeviceLocation ||
                        saveLocationMutation.isPending
                      }
                      className="w-full h-12 text-base"
                    >
                      {isCapturingDeviceLocation || saveLocationMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Navigation className="h-5 w-5" />
                      )}
                      {t("use_my_location")}
                    </Button>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{t("saved_gps_label")}</span>
                      <MapLink
                        latitude={user?.latitude}
                        longitude={user?.longitude}
                      />
                      {!user?.latitude || !user?.longitude ? (
                        <span>{t("gps_not_saved")}</span>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 text-sm space-y-2">
                <p className="font-semibold">{t("booking_summary_title")}</p>
                <div className="flex justify-between">
                  <span>{t("summary_when")}</span>
                  <span>
                    {selectedUrgency === "now"
                      ? t("urgency_now_summary")
                      : selectedUrgency === "today"
                        ? t("urgency_today_summary")
                        : selectedUrgency === "tomorrow"
                          ? t("urgency_tomorrow_summary")
                          : t("summary_not_selected")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t("summary_where")}</span>
                  <span>
                    {serviceLocation === "customer"
                      ? t("service_location_customer")
                      : t("service_location_provider")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t("summary_price")}</span>
                  <span>₹{service.price}</span>
                </div>
              </div>

              <Button
                onClick={handleBookingRequest}
                className="w-full h-12"
                disabled={
                  !selectedUrgency ||
                  !providerOnline ||
                  bookingsLoading ||
                  dailyLimitReached ||
                  !resolvedSlotLabel ||
                  (serviceLocation === "customer" && !bookingLandmark.trim()) ||
                  createBookingMutation.isPending
                }
              >
                {createBookingMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("request_booking")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setDialogStep("confirm");
              setLastBookingId(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialogStep === "sent"
                  ? t("booking_requested_title")
                  : t("confirm_booking_title")}
              </DialogTitle>
            </DialogHeader>
            {dialogStep === "sent" ? (
              <div className="space-y-4">
                {lastBookingId ? (
                  <p className="text-sm text-muted-foreground">
                    {t("booking_number_label").replace(
                      "{id}",
                      String(lastBookingId),
                    )}
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  {serviceLocation === "customer"
                    ? t("next_step_send_location")
                    : t("next_step_message_provider")}
                </p>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => {
                    if (!whatsappShareHref) return;
                    window.open(whatsappShareHref, "_blank");
                  }}
                  disabled={!whatsappShareHref}
                  className="w-full h-14 text-base bg-green-600 hover:bg-green-700 text-white"
                >
                  <MessageCircle className="h-5 w-5" />
                  {serviceLocation === "customer"
                    ? t("send_location_to_provider").replace(
                      "{name}",
                      providerName,
                    )
                    : t("message_provider_on_whatsapp").replace(
                      "{name}",
                      providerName,
                    )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setDialogOpen(false)}
                >
                  {t("done")}
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <p>
                    <strong>{t("service_label")}:</strong> {service.name}
                  </p>
                  <p>
                    <strong>{t("when_label")}:</strong>{" "}
                    {selectedUrgency === "now"
                      ? t("urgency_now_summary")
                      : selectedUrgency === "today"
                        ? t("urgency_today_summary")
                        : selectedUrgency === "tomorrow"
                          ? t("urgency_tomorrow_summary")
                          : t("not_available")}
                  </p>
                  <p>
                    <strong>{t("preferred_day_label")}:</strong>{" "}
                    {formatBase(selectedDate, "PPP")}
                  </p>
                  <p>
                    <strong>{t("location_label")}:</strong>{" "}
                    {serviceLocation === "provider"
                      ? t("summary_location_provider").replace(
                        "{address}",
                        providerFullAddress || t("location_not_specified"),
                      )
                      : t("summary_location_customer")}
                  </p>
                  {serviceLocation === "customer" && bookingLandmark.trim() ? (
                    <p>
                      <strong>{t("landmark_label")}:</strong>{" "}
                      {bookingLandmark.trim()}
                    </p>
                  ) : null}
                  {serviceLocation === "customer" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{t("map_label")}:</strong>
                      <MapLink
                        latitude={user?.latitude}
                        longitude={user?.longitude}
                      />
                    </div>
                  ) : null}
                  <div className="rounded-md border bg-muted/10 p-4 space-y-2">
                    <div className="flex justify-between">
                      <span>{t("estimated_price_label_inline")}</span>
                      <span>₹{service?.price}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("final_price_note")}
                    </p>
                    {featureFlags.platformFeesEnabled &&
                      featureFlags.platformFeeBreakdownEnabled ? (
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t("platform_fee_label")}</span>
                        <span>₹{platformFee.toFixed(2)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    {t("cancel")}
                  </Button>
                  <Button
                    onClick={confirmBooking}
                    disabled={
                      createBookingMutation.isPending ||
                      saveLandmarkMutation.isPending
                    }
                  >
                    {createBookingMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {t("confirm_and_request")}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Customer Reviews Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t("customer_reviews_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {service.reviews && service.reviews.length > 0 ? (
              <div className="space-y-4">
                {service.reviews.map((review) => (
                  <div
                    key={review.id}
                    className="border-b pb-4 last:border-b-0"
                  >
                    <div className="flex items-center mb-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"}`}
                        />
                      ))}
                      <span className="ml-2 text-sm font-medium">
                        {review.rating}.0
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {review.createdAt
                        ? format(new Date(review.createdAt), "PP")
                        : ""}{" "}
                      -{" "}
                      {review.customerId
                        ? t("review_by_customer_id").replace(
                          "{id}",
                          String(review.customerId),
                        )
                        : t("review_by_customer")}
                    </p>
                    <p className="text-sm">{review.review}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("no_reviews_yet")}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
