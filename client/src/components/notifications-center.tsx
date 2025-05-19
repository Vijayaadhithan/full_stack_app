import { Bell, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Notification } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/language-context";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { formatIndianDisplay } from '@shared/date-utils'; // Import IST utility

export function NotificationsCenter() {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: notifications, refetch } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/notifications/${id}/read`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to mark notification as read");
      }
      return res.json();
    },
    onSuccess: (_, id) => {
      // Optimistically update the UI immediately
      queryClient.setQueryData(["/api/notifications"], (oldData: Notification[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(notification => {
          if (notification.id === id) {
            return { ...notification, isRead: true };
          }
          return notification;
        });
      });
      
      // Also invalidate the query to ensure data consistency with the server
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });
  
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      // Include user role in the request to mark only relevant notifications
      const res = await apiRequest("PATCH", "/api/notifications/mark-all-read", { role: user?.role });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to mark all notifications as read");
      }
      return res.json();
    },
    onSuccess: () => {
      // Optimistically update the local cache to show zero unread count
      queryClient.setQueryData(["/api/notifications"], (oldData: Notification[] | undefined) => {
        if (!oldData) return [];
        // Only mark notifications relevant to the user's role as read
        return oldData.map(notification => {
          // Check if this notification is relevant to the user's role
          let isRelevantToUser = false;
          
          // Shop owners should only mark shop/order/return notifications as read
          if (user?.role === 'shop') {
            isRelevantToUser = ['order', 'shop', 'return'].includes(notification.type);
          }
          
          // Service providers should only mark service/booking notifications as read
          else if (user?.role === 'provider') {
            isRelevantToUser = ['service', 'booking'].includes(notification.type);
          }
          
          // Customers should mark all their notifications as read
          else if (user?.role === 'customer') {
            isRelevantToUser = true;
          }
          
          // Only mark as read if it's relevant to the user
          return {
            ...notification,
            isRead: isRelevantToUser ? true : notification.isRead
          };
        });
      });
      
      // Invalidate the query to ensure data is refetched from the server in the background
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      
      toast({
        title: t('notifications_cleared'),
        description: t('all_notifications_marked_as_read'),
      });
      // REMOVED: refetch(); // The optimistic update and invalidation should be sufficient.
    },
  });

  // Filter notifications based on user role
  const filteredNotifications = notifications?.filter(notification => {
    if (!user) return false;
    
    // Shop owners should only see shop/order/return notifications
    if (user.role === 'shop') {
      return ['order', 'shop', 'return'].includes(notification.type);
    }
    // Service providers should see service/booking notifications
    // and specifically service request notifications
    if (user.role === 'provider') {
      // Include notifications about new service requests
      if (notification.type === 'service_request' &&
          (notification.title.includes('New Service Request') || 
           notification.title.includes('Service Request') || 
           notification.message.includes('new service request'))) {
        return true;
      }
      return ['service', 'booking', 'booking_request'].includes(notification.type);
    }
    // Customers should see all relevant notifications
    return true;
  }) || [];
  
  // Sort notifications with unread first, then by date
  const sortedNotifications = [...filteredNotifications].sort((a, b) => {
    // First sort by read status (unread first)
    if (a.isRead !== b.isRead) {
      return a.isRead ? 1 : -1;
    }
    // Then sort by date (newest first) - ensure we're comparing dates properly
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const unreadCount = filteredNotifications.filter((n) => !n.isRead).length || 0;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "booking":
        return "📅";
      case "order":
        return "📦";
      case "return":
        return "↩️";
      case "service":
        return "🛠️";
      default:
        return "📬";
    }
  };
  
  // Function to navigate to the relevant page based on notification type and content
  const navigateToRelevantPage = (notification: Notification) => {
    // Close the notification panel
    setOpen(false);
    
    // Extract any IDs from the notification message if present
    const idMatch = notification.message?.match(/ID: (\d+)/) || [];
    const id = idMatch[1];
    
    // Navigate based on notification type and user role
    switch (notification.type) {
      case "booking":
        if (user?.role === 'customer') {
          navigate(`/customer/bookings/${id || ''}`);
        } else if (user?.role === 'provider') {
          navigate(`/provider/bookings${id ? `/${id}` : '?status=pending'}`);
        }
        break;
      case "order":
        if (user?.role === 'customer') {
          navigate(`/customer/order/${id || ''}`);
        } else if (user?.role === 'shop') {
          navigate(`/shop/orders${id ? `/${id}` : ''}`);
        }
        break;
      case "return":
        if (user?.role === 'customer') {
          navigate(`/customer/returns/${id || ''}`);
        } else if (user?.role === 'shop') {
          navigate(`/shop/returns${id ? `/${id}` : ''}`);
        }
        break;
      case "service_request":
        if (user?.role === 'provider') {
          navigate(`/provider/services${id ? `/${id}` : ''}`);
        }
        break;
      default:
        // For general notifications, navigate to the dashboard
        navigate(`/${user?.role || ''}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <div className="flex justify-between items-center">
            <SheetTitle>{t('notifications')}</SheetTitle>
            {unreadCount > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                {markAllAsReadMutation.isPending ? (
                  <span className="animate-pulse">{t('marking')}...</span>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    {t('mark_all_read')}
                  </>
                )}
              </Button>
            )}
          </div>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-5rem)] mt-4">
          <div className="space-y-4 pr-4">
            {!sortedNotifications.length ? (
              <p className="text-center text-muted-foreground">{t('no_notifications')}</p>
            ) : (
              sortedNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border ${
                    notification.isRead ? "bg-background" : "bg-muted"
                  } cursor-pointer`}
                  onClick={() => {
                    // Mark as read if unread
                    if (!notification.isRead) {
                      markAsReadMutation.mutate(notification.id);
                    }
                    
                    // Navigate to the relevant page based on notification type
                    navigateToRelevantPage(notification);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div>
                      <h4 className="font-medium">{t(notification.title)}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t(notification.message)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.createdAt
                          ? formatIndianDisplay(notification.createdAt, 'datetime') // Use formatIndianDisplay with IST timezone
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}