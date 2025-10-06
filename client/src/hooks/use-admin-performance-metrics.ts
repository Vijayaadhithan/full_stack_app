import { useEffect, useRef } from "react";
import type { PerformanceMetric } from "@shared/performance";
import { apiRequest, getCsrfToken, API_BASE_URL } from "../lib/queryClient";

type MetricName = PerformanceMetric["name"];

const METRIC_THRESHOLDS: Record<MetricName, { good: number; needsImprovement: number }> = {
  FCP: { good: 1800, needsImprovement: 3000 },
  LCP: { good: 2500, needsImprovement: 4000 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FID: { good: 100, needsImprovement: 300 },
  TTFB: { good: 800, needsImprovement: 1800 },
};

function getMetricRating(name: MetricName, value: number): PerformanceMetric["rating"] {
  const thresholds = METRIC_THRESHOLDS[name];
  if (!thresholds) return "needs-improvement";
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.needsImprovement) return "needs-improvement";
  return "poor";
}

async function postMetric(metric: PerformanceMetric) {
  const csrfToken = await getCsrfToken();
  const payload = { ...metric, _csrf: csrfToken };
  const body = JSON.stringify(payload);

  const metricUrl = new URL("/api/admin/performance-metrics", API_BASE_URL).toString();

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    const sent = navigator.sendBeacon(metricUrl, blob);
    if (sent) {
      return;
    }
  }

  await apiRequest("POST", "/api/admin/performance-metrics", payload);
}

export function useAdminPerformanceMetrics() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    if (typeof window === "undefined" || !("performance" in window)) {
      return;
    }

    const page = window.location.pathname;

    const sendMetric = (
      metric: Omit<PerformanceMetric, "page" | "timestamp"> & {
        details?: PerformanceMetric["details"];
      },
    ) => {
      postMetric({
        ...metric,
        page,
        timestamp: Date.now(),
      }).catch(() => {
        // ignore metric upload errors
      });
    };

    const navigationEntries = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    const navigationEntry = navigationEntries[0];
    if (navigationEntry) {
      const ttfb = navigationEntry.responseStart;
      if (Number.isFinite(ttfb)) {
        sendMetric({
          name: "TTFB",
          value: ttfb,
          rating: getMetricRating("TTFB", ttfb),
          details: {
            requestStart: navigationEntry.requestStart,
            responseStart: navigationEntry.responseStart,
          },
        });
      }
    }

    const paintEntries = performance.getEntriesByType("paint");
    const fcpEntry = paintEntries.find((entry) => entry.name === "first-contentful-paint");
    if (fcpEntry) {
      const value = fcpEntry.startTime;
      sendMetric({
        name: "FCP",
        value,
        rating: getMetricRating("FCP", value),
      });
    }

    let clsValue = 0;
    let lcpEntry: PerformanceEntry | undefined;
    let fidSent = false;

    const tryObserve = <K extends string>(type: K, callback: PerformanceObserverCallback) => {
      try {
        const observer = new PerformanceObserver(callback);
        observer.observe({ type, buffered: true } as PerformanceObserverInit);
        return observer;
      } catch (error) {
        return null;
      }
    };

    const lcpObserver = tryObserve("largest-contentful-paint", (entryList) => {
      const entries = entryList.getEntries();
      if (entries.length) {
        lcpEntry = entries[entries.length - 1];
      }
    });

    const clsObserver = tryObserve("layout-shift", (entryList) => {
      for (const entry of entryList.getEntries()) {
        const layoutShift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!layoutShift.hadRecentInput) {
          clsValue += layoutShift.value;
        }
      }
    });

    const fidObserver = tryObserve("first-input", (entryList) => {
      if (fidSent) return;
      const entry = entryList.getEntries()[0] as PerformanceEntry & {
        processingStart: number;
        startTime: number;
        name: string;
      };
      if (!entry) return;
      fidSent = true;
      const value = entry.processingStart - entry.startTime;
      sendMetric({
        name: "FID",
        value,
        rating: getMetricRating("FID", value),
        details: { eventType: entry.name },
      });
      fidObserver?.disconnect();
    });

    const flushMetrics = () => {
      if (lcpEntry) {
        const value = (lcpEntry as any).renderTime || lcpEntry.startTime;
        sendMetric({
          name: "LCP",
          value,
          rating: getMetricRating("LCP", value),
          details: {
            size: (lcpEntry as any).size,
            element: (lcpEntry as any).element?.tagName,
          },
        });
        lcpEntry = undefined;
      }

      if (clsValue > 0) {
        sendMetric({
          name: "CLS",
          value: clsValue,
          rating: getMetricRating("CLS", clsValue),
        });
        clsValue = 0;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushMetrics();
        lcpObserver?.disconnect();
        clsObserver?.disconnect();
        fidObserver?.disconnect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleVisibilityChange);
      lcpObserver?.disconnect();
      clsObserver?.disconnect();
      fidObserver?.disconnect();
      flushMetrics();
    };
  }, [initializedRef]);
}
