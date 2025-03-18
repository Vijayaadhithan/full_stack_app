import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Service, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Clock, Calendar as CalendarIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { addDays, format, parse, isAfter, isBefore, addMinutes, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";

type TimeSlot = {
  start: Date;
  end: Date;
  available: boolean;
};

function generateTimeSlots(
  date: Date,
  duration: number,
  bufferTime: number,
  existingBookings: { start: Date; end: Date }[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const startOfDay = new Date(date.setHours(9, 0, 0, 0)); // Start at 9 AM
  const endOfDay = new Date(date.setHours(17, 0, 0, 0)); // End at 5 PM

  let currentSlot = startOfDay;
  while (currentSlot < endOfDay) {
    const slotEnd = addMinutes(currentSlot, duration);

    // Check if slot overlaps with any existing booking
    const isOverlapping = existingBookings.some(booking => {
      return (
        (currentSlot >= booking.start && currentSlot < booking.end) ||
        (slotEnd > booking.start && slotEnd <= booking.end)
      );
    });

    slots.push({
      start: currentSlot,
      end: slotEnd,
      available: !isOverlapping,
    });

    // Add buffer time to the next slot
    currentSlot = addMinutes(slotEnd, bufferTime);
  }

  return slots;
}

export default function BookService() {
  const { id } = useParams();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>();
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState<"weekly" | "monthly">();
  const [recurringDuration, setRecurringDuration] = useState<number>(4); // Number of occurrences
  const [joinWaitlist, setJoinWaitlist] = useState(false);

  const { data: service, isLoading: serviceLoading } = useQuery<Service>({
    queryKey: [`/api/services/${id}`],
  });

  const { data: provider } = useQuery<User>({
    queryKey: [`/api/users/${service?.providerId}`],
    enabled: !!service?.providerId,
  });

  // Get existing bookings for availability check
  const { data: existingBookings } = useQuery<{ start: Date; end: Date }[]>({
    queryKey: [`/api/services/${id}/bookings`, selectedDate.toISOString()],
    enabled: !!service,
  });

  // Generate available time slots
  const timeSlots = service && existingBookings
    ? generateTimeSlots(
        selectedDate,
        service.duration,
        service.bufferTime || 0,
        existingBookings
      )
    : [];

  const bookingMutation = useMutation({
    mutationFn: async (data: {
      serviceId: number;
      date: string;
      time: string;
      isRecurring: boolean;
      recurringPattern?: string;
      recurringDuration?: number;
    }) => {
      const res = await apiRequest("POST", "/api/bookings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Booking successful",
        description: "Your service has been booked successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Booking failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const waitlistMutation = useMutation({
    mutationFn: async (data: { serviceId: number; preferredDate: string }) => {
      const res = await apiRequest("POST", "/api/waitlist", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Added to waitlist",
        description: "You'll be notified when a slot becomes available.",
      });
    },
  });

  const handleBooking = () => {
    if (!selectedTime || !service) return;

    const dateTime = parse(selectedTime, "HH:mm", selectedDate);

    if (joinWaitlist) {
      waitlistMutation.mutate({
        serviceId: service.id,
        preferredDate: dateTime.toISOString(),
      });
      return;
    }

    // For recurring bookings, validate all future dates
    if (isRecurring && recurringPattern) {
      const endDate = addDays(new Date(), 90); // Allow booking up to 90 days in advance
      const dates = recurringPattern === "weekly"
        ? eachWeekOfInterval({ start: selectedDate, end: endDate }).slice(0, recurringDuration)
        : eachMonthOfInterval({ start: selectedDate, end: endDate }).slice(0, recurringDuration);

      // Check availability for all recurring dates
      const allDatesAvailable = dates.every(date => {
        const slots = generateTimeSlots(
          date,
          service.duration,
          service.bufferTime || 0,
          existingBookings || []
        );
        return slots.some(slot => format(slot.start, "HH:mm") === selectedTime && slot.available);
      });

      if (!allDatesAvailable) {
        toast({
          title: "Booking not available",
          description: "Some of your requested recurring dates are not available. Please choose different dates or join the waitlist.",
          variant: "destructive",
        });
        return;
      }
    }

    bookingMutation.mutate({
      serviceId: service.id,
      date: selectedDate.toISOString(),
      time: selectedTime,
      isRecurring,
      recurringPattern,
      recurringDuration: isRecurring ? recurringDuration : undefined,
    });
  };

  if (serviceLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <span className="loading loading-spinner" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Book {service?.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Label>Select Date</Label>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  disabled={(date) =>
                    isBefore(date, new Date()) ||
                    isAfter(date, addDays(new Date(), 90))
                  }
                />
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Available Time Slots</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {timeSlots.map((slot) => (
                      <Button
                        key={slot.start.toISOString()}
                        variant={
                          selectedTime ===
                          format(slot.start, "HH:mm")
                            ? "default"
                            : "outline"
                        }
                        disabled={!slot.available}
                        onClick={() =>
                          setSelectedTime(format(slot.start, "HH:mm"))
                        }
                        className="w-full"
                      >
                        {format(slot.start, "HH:mm")}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={isRecurring}
                      onCheckedChange={setIsRecurring}
                    />
                    <Label>Make this a recurring booking</Label>
                  </div>

                  {isRecurring && (
                    <div className="space-y-4">
                      <Select
                        value={recurringPattern}
                        onValueChange={(value: "weekly" | "monthly") =>
                          setRecurringPattern(value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select recurring pattern" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="space-y-2">
                        <Label>Number of occurrences</Label>
                        <Select
                          value={recurringDuration.toString()}
                          onValueChange={(value) =>
                            setRecurringDuration(parseInt(value))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                          <SelectContent>
                            {[4, 8, 12].map((weeks) => (
                              <SelectItem key={weeks} value={weeks.toString()}>
                                {weeks} {recurringPattern === "weekly" ? "weeks" : "months"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                {!timeSlots.some((slot) => slot.available) && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={joinWaitlist}
                      onCheckedChange={setJoinWaitlist}
                    />
                    <Label>Join waitlist for this date</Label>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleBooking}
                  disabled={(!selectedTime && !joinWaitlist) || bookingMutation.isPending}
                >
                  {bookingMutation.isPending ? (
                    <span className="loading loading-spinner" />
                  ) : joinWaitlist ? (
                    "Join Waitlist"
                  ) : (
                    "Book Service"
                  )}
                </Button>
              </div>
            </div>

            {service && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Service Details</h3>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Duration: {service.duration} minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    <span>Buffer time: {service.bufferTime} minutes</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}