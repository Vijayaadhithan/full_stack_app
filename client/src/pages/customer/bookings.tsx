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
import { Input } from "@/components/ui/input"; // Added Input for datetime-local

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
  // const [rescheduleDate, setRescheduleDate] = useState<Date>();
  // const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const [newRescheduleDateTime, setNewRescheduleDateTime] = useState<string>(""); // New state for datetime-local
  const [rescheduleComments, setRescheduleComments] = useState<string>(""); // Added for comments
  // const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [order, setOrder] = useState<any>(null);

  // Fetch bookings
  const { data: bookings, isLoading } = useQuery<BookingWithService[]> ({
    queryKey: ["/api/bookings"],
  });

  // REMOVED: Fetch available slots for rescheduling (providerAvailability query and related useEffects)
  // const { data: providerAvailability, isLoading: isLoadingAvailability } = useQuery<string[], Error>({
  //   queryKey: ["/api/services", selectedBooking?.serviceId, "availability", rescheduleDate ? rescheduleDate.toISOString().split('T')[0] : undefined],
  //   queryFn: async () => {
  //     if (!selectedBooking?.serviceId || !rescheduleDate) return [];
  //     const dateStr = rescheduleDate.toISOString().split('T')[0];
  //     const response = await apiRequest("GET", `/api/services/${selectedBooking.serviceId}/availability?date=${dateStr}`);
  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(errorData.message || "Failed to fetch availability");
  //     }
  //     return response.json();
  //   },
  //   enabled: !!selectedBooking?.serviceId && !!rescheduleDate,
  // });

  // REMOVED: useEffect for providerAvailability
  // useEffect(() => {
  //   if (providerAvailability) {
  //     setAvailableTimes(providerAvailability);
  //     if (providerAvailability.length > 0) {
  //       setRescheduleTime(providerAvailability[0]); // Default to the first available time
  //     } else {
  //       setRescheduleTime("");
  //     }
  //   }
  // }, [providerAvailability]);

  // REMOVED: useEffect for providerAvailability error handling
  // useEffect(() => {
  //   if (providerAvailability === undefined) return;
    
  //   const queryState = queryClient.getQueryState([
  //     "/api/services",
  //     selectedBooking?.serviceId,
  //     "availability",
  //     rescheduleDate ? rescheduleDate.toISOString().split('T')[0] : undefined,
  //   ]);
  //   const error = queryState?.error;
    
  //   if (error) {
  //     toast({
  //       title: "Error fetching availability",
  //       description: error instanceof Error ? error.message : "Failed to fetch availability",
  //       variant: "destructive",
  //     });
  //     setAvailableTimes([]);
  //     setRescheduleTime("");
  //   }
  // }, [providerAvailability, queryClient, rescheduleDate, selectedBooking?.serviceId]);

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
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "", // Use environment variable
        amount: order.amount, // Amount should be in the smallest currency unit (e.g., paise for INR)
        currency: order.currency,
        name: "Service Booking Payment", // Keep it simple or fetch service name if needed
        description: `Payment for booking #${order.bookingId}`, // Use bookingId from order state
        order_id: order.id, // This is the Razorpay Order ID from the order state
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
      time,
      comments, // Added comments
    }: {
      bookingId: number;
      date: Date; // Changed to Date object
      time: string;
      comments?: string; // Added comments
    }) => {
      // Combine date and time
      const newBookingDate = new Date(date);
      const [hours, minutes] = time.split(":").map(Number);
      newBookingDate.setHours(hours, minutes, 0, 0);

      return apiRequest("PATCH", `/api/bookings/${bookingId}`, {
        bookingDate: newBookingDate.toISOString(), // Send as ISO string
        comments: comments, // Send comments
      }).then((r) => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Reschedule Requested",
        description: "Your reschedule request has been sent to the provider for confirmation.",
      });
      setSelectedBooking(undefined); // Close dialog
      setNewRescheduleDateTime("");
      setRescheduleComments(""); // Reset comments
    },
    onError: (error: any) => {
      toast({
        title: "Reschedule Failed",
        description: error.message || "Could not reschedule booking.",
        variant: "destructive",
      });
      setRescheduleComments(""); // Reset comments on error as well
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
        // Use the customer-specific update endpoint
        return apiRequest("PUT", `/api/reviews/${data.id}/customer`, {
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
    onError: (error: any) => {
      // Log the full error object for detailed debugging
      console.error("Review submission error:", error);
      // Display error message to the user
      const errorMessage = error.response?.data?.message || "Failed to submit review. Please try again.";
      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setRescheduleComments(""); // Reset comments on error as well
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
    onSuccess: (data, variables) => { // Added variables to access bookingId
      toast({
        title: "Service marked as completed",
        description: data.message || "Thank you for your feedback",
      });
      // If payment is required, initiate the payment flow
      if (data.paymentRequired) {
        initiatePaymentMutation.mutate(variables.bookingId); // Call initiatePaymentMutation
      } else {
        // If no payment needed, just invalidate queries
        queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Service completion failed",
        description: error.message,
        variant: "destructive",
      });
      setRescheduleComments(""); // Reset comments on error as well
    },
  });

  // Initiate payment (if needed)
  const initiatePaymentMutation = useMutation({
    mutationFn: (bookingId: number) =>
      apiRequest("POST", `/api/bookings/${bookingId}/initiate-payment`, {}).then(
        async (r) => {
          if (!r.ok) {
            const errorBody = await r.json().catch(() => ({ message: "Payment initiation failed" }));
            throw new Error(errorBody.message || "Payment initiation failed");
          }
          return r.json(); // Expects { razorpayOrderId: string, amount: number, currency: string, bookingId: number }
        }
      ),
    onSuccess: (data) => {
      // Set the order state with the specific details needed for Razorpay
      setOrder({
        id: data.razorpayOrderId, // This is the Razorpay Order ID
        amount: data.amount,
        currency: data.currency,
        bookingId: data.bookingId, // Keep booking ID for reference/description
      });
      setPaymentDialogOpen(true); // Open the dialog (which contains the button to trigger useEffect)
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
    if (!selectedBooking || !newRescheduleDateTime) return;

    // Basic validation for datetime-local input (e.g., not empty)
    // More sophisticated validation (e.g., ensuring it's in the future) can be added here or on the backend
    if (new Date(newRescheduleDateTime) <= new Date()) {
        toast({
            title: "Invalid Date/Time",
            description: "Please select a future date and time for rescheduling.",
            variant: "destructive",
        });
        return;
    }

    const newDate = new Date(newRescheduleDateTime);
    const timeString = newRescheduleDateTime.split("T")[1];

    rescheduleMutation.mutate({
      bookingId: selectedBooking.id,
      date: newDate,
      time: timeString,
      comments: rescheduleComments,
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
                                    {/* REMOVED: Calendar and Time Select */}
                                    {/* <Calendar
                                      mode="single"
                                      selected={rescheduleDate}
                                      onSelect={setRescheduleDate}
                                      disabled={(date) =>
                                        isBefore(date, addDays(new Date(), 1)) || // Disable past dates and today
                                        isAfter(date, addDays(new Date(), 30))  // Disable dates more than 30 days out
                                      }
                                    />
                                    {rescheduleDate && (
                                      <div className="space-y-2 pt-2">
                                        <Label htmlFor="reschedule-time">Select Time</Label>
                                        {isLoadingAvailability && <p>Loading available times...</p>}
                                        {!isLoadingAvailability && availableTimes.length === 0 && rescheduleDate && (
                                          <p className="text-sm text-muted-foreground">
                                            No available time slots for the selected date. Please choose another date.
                                          </p>
                                        )}
                                        {availableTimes.length > 0 && (
                                          <Select onValueChange={setRescheduleTime} value={rescheduleTime}>
                                            <SelectTrigger id="reschedule-time">
                                              <SelectValue placeholder="Select a time" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {availableTimes.map((time) => (
                                                <SelectItem key={time} value={time}>
                                                  {time}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        )}
                                      </div>
                                    )} */}
                                    <div>
                                      <Label htmlFor="newRescheduleDateTime">New Date and Time</Label>
                                      <Input 
                                        type="datetime-local"
                                        id="newRescheduleDateTime"
                                        value={newRescheduleDateTime}
                                        onChange={(e) => setNewRescheduleDateTime(e.target.value)}
                                        className="mt-1"
                                      />
                                    </div>
                                    <div className="mt-4">
                                      <Label htmlFor="rescheduleComments">Reason for Rescheduling (Optional)</Label>
                                      <Textarea
                                        id="rescheduleComments"
                                        value={rescheduleComments}
                                        onChange={(e) => setRescheduleComments(e.target.value)}
                                        placeholder="Enter any comments for the provider..."
                                        className="mt-1"
                                      />
                                    </div>
                                    <Button
                                      className="w-full mt-4"
                                      onClick={handleReschedule}
                                      disabled={!newRescheduleDateTime || rescheduleMutation.isPending}
                                    >
                                      {rescheduleMutation.isPending ? "Confirming..." : "Confirm Reschedule"}
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
                          {/* Review Button for Completed Bookings */}
                          {booking.status === 'completed' && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" onClick={() => setSelectedBooking(booking)}>
                                  {existingReviews?.some((r) => r.bookingId === booking.id)
                                    ? "Edit Review"
                                    : "Leave Review"}
                                </Button>
                              </DialogTrigger>
                              {/* The DialogContent is handled below, outside the map */}
                            </Dialog>
                          )}
                          {/* Payment Button if needed (Should ideally be handled before completion, but kept for safety) */}
                          {booking.status === 'accepted' && booking.paymentStatus !== 'paid' && Number(booking.service.price) > 0 && (
                            <Button 
                              onClick={() => initiatePaymentMutation.mutate(booking.id)}
                              disabled={initiatePaymentMutation.isPending}
                            >
                              {initiatePaymentMutation.isPending ? 'Processing...' : 'Pay Now'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Review Dialog - Linked to the trigger in Past Bookings */}
        <Dialog open={!!selectedBooking && selectedBooking.status === 'completed'} onOpenChange={(open) => !open && setSelectedBooking(undefined)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Leave a Review for {selectedBooking?.service.name}</DialogTitle>
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
                      className={`p-0 ${value <= rating ? "text-yellow-500" : "text-gray-300"}`}
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
                disabled={reviewMutation.isPending || !review} // Disable if submitting or no review text
              >
                {reviewMutation.isPending
                  ? "Submitting..."
                  : userReview
                  ? "Update Review"
                  : "Submit Review"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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