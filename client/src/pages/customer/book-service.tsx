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
    const breakStart = parse(breakTime.start, "HH:mm", time);
    const breakEnd = parse(breakTime.end, "HH:mm", time);
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

    const isInBreakTime = isBreakTime(currentSlot, breakTimes) || 
                         isBreakTime(slotEnd, breakTimes);

    const isOverlapping = existingBookings.some(booking => {
      return (
        (currentSlot >= booking.start && currentSlot < booking.end) ||
        (slotEnd > booking.start && slotEnd <= booking.end)
      );
    });

    if (!isOverlapping && !isInBreakTime) {
      slots.push({
        start: currentSlot,
        end: slotEnd,
        available: true,
      });
    }

    currentSlot = addMinutes(slotEnd, bufferTime);
  }

  return slots;
}

export default function BookService() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [order, setOrder] = useState<any>(null);

  // Fetch service with provider info
  const { data: service, isLoading: serviceLoading } = useQuery<Service & { provider: User, reviews: any[] }>({
    queryKey: [`/api/services/${id}`, 'with-provider'],
    enabled: !!id,
  });

  // Get existing bookings for availability check
  const { data: existingBookings } = useQuery<{ start: Date; end: Date }[]>({
    queryKey: [`/api/services/${id}/bookings`, selectedDate.toISOString()],
    enabled: !!service && !!selectedDate,
  });

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
      setOrder(data.order);
      setPaymentDialogOpen(true);
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
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
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
                    }
                  }}
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
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {t('book_service')}
                </Button>
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

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete your booking</DialogTitle>
          </DialogHeader>
          <p>Please wait while we initialize the payment...</p>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}