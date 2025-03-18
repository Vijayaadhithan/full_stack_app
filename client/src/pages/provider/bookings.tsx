import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X, Calendar, Clock, User } from "lucide-react";
import { motion } from "framer-motion";
import { Booking, Service } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";

const bookingActionSchema = z.object({
  status: z.enum(["confirmed", "cancelled", "completed"]),
  comments: z.string().min(1, "Please provide a reason or comment"),
});

type BookingActionData = z.infer<typeof bookingActionSchema>;

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

export default function ProviderBookings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  const { data: bookings, isLoading } = useQuery<(Booking & { service: Service })[]>({
    queryKey: ["/api/bookings/provider"],
    enabled: !!user?.id,
  });

  const form = useForm<BookingActionData>({
    resolver: zodResolver(bookingActionSchema),
    defaultValues: {
      comments: "",
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: BookingActionData }) => {
      const res = await apiRequest("PATCH", `/api/bookings/${id}`, data);
      if (!res.ok) {
        throw new Error("Failed to update booking");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
      toast({
        title: "Booking updated",
        description: "The booking has been updated successfully.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredBookings = bookings?.filter(booking => {
    if (selectedStatus !== "all" && booking.status !== selectedStatus) return false;
    if (dateFilter) {
      const bookingDate = new Date(booking.bookingDate).toLocaleDateString();
      const filterDate = new Date(dateFilter).toLocaleDateString();
      if (bookingDate !== filterDate) return false;
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-yellow-500";
      case "confirmed":
        return "text-green-500";
      case "cancelled":
        return "text-red-500";
      case "completed":
        return "text-blue-500";
      default:
        return "";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Manage Bookings</h1>
          <div className="flex gap-4">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-auto"
            />
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bookings</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid gap-6"
          >
            {filteredBookings?.map((booking) => (
              <motion.div key={booking.id} variants={item}>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{booking.service.name}</h3>
                          <span className={`text-sm font-medium ${getStatusColor(booking.status)}`}>
                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(booking.bookingDate).toLocaleDateString()}
                          <Clock className="h-4 w-4 ml-2" />
                          {booking.service.duration} mins
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <User className="h-4 w-4" />
                          {booking.customer?.name} ({booking.customer?.phone})
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {booking.status === "pending" && (
                          <>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" className="text-green-600">
                                  <Check className="h-4 w-4 mr-2" />
                                  Accept
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Accept Booking</DialogTitle>
                                </DialogHeader>
                                <Form {...form}>
                                  <form
                                    onSubmit={form.handleSubmit((data) =>
                                      updateBookingMutation.mutate({
                                        id: booking.id,
                                        data: { ...data, status: "confirmed" },
                                      })
                                    )}
                                    className="space-y-4"
                                  >
                                    <FormField
                                      control={form.control}
                                      name="comments"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Comments</FormLabel>
                                          <FormControl>
                                            <Textarea
                                              {...field}
                                              placeholder="Add any instructions or notes for the customer"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <Button
                                      type="submit"
                                      className="w-full"
                                      disabled={updateBookingMutation.isPending}
                                    >
                                      {updateBookingMutation.isPending && (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      )}
                                      Confirm Booking
                                    </Button>
                                  </form>
                                </Form>
                              </DialogContent>
                            </Dialog>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" className="text-red-600">
                                  <X className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reject Booking</DialogTitle>
                                </DialogHeader>
                                <Form {...form}>
                                  <form
                                    onSubmit={form.handleSubmit((data) =>
                                      updateBookingMutation.mutate({
                                        id: booking.id,
                                        data: { ...data, status: "cancelled" },
                                      })
                                    )}
                                    className="space-y-4"
                                  >
                                    <FormField
                                      control={form.control}
                                      name="comments"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Reason for Rejection</FormLabel>
                                          <FormControl>
                                            <Textarea
                                              {...field}
                                              placeholder="Please provide a reason for rejecting this booking"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <Button
                                      type="submit"
                                      className="w-full"
                                      disabled={updateBookingMutation.isPending}
                                    >
                                      {updateBookingMutation.isPending && (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      )}
                                      Confirm Rejection
                                    </Button>
                                  </form>
                                </Form>
                              </DialogContent>
                            </Dialog>
                          </>
                        )}
                        {booking.status === "confirmed" && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="text-green-600">
                                <Check className="h-4 w-4 mr-2" />
                                Mark as Complete
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Complete Service</DialogTitle>
                              </DialogHeader>
                              <Form {...form}>
                                <form
                                  onSubmit={form.handleSubmit((data) =>
                                    updateBookingMutation.mutate({
                                      id: booking.id,
                                      data: { ...data, status: "completed" },
                                    })
                                  )}
                                  className="space-y-4"
                                >
                                  <FormField
                                    control={form.control}
                                    name="comments"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Service Notes</FormLabel>
                                        <FormControl>
                                          <Textarea
                                            {...field}
                                            placeholder="Add any notes about the completed service"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={updateBookingMutation.isPending}
                                  >
                                    {updateBookingMutation.isPending && (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    )}
                                    Mark as Complete
                                  </Button>
                                </form>
                              </Form>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                    {booking.comments && (
                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <p className="text-sm">{booking.comments}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}