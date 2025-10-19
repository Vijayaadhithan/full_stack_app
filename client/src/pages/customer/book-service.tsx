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
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { platformFees } from "@shared/config";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { motion } from "framer-motion";
import { Loader2, MapPin, Clock, Star, AlertCircle } from "lucide-react";
import { useState, useEffect, useMemo } from "react"; // Add useMemo
import {
  format as formatBase,
  addDays,
  isBefore,
  isAfter,
  addMinutes,
  isWithinInterval,
  parse,
  format,
} from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz"; // Import date-fns-tz functions

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
// Remove Input import if no longer needed elsewhere
// import { Input } from "@/components/ui/input";
import { ServiceDetail } from "@shared/api-contract";
import { apiClient } from "@/lib/apiClient";

const timeZone = "Asia/Kolkata"; // Define IST timezone

type TimeSlot = {
  start: Date;
  end: Date;
  available: boolean;
};

function isBreakTime(
  slotStart: Date,
  slotEnd: Date,
  breakTimes: Array<{ start: string; end: string }>,
  date: Date,
) {
  const zonedDate = toZonedTime(date, timeZone);
  return breakTimes.some((breakTime) => {
    try {
      const breakStartStr = breakTime.start?.padStart(5, "0"); // Ensure HH:mm, add optional chaining
      const breakEndStr = breakTime.end?.padStart(5, "0"); // Ensure HH:mm, add optional chaining

      // Skip if start or end time is missing or invalid
      if (!breakStartStr || !breakEndStr) {
        console.warn(`Skipping invalid break time entry:`, breakTime);
        return false;
      }

      // Handle potential zero-duration breaks gracefully
      if (breakStartStr === breakEndStr) {
        // console.log(`Skipping zero-duration break: ${breakStartStr}`);
        return false; // A zero-duration break cannot overlap
      }

      const breakStartParts = breakStartStr.split(":");
      const breakEndParts = breakEndStr.split(":");

      if (breakStartParts.length !== 2 || breakEndParts.length !== 2) {
        console.error(
          `Invalid time format in break time: ${breakTime.start}-${breakTime.end}`,
        );
        return false;
      }

      const breakStartHour = parseInt(breakStartParts[0], 10);
      const breakStartMinute = parseInt(breakStartParts[1], 10);
      const breakEndHour = parseInt(breakEndParts[0], 10);
      const breakEndMinute = parseInt(breakEndParts[1], 10);

      if (
        isNaN(breakStartHour) ||
        isNaN(breakStartMinute) ||
        isNaN(breakEndHour) ||
        isNaN(breakEndMinute)
      ) {
        console.error(
          `Invalid time values in break time: ${breakTime.start}-${breakTime.end}`,
        );
        return false; // Skip invalid break times
      }

      const breakStartDateTime = new Date(zonedDate);
      breakStartDateTime.setHours(breakStartHour, breakStartMinute, 0, 0);
      const breakEndDateTime = new Date(zonedDate);
      breakEndDateTime.setHours(breakEndHour, breakEndMinute, 0, 0);

      // Handle breaks spanning midnight if necessary (assuming breaks are within the same day for now)
      // if (breakEndDateTime <= breakStartDateTime) { ... }

      const breakStartUTC = fromZonedTime(breakStartDateTime, timeZone);
      const breakEndUTC = fromZonedTime(breakEndDateTime, timeZone);

      // Check if the slot *overlaps* with the break time
      // Overlap occurs if: slot starts before break ends AND slot ends after break starts
      const overlaps = slotStart < breakEndUTC && slotEnd > breakStartUTC;
      // if (overlaps) {
      //   console.log(`Slot ${formatInTimeZone(slotStart, timeZone, 'HH:mm')} - ${formatInTimeZone(slotEnd, timeZone, 'HH:mm')} overlaps with break ${formatInTimeZone(breakStartUTC, timeZone, 'HH:mm')} - ${formatInTimeZone(breakEndUTC, timeZone, 'HH:mm')}`);
      // }
      return overlaps;
    } catch (e) {
      console.error(
        `Error processing break time: ${breakTime.start}-${breakTime.end}`,
        e,
      );
      return false;
    }
  });
}

function generateTimeSlots(
  date: Date,
  duration: number,
  bufferTime: number,
  workingHours: any,
  breakTimes: Array<{ start: string; end: string }>,
  existingBookings: { start: Date | string; end: Date | string }[],
  maxDailyBookings: number | null, // Add maxDailyBookings parameter
): TimeSlot[] {
  console.log("[generateTimeSlots] --- Start ---");
  console.log("[generateTimeSlots] Input Date (UTC):", date.toISOString());
  console.log(
    "[generateTimeSlots] Input Date (IST):",
    formatInTimeZone(date, timeZone, "yyyy-MM-dd HH:mm:ss zzzz"),
  );
  console.log(
    "[generateTimeSlots] Duration:",
    duration,
    "Buffer:",
    bufferTime,
    "Max Bookings:",
    maxDailyBookings,
  );
  console.log(
    "[generateTimeSlots] Working Hours:",
    JSON.stringify(workingHours),
  );
  console.log("[generateTimeSlots] Break Times:", JSON.stringify(breakTimes));
  console.log(
    "[generateTimeSlots] Existing Bookings:",
    JSON.stringify(
      existingBookings.map((b) => ({
        start: b.start.toString(),
        end: b.end.toString(),
      })),
    ),
  );

  const zonedDate = toZonedTime(date, timeZone); // Use the selected date in IST
  const dayOfWeek = formatBase(zonedDate, "EEEE").toLowerCase(); // Get day of week in IST
  const daySchedule = workingHours[dayOfWeek];

  console.log(
    `[generateTimeSlots] Day: ${dayOfWeek}, Schedule:`,
    daySchedule ? JSON.stringify(daySchedule) : "Not Found",
  );

  if (!daySchedule) {
    console.log(
      "[generateTimeSlots] No schedule found for this day. Returning empty array.",
    );
    console.log("[generateTimeSlots] --- End ---");
    return [];
  }

  if (!daySchedule.isAvailable) {
    console.log(
      "[generateTimeSlots] Day marked as unavailable. Returning empty array.",
    );
    console.log("[generateTimeSlots] --- End ---");
    return [];
  }

  const startStr = daySchedule.start?.padStart(5, "0"); // Add optional chaining
  const endStr = daySchedule.end?.padStart(5, "0"); // Add optional chaining

  if (!startStr || !endStr) {
    console.error(
      "[generateTimeSlots] Invalid or missing start/end time in schedule. Returning empty array.",
    );
    console.log("[generateTimeSlots] --- End ---");
    return [];
  }

  const slots: TimeSlot[] = [];
  let startTimeUTC: Date;
  let endTimeUTC: Date;

  try {
    const startHour = parseInt(startStr.split(":")[0], 10);
    const startMinute = parseInt(startStr.split(":")[1], 10);
    const endHour = parseInt(endStr.split(":")[0], 10);
    const endMinute = parseInt(endStr.split(":")[1], 10);

    if (
      isNaN(startHour) ||
      isNaN(startMinute) ||
      isNaN(endHour) ||
      isNaN(endMinute)
    ) {
      throw new Error("Invalid time format in working hours");
    }

    const startDateTime = new Date(zonedDate);
    startDateTime.setHours(startHour, startMinute, 0, 0);
    const endDateTime = new Date(zonedDate);
    endDateTime.setHours(endHour, endMinute, 0, 0);

    // Handle overnight shifts if end time is earlier than start time
    if (endDateTime <= startDateTime) {
      console.log(
        "[generateTimeSlots] Detected overnight shift. Adjusting end time.",
      );
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    startTimeUTC = fromZonedTime(startDateTime, timeZone);
    endTimeUTC = fromZonedTime(endDateTime, timeZone);
    console.log(
      `[generateTimeSlots] Calculated Work Start (UTC): ${startTimeUTC.toISOString()}, End (UTC): ${endTimeUTC.toISOString()}`,
    );
    console.log(
      `[generateTimeSlots] Calculated Work Start (IST): ${formatInTimeZone(startTimeUTC, timeZone, "HH:mm")}, End (IST): ${formatInTimeZone(endTimeUTC, timeZone, "HH:mm")}`,
    );
  } catch (e: any) {
    console.error(
      "[generateTimeSlots] Error parsing working hours:",
      e.message,
    );
    console.log("[generateTimeSlots] --- End ---");
    return [];
  }

  if (isNaN(startTimeUTC.getTime()) || isNaN(endTimeUTC.getTime())) {
    console.error(
      "[generateTimeSlots] Invalid start or end time calculated. Returning empty array.",
    );
    console.log("[generateTimeSlots] --- End ---");
    return [];
  }

  let currentSlotStartUTC = startTimeUTC;
  let slotCounter = 0; // Add counter for limiting logs
  let generatedSlotsCount = 0; // Counter for generated slots
  const nowUTC = new Date(); // Define nowUTC once outside the loop
  const isSelectedDateToday =
    formatBase(toZonedTime(date, timeZone), "yyyy-MM-dd") ===
    formatBase(toZonedTime(nowUTC, timeZone), "yyyy-MM-dd"); // Check if selected date is today
  console.log(
    `[generateTimeSlots] Is selected date today? ${isSelectedDateToday}, Now (UTC): ${nowUTC.toISOString()}, Now (IST): ${formatInTimeZone(nowUTC, timeZone, "yyyy-MM-dd HH:mm:ss")}`,
  );

  while (currentSlotStartUTC < endTimeUTC) {
    // Check if maxDailyBookings limit is reached
    if (maxDailyBookings !== null && generatedSlotsCount >= maxDailyBookings) {
      console.log(
        `  Slot generation stopped: Max daily bookings limit (${maxDailyBookings}) reached.`,
      );
      break;
    }

    const slotEndUTC = addMinutes(currentSlotStartUTC, duration);
    slotCounter++;
    console.log(`\n[generateTimeSlots] Iteration ${slotCounter}:`);
    console.log(
      `  Trying Slot (UTC): ${currentSlotStartUTC.toISOString()} - ${slotEndUTC.toISOString()}`,
    );
    console.log(
      `  Trying Slot (IST): ${formatInTimeZone(currentSlotStartUTC, timeZone, "HH:mm")} - ${formatInTimeZone(slotEndUTC, timeZone, "HH:mm")}`,
    );

    // Check 1: Does the slot end after the working day ends?
    if (slotEndUTC > endTimeUTC) {
      console.log(
        `  Slot rejected: Ends after working hours (End UTC: ${endTimeUTC.toISOString()}).`,
      );
      break; // No further slots possible today
    }

    // Check 2: Is the slot in a break time?
    const isInBreakTime = isBreakTime(
      currentSlotStartUTC,
      slotEndUTC,
      breakTimes,
      date,
    );
    console.log(`  Check 2: Is in break time? ${isInBreakTime}`);
    if (isInBreakTime) {
      console.log("  Slot rejected: Overlaps with break time.");
      // Advance past the break - find the end of the overlapping break
      const overlappingBreak = breakTimes.find((breakTime) => {
        try {
          const breakStartStr = breakTime.start?.padStart(5, "0");
          const breakEndStr = breakTime.end?.padStart(5, "0");
          if (!breakStartStr || !breakEndStr) return false;
          const breakStartDateTime = parse(breakStartStr, "HH:mm", zonedDate);
          const breakEndDateTime = parse(breakEndStr, "HH:mm", zonedDate);
          const breakStartUTC = fromZonedTime(breakStartDateTime, timeZone);
          const breakEndUTC = fromZonedTime(breakEndDateTime, timeZone);
          return (
            currentSlotStartUTC < breakEndUTC && slotEndUTC > breakStartUTC
          );
        } catch {
          return false;
        }
      });
      if (overlappingBreak?.end) {
        try {
          const breakEndDateTime = parse(
            overlappingBreak.end.padStart(5, "0"),
            "HH:mm",
            zonedDate,
          );
          const breakEndUTC = fromZonedTime(breakEndDateTime, timeZone);
          console.log(
            `  Advancing currentSlotStartUTC past break end: ${breakEndUTC.toISOString()}`,
          );
          currentSlotStartUTC = breakEndUTC; // Move to the end of the break
        } catch (e) {
          console.error(
            "  Error parsing break end time for advancement, using smaller advance:",
            e,
          );
          currentSlotStartUTC = addMinutes(
            currentSlotStartUTC,
            bufferTime || 15,
          ); // Fallback advance by buffer or 15 mins
        }
      } else {
        console.warn(
          "  Could not determine break end time, using smaller advance.",
        );
        currentSlotStartUTC = addMinutes(currentSlotStartUTC, bufferTime || 15); // Fallback advance by buffer or 15 mins
      }
      continue;
    }

    // Check 3: Does the slot overlap with existing bookings?
    const overlappingBooking = existingBookings.find((booking) => {
      try {
        // Ensure booking dates are properly converted to Date objects
        const bookingStart =
          booking.start instanceof Date
            ? booking.start
            : new Date(booking.start);
        const bookingEnd =
          booking.end instanceof Date ? booking.end : new Date(booking.end);

        if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
          console.warn(
            "  Invalid date in existing booking during check:",
            booking,
          );
          return false; // Skip invalid booking data
        }

        // Check for overlap: (SlotStart < BookingEnd) and (SlotEnd > BookingStart)
        const overlaps =
          currentSlotStartUTC < bookingEnd && slotEndUTC > bookingStart;

        if (overlaps) {
          console.log(
            `  Overlap check: Slot ${formatInTimeZone(currentSlotStartUTC, timeZone, "HH:mm")}-${formatInTimeZone(slotEndUTC, timeZone, "HH:mm")} vs Booking ${formatInTimeZone(bookingStart, timeZone, "HH:mm")}-${formatInTimeZone(bookingEnd, timeZone, "HH:mm")}`,
          );
        }

        return overlaps;
      } catch (error) {
        console.error("  Error checking booking overlap:", error);
        return false; // Skip on error
      }
    });
    console.log(
      `  Check 3: Overlaps with existing booking? ${!!overlappingBooking}`,
    );
    if (overlappingBooking) {
      console.log("  Slot rejected: Overlaps with an existing booking.");
      // Advance past the existing booking
      try {
        const bookingEnd =
          overlappingBooking.end instanceof Date
            ? overlappingBooking.end
            : new Date(overlappingBooking.end);
        if (!isNaN(bookingEnd.getTime())) {
          console.log(
            `  Advancing currentSlotStartUTC past booking end: ${bookingEnd.toISOString()}`,
          );
          currentSlotStartUTC = addMinutes(bookingEnd, bufferTime); // Move start time past the booking + buffer
        } else {
          console.warn("  Invalid booking end date, using smaller advance.");
          currentSlotStartUTC = addMinutes(
            currentSlotStartUTC,
            bufferTime || 15,
          ); // Fallback advance by buffer or 15 mins
        }
      } catch (error) {
        console.error("  Error processing booking end time:", error);
        currentSlotStartUTC = addMinutes(currentSlotStartUTC, bufferTime || 15); // Fallback advance by buffer or 15 mins
      }
      continue;
    }

    // Check 4: Is the slot start time in the past (only if selected date is today)?
    const isPast = isSelectedDateToday && isBefore(currentSlotStartUTC, nowUTC);
    console.log(
      `  Check 4: Is slot start in the past? ${isPast} (Only checked if today)`,
    );
    if (isPast) {
      console.log("  Slot rejected: Start time is in the past.");
      // Advance by a smaller increment to check the next possible moment
      currentSlotStartUTC = addMinutes(currentSlotStartUTC, bufferTime || 15);
      continue;
    }

    // If all checks pass, add the slot
    console.log("  Slot accepted!");
    slots.push({
      start: currentSlotStartUTC,
      end: slotEndUTC,
      available: true,
    });
    generatedSlotsCount++; // Increment generated slots count

    // Move to the next potential slot start time (End of current slot + buffer)
    currentSlotStartUTC = addMinutes(slotEndUTC, bufferTime);
    console.log(
      `  Advanced next potential slot start (UTC) to: ${currentSlotStartUTC.toISOString()}`,
    );
  }

  console.log(`[generateTimeSlots] Generated ${slots.length} slots.`);
  console.log(
    "[generateTimeSlots] Final Slots (UTC):",
    JSON.stringify(
      slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      })),
    ),
  );
  console.log("[generateTimeSlots] --- End ---");
  return slots;
}

export default function BookService() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { toast } = useToast();
  const platformFee = platformFees.serviceBooking;
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // Represents the *day* selected, time part is ignored
  const [selectedTime, setSelectedTime] = useState<string>(); // Store the selected UTC start time string
  const [serviceLocation, setServiceLocation] = useState<
    "customer" | "provider"
  >("provider"); // Default to provider location
  const [dialogOpen, setDialogOpen] = useState(false);

  type BookingService = ServiceDetail & {
    breakTimes?: Array<{ start: string; end: string }>;
  };
  // Fetch service with provider info
  const { data: service, isLoading: serviceLoading } = useQuery<BookingService>({
    queryKey: [`/api/services/${id}`],
    queryFn: async () => {
      const data = await apiClient.get("/api/services/:id", {
        params: { id: Number(id) },
      });
      console.log("Raw service data from API:", data);
      const providedBreakTimes = (data as { breakTimes?: Array<{ start: string; end: string }> }).breakTimes;
      const breakTimes = Array.isArray(providedBreakTimes) && providedBreakTimes.length > 0
        ? providedBreakTimes
        : Array.isArray(data.breakTime)
          ? data.breakTime
          : [];
      return {
        ...data,
        breakTimes,
      } as BookingService;
    },
    enabled: !!id,
  });

  // Log service data when it changes
  useEffect(() => {
    if (service) {
      console.log("Service data loaded:", {
        id: service.id,
        name: service.name,
        hasWorkingHours: !!service.workingHours,
        breakTimeLength: Array.isArray(service.breakTime)
          ? service.breakTime.length
          : 0,
      });
    }
  }, [service]);

  // Fetch existing bookings for the selected date and service
  const { data: existingBookings, isLoading: bookingsLoading } = useQuery<
    any[]
  >({
    queryKey: [
      "/api/bookings/service",
      id,
      selectedDate.toISOString().split("T")[0],
    ], // Use ISO date string for consistent cache key
    queryFn: async () => {
      const dateStr = formatBase(selectedDate, "yyyy-MM-dd");
      console.log(`Fetching bookings for service ${id} on date ${dateStr}`);
      const res = await apiRequest(
        "GET",
        `/api/bookings/service/${id}?date=${dateStr}`,
      );
      if (!res.ok) throw new Error("Failed to fetch existing bookings");
      const bookingsData = await res.json();

      console.log("Raw booking data from API:", bookingsData);

      // Convert booking dates from ISO strings to Date objects (assuming they are UTC)
      const processedBookings = bookingsData
        .map((booking: any) => {
          try {
            const startDate = new Date(booking.bookingDate); // Assuming bookingDate is the start time in UTC
            // Calculate end time based on duration
            const endDate = service?.duration
              ? addMinutes(new Date(booking.bookingDate), service.duration)
              : addMinutes(new Date(booking.bookingDate), 60); // Default to 60 minutes if duration not set

            // Validate dates
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              console.warn("Invalid booking date detected:", booking);
              return null; // Will be filtered out
            }

            return {
              ...booking,
              start: startDate,
              end: endDate,
            };
          } catch (error) {
            console.error("Error processing booking:", error, booking);
            return null; // Will be filtered out
          }
        })
        .filter(Boolean); // Remove any null entries

      console.log("Processed bookings:", processedBookings);
      return processedBookings;
    },
    enabled: !!id && !!service, // Enable when service is loaded
  });

  // Memoize the break time array to ensure consistency
  const breakTimeArray = useMemo(() => {
    const currentService = service as BookingService | undefined;
    if (!currentService) return [];
    // Prefer breakTimes if it exists and is an array, otherwise use breakTime if it's an array, fallback to empty
    const breaks =
      Array.isArray(currentService.breakTimes) && currentService.breakTimes.length > 0
        ? currentService.breakTimes
        : Array.isArray(currentService.breakTime)
          ? currentService.breakTime
          : [];
    console.log("Memoized breakTimeArray:", breaks);
    return breaks;
  }, [service]);

  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);

  useEffect(() => {
    // Only proceed if we have all required data
    if (service && service.workingHours && service.duration) {
      // Ensure duration is also loaded
      console.log("Generating time slots with:", {
        selectedDate,
        duration: service.duration,
        bufferTime: service.bufferTime || 0,
        workingHours: service.workingHours,
        breakTimes: breakTimeArray,
        existingBookings: existingBookings || [],
        maxDailyBookings: service.maxDailyBookings ?? null, // Added nullish coalescing for safety
      });
      const slots = generateTimeSlots(
        selectedDate,
        service.duration,
        service.bufferTime || 0, // Use bufferTime from service or default to 0
        service.workingHours,
        breakTimeArray, // Use the memoized array
        existingBookings || [], // Pass existing bookings or empty array
        service.maxDailyBookings ?? null, // Pass maxDailyBookings or null
      );
      setAvailableSlots(slots);
      setSelectedTime(undefined); // Reset selected time when date changes or slots regenerate
    } else {
      console.log(
        "Skipping slot generation: Missing service, workingHours, or duration.",
      );
      setAvailableSlots([]); // Clear slots if required data is missing
    }
  }, [service, selectedDate, existingBookings, breakTimeArray]); // Add breakTimeArray to dependency array

  // Debug log when availableSlots changes
  useEffect(() => {
    console.log("Available slots updated:", {
      count: availableSlots.length,
      hasWorkingHours: !!service?.workingHours,
      breakTimeArrayLength: breakTimeArray.length,
      existingBookingsCount: existingBookings?.length || 0,
    });
  }, [availableSlots, service, existingBookings, breakTimeArray]);

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
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBookingRequest = () => {
    if (!selectedTime) {
      toast({ title: "Please select a time slot", variant: "destructive" });
      return;
    }
    setDialogOpen(true); // Open confirmation dialog
  };

  const confirmBooking = () => {
    if (!selectedTime || !service) return;

    // selectedTime is the UTC start time string
    const bookingDateUTC = new Date(selectedTime);

    createBookingMutation.mutate({
      serviceId: service.id,
      bookingDate: bookingDateUTC.toISOString(), // Send UTC ISO string
      serviceLocation: serviceLocation,
      // No providerAddress needed here
    });
  };

  // Calculate average rating
  const averageRating =
    service?.reviews && service.reviews.length > 0
      ? service.reviews.reduce((acc, review) => acc + review.rating, 0) /
        service.reviews.length
      : 0;

  // --- Calendar disabling logic ---
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of today

  const disabledDays = [
    { before: addDays(today, 1) }, // Disable past dates and today
    (date: Date) => {
      const workingHours = service?.workingHours;
      if (!workingHours) return true; // Disable if working hours not loaded
      const zonedDate = toZonedTime(date, timeZone);
      const dayKey = formatBase(zonedDate, "EEEE").toLowerCase();
      const schedule = (workingHours as any)[dayKey];
      return !schedule || !schedule.isAvailable;
    },
  ];

  const selectedDayKey = formatBase(
    toZonedTime(selectedDate, timeZone),
    "EEEE",
  ).toLowerCase();
  const selectedDaySchedule = service?.workingHours
    ? (service.workingHours as any)[selectedDayKey]
    : undefined;
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
                fromDate={addDays(today, 1)} // Start from tomorrow
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
                {bookingsLoading || serviceLoading ? ( // Show loader if service or bookings are loading
                  <div className="flex items-center justify-center h-20">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : availableSlots.length > 0 ? (
                  // Render available slots
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableSlots.map((slot, index) => {
                      const startTime =
                        slot.start instanceof Date
                          ? slot.start
                          : new Date(slot.start);
                      const slotKey = startTime.toISOString();
                      const formattedTime = formatInTimeZone(
                        startTime,
                        timeZone,
                        "hh:mm a",
                      );

                      return (
                        <Button
                          key={`${slotKey}-${index}`} // Use index in key to ensure uniqueness
                          variant={
                            selectedTime === slotKey ? "default" : "outline"
                          }
                          onClick={() => setSelectedTime(slotKey)}
                          disabled={!slot.available} // Should always be true here, but keep for safety
                          className="w-full justify-center"
                        >
                          {formattedTime}
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  // Render specific 'no slots' messages
                  <div>
                    {breakTimeArray.length > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No slots available due to provider's break times or
                        existing bookings.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No slots available. The provider may be fully booked or
                        unavailable on this day.
                      </p>
                    )}
                    {/* Optional: Add more detailed reason based on working hours check */}
                    {!service?.workingHours ||
                    !selectedDaySchedule?.isAvailable ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        Provider is marked as unavailable on this day.
                      </p>
                    ) : null}
                  </div>
                )}
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
                disabled={!selectedTime || createBookingMutation.isPending}
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
                {selectedTime
                  ? formatInTimeZone(
                      new Date(selectedTime),
                      timeZone,
                      "hh:mm a",
                    )
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
