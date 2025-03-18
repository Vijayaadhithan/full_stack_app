import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Package, Calendar, Star, Bell, Settings, Users, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { Booking, Review, Service } from "@shared/schema";

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

export default function ProviderDashboard() {
  const { user } = useAuth();

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

  const { data: notifications, isLoading: notificationsLoading } = useQuery<Notification[]>({
    queryKey: [`/api/notifications/user/${user?.id}`],
    enabled: !!user?.id,
  });

  const isLoading = servicesLoading || bookingsLoading || reviewsLoading || notificationsLoading;

  const activeServices = services?.filter(service => service.isAvailable)?.length || 0;
  const pendingBookings = bookings?.filter(booking => booking.status === "pending")?.length || 0;
  const averageRating = reviews?.length
    ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length
    : 0;
  const unreadNotifications = notifications?.filter(notification => !notification.isRead)?.length || 0;

  const upcomingBookings = bookings
    ?.filter(booking => booking.status === "confirmed")
    ?.sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime())
    ?.slice(0, 5);

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
          <Link href="/provider/profile">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Manage Profile
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <motion.div variants={item}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Services</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeServices}</div>
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
                <div className="text-2xl font-bold">{pendingBookings}</div>
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
                <div className="text-2xl font-bold">{averageRating.toFixed(1)}</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Notifications</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{unreadNotifications}</div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

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
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : upcomingBookings?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No upcoming bookings</p>
                ) : (
                  <div className="space-y-4">
                    {upcomingBookings?.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <Users className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{booking.service?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(booking.bookingDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(booking.bookingDate).toLocaleTimeString()}
                          </span>
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
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : reviews?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No reviews yet</p>
                ) : (
                  <div className="space-y-4">
                    {reviews?.slice(0, 5).map((review) => (
                      <div
                        key={review.id}
                        className="p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                        <p className="text-sm">{review.review}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(review.createdAt || '').toLocaleDateString()}
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