import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X, Calendar, Clock, User as UserIcon } from "lucide-react"; // Import UserIcon
import { MapPin as LocationIcon } from 'lucide-react'; // Use a different alias for MapPin
import { Booking, Service, User } from "@shared/schema"; // Import User type
import { z } from "zod";
import { useState, useEffect } from "react";
import { formatIndianDisplay } from '@shared/date-utils'; // Import IST utility

const bookingActionSchema = z.object({
  status: z.enum(["accepted", "rejected", "rescheduled", "completed"]),
  comments: z.string().min(1, "Please provide a reason or comment"),
  rescheduleDate: z.string().optional(),
});

type BookingActionData = z.infer<typeof bookingActionSchema>;

export default function ProviderBookings() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  // Get status from URL query parameter
  const [searchParams] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  });
  const statusFromUrl = searchParams.get('status');
  
  const [selectedStatus, setSelectedStatus] = useState<string>(statusFromUrl || "all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [actionType, setActionType] = useState<"accept" | "reject" | "reschedule" | "complete" | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Fetch all bookings including accepted ones
  const { data: bookings, isLoading } = useQuery<BookingWithDetails[]>({ // Use BookingWithDetails
    queryKey: ["/api/bookings/provider"],
    enabled: !!user?.id,
  });

  // Update the selected status when the URL changes
  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      if (status) {
        setSelectedStatus(status);
      }
    }
  }, []);
  
  // Set the initial status filter based on URL parameter when component mounts
  useEffect(() => {
    if (statusFromUrl) {
      setSelectedStatus(statusFromUrl);
    }
  }, [statusFromUrl]);

  const form = useForm<BookingActionData>({
    resolver: zodResolver(bookingActionSchema),
    defaultValues: {
      comments: "",
      status: "accepted", // Set a default status
    },
  });

  // Reset form when action type changes
  useEffect(() => {
    if (actionType) {
      form.reset({
        comments: "",
        status: actionType === "accept" ? "accepted"
          : actionType === "reject" ? "rejected"
          : actionType === "reschedule" ? "rescheduled"
          : "completed",
        rescheduleDate: actionType === "reschedule" ? new Date().toISOString().slice(0, 16) : undefined
      });
    }
  }, [actionType, form]);

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: BookingActionData }) => {
      // Prepare payload for the status update endpoint
      const payload: { status: string; rejectionReason?: string; rescheduleDate?: string } = { 
        status: data.status 
      };
      if (data.status === 'rejected' && data.comments) {
        payload.rejectionReason = data.comments;
      }
      if (data.status === 'rescheduled' && data.rescheduleDate) {
        payload.rescheduleDate = data.rescheduleDate;
      }

      // Corrected endpoint to PATCH /api/bookings/:id/status
      const res = await apiRequest("PATCH", `/api/bookings/${id}/status`, payload);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update booking status");
      }
      const updatedBookingData = await res.json();
      // Pass along original input data (specifically comments for rejection) for onSuccess
      return { responseData: updatedBookingData, inputData: data }; 
    },
    onSuccess: async (result) => { // result is { responseData: { booking: updatedBookingData, message: string }, inputData: data }
      const { responseData, inputData } = result;
      const updatedBooking = responseData.booking; // Access the nested booking object

      // Existing success logic
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Success",
        description: `Booking status updated to ${updatedBooking.status}`,
      });
      form.reset();
      setActionType(null);
      setSelectedBooking(null);

      // New logic for email notification
      const bookingId = updatedBooking.id;

      if (updatedBooking.status === "accepted") {
        console.log(`[FRONTEND bookings.tsx] Booking ${bookingId} accepted. Triggering acceptance email.`);
        try {
          await apiRequest("POST", `/api/bookings/${bookingId}/notify-customer-accepted`);
          console.log(`[FRONTEND bookings.tsx] Acceptance email trigger for booking ${bookingId} sent.`);
        } catch (emailError) {
          console.error(`[FRONTEND bookings.tsx] Failed to trigger acceptance email for ${bookingId}:`, emailError);
          toast({
            title: "Email Notification Issue",
            description: "Failed to send acceptance email to customer. Please check logs.",
            variant: "default",
          });
        }
      } else if (updatedBooking.status === "rejected") {
        const rejectionReason = inputData.comments;
        console.log(`[FRONTEND bookings.tsx] Booking ${bookingId} rejected. Triggering rejection email. Reason: ${rejectionReason}`);
        try {
          await apiRequest("POST", `/api/bookings/${bookingId}/notify-customer-rejected`, { rejectionReason });
          console.log(`[FRONTEND bookings.tsx] Rejection email trigger for booking ${bookingId} sent.`);
        } catch (emailError) {
          console.error(`[FRONTEND bookings.tsx] Failed to trigger rejection email for ${bookingId}:`, emailError);
          toast({
            title: "Email Notification Issue",
            description: "Failed to send rejection email to customer. Please check logs.",
            variant: "default",
          });
        }
      }
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
    
    // Set the correct status based on action type
    const status = actionType === "accept" ? "accepted"
      : actionType === "reject" ? "rejected"
      : actionType === "reschedule" ? "rescheduled"
      : "completed";
      
    // Ensure we have all required data
    const payload = {
      id: selectedBooking.id,
      data: {
        ...data,
        status,
        // For reschedule, ensure we have a date
        ...(status === "rescheduled" && !data.rescheduleDate && {
          rescheduleDate: new Date().toISOString()
        }),
        // For rejection, ensure we have a reason
        ...(status === "rejected" && {
          rejectionReason: data.comments
        })
      },
    };
    
    // Execute the mutation
    updateBookingMutation.mutate({
      id: payload.id,
      data: {
        status: payload.data.status as "accepted" | "rejected" | "rescheduled" | "completed",
        comments: payload.data.comments,
        rescheduleDate: payload.data.rescheduleDate
      }
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{t('service_bookings')}</h1>
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
              <option value="all">{t('all_bookings')}</option>
              <option value="pending">{t('pending')}</option>
              <option value="accepted">{t('accepted')}</option>
              <option value="rejected">{t('rejected')}</option>
              <option value="rescheduled">{t('rescheduled')}</option>
              <option value="completed">{t('completed')}</option>
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
              <p className="text-muted-foreground">{t('no_bookings_found')}</p>
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
                          {t(booking.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {formatIndianDisplay(booking.bookingDate, 'date')}
                        <Clock className="h-4 w-4 ml-2" />
                        {formatIndianDisplay(booking.bookingDate, 'time')}
                        <span className="ml-2">({booking.service.duration} mins)</span>
                      </div>
                      {/* Display Service Location */}
                      <div className="flex items-start gap-2 text-sm text-muted-foreground"> {/* Use items-start for multi-line */}
                        <LocationIcon className="h-4 w-4 mt-1 flex-shrink-0" /> {/* Adjust icon alignment */}
                        <div> {/* Wrap text content */}
                          {booking.serviceLocation === 'customer' ? (
                            <>
                              <span>{t('service_at_customer_location')}</span>
                              {booking.customer ? (
                                <p className="font-medium">{`${booking.customer.addressStreet || ''}, ${booking.customer.addressCity || ''}, ${booking.customer.addressState || ''} ${booking.customer.addressPostalCode || ''}`.trim().replace(/, $/, '') || t('customer_address_not_provided')}</p>
                              ) : (
                                <p className="font-medium text-muted-foreground">({t('customer_address_not_available')})</p>
                              )}
                            </>
                          ) : (
                            <span>
                              {booking.providerAddress
                                ? `${t('service_at_provider_location')}: ${booking.providerAddress}`
                                : t('service_at_provider_location')}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Display Customer Information (Name and Phone) */}
                      {booking.customer && (
                        <div className="mt-2 text-sm text-muted-foreground border-t pt-2">
                          <p className="flex items-center"><UserIcon className="h-4 w-4 mr-1" /> <strong>{t('customer')}:</strong> {booking.customer.name}</p>
                          <p><strong>{t('phone')}:</strong> {booking.customer.phone}</p> {/* Keep phone here for all cases */}
                          {/* Address is now shown in the location section if applicable */}
                        </div>
                      )}
                      {booking.status === 'rescheduled' && booking.rescheduleDate && (
                        <div className="text-sm text-yellow-600">
                          Rescheduled to: {formatIndianDisplay(booking.rescheduleDate, 'datetime')}
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
                        <Dialog>
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
                              {t('accept')}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{t('accept_booking')}</DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                              <form onSubmit={form.handleSubmit(handleAction)} className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name="comments"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>{t('additional_instructions')}</FormLabel>
                                      <FormControl>
                                        <Textarea {...field} placeholder={t('add_any_instructions_for_the_customer')} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <Button type="submit" className="w-full">{t('accept_booking')}</Button>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
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
                              {t('reject')}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{t('reject_booking')}</DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                              <form onSubmit={form.handleSubmit(handleAction)} className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name="comments"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>{t('reason_for_rejection')}</FormLabel>
                                      <FormControl>
                                        <Textarea {...field} placeholder={t('please_provide_a_reason_for_rejecting_this_booking')} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <Button type="submit" variant="destructive" className="w-full">
                                  {t('reject_booking')}
                                </Button>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setActionType('reschedule');
                                setSelectedBooking(booking);
                              }}
                            >
                              <Calendar className="h-4 w-4 mr-2" />
                              {t('reschedule')}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{t('reschedule_booking')}</DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                              <form onSubmit={form.handleSubmit(handleAction)} className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name="rescheduleDate"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>{t('new_date_and_time')}</FormLabel>
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
                                      <FormLabel>{t('reason_for_rescheduling')}</FormLabel>
                                      <FormControl>
                                        <Textarea {...field} placeholder={t('please_provide_a_reason_for_rescheduling')} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <Button type="submit" className="w-full">
                                  {t('confirm_reschedule')}
                                </Button>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}

                    {booking.status === 'accepted' && (
                      <Dialog>
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
                            {t('complete_service')}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t('complete_service')}</DialogTitle>
                          </DialogHeader>
                          <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleAction)} className="space-y-4">
                              <FormField
                                control={form.control}
                                name="comments"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('service_notes')}</FormLabel>
                                    <FormControl>
                                      <Textarea {...field} placeholder={t('add_any_notes_about_the_completed_service')} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <Button type="submit" className="w-full">{t('mark_as_complete')}</Button>
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

// Update Booking type to include customer details
type BookingWithDetails = Booking & { 
  service: Service; 
  customer?: User | null; // Add customer details
};