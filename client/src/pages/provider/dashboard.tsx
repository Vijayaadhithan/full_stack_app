import { useState } from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Loader2,
  Plus,
  Calendar,
  Star,
  Bell,
  Settings,
  Users,
  Clock,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { Booking, Review, Service } from "@shared/schema";
import { format, isAfter } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useLanguage } from "@/contexts/language-context";

// ─── PENDING BOOKING REQUESTS COMPONENT ───────────────────────────────
function PendingBookingRequestsList() {
  const { toast } = useToast();
  const [selectedBooking, setSelectedBooking] = useState<(Booking & { service: any }) | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'accept' | 'reject' | null>(null);
  const [actionComment, setActionComment] = useState('');
  
  const { data: pendingBookings, isLoading } = useQuery<(Booking & { service: any })[]>({
    queryKey: ["/api/bookings/provider/pending"],
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, status, comments }: { id: number; status: string; comments: string }) => {
      const res = await apiRequest("PATCH", `/api/bookings/${id}`, {
        status,
        comments,
        changedBy: null, // Server sets authenticated user
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider/history"] });
      toast({
        title: "Success",
        description: `Booking ${actionType === 'accept' ? 'accepted' : 'rejected'} successfully`,
      });
      setActionDialogOpen(false);
      setSelectedBooking(null);
      setActionComment('');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAction = () => {
    if (!selectedBooking || !actionType) return;
    updateBookingMutation.mutate({
      id: selectedBooking.id,
      status: actionType === 'accept' ? 'accepted' : 'rejected',
      comments: actionComment,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!pendingBookings || pendingBookings.length === 0) {
    return <p className="text-sm text-muted-foreground">You have no pending booking requests</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {pendingBookings.map((booking) => (
          <div key={booking.id} className="flex items-center justify-between border rounded-md p-3">
            <div>
              <p className="font-medium">{booking.service?.name}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(booking.bookingDate), 'PPP')} at {format(new Date(booking.bookingDate), 'p')}
              </p>
              <div className="flex items-center mt-1">
                <Clock className="h-3 w-3 mr-1 text-yellow-500" />
                <span className="text-xs">
                  Expires in {Math.ceil((new Date(booking.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex items-center gap-1"
                onClick={() => {
                  setSelectedBooking(booking);
                  setActionType('accept');
                  setActionDialogOpen(true);
                }}
              >
                <CheckCircle className="h-3 w-3" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex items-center gap-1"
                onClick={() => {
                  setSelectedBooking(booking);
                  setActionType('reject');
                  setActionDialogOpen(true);
                }}
              >
                <XCircle className="h-3 w-3" />
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'accept' ? 'Accept' : 'Reject'} Booking Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Service</p>
              <p className="text-sm">{selectedBooking?.service?.name}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Date & Time</p>
              <p className="text-sm">
                {selectedBooking && format(new Date(selectedBooking.bookingDate), 'PPP')} at {selectedBooking && format(new Date(selectedBooking.bookingDate), 'p')}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Comments</p>
              <Textarea
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                placeholder={
                  actionType === 'accept'
                    ? 'Add any instructions for the customer'
                    : 'Provide a reason for rejection'
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAction} disabled={updateBookingMutation.isPending}>
              {updateBookingMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionType === 'accept' ? 'Accept' : 'Reject'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Button variant="outline" size="sm" asChild className="w-full">
        <Link href="/provider/bookings">View All Bookings</Link>
      </Button>
    </div>
  );
}

// ─── BOOKING HISTORY COMPONENT ─────────────────────────────────────────
function BookingHistoryList() {
  const { data: bookingHistory, isLoading } = useQuery<(Booking & { service: any })[]>({
    queryKey: ["/api/bookings/provider/history"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!bookingHistory || bookingHistory.length === 0) {
    return <p className="text-sm text-muted-foreground">You have no booking history yet</p>;
  }

  // Show only the most recent 3 history items
  const recentHistory = bookingHistory.slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {recentHistory.map((booking) => (
          <div key={booking.id} className="flex items-center justify-between border rounded-md p-3">
            <div>
              <p className="font-medium">{booking.service?.name}</p>
              <p className="text-sm text-muted-foreground">{format(new Date(booking.bookingDate), 'PPP')}</p>
              <div className="flex items-center mt-1">
                {booking.status === 'accepted' && (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                    <span className="text-xs">Accepted</span>
                  </>
                )}
                {booking.status === 'rejected' && (
                  <>
                    <XCircle className="h-3 w-3 mr-1 text-red-500" />
                    <span className="text-xs">Rejected</span>
                  </>
                )}
                {booking.status === 'expired' && (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1 text-orange-500" />
                    <span className="text-xs">Expired</span>
                  </>
                )}
              </div>
            </div>
            <Badge
              variant={booking.status === 'accepted' ? 'default' : 'destructive'}
              className="flex items-center gap-1"
            >
              {booking.status === 'accepted' && <CheckCircle className="h-3 w-3" />}
              {booking.status === 'rejected' && <XCircle className="h-3 w-3" />}
              {booking.status === 'expired' && <AlertCircle className="h-3 w-3" />}
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </Badge>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" asChild className="w-full">
        <Link href="/provider/bookings">View Full History</Link>
      </Button>
    </div>
  );
}

// ─── ANIMATION & FORM CONSTANTS ─────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const DAYS = [
  { key: 'sunday', label: 'S' },
  { key: 'monday', label: 'M' },
  { key: 'tuesday', label: 'T' },
  { key: 'wednesday', label: 'W' },
  { key: 'thursday', label: 'T' },
  { key: 'friday', label: 'F' },
  { key: 'saturday', label: 'S' },
] as const;

const serviceFormSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  price: z.string().min(1, "Price is required"),
  duration: z.number().min(15, "Duration must be at least 15 minutes"),
  isAvailable: z.boolean().default(true),
  workingHours: z.object({
    monday: z.object({
      isAvailable: z.boolean().default(true),
      start: z.string().min(1, "Start time is required"),
      end: z.string().min(1, "End time is required"),
    }),
    tuesday: z.object({
      isAvailable: z.boolean().default(true),
      start: z.string().min(1, "Start time is required"),
      end: z.string().min(1, "End time is required"),
    }),
    wednesday: z.object({
      isAvailable: z.boolean().default(true),
      start: z.string().min(1, "Start time is required"),
      end: z.string().min(1, "End time is required"),
    }),
    thursday: z.object({
      isAvailable: z.boolean().default(true),
      start: z.string().min(1, "Start time is required"),
      end: z.string().min(1, "End time is required"),
    }),
    friday: z.object({
      isAvailable: z.boolean().default(true),
      start: z.string().min(1, "Start time is required"),
      end: z.string().min(1, "End time is required"),
    }),
    saturday: z.object({
      isAvailable: z.boolean().default(true),
      start: z.string().min(1, "Start time is required"),
      end: z.string().min(1, "End time is required"),
    }),
    sunday: z.object({
      isAvailable: z.boolean().default(false),
      start: z.string().min(1, "Start time is required"),
      end: z.string().min(1, "End time is required"),
    }),
  }),
  breakTime: z.array(z.object({
    start: z.string().min(1, "Start time is required"),
    end: z.string().min(1, "End time is required"),
  })).optional().default([]),
  maxDailyBookings: z.number().min(1, "Must accept at least 1 booking per day"),
  bufferTime: z.number().min(0, "Buffer time must be non-negative"),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
});

type ServiceFormData = z.infer<typeof serviceFormSchema>;

// ─── PROVIDER DASHBOARD PAGE ─────────────────────────────────────────────
export default function ProviderDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  // State for service creation/edit dialog and tab control
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [activeTab, setActiveTab] = useState("basic");

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      price: "",
      duration: 15,
      isAvailable: true,
      workingHours: {
        monday: { isAvailable: true, start: "09:00", end: "17:00" },
        tuesday: { isAvailable: true, start: "09:00", end: "17:00" },
        wednesday: { isAvailable: true, start: "09:00", end: "17:00" },
        thursday: { isAvailable: true, start: "09:00", end: "17:00" },
        friday: { isAvailable: true, start: "09:00", end: "17:00" },
        saturday: { isAvailable: true, start: "10:00", end: "16:00" },
        sunday: { isAvailable: false, start: "00:00", end: "00:00" },
      },
      breakTime: [],
      maxDailyBookings: 1,
      bufferTime: 0,
      location: { lat: 0, lng: 0 },
    },
  });

  // Fetch services, bookings and reviews (only after user is available)
  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: [`/api/services/provider/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: [`/api/bookings/provider/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery<Review[]>({
    queryKey: [`/api/reviews/provider/${user?.id}`],
    enabled: !!user?.id,
  });

  // Compute metrics
  const activeServicesCount = services ? services.filter(s => s.isAvailable).length : 0;
  const pendingBookingsCount = bookings ? bookings.filter(b => b.status === "pending").length : 0;
  const averageRating =
    reviews && reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;
  const upcomingBookings = bookings
    ? bookings
        .filter(
          (booking) =>
            booking.status === "confirmed" && isAfter(new Date(booking.bookingDate), new Date())
        )
        .sort(
          (a, b) =>
            new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime()
        )
        .slice(0, 5)
    : [];

  // Mutations for service management
  const createServiceMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const res = await apiRequest("POST", "/api/services", {
        ...data,
        providerId: user?.id,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create service");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/services/provider/${user?.id}`] });
      toast({
        title: "Success",
        description: "Service created successfully",
      });
      form.reset();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ServiceFormData> }) => {
      const res = await apiRequest("PATCH", `/api/services/${id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update service");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/services/provider/${user?.id}`] });
      toast({
        title: "Success",
        description: "Service updated successfully",
      });
      setDialogOpen(false);
      setEditingService(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: number) => {
      const res = await apiRequest("DELETE", `/api/services/${serviceId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete service");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/services/provider/${user?.id}`] });
      toast({
        title: "Success",
        description: "Service deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ServiceFormData) => {
    try {
      if (editingService) {
        await updateServiceMutation.mutateAsync({ id: editingService.id, data });
      } else {
        await createServiceMutation.mutateAsync(data);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: [`/api/services/provider/${user?.id}`] });
      setDialogOpen(false);
      form.reset();
      setEditingService(null);
    } catch (error) {
      console.error("Service submission error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save service",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <motion.div variants={container} initial="hidden" animate="show" className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
          <div className="flex gap-2">
            <Link href="/provider/profile">
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Manage Profile
              </Button>
            </Link>
            <Button onClick={() => { setEditingService(null); form.reset(); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Service
            </Button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <motion.div variants={item}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Services</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeServicesCount}</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Bookings</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingBookingsCount}</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {averageRating ? averageRating.toFixed(1) : "N/A"}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Booking Requests & History */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="mr-2 h-5 w-5" /> Pending Booking Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PendingBookingRequestsList />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-5 w-5" /> Recent Booking History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BookingHistoryList />
            </CardContent>
          </Card>
        </div>

        {/* Services Offered */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Services Offered</CardTitle>
                <Button onClick={() => { setEditingService(null); form.reset(); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {servicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : !services || services.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No services added yet</p>
                  <Button variant="outline" onClick={() => { setEditingService(null); form.reset(); setDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Service
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {services.slice(0, 4).map((service) => (
                    <Card key={service.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{service.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingService(service);
                                form.reset({
                                  ...service,
                                  price: service.price.toString(),
                                });
                                setDialogOpen(true);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete your service.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteServiceMutation.mutate(service.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Price</span>
                            <span className="font-medium">₹{service.price}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Duration</span>
                            <span>{service.duration} minutes</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Category</span>
                            <span>{service.category}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Status</span>
                            <span className={service.isAvailable ? "text-green-600" : "text-red-600"}>
                              {service.isAvailable ? "Available" : "Unavailable"}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {services && services.length > 4 && (
                <div className="mt-4 text-center">
                  <Link href="/provider/services">
                    <Button variant="outline">View All Services</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Service Creation / Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
              <DialogTitle>{editingService ? 'Edit Service' : 'Add New Service'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="availability">Availability</TabsTrigger>
                    <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
                    <TabsTrigger value="location">Location</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Service Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Beauty & Wellness">Beauty & Wellness</SelectItem>
                                <SelectItem value="Home Services">Home Services</SelectItem>
                                <SelectItem value="Professional Services">Professional Services</SelectItem>
                                <SelectItem value="Health & Fitness">Health & Fitness</SelectItem>
                                <SelectItem value="Education & Training">Education & Training</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="price"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Price (₹)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min="0" step="0.01" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="duration"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Duration (minutes)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min="15" step="15" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="availability">
                    <div className="space-y-4">
                      <div className="grid grid-cols-7 gap-2 mb-4">
                        {DAYS.map(({ key, label }) => (
                          <div key={key} className="flex flex-col items-center space-y-2 p-2 border rounded">
                            <span className="font-medium">{label}</span>
                            <FormField
                              control={form.control}
                              name={`workingHours.${key}.isAvailable`}
                              render={({ field }) => (
                                <Switch checked={field.value} onCheckedChange={field.onChange} size="sm" />
                              )}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="space-y-4">
                        {DAYS.map(({ key }) => (
                          <div
                            key={key}
                            className={`grid grid-cols-2 gap-2 transition-opacity ${
                              form.watch(`workingHours.${key}.isAvailable`) ? 'opacity-100' : 'opacity-50'
                            }`}
                          >
                            <FormField
                              control={form.control}
                              name={`workingHours.${key}.start`}
                              render={({ field }) => (
                                <div className="flex items-center gap-2">
                                  <span className="w-16 text-sm capitalize">{key}</span>
                                  <Input
                                    type="time"
                                    {...field}
                                    disabled={!form.watch(`workingHours.${key}.isAvailable`)}
                                    className="flex-1"
                                    onChange={(e) => field.onChange(e.target.value)}
                                  />
                                </div>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`workingHours.${key}.end`}
                              render={({ field }) => (
                                <Input
                                  type="time"
                                  {...field}
                                  disabled={!form.watch(`workingHours.${key}.isAvailable`)}
                                  className="flex-1"
                                  onChange={(e) => field.onChange(e.target.value)}
                                />
                              )}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="scheduling">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="maxDailyBookings"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Maximum Daily Bookings</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="bufferTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Buffer Time Between Bookings (minutes)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="5"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="breakTime.0.start"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Break Start Time</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} onChange={(e) => field.onChange(e.target.value)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="breakTime.0.end"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Break End Time</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} onChange={(e) => field.onChange(e.target.value)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="location">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="location.lat"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Latitude</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.000001"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="location.lng"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Longitude</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.000001"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end">
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingService ? 'Update Service' : 'Create Service'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Upcoming Bookings & Recent Reviews */}
        <div className="grid gap-6 md:grid-cols-2">
          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Upcoming Bookings</span>
                  <Link href="/provider/bookings">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bookingsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : !upcomingBookings || upcomingBookings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No upcoming bookings</p>
                ) : (
                  <div className="space-y-4">
                    {upcomingBookings.map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <Users className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{booking.service?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(booking.bookingDate), "MMMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{format(new Date(booking.bookingDate), "h:mm a")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Recent Reviews</span>
                  <Link href="/provider/reviews">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reviewsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : !reviews || reviews.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No reviews yet</p>
                ) : (
                  <div className="space-y-4">
                    {reviews.slice(0, 5).map((review) => (
                      <div key={review.id} className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                        <p className="text-sm">{review.review}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(review.createdAt || ''), "MMMM d, yyyy")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
