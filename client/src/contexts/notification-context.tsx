import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Notification } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: number) => void;
  refreshNotifications: () => void;
  pendingBookingsCount: number;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);

  // Fetch all notifications
  const { data: allNotifications = [], refetch: refreshNotifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!user,
  });
  
  // Filter notifications based on user role
  const notifications = React.useMemo(() => {
    if (!user) return [];
    
    // For customer, only show relevant notifications
    if (user.role === 'customer') {
      return allNotifications.filter(notification => {
        // For service type notifications, only show accepted, rejected, or rescheduled
        if (notification.type === 'service') {
          return notification.title.includes('Booking Accepted') || 
                 notification.title.includes('Booking Rejected') || 
                 notification.title.includes('Booking Rescheduled');
        }
        // Show all other notification types
        return true;
      });
    }
    
    // For service providers, only show service-related notifications
    if (user.role === 'provider') {
      return allNotifications.filter(notification => {
        // For completed services, don't show notifications to avoid button issues
        if (notification.title.includes('Service Completed')) {
          return false;
        }
        
        // Show booking requests and service notifications
        if (notification.type === 'service' || notification.type === 'booking_request') {
          return true;
        }
        
        // Show general notifications
        return notification.type !== 'shop';
      });
    }
    
    // For shop owners, only show shop-related notifications
    if (user.role === 'shop') {
      return allNotifications.filter(notification => {
        // Don't show service provider notifications to shop owners
        if (notification.type === 'service') {
          return false;
        }
        
        // Show shop-related and general notifications
        return true;
      });
    }
    
    return allNotifications;
  }, [allNotifications, user]);


  // Fetch pending bookings count for providers
  useEffect(() => {
    if (user?.role === 'provider') {
      const fetchPendingBookings = async () => {
        try {
          const res = await apiRequest('GET', '/api/bookings/provider/pending');
          if (res.ok) {
            const data = await res.json();
            setPendingBookingsCount(data.length);
          }
        } catch (error) {
          console.error('Error fetching pending bookings:', error);
        }
      };
      
      fetchPendingBookings();
      const interval = setInterval(fetchPendingBookings, 60000); // Check every minute
      
      return () => clearInterval(interval);
    }
  }, [user]);

  // Mark notification as read
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

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/notifications/mark-all-read");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to mark all notifications as read");
      }
      return res.json();
    },
    onSuccess: () => {
      // Force refresh the notifications data
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      // Immediately update the local state to show zero unread count
      queryClient.setQueryData(["/api/notifications"], (oldData: Notification[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(notification => ({
          ...notification,
          isRead: true
        }));
      });
    },
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/notifications/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete notification");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length || 0;

  const value = {
    notifications,
    unreadCount,
    markAsRead: (id: number) => markAsReadMutation.mutate(id),
    markAllAsRead: () => markAllAsReadMutation.mutate(),
    deleteNotification: (id: number) => deleteNotificationMutation.mutate(id),
    refreshNotifications,
    pendingBookingsCount,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}