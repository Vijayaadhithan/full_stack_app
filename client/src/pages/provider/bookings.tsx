import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Booking, Service } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";

const bookingActionSchema = z.object({
  status: z.enum(["accepted", "rejected", "rescheduled", "completed"]),
  comments: z.string().min(1, "Please provide a reason or comment"),
  rescheduleDate: z.string().optional(),
});

type BookingActionData = z.infer<typeof bookingActionSchema>;

export default function ProviderBookings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [actionType, setActionType] = useState<"accept" | "reject" | "reschedule" | "complete" | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

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
        const error = await res.json();
        throw new Error(error.message || "Failed to update booking");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
      toast({
        title: "Success",
        description: "Booking updated successfully",
      });
      form.reset();
      setActionType(null);
      setSelectedBooking(null);
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

  const handleAction = (data: BookingActionData) => {
    if (!selectedBooking) return;

    updateBookingMutation.mutate({
      id: selectedBooking.id,
      data: {
        ...data,
        status: actionType === "accept" ? "accepted" 
               : actionType === "reject" ? "rejected"
               : actionType === "reschedule" ? "rescheduled"
               : "completed"
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Service Bookings</h1>
          <div className="flex items-center gap-4">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border rounded p-2"
            >
              <option value="all">All Bookings</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !filteredBookings?.length ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No bookings found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <Card key={booking.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{booking.service.name}</h3>
                        <span className={`text-sm font-medium ${
                          booking.status === 'accepted' ? 'text-green-600' :
                          booking.status === 'rejected' ? 'text-red-600' :
                          booking.status === 'rescheduled' ? 'text-yellow-600' :
                          booking.status === 'completed' ? 'text-blue-600' :
                          'text-gray-600'
                        }`}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(booking.bookingDate).toLocaleString()}
                        <Clock className="h-4 w-4 ml-2" />
                        {booking.service.duration} mins
                      </div>
                      {booking.status === 'rescheduled' && booking.rescheduleDate && (
                        <div className="text-sm text-yellow-600">
                          Rescheduled to: {new Date(booking.rescheduleDate).toLocaleString()}
                        </div>
                      )}
                      {booking.status === 'rejected' && booking.rejectionReason && (
                        <div className="text-sm text-red-600">
                          Reason: {booking.rejectionReason}
                        </div>
                      )}
                    </div>

                    {booking.status === 'pending' && (
                      <div className="flex gap-2">
                        <Dialog open={actionType === 'accept'} onOpenChange={() => setActionType(null)}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="text-green-600"
                              onClick={() => {
                                setActionType('accept');
                                setSelectedBooking(booking);
                              }}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Accept
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Accept Booking</DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                              <form onSubmit={form.handleSubmit(handleAction)} className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name="comments"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Additional Instructions</FormLabel>
                                      <FormControl>
                                        <Textarea {...field} placeholder="Add any instructions for the customer" />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <Button type="submit" className="w-full">Accept Booking</Button>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>

                        <Dialog open={actionType === 'reject'} onOpenChange={() => setActionType(null)}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="text-red-600"
                              onClick={() => {
                                setActionType('reject');
                                setSelectedBooking(booking);
                              }}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reject Booking</DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                              <form onSubmit={form.handleSubmit(handleAction)} className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name="comments"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Reason for Rejection</FormLabel>
                                      <FormControl>
                                        <Textarea {...field} placeholder="Please provide a reason for rejecting this booking" />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <Button type="submit" variant="destructive" className="w-full">
                                  Reject Booking
                                </Button>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>

                        <Dialog open={actionType === 'reschedule'} onOpenChange={() => setActionType(null)}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline"
                              onClick={() => {
                                setActionType('reschedule');
                                setSelectedBooking(booking);
                              }}
                            >
                              <Calendar className="h-4 w-4 mr-2" />
                              Reschedule
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reschedule Booking</DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                              <form onSubmit={form.handleSubmit(handleAction)} className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name="rescheduleDate"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>New Date and Time</FormLabel>
                                      <FormControl>
                                        <Input type="datetime-local" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="comments"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Reason for Rescheduling</FormLabel>
                                      <FormControl>
                                        <Textarea {...field} placeholder="Please provide a reason for rescheduling" />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <Button type="submit" className="w-full">
                                  Confirm Reschedule
                                </Button>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}

                    {booking.status === 'accepted' && (
                      <Dialog open={actionType === 'complete'} onOpenChange={() => setActionType(null)}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline"
                            className="text-green-600"
                            onClick={() => {
                              setActionType('complete');
                              setSelectedBooking(booking);
                            }}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Complete Service
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Complete Service</DialogTitle>
                          </DialogHeader>
                          <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleAction)} className="space-y-4">
                              <FormField
                                control={form.control}
                                name="comments"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Service Notes</FormLabel>
                                    <FormControl>
                                      <Textarea {...field} placeholder="Add any notes about the completed service" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <Button type="submit" className="w-full">Mark as Complete</Button>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}