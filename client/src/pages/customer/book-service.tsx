import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Service, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { motion } from "framer-motion";
import { Loader2, MapPin, Clock, Star, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { format, addDays, isBefore, isAfter, addMinutes, isWithinInterval, parse } from "date-fns";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type TimeSlot = {
  start: Date;
  end: Date;
  available: boolean;
};

function isBreakTime(time: Date, breakTimes: Array<{ start: string; end: string }>) {
  return breakTimes.some(breakTime => {
    // Ensure break times are in HH:mm format
    const formattedStart = breakTime.start.includes(':') ? breakTime.start : `${breakTime.start}:00`;
    const formattedEnd = breakTime.end.includes(':') ? breakTime.end : `${breakTime.end}:00`;
    
    console.log(`Checking break time: ${formattedStart} - ${formattedEnd} against slot time: ${format(time, 'HH:mm')}`);
    
    const breakStart = parse(formattedStart, "HH:mm", time);
    const breakEnd = parse(formattedEnd, "HH:mm", time);
    
    // Log if we have invalid dates
    if (isNaN(breakStart.getTime()) || isNaN(breakEnd.getTime())) {
      console.error(`Invalid break time format: ${formattedStart} - ${formattedEnd}`);
      return false;
    }
    
    return isWithinInterval(time, { start: breakStart, end: breakEnd });
  });
}

function generateTimeSlots(
  date: Date,
  duration: number,
  bufferTime: number,
  workingHours: any,
  breakTimes: Array<{ start: string; end: string }>,
  existingBookings: { start: Date; end: Date }[]
): TimeSlot[] {
  // Get day of week in lowercase (monday, tuesday, etc.) to match workingHours keys exactly
  const dayOfWeek = format(date, 'EEEE').toLowerCase();
  const daySchedule = workingHours[dayOfWeek];

  console.log('Generating time slots for:', {
    date: format(date, 'yyyy-MM-dd'),
    dayOfWeek,
    daySchedule,
    workingHoursKeys: workingHours ? Object.keys(workingHours) : 'undefined'
  });

  // Check if day schedule exists and is available
  if (!daySchedule) {
    console.error(`Day schedule not found for ${dayOfWeek}. Available keys:`, workingHours ? Object.keys(workingHours) : 'undefined');
    return [];
  }

  if (!daySchedule.isAvailable) {
    console.log(`Day ${dayOfWeek} is marked as not available`);
    return [];
  }

  // Ensure time format is HH:mm
  const formatTimeString = (timeStr: string): string => {
    if (!timeStr) return "00:00";
    // If already in HH:mm format, return as is
    if (timeStr.includes(':')) return timeStr;
    // If it's in 12-hour format with AM/PM, convert to 24-hour
    if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
      // This is a simplification - a real implementation would properly convert 12h to 24h
      console.warn(`Time format appears to be 12-hour: ${timeStr}. Should be in 24-hour format (HH:mm).`);
      return timeStr; // Return as is for now, but log a warning
    }
    // If it's just a number, assume it's hours and add :00
    return `${timeStr}:00`;
  };

  const formattedStart = formatTimeString(daySchedule.start);
  const formattedEnd = formatTimeString(daySchedule.end);

  console.log(`Using formatted time range: ${formattedStart} - ${formattedEnd}`);

  const slots: TimeSlot[] = [];
  const startTime = parse(formattedStart, "HH:mm", date);
  const endTime = parse(formattedEnd, "HH:mm", date);

  console.log('Parsed time range:', {
    startTime: startTime.toString(),
    endTime: endTime.toString(),
    isStartValid: !isNaN(startTime.getTime()),
    isEndValid: !isNaN(endTime.getTime()),
    rawStart: daySchedule.start,
    rawEnd: daySchedule.end
  });

  // If either time is invalid, return empty slots
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    console.error('Invalid time format. Cannot generate time slots.');
    return [];
  }

  // Log existing bookings for debugging
  console.log(`Existing bookings for ${format(date, 'yyyy-MM-dd')}:`, 
    existingBookings.map(b => `${format(b.start, 'HH:mm')} - ${format(b.end, 'HH:mm')}`));
  
  // Log break times for debugging
  console.log('Break times:', breakTimes);

  let currentSlot = startTime;
  while (currentSlot < endTime) {
    const slotEnd = addMinutes(currentSlot, duration);

    const isInBreakTime = isBreakTime(currentSlot, breakTimes) || 
                         isBreakTime(slotEnd, breakTimes);

    const isOverlapping = existingBookings.some(booking => {
      const overlaps = (
        (currentSlot >= booking.start && currentSlot < booking.end) ||
        (slotEnd > booking.start && slotEnd <= booking.end) ||
        (currentSlot <= booking.start && slotEnd >= booking.end)
      );
      if (overlaps) {
        console.log(`Slot ${format(currentSlot, 'HH:mm')} - ${format(slotEnd, 'HH:mm')} overlaps with booking ${format(booking.start, 'HH:mm')} - ${format(booking.end, 'HH:mm')}`);
      }
      return overlaps;
    });

    if (!isOverlapping && !isInBreakTime) {
      slots.push({
        start: currentSlot,
        end: slotEnd,
        available: true,
      });
    } else {
      console.log(`Slot ${format(currentSlot, 'HH:mm')} - ${format(slotEnd, 'HH:mm')} is not available. Break time: ${isInBreakTime}, Overlapping: ${isOverlapping}`);
    }

    currentSlot = addMinutes(slotEnd, bufferTime);
  }

  console.log(`Generated ${slots.length} available time slots for ${format(date, 'yyyy-MM-dd')}`);
  return slots;
}

export default function BookService() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [order, setOrder] = useState<any>(null);

  // Fetch service with provider info
  const { data: service, isLoading: serviceLoading } = useQuery<Service & { provider: User, reviews: any[] }>({    
    queryKey: [`/api/services/${id}`],
    enabled: !!id,
  });

  // Get existing bookings for availability check
  const { data: existingBookingsRaw } = useQuery<{ start: string; end: string }[]>({
    queryKey: [`/api/services/${id}/bookings`, selectedDate.toISOString()],
    enabled: !!service && !!selectedDate,
  });
  
  // Parse the dates from strings to Date objects
  const existingBookings = existingBookingsRaw?.map(booking => ({
    start: new Date(booking.start),
    end: new Date(booking.end)
  })) || [];

  // Generate available time slots
  const timeSlots = service && existingBookings
    ? generateTimeSlots(
        selectedDate,
        service.duration,
        service.bufferTime || 0,
        service.workingHours,
        service.breakTime || [],
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
        throw new Error(error.message || t("booking_failed"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Show booking pending notification - provider needs to accept first
      toast({
        title: t("booking_request_sent"),
        description: t("booking_pending_provider_approval"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("booking_failed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation for handling payment after booking is accepted and service is completed
  const paymentMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const res = await apiRequest("POST", `/api/bookings/${bookingId}/initiate-payment`, {});
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || t("payment_initiation_failed"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      setOrder(data.order);
      setPaymentDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: t("payment_initiation_failed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation for marking a service as completed
  const completeServiceMutation = useMutation({
    mutationFn: async ({ bookingId, isSatisfactory, comments }: { bookingId: number; isSatisfactory: boolean; comments?: string }) => {
      const res = await apiRequest("PATCH", `/api/bookings/${bookingId}/complete`, { isSatisfactory, comments });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || t("service_completion_failed"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: t("service_marked_complete"),
        description: data.message || t("thank_you_for_feedback"),
      });
      
      // If payment is required, initiate it
      if (data.paymentRequired && data.booking) {
        paymentMutation.mutate(data.booking.id);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("service_completion_failed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Show information dialog when component mounts
  useEffect(() => {
    setDialogOpen(true);
  }, []);

  const handleBooking = () => {
    if (!selectedTime || !service) return;

    bookingMutation.mutate({
      serviceId: service.id,
      date: selectedDate.toISOString(),
      time: selectedTime,
    });
  };

  useEffect(() => {
    if (order) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        const options = {
          key: "rzp_test_WIK4gEdE7PPhgw", // Using the provided test key directly
          amount: order.amount,
          currency: order.currency,
          name: service?.name,
          description: `Booking for ${service?.name}`,
          order_id: order.id,
          handler: async (response: any) => {
            try {
              const res = await apiRequest("POST", `/api/bookings/${order.booking.id}/payment`, {
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });

              if (res.ok) {
                queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
                queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
                toast({
                  title: t("booking_successful"),
                  description: t("booking_confirmation_sent"),
                });
                setPaymentDialogOpen(false);
              } else {
                throw new Error("Payment verification failed");
              }
            } catch (error) {
              toast({
                title: t("payment_failed"),
                description: error instanceof Error ? error.message : "Payment verification failed",
                variant: "destructive",
              });
            }
          },
          prefill: {
            name: service?.provider?.name,
            email: service?.provider?.email,
          },
          theme: {
            color: "#10B981",
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      };
      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    }
  }, [order]);

  if (serviceLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!service) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h2 className="text-2xl font-bold mb-4">Service not found</h2>
          <Link href="/customer/browse-services">
            <Button>Back to Services</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const averageRating = service.reviews?.length
    ? service.reviews.reduce((acc, review) => acc + review.rating, 0) / service.reviews.length
    : 0;

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto space-y-6 p-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>{service.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Service Provider</h3>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  {service.provider?.profilePicture ? (
                    <img
                      src={service.provider.profilePicture}
                      alt={service.provider.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">{service.provider?.name[0]}</span>
                  )}
                </div>
                <div>
                  <p className="font-medium">{service.provider?.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    <span>{averageRating.toFixed(1)} ({service.reviews?.length || 0} reviews)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="font-semibold mb-2">{t('select_date')}</h3>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setSelectedTime(undefined);
                      console.log(`Selected date: ${format(date, 'yyyy-MM-dd')}`);
                    }
                  }}
                  disabled={(date) =>
                    // Only disable dates in the past
                    isBefore(date, new Date())
                    // No upper limit on future dates - can book any date in the future
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
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {t('request_booking')}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {t('booking_requires_provider_approval')}
                </p>
              </div>
            </div>

            {/* Service Details */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">{t('service_details')}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{t('duration')}: {service.duration} {t('minutes')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{t('location')}: {service.location ? `${service.location.lat}, ${service.location.lng}` : 'Not specified'}</span>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">{service.description}</p>
                  <p className="mt-2 font-semibold">₹{service.price}</p>
                </div>
              </div>
            </div>

            {/* Reviews Section */}
            {service.reviews && service.reviews.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Customer Reviews</h3>
                <div className="space-y-4">
                  {service.reviews.map((review) => (
                    <div key={review.id} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex text-yellow-500">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-current" />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(review.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="text-sm">{review.review}</p>
                      {review.providerReply && (
                        <div className="mt-2 pl-4 border-l-2">
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Provider response:</span> {review.providerReply}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("payment_processing")}</DialogTitle>
          </DialogHeader>
          <p>{t("payment_initialization_message")}</p>
        </DialogContent>
      </Dialog>
      
      {/* Information Dialog about booking process */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("booking_process_info")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="mb-4">
              <h3 className="font-medium text-lg mb-1">{t("booking_process_step1")}</h3>
              <p className="text-muted-foreground">{t("When you request a booking, the service provider will receive a notification.")}</p>
            </div>
            <div className="mb-4">
              <h3 className="font-medium text-lg mb-1">{t("booking_process_step2")}</h3>
              <p className="text-muted-foreground">{t("The provider will review your request and either accept or reject it. You'll receive a notification with their decision.")}</p>
            </div>
            <div className="mb-4">
              <h3 className="font-medium text-lg mb-1">{t("booking_process_step3")}</h3>
              <p className="text-muted-foreground">{t("If accepted, you'll meet the provider at the scheduled time. After the service is completed, you can mark it as satisfactory and proceed with payment.")}</p>
            </div>
            <div className="mb-4">
              <h3 className="font-medium text-lg mb-1">{t("booking_process_step4")}</h3>
              <p className="text-muted-foreground">{t("If rejected, you'll receive a notification with the reason and can book with another provider.")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)}>{t("I understand")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}