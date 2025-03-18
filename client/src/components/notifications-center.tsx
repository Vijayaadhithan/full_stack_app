import { Bell } from "lucide-react";
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
import { useState } from "react";

export function NotificationsCenter() {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  const { data: notifications } = useQuery<Notification[]>({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

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
          <SheetTitle>{t('notifications')}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-5rem)] mt-4">
          <div className="space-y-4 pr-4">
            {!notifications?.length ? (
              <p className="text-center text-muted-foreground">{t('no_notifications')}</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border ${
                    notification.isRead ? "bg-background" : "bg-muted"
                  } cursor-pointer`}
                  onClick={() => {
                    if (!notification.isRead) {
                      markAsReadMutation.mutate(notification.id);
                    }
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
                          ? new Date(notification.createdAt).toLocaleString()
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