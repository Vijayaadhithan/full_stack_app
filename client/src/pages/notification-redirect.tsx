import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useUserContext } from "@/contexts/UserContext";
import {
  buildNotificationRoutingContext,
  resolveNotificationNavigation,
  type NotificationLike,
} from "@/lib/notification-routing";

const normalizePath = (target: string) => {
  try {
    const url = new URL(target);
    return `${url.pathname}${url.search}`;
  } catch {
    return target;
  }
};

export default function NotificationRedirect() {
  const { user, profiles, isLoading, isLoadingProfiles, setAppMode } = useUserContext();
  const [, setLocation] = useLocation();
  const hasRedirected = useRef(false);

  const payload = useMemo<{
    notification: NotificationLike;
    fallbackUrl: string | null;
  }>(() => {
    const params = new URLSearchParams(window.location.search);
    const type = (params.get("type") ?? "") as NotificationLike["type"];
    const title = params.get("title") ?? "";
    const message = params.get("message") ?? params.get("body") ?? "";
    const relatedId = params.get("relatedId") ?? params.get("relatedBookingId");
    const relatedBookingId = relatedId ? Number(relatedId) : null;

    return {
      notification: {
        type,
        title,
        message,
        relatedBookingId: Number.isFinite(relatedBookingId)
          ? relatedBookingId
          : null,
      },
      fallbackUrl: params.get("clickUrl"),
    };
  }, []);

  useEffect(() => {
    if (hasRedirected.current) return;
    if (isLoading || isLoadingProfiles) return;

    const hasType = payload.notification.type.trim().length > 0;
    const context = buildNotificationRoutingContext(user, profiles);
    const resolved = hasType
      ? resolveNotificationNavigation(payload.notification, context)
      : null;

    if (resolved?.appMode) {
      setAppMode(resolved.appMode);
    }

    const target = resolved?.path || payload.fallbackUrl || "/customer";
    if (!target) return;

    console.info("[notification-redirect] routing", {
      type: payload.notification.type,
      relatedBookingId: payload.notification.relatedBookingId ?? null,
      hasTitle: Boolean(payload.notification.title),
      hasMessage: Boolean(payload.notification.message),
      appMode: resolved?.appMode ?? null,
      target,
    });

    hasRedirected.current = true;
    setLocation(normalizePath(target));
  }, [
    isLoading,
    isLoadingProfiles,
    payload,
    profiles,
    setAppMode,
    setLocation,
    user,
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Opening notification...
    </div>
  );
}
