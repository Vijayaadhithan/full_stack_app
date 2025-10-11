import { useEffect, useRef } from "react";
import { API_BASE_URL, queryClient } from "@/lib/queryClient";

type InvalidateMessage = {
  keys?: string[];
};

const RECONNECT_BASE_DELAY_MS = 3000;
const RECONNECT_MAX_DELAY_MS = 30000;

export function useRealtimeUpdates(enabled: boolean) {
  const retryAttemptRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let isUnmounted = false;

    const scheduleReconnect = () => {
      if (isUnmounted) return;
      const attempt = retryAttemptRef.current;
      const delay = Math.min(
        RECONNECT_MAX_DELAY_MS,
        RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt),
      );
      reconnectTimer = window.setTimeout(() => {
        if (isUnmounted) return;
        retryAttemptRef.current = attempt + 1;
        connect();
      }, delay);
    };

    const cleanupTimers = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const handleInvalidate = (event: MessageEvent) => {
      if (!event.data) return;
      try {
        const payload = JSON.parse(event.data) as InvalidateMessage;
        const keys = Array.isArray(payload.keys) ? payload.keys : [];
        for (const key of keys) {
          if (typeof key === "string" && key.length > 0) {
            queryClient.invalidateQueries({ queryKey: [key] });
          }
        }
      } catch (error) {
        console.warn("[Realtime] Failed to parse invalidate event", error);
      }
    };

    const connect = () => {
      cleanupTimers();
      if (eventSource) {
        eventSource.close();
      }

      const url = `${API_BASE_URL}/api/events`;
      eventSource = new EventSource(url, { withCredentials: true });

      eventSource.addEventListener("connected", () => {
        retryAttemptRef.current = 0;
      });
      eventSource.addEventListener("invalidate", handleInvalidate);
      eventSource.onerror = () => {
        if (isUnmounted) return;
        if (eventSource) {
          eventSource.close();
        }
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      cleanupTimers();
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [enabled]);
}
