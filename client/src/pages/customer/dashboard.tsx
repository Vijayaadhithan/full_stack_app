import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { ShoppingBag, Calendar, Heart, Package, Store, Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Booking } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatIndianDisplay } from '@shared/date-utils'; // Import IST utility
import { User } from 'lucide-react'; // Import User icon

// Component to display booking requests with status tracking
function BookingRequestsList() {
  const { toast } = useToast();
  
  const { data: bookingRequests, isLoading } = useQuery<(Booking & { service: any })[]>({
    queryKey: ["/api/bookings/customer/requests"],
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!bookingRequests || bookingRequests.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground mb-4">You have no booking requests</p>
        <Button variant="outline" asChild>
          <Link href="/customer/browse-services">Book a Service</Link>
        </Button>
      </div>
    );
  }

  // Filter to show only pending requests
  const pendingRequests = bookingRequests.filter(booking => booking.status === 'pending');

  return (
    <div className="space-y-4">
      {pendingRequests.length === 0 ? (
        <p className="text-sm text-muted-foreground">You have no pending booking requests</p>
      ) : (
        <div className="space-y-3">
          {pendingRequests.map((booking) => (
            <div key={booking.id} className="flex items-center justify-between border rounded-md p-3">
              <div>
                <p className="font-medium">{booking.service?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatIndianDisplay(booking.bookingDate, 'datetime')} {/* Use formatIndianDisplay */}
                </p>
                <div className="flex items-center mt-1">
                  <Clock className="h-3 w-3 mr-1 text-yellow-500" />
                  <span className="text-xs">Awaiting response</span>
                </div>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Pending
              </Badge>
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" asChild className="w-full">
        <Link href="/customer/bookings">View All Bookings</Link>
      </Button>
    </div>
  );
}

// Component to display booking history (accepted/rejected/expired)
function BookingHistoryList() {
  const { data: bookingHistory, isLoading } = useQuery<(Booking & { service: any })[]>({
    queryKey: ["/api/bookings/customer/history"],
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!bookingHistory || bookingHistory.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">You have no booking history yet</p>
    );
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
              <p className="text-sm text-muted-foreground">
                {formatIndianDisplay(booking.bookingDate, 'date')} {/* Use formatIndianDisplay */}
              </p>
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
        <Link href="/customer/bookings">View Full History</Link>
      </Button>
    </div>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
          <p className="text-muted-foreground">Here's what you can do</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/customer/browse-services">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Browse Services</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Find and book services from local providers</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/customer/browse-shops">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Browse Shops</CardTitle>
                <Store className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Discover and explore local shops</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/customer/browse-products">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Shop Products</CardTitle>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Browse and purchase products from local shops</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/customer/bookings">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">My Bookings</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">View and manage your service bookings</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/customer/profile"> {/* Add link to profile page */}
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">My Profile</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" /> {/* Use User icon */}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">View and edit your profile information</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/customer/orders">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">My Orders</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Track and manage your product orders</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Booking Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingRequestsList />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Booking History</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingHistoryList />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}