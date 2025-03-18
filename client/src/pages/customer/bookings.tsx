import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Booking, Service, Review } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Star, Calendar as CalendarIcon, Clock, X } from "lucide-react";
import { useState } from "react";
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

export default function Bookings() {
  const { toast } = useToast();
  const [selectedBooking, setSelectedBooking] = useState<BookingWithService>();
  const [rescheduleDate, setRescheduleDate] = useState<Date>();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");

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
                          {booking.isRecurring && (
                            <p className="text-sm text-muted-foreground">
                              Recurring: {booking.recurringPattern}
                            </p>
                          )}
                        </div>
                        <div className="space-x-2">
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
    </DashboardLayout>
  );
}
