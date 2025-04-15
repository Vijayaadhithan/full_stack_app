import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Booking, Service, Review } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Star, Calendar as CalendarIcon, Clock, X, CheckCircle, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { format, isAfter, isBefore, addDays } from "date-fns";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

type BookingWithService = Booking & { service: Service };

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function Bookings() {
  const { toast } = useToast();
  const [selectedBooking, setSelectedBooking] = useState<BookingWithService>();
  const [rescheduleDate, setRescheduleDate] = useState<Date>();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [order, setOrder] = useState<any>(null);

  const { data: bookings, isLoading } = useQuery<BookingWithService[]>({
    queryKey: ["/api/bookings"],
  });

  const cancelMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const res = await apiRequest("PATCH", `/api/bookings/${bookingId}`, {
        status: "cancelled",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Booking cancelled",
        description: "Your booking has been cancelled successfully.",
      });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({
      bookingId,
      date,
    }: {
      bookingId: number;
      date: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/bookings/${bookingId}`, {
        bookingDate: date,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Booking rescheduled",
        description: "Your booking has been rescheduled successfully.",
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (data: {
      serviceId: number;
      rating: number;
      review: string;
    }) => {
      const res = await apiRequest("POST", "/api/reviews", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      toast({
        title: "Review submitted",
        description: "Thank you for your feedback!",
      });
    },
  });
  
  // Mutation for marking a service as completed
  const completeServiceMutation = useMutation({
    mutationFn: async ({ bookingId, isSatisfactory, comments }: { bookingId: number; isSatisfactory: boolean; comments?: string }) => {
      const res = await apiRequest("PATCH", `/api/bookings/${bookingId}/complete`, { isSatisfactory, comments });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to complete service");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Service marked as completed",
        description: data.message || "Thank you for your feedback",
      });
      
      // If payment is required, initiate it
      if (data.paymentRequired && data.booking) {
        initiatePaymentMutation.mutate(data.booking.id);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Service completion failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation for initiating payment
  const initiatePaymentMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const res = await apiRequest("POST", `/api/bookings/${bookingId}/initiate-payment`, {});
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Payment initiation failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setOrder(data.order);
      setPaymentDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Payment initiation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCancel = (booking: BookingWithService) => {
    if (
      window.confirm(
        "Are you sure you want to cancel this booking? This action cannot be undone."
      )
    ) {
      cancelMutation.mutate(booking.id);
    }
  };

  const handleReschedule = () => {
    if (!selectedBooking || !rescheduleDate) return;
    rescheduleMutation.mutate({
      bookingId: selectedBooking.id,
      date: rescheduleDate.toISOString(),
    });
  };

  const handleReview = () => {
    if (!selectedBooking) return;
    reviewMutation.mutate({
      serviceId: selectedBooking.serviceId,
      rating,
      review,
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

  const upcomingBookings = bookings?.filter(
    (booking) =>
      booking.status !== "cancelled" &&
      booking.status !== "completed" &&
      isAfter(new Date(booking.bookingDate), new Date())
  );

  const pastBookings = bookings?.filter(
    (booking) =>
      booking.status === "completed" ||
      isBefore(new Date(booking.bookingDate), new Date())
  );

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto space-y-6"
      >
        <h1 className="text-2xl font-bold">My Bookings</h1>

        <Tabs defaultValue="upcoming">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <div className="grid gap-4">
              {upcomingBookings?.map((booking) => (
                <motion.div key={booking.id} variants={item}>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{booking.service.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {format(
                              new Date(booking.bookingDate),
                              "MMMM d, yyyy 'at' h:mm a"
                            )}
                          </p>
                          <p className={`text-sm font-medium ${booking.status === "accepted" ? "text-green-600" : booking.status === "rejected" ? "text-red-600" : "text-yellow-600"}`}>
                            Status: {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            {booking.rejectionReason && ` - Reason: ${booking.rejectionReason}`}
                          </p>
                          {booking.isRecurring && (
                            <p className="text-sm text-muted-foreground">
                              Recurring: {booking.recurringPattern}
                            </p>
                          )}
                        </div>
                        <div className="space-x-2">
                          {booking.status === "accepted" && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="default"
                                  onClick={() => setSelectedBooking(booking)}
                                >
                                  Mark Complete
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Service Completion</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 pt-4">
                                  <p>Was the service completed satisfactorily?</p>
                                  <div className="flex gap-4">
                                    <Button 
                                      className="flex-1" 
                                      onClick={() => {
                                        if (!selectedBooking) return;
                                        completeServiceMutation.mutate({
                                          bookingId: selectedBooking.id,
                                          isSatisfactory: true,
                                          comments: "Service was satisfactory"
                                        });
                                      }}
                                    >
                                      Yes, Proceed to Payment
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      className="flex-1"
                                      onClick={() => {
                                        if (!selectedBooking) return;
                                        completeServiceMutation.mutate({
                                          bookingId: selectedBooking.id,
                                          isSatisfactory: false,
                                          comments: "Service had issues"
                                        });
                                      }}
                                    >
                                      No, Report Issues
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                          {booking.status === "pending" && (
                            <>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    onClick={() => setSelectedBooking(booking)}
                                  >
                                    Reschedule
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Reschedule Booking</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 pt-4">
                                    <Calendar
                                      mode="single"
                                      selected={rescheduleDate}
                                      onSelect={setRescheduleDate}
                                      disabled={(date) =>
                                        isBefore(date, new Date()) ||
                                        isAfter(date, addDays(new Date(), 30))
                                      }
                                    />
                                    <Button
                                      className="w-full"
                                      onClick={handleReschedule}
                                      disabled={!rescheduleDate}
                                    >
                                      Confirm Reschedule
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

          <TabsContent value="past">
            <div className="grid gap-4">
              {pastBookings?.map((booking) => (
                <motion.div key={booking.id} variants={item}>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{booking.service.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {format(
                              new Date(booking.bookingDate),
                              "MMMM d, yyyy 'at' h:mm a"
                            )}
                          </p>
                          <p
                            className={`text-sm ${
                              booking.status === "completed"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {booking.status.charAt(0).toUpperCase() +
                              booking.status.slice(1)}
                          </p>
                        </div>
                        {booking.status === "completed" && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                onClick={() => setSelectedBooking(booking)}
                              >
                                Leave Review
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Review Service</DialogTitle>
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
                                        className={`p-0 ${
                                          value <= rating
                                            ? "text-yellow-500"
                                            : "text-gray-300"
                                        }`}
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
                                  disabled={!review}
                                >
                                  Submit Review
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
      
      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete your payment</DialogTitle>
          </DialogHeader>
          <p>Please wait while we initialize the payment...</p>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );

  // Initialize Razorpay when order is available - moved outside JSX
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
          name: order.booking?.service?.name || "Service Booking",
          description: `Payment for booking #${order.booking?.id}`,
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
                  title: "Payment successful",
                  description: "Your booking has been confirmed and payment processed.",
                });
                setPaymentDialogOpen(false);
              } else {
                throw new Error("Payment verification failed");
              }
            } catch (error) {
              toast({
                title: "Payment failed",
                description: error instanceof Error ? error.message : "Payment verification failed",
                variant: "destructive",
              });
            }
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
}
