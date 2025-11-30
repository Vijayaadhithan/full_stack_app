import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { platformFees } from "@shared/config";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Loader2, MapPin, Clock, Star, AlertCircle } from "lucide-react";
import { useState, useEffect, useMemo } from "react"; // Add useMemo
import {
  format as formatBase,
  format,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz"; // Import date-fns-tz functions

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
// Remove Input import if no longer needed elsewhere
// import { Input } from "@/components/ui/input";
import { ServiceDetail } from "@shared/api-contract";
import { apiClient } from "@/lib/apiClient";
import { ToastAction } from "@/components/ui/toast";
import { getVerificationError, parseApiError } from "@/lib/api-error";

const timeZone = "Asia/Kolkata"; // Define IST timezone

type BroadSlotLabel = "morning" | "afternoon" | "evening";

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

export default function BookService() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const platformFee = platformFees.serviceBooking;
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // Represents the *day* selected, time part is ignored
  const [selectedSlot, setSelectedSlot] = useState<BroadSlotLabel | null>(null);
  const [serviceLocation, setServiceLocation] = useState<
    "customer" | "provider"
  >("provider"); // Default to provider location
  const [dialogOpen, setDialogOpen] = useState(false);

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
      selectedDate.toISOString().split("T")[0],
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

  const bookedSlotLabels = useMemo(() => {
    return new Set(
      (bookedSlots || [])
        .map((slot) => slot.timeSlotLabel)
        .filter(Boolean) as BroadSlotLabel[],
    );
  }, [bookedSlots]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDate]);

  const providerOnline =
    (service?.isAvailableNow ?? true) && (service?.isAvailable ?? true);
  const maxDailyBookings = service?.maxDailyBookings ?? null;
  const dailyLimitReached =
    maxDailyBookings !== null
      ? (bookedSlots?.length ?? 0) >= maxDailyBookings
      : false;
  const allowedSlotSet = useMemo(() => {
    const allowed =
      (service?.allowedSlots as BroadSlotLabel[] | undefined | null) ??
      SLOT_OPTIONS.map((s) => s.label);
    return new Set(allowed);
  }, [service?.allowedSlots]);
  const selectedSlotStart = selectedSlot
    ? getSlotStartForDate(selectedDate, selectedSlot)
    : null;
  const selectedSlotMeta = SLOT_OPTIONS.find(
    (slot) => slot.label === selectedSlot,
  );

  useEffect(() => {
    if (selectedSlot && !allowedSlotSet.has(selectedSlot)) {
      setSelectedSlot(null);
    }
  }, [allowedSlotSet, selectedSlot]);

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
        throw new Error(error.message || "Booking failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Booking Request Sent",
        description:
          data.message || "Your booking request has been sent to the provider.",
      });
      // Optionally redirect or close modal
      // setLocation('/customer/bookings');
      setDialogOpen(false); // Close the confirmation dialog
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
              altText="Go to profile"
              onClick={() => navigate("/customer/profile")}
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
        title: "Booking Failed",
        description: parsed.message,
        variant: "destructive",
      });
    },
  });

  const [, navigate] = useLocation();

  const handleBookingRequest = () => {
    if (!selectedSlot) {
      toast({ title: "Please select a time slot", variant: "destructive" });
      return;
    }
    if (!providerOnline) {
      toast({
        title: "Provider is offline",
        description: "Please try again when the provider is available.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedSlotStart) {
      toast({
        title: "Unable to schedule",
        description: "Please pick a different slot and try again.",
        variant: "destructive",
      });
      return;
    }
    if (dailyLimitReached) {
      toast({
        title: "Fully booked",
        description: "The provider has reached the daily booking limit.",
        variant: "destructive",
      });
      return;
    }
    setDialogOpen(true); // Open confirmation dialog
  };

  const confirmBooking = () => {
    if (!selectedSlot || !service || !selectedSlotStart) return;

    createBookingMutation.mutate({
      serviceId: service.id,
      bookingDate: selectedSlotStart.toISOString(), // Send UTC ISO string
      serviceLocation: serviceLocation,
      timeSlotLabel: selectedSlot,
      // No providerAddress needed here
    });
  };

  // Calculate average rating
  const averageRating =
    service?.reviews && service.reviews.length > 0
      ? service.reviews.reduce((acc: number, review) => acc + review.rating, 0) /
        service.reviews.length
      : 0;

  // --- Calendar disabling logic ---
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of today

  const disabledDays = [{ before: today }];
  // --- End Calendar disabling logic ---

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
          <h2 className="mt-4 text-xl font-semibold">Service Not Found</h2>
          <p className="mt-2 text-muted-foreground">
            The requested service could not be found.
          </p>
          <Button asChild className="mt-4">
            <Link href="/customer/browse-services">Browse Other Services</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Format provider address
  const providerName = service.provider.name ?? "Provider";
  const providerFullAddress = [
    service.provider.addressStreet,
    service.provider.addressCity,
    service.provider.addressState,
    service.provider.addressPostalCode,
    service.provider.addressCountry,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="p-4 md:p-6 space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{service.name}</CardTitle>
            <div className="flex items-center text-sm text-muted-foreground">
              <Star className="h-4 w-4 mr-1 fill-yellow-400 text-yellow-500" />
              <span>
                {averageRating.toFixed(1)} ({service.reviews?.length || 0}{" "}
                reviews)
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{service.description}</p>
            <div className="flex items-center text-sm">
              <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>Duration: {service.duration} minutes</span>
            </div>
            <div className="flex items-start text-sm">
              <MapPin className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground" />
              <span>Location: {providerFullAddress || "Not specified"}</span>
            </div>
            <div className="text-lg font-semibold">Price: ₹{service.price}</div>
            <div>
              <h3 className="font-medium mb-2">Service Provider</h3>
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

        <Card>
          <CardHeader>
            {/* Removed grid layout from CardContent to prevent heading wrapping */}
            <CardTitle>Book Your Slot</CardTitle>
          </CardHeader>
          {/* Reverted CardContent and added Grid for layout */}
          <CardContent className="grid md:grid-cols-2 gap-6">
            {/* Calendar Section (Left Column) */}
            <div>
              <h3 className="font-medium mb-2">Select Date</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                disabled={disabledDays}
                className="rounded-md border p-0"
                fromDate={today}
              />
            </div>
            {/* Time Slots, Location, and Button Section (Right Column) */}
            <div className="space-y-4">
              {" "}
              {/* Use space-y for vertical spacing within the right column */}
              <div>
                <h3 className="font-medium mb-2">
              Available Time Slots ({formatBase(selectedDate, "PPP")})
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Pick a broad window—your provider will confirm the exact arrival time.
            </p>
            {bookingsLoading || serviceLoading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {SLOT_OPTIONS.map((slot) => {
                      const isSelected = selectedSlot === slot.label;
                      const isBooked = bookedSlotLabels.has(slot.label);
                      const isAllowed = allowedSlotSet.has(slot.label);
                      const slotDisabled =
                        !providerOnline ||
                        dailyLimitReached ||
                        isBooked ||
                        !isAllowed;
                      const badgeCopy = !providerOnline
                        ? "Offline"
                        : dailyLimitReached
                          ? "Full"
                          : isBooked
                            ? "Booked"
                            : !isAllowed
                              ? "Disabled"
                            : "Flexible arrival";
                      return (
                        <Button
                          key={slot.label}
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => setSelectedSlot(slot.label)}
                          disabled={slotDisabled}
                          className="w-full h-full justify-start p-4 text-left flex flex-col items-start space-y-2 shadow-sm"
                        >
                          <div className="flex w-full items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-base">
                                {slot.title}
                              </div>
                              <div className="text-xs text-muted-foreground whitespace-normal break-words">
                                {slot.window}
                              </div>
                            </div>
                            <span
                              className={`text-[11px] px-2 py-1 rounded-full border ${
                                slotDisabled
                                  ? "text-muted-foreground border-muted"
                                  : "text-primary border-primary/30 bg-primary/5"
                              }`}
                            >
                              {badgeCopy === "Flexible arrival"
                                ? "Flexible"
                                : badgeCopy}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-snug whitespace-normal break-words">
                            Provider arrives within this window; exact timing is
                            coordinated after you book.
                          </p>
                        </Button>
                      );
                    })}
                  </div>
            )}
            {!providerOnline ? (
              <p className="text-sm text-red-600 mt-2">
                This provider is offline right now.
              </p>
            ) : dailyLimitReached ? (
              <p className="text-sm text-muted-foreground mt-2">
                Daily booking limit reached for this date.
              </p>
            ) : null}
            {!providerOnline && service.availabilityNote ? (
              <p className="text-xs text-muted-foreground">
                {service.availabilityNote}
              </p>
            ) : null}
          </div>
          <div>
            <h3 className="font-medium mb-2">Service Location</h3>
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
                      Provider's Location
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="customer" id="my_location" />
                    <Label htmlFor="my_location">My Location</Label>
                  </div>
                </RadioGroup>
                {/* Display provider address when provider location is selected */}
                {serviceLocation === "provider" && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Service will be at:{" "}
                    {providerFullAddress || "Provider address not specified"}
                  </p>
                )}
                {/* Remove the input field for provider address */}
                {/* 
                 {serviceLocation === 'provider' && (
                   <div className="mt-4 space-y-2">
                     <Label htmlFor="provider_address">Provider Address</Label>
                     <Input 
                       id="provider_address"
                       placeholder="Enter provider's full address"
                       value={providerAddress} 
                       onChange={(e) => setProviderAddress(e.target.value)} 
                       required={serviceLocation === 'provider'}
                     />
                   </div>
                 )}
                 */}
              </div>
          {/* Button remains within the right column */}
          <Button
            onClick={handleBookingRequest}
            className="w-full mt-4" /* Reverted margin */
            disabled={
              !selectedSlot ||
              !providerOnline ||
              dailyLimitReached ||
              createBookingMutation.isPending
            }
          >
            {createBookingMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Request Booking
              </Button>
              {/* {service.bookingRequiresProviderApproval && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Booking requires provider approval.
                </p>
              )} */}
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Booking</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p>
                <strong>Service:</strong> {service.name}
              </p>
              <p>
                <strong>Date:</strong> {formatBase(selectedDate, "PPP")}
              </p>
              <p>
                <strong>Time:</strong>{" "}
                {selectedSlotMeta
                  ? `${selectedSlotMeta.title} (${selectedSlotMeta.window})`
                  : "N/A"}
              </p>
              <p>
                <strong>Location:</strong>{" "}
                {serviceLocation === "provider"
                  ? `Provider's Location (${providerFullAddress || "Not specified"})`
                  : "Your Location"}
              </p>
              <div className="flex justify-between py-2">
                <span>Service Price:</span>
                <span>₹{service?.price}</span>
              </div>
              <div className="flex justify-between py-2 text-gray-600">
                <span>Platform Fee:</span>
                <span>₹{platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 font-bold">
                <span>Total:</span>
                <span>
                  ₹{(
                    parseFloat(service?.price || "0") +
                    platformFee
                  ).toFixed(2)}
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={confirmBooking}
                disabled={createBookingMutation.isPending}
              >
                {createBookingMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Confirm & Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Customer Reviews Section */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Reviews</CardTitle>
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
                      - By {review.customerId ? `Customer #${review.customerId}` : "Customer"}
                    </p>
                    <p className="text-sm">{review.review}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
