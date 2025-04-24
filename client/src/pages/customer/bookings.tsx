import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
} from "lucide-react";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { formatIndianDisplay } from "@shared/date-utils";
import { DialogTrigger } from "@radix-ui/react-dialog";

type BookingWithService = Booking & {
  service: Service;
  provider?: {
    id: number;
    name: string;
    phone: string;
    addressStreet?: string;
    addressCity?: string;
    addressState?: string;
    addressPostalCode?: string;
    addressCountry?: string;
  } | null;
};

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

  // Fetch bookings
  const { data: bookings, isLoading } = useQuery<BookingWithService[]>({
    queryKey: ["/api/bookings"],
  });

  // Fetch existing reviews for selected service
  const { data: existingReviews } = useQuery<Review[]>({
    queryKey: ["/api/reviews/service/", selectedBooking?.serviceId],
    enabled: !!selectedBooking?.serviceId,
  });

  // Derive the user's review for the selected booking
  const userReview = existingReviews?.find(
    (r) =>
      r.serviceId === selectedBooking?.serviceId &&
      r.bookingId === selectedBooking?.id
  );

  // When editing, populate rating & text
  useEffect(() => {
    if (userReview) {
      setRating(userReview.rating);
      setReview(userReview.review || "");
    }
  }, [userReview]);

  // Razorpay script loader (must be above the return)
  useEffect(() => {
    if (!order) return;

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      const options = {
        key: "rzp_test_WIK4gEdE7PPhgw",
        amount: order.amount,
        currency: order.currency,
        name: order.booking?.service?.name || "Service Booking",
        description: `Payment for booking #${order.booking?.id}`,
        order_id: order.id,
        handler: async (response: any) => {
          try {
            const res = await apiRequest(
              "POST",
              `/api/bookings/${order.booking.id}/payment`,
              {
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }
            );
            if (!res.ok) throw new Error("Payment verification failed");
            queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
            queryClient.invalidateQueries({
              queryKey: ["/api/notifications"],
            });
            toast({
              title: "Payment successful",
              description:
                "Your booking has been confirmed and payment processed.",
            });
            setPaymentDialogOpen(false);
          } catch (err: any) {
            toast({
              title: "Payment failed",
              description: err.message,
              variant: "destructive",
            });
          }
        },
        theme: { color: "#10B981" },
      };
      new window.Razorpay(options).open();
    };
    document.body.appendChild(script);
    return () => void document.body.removeChild(script);
  }, [order, toast]);

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
    }: {
      bookingId: number;
      date: string;
    }) =>
      apiRequest("PATCH", `/api/bookings/${bookingId}`, {
        bookingDate: date,
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Booking rescheduled",
        description: "Your booking has been rescheduled successfully.",
      });
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
        return apiRequest("PATCH", `/api/reviews/${data.id}`, {
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
      toast({
        title: userReview ? "Review updated" : "Review submitted",
        description: "Thank you for your feedback!",
      });
    },
  });

  // Complete service mutation
  const completeServiceMutation = useMutation({
    mutationFn: async ({
      bookingId,
      isSatisfactory,
      comments,
    }: {
      bookingId: number;
      isSatisfactory: boolean;
      comments?: string;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/bookings/${bookingId}/complete`,
        { isSatisfactory, comments }
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to complete service");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Service marked as completed",
        description: data.message || "Thank you for your feedback",
      });
      if (data.paymentRequired && data.booking) {
        setOrder(null);
        setOrder(data.booking); // triggers Razorpay effect
        setPaymentDialogOpen(true);
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

  // Initiate payment (if needed)
  const initiatePaymentMutation = useMutation({
    mutationFn: (bookingId: number) =>
      apiRequest("POST", `/api/bookings/${bookingId}/initiate-payment`, {}).then(
        (r) => {
          if (!r.ok) throw new Error("Payment initiation failed");
          return r.json();
        }
      ),
    onSuccess: (data) => {
      setOrder(data.order);
      setPaymentDialogOpen(true);
    },
    onError: (error: Error) =>
      toast({
        title: "Payment initiation failed",
        description: error.message,
        variant: "destructive",
      }),
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

  const upcomingBookings = bookings?.filter(
    (b) =>
      b.status !== "cancelled" &&
      b.status !== "completed" &&
      isAfter(new Date(b.bookingDate), new Date())
  );
  const pastBookings = bookings?.filter(
    (b) =>
      b.status === "completed" ||
      isBefore(new Date(b.bookingDate), new Date())
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          {/* Upcoming */}
          <TabsContent value="upcoming">
            <div className="grid gap-4">
              {upcomingBookings?.map((booking) => (
                <motion.div key={booking.id} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{booking.service.name}</h3>
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
                                <strong>Provider:</strong> {booking.provider.name}
                              </p>
                              <p>
                                <strong>Phone:</strong> {booking.provider.phone}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="space-x-2">
                          {booking.status === "accepted" && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button onClick={() => setSelectedBooking(booking)}>
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
                                      onClick={() =>
                                        completeServiceMutation.mutate({
                                          bookingId: booking.id,
                                          isSatisfactory: true,
                                          comments: "Service was satisfactory",
                                        })
                                      }
                                    >
                                      Yes, Proceed to Payment
                                    </Button>
                                    <Button
                                      variant="outline"
                                      className="flex-1"
                                      onClick={() =>
                                        completeServiceMutation.mutate({
                                          bookingId: booking.id,
                                          isSatisfactory: false,
                                          comments: "Service had issues",
                                        })
                                      }
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
                                  <Button onClick={() => setSelectedBooking(booking)}>
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

          {/* Past */}
          <TabsContent value="past">
            <div className="grid gap-4">
              {pastBookings?.map((booking) => (
                <motion.div key={booking.id} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{booking.service.name}</h3>
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
                                <strong>Provider:</strong> {booking.provider.name}
                              </p>
                              <p>
                                <strong>Phone:</strong> {booking.provider.phone}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="space-x-2">
                          {booking.status === "accepted" && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button onClick={() => setSelectedBooking(booking)}>
                                  {existingReviews?.some((r) => r.bookingId === booking.id)
                                    ? "Edit Review"
                                    : "Leave Review"}
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>
                                    {userReview ? "Edit Review" : "Review Service"}
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
                                    {userReview ? "Update Review" : "Submit Review"}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div> {/* ← added this closing tag */}
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
}
