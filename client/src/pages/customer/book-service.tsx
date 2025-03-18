import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Service, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { motion } from "framer-motion";
import { Clock, Calendar as CalendarIcon, AlertCircle } from "lucide-react";
import { useState } from "react";
import { addDays, format, parse, isAfter, isBefore, addMinutes } from "date-fns";

type TimeSlot = {
  start: Date;
  end: Date;
  available: boolean;
};

function generateTimeSlots(
  date: Date,
  duration: number,
  bufferTime: number,
  workingHours: any,
  existingBookings: { start: Date; end: Date }[]
): TimeSlot[] {
  const dayOfWeek = format(date, 'EEEE').toLowerCase();
  const daySchedule = workingHours[dayOfWeek];

  if (!daySchedule?.isAvailable) {
    return [];
  }

  const slots: TimeSlot[] = [];
  const startTime = parse(daySchedule.start, "HH:mm", date);
  const endTime = parse(daySchedule.end, "HH:mm", date);

  let currentSlot = startTime;
  while (currentSlot < endTime) {
    const slotEnd = addMinutes(currentSlot, duration);

    // Check if slot overlaps with any existing booking or break time
    const isOverlapping = existingBookings.some(booking => {
      return (
        (currentSlot >= booking.start && currentSlot < booking.end) ||
        (slotEnd > booking.start && slotEnd <= booking.end)
      );
    });

    if (!isOverlapping) {
      slots.push({
        start: currentSlot,
        end: slotEnd,
        available: true,
      });
    }

    // Add buffer time to the next slot
    currentSlot = addMinutes(slotEnd, bufferTime);
  }

  return slots;
}

export default function BookService() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>();

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
        service.workingHours,
        existingBookings
      )
    : [];

  const bookingMutation = useMutation({
    mutationFn: async (data: {
      serviceId: number;
      date: string;
      time: string;
    }) => {
      const res = await apiRequest("POST", "/api/bookings", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create booking");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: t("booking_successful"),
        description: t("booking_confirmation_sent"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("booking_failed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBooking = () => {
    if (!selectedTime || !service) return;

    const dateTime = parse(selectedTime, "HH:mm", selectedDate);

    bookingMutation.mutate({
      serviceId: service.id,
      date: selectedDate.toISOString(),
      time: selectedTime,
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
            <CardTitle>{service?.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="font-semibold mb-2">{t('select_date')}</h3>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  disabled={(date) =>
                    isBefore(date, new Date()) ||
                    isAfter(date, addDays(new Date(), 30))
                  }
                />
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">{t('available_time_slots')}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {timeSlots.map((slot) => (
                    <Button
                      key={slot.start.toISOString()}
                      variant={
                        selectedTime === format(slot.start, "HH:mm")
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        setSelectedTime(format(slot.start, "HH:mm"))
                      }
                      className="w-full"
                    >
                      {format(slot.start, "HH:mm")}
                    </Button>
                  ))}
                </div>

                {!timeSlots.length && (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{t('no_slots_available')}</span>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleBooking}
                  disabled={!selectedTime || bookingMutation.isPending}
                >
                  {bookingMutation.isPending ? (
                    <span className="loading loading-spinner" />
                  ) : (
                    t('book_service')
                  )}
                </Button>
              </div>
            </div>

            {service && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">{t('service_details')}</h3>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{t('duration')}: {service.duration} {t('minutes')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    <span>{t('buffer_time')}: {service.bufferTime} {t('minutes')}</span>
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