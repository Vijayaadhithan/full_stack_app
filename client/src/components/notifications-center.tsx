import { Bell, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Notification } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/language-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { formatIndianDisplay } from "@shared/date-utils"; // Import IST utility
import { useUserContext } from "@/contexts/UserContext";

export function NotificationsCenter() {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const lastSeenNotificationIdRef = useRef<number | null>(null);

  // Get profiles and setAppMode from UserContext - source of truth for shop/provider access
  const { profiles, setAppMode } = useUserContext();

  // Determine if user can access shop features
  const isShopOwner = profiles.hasShop || user?.role === "shop" || user?.role === "worker";

  const { data: notificationsData, isFetched } = useQuery<{
    data: Notification[];
    total: number;
    totalPages: number;
  }>({
    queryKey: ["/api/notifications"],
  });

  const notifications = useMemo<Notification[]>(
    () => notificationsData?.data ?? [],
    [notificationsData?.data],
  );

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
      queryClient.setQueryData(
        ["/api/notifications"],
        (
          oldData:
            | { data: Notification[]; total: number; totalPages: number }
            | undefined,
        ) => {
          if (!oldData) return undefined;
          return {
            ...oldData,
            data: oldData.data.map((notification) => {
              if (notification.id === id) {
                return { ...notification, isRead: true };
              }
              return notification;
            }),
          };
        },
      );

      // Also invalidate the query to ensure data consistency with the server
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      // Mark ALL notifications as read (no role filtering)
      const res = await apiRequest(
        "PATCH",
        "/api/notifications/mark-all-read",
        {},
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(
          error.message || "Failed to mark all notifications as read",
        );
      }
      return res.json();
    },
    onSuccess: () => {
      // Optimistically update the local cache to mark all notifications as read
      queryClient.setQueryData(
        ["/api/notifications"],
        (
          oldData:
            | { data: Notification[]; total: number; totalPages: number }
            | undefined,
        ) => {
          if (!oldData) return undefined;
          // Mark ALL notifications as read
          return {
            ...oldData,
            data: oldData.data.map((notification) => ({
              ...notification,
              isRead: true,
            })),
          };
        },
      );

      // Invalidate the query to ensure data is refetched from the server in the background
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });

      toast({
        title: t("notifications_cleared"),
        description: t("all_notifications_marked_as_read"),
      });
    },
  });

  // Show ALL notifications to the user regardless of role
  // This provides a unified notification experience across all profiles
  const filteredNotifications = useMemo(() => {
    if (!user) return [];
    return notifications;
  }, [notifications, user]);

  // Sort notifications with unread first, then by date
  const sortedNotifications = useMemo(() => {
    return [...filteredNotifications].sort((a, b) => {
      // First sort by read status (unread first)
      if (a.isRead !== b.isRead) {
        return a.isRead ? 1 : -1;
      }
      // Then sort by date (newest first) - ensure we're comparing dates properly
      return (
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
      );
    });
  }, [filteredNotifications]);

  const unreadCount =
    filteredNotifications.filter((n) => !n.isRead).length || 0;

  const playAttentionSound = () => {
    if (typeof window === "undefined") return;

    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      const context = new AudioContextCtor();
      void context.resume().catch(() => undefined);

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(880, context.currentTime);

      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start();
      oscillator.stop(context.currentTime + 0.5);
      oscillator.onended = () => {
        void context.close().catch(() => undefined);
      };
    } catch {
      // Ignore sound errors (browser autoplay restrictions, etc.)
    }
  };

  useEffect(() => {
    if (!user || !isShopOwner) return;
    if (!isFetched) return;
    if (open) return;

    const maxId = filteredNotifications.length
      ? Math.max(...filteredNotifications.map((n) => n.id))
      : 0;
    const lastSeen = lastSeenNotificationIdRef.current;

    if (lastSeen == null) {
      lastSeenNotificationIdRef.current = maxId;
      return;
    }

    if (maxId <= lastSeen) return;

    const newUnread = filteredNotifications.filter(
      (notification) => notification.id > lastSeen && !notification.isRead,
    );
    lastSeenNotificationIdRef.current = maxId;

    const shouldAlert = newUnread.some((notification) => {
      if (notification.type !== "order") return false;
      const title = (notification.title || "").toLowerCase();
      const message = (notification.message || "").toLowerCase();
      return (
        title.includes("pay later") ||
        title.includes("quick order") ||
        message.includes("credit approval") ||
        message.includes("quick order")
      );
    });

    if (!shouldAlert) return;

    playAttentionSound();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.([250, 120, 250]);
      } catch {
        // ignore
      }
    }

    const highlight =
      newUnread.find((notification) => notification.type === "order") ?? newUnread[0];
    if (highlight) {
      toast({
        title: highlight.title || "New order notification",
        description: highlight.message || "A new order needs your attention.",
      });
    }
  }, [filteredNotifications, isFetched, isShopOwner, open, toast, user]);

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

  const extractEntityId = (notification: Notification) => {
    if (notification.relatedBookingId != null) {
      return String(notification.relatedBookingId);
    }

    const haystack = `${notification.title ?? ""} ${notification.message ?? ""}`;
    const byExplicitId = haystack.match(/ID:\s*(\d+)/i);
    if (byExplicitId?.[1]) return byExplicitId[1];

    const byOrder = haystack.match(/\border\s*#\s*(\d+)/i);
    if (byOrder?.[1]) return byOrder[1];

    const byBooking = haystack.match(/\bbooking\s*#\s*(\d+)/i);
    if (byBooking?.[1]) return byBooking[1];

    const byHash = haystack.match(/#\s*(\d+)/);
    if (byHash?.[1]) return byHash[1];

    return undefined;
  };

  const buildCustomerBookingsUrl = (bookingId?: string) => {
    if (!bookingId) return "/customer/bookings";
    return `/customer/bookings?bookingId=${encodeURIComponent(bookingId)}`;
  };

  const buildProviderBookingsUrl = (status?: string) => {
    if (!status) return "/provider/bookings";
    return `/provider/bookings?status=${encodeURIComponent(status)}`;
  };

  // Function to navigate to the relevant page based on notification type and CONTENT
  // The key insight: check the notification TITLE to determine WHO it's for
  const navigateToRelevantPage = (notification: Notification) => {
    // Close the notification panel
    setOpen(false);

    // Extract any IDs from the notification message if present
    const id = extractEntityId(notification);

    // Determine user capabilities
    const hasShopAccess = profiles.hasShop || user?.role === "shop" || user?.role === "worker";
    const hasProviderAccess = profiles.hasProvider || user?.role === "provider";

    // Get the notification title for content-based routing
    const title = (notification.title || "").toLowerCase();
    const message = (notification.message || "").toLowerCase();

    // Navigate based on notification type
    switch (notification.type) {
      // ========== ORDER NOTIFICATIONS ==========
      // Check title to determine if FOR shop or FOR customer
      case "order": {
        // Titles that indicate this notification is FOR THE SHOP
        // Be specific to avoid matching customer titles like "Pay Later approved"
        const isForShop =
          title.includes("new order") ||
          title.includes("order received") ||
          title.includes("approval needed") ||      // "Pay Later approval needed"
          title.includes("quick order") ||          // "New Quick Order"
          title.includes("action required") ||
          title.includes("payment reference") ||
          title.includes("agreed to final bill") || // "Customer agreed to final bill"
          title.includes("customer agreed");

        if (isForShop && hasShopAccess) {
          // This is a new order notification FOR the shop owner
          setAppMode("SHOP");
          navigate("/shop/orders");
        } else {
          // This is an order status update FOR the customer
          setAppMode("CUSTOMER");
          navigate(`/customer/order${id ? `/${id}` : "s"}`);
        }
        break;
      }

      // ========== RETURN NOTIFICATIONS ==========
      case "return": {
        // Titles that indicate this notification is FOR THE SHOP
        const isForShop =
          title.includes("new return") ||
          (title.includes("return request") && !title.includes("received"));

        if (isForShop && hasShopAccess) {
          // New return request FOR the shop
          setAppMode("SHOP");
          navigate("/shop/returns");
        } else {
          // Return status update FOR the customer
          setAppMode("CUSTOMER");
          navigate(`/customer/returns${id ? `/${id}` : ""}`);
        }
        break;
      }

      // ========== BOOKING TYPES - EXPLICITLY FOR PROVIDERS ==========
      case "booking_request":
      case "booking_cancelled_by_customer":
        if (hasProviderAccess) {
          setAppMode("PROVIDER");
          navigate("/provider/bookings?status=pending");
        } else {
          setAppMode("CUSTOMER");
          navigate(buildCustomerBookingsUrl(id));
        }
        break;

      // ========== BOOKING TYPES - EXPLICITLY FOR CUSTOMERS ==========
      // booking_update is used for "Booking Accepted" and "Booking Rejected"
      // booking_rescheduled_by_provider is when provider reschedules
      case "booking_update": {
        const isProviderPaymentUpdate =
          hasProviderAccess &&
          (title.includes("payment submitted") ||
            message.includes("payment reference") ||
            message.includes("submitted payment"));

        if (isProviderPaymentUpdate) {
          setAppMode("PROVIDER");
          navigate(buildProviderBookingsUrl("awaiting_payment"));
        } else {
          setAppMode("CUSTOMER");
          navigate(buildCustomerBookingsUrl(id));
        }
        break;
      }

      case "booking_rescheduled_request":
        if (hasProviderAccess) {
          setAppMode("PROVIDER");
          navigate(buildProviderBookingsUrl("rescheduled_pending_provider_approval"));
        } else {
          setAppMode("CUSTOMER");
          navigate(buildCustomerBookingsUrl(id));
        }
        break;

      case "booking_confirmed":
      case "booking_rejected":
      case "booking_rescheduled_by_provider":
        // Switch to CUSTOMER mode and navigate to bookings
        setAppMode("CUSTOMER");
        navigate(buildCustomerBookingsUrl(id));
        break;

      // ========== GENERIC BOOKING/SERVICE NOTIFICATIONS ==========
      case "booking":
      case "service":
      case "service_request": {
        // Check title to determine if FOR provider or FOR customer
        const isForProvider =
          title.includes("new booking") ||
          title.includes("booking request") ||
          title.includes("new service") ||
          title.includes("service request");

        if (isForProvider && hasProviderAccess) {
          setAppMode("PROVIDER");
          navigate("/provider/bookings?status=pending");
        } else {
          setAppMode("CUSTOMER");
          navigate(buildCustomerBookingsUrl(id));
        }
        break;
      }

      // ========== SHOP-SPECIFIC ==========
      case "shop":
        if (hasShopAccess) {
          setAppMode("SHOP");
          navigate("/shop/inventory");
        } else {
          setAppMode("CUSTOMER");
          navigate("/customer");
        }
        break;

      // ========== PROMOTION ==========
      case "promotion":
        setAppMode("CUSTOMER");
        navigate("/customer/explore");
        break;

      // ========== SYSTEM ==========
      case "system":
        if (hasShopAccess) {
          setAppMode("SHOP");
          navigate("/shop");
        } else if (hasProviderAccess) {
          setAppMode("PROVIDER");
          navigate("/provider");
        } else {
          setAppMode("CUSTOMER");
          navigate("/customer");
        }
        break;

      default:
        setAppMode("CUSTOMER");
        navigate("/customer");
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
      <SheetContent
        side="right"
        className="w-full max-w-sm sm:max-w-md flex flex-col gap-4"
      >
        <SheetHeader>
          <div className="flex justify-between items-center">
            <SheetTitle>{t("notifications")}</SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                {markAllAsReadMutation.isPending ? (
                  <span className="animate-pulse">{t("marking")}...</span>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    {t("mark_all_read")}
                  </>
                )}
              </Button>
            )}
          </div>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-5rem)] mt-4">
          <div className="space-y-4 pr-4">
            {!sortedNotifications.length ? (
              <p className="text-center text-muted-foreground">
                {t("no_notifications")}
              </p>
            ) : (
              sortedNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border ${notification.isRead ? "bg-background" : "bg-muted"
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
                          ? formatIndianDisplay(
                            notification.createdAt,
                            "datetime",
                          ) // Use formatIndianDisplay with IST timezone
                          : ""}
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
