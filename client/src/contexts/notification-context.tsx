import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Notification } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: number) => void;
  deleteNotification: (id: number) => void;
  refreshNotifications: () => void;
  pendingBookingsCount: number;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);

  // Fetch all notifications
  const { data: notifications = [], refetch: refreshNotifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!user,
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
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