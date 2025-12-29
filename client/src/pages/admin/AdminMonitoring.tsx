import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MonitoringSnapshot } from "@shared/monitoring";
import type { LogCategory } from "@shared/logging";

const OVERVIEW_REFRESH_INTERVAL = 60000;
const LOGS_REFRESH_INTERVAL = 60000;
const HEALTH_REFRESH_INTERVAL = 60000;

const getVisibilityAwareInterval =
  (intervalMs: number) => () => {
    if (typeof document === "undefined") {
      return intervalMs;
    }
    return document.visibilityState === "visible" ? intervalMs : false;
  };

const integerFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});
const decimalFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
});
const percentFormatter = new Intl.NumberFormat("en-IN", {
  style: "percent",
  maximumFractionDigits: 1,
});

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return "—";
  if (digits === 0) return integerFormatter.format(value);
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(value);
}

function formatPercent(
  value: number | null | undefined,
  { alreadyRatio = false }: { alreadyRatio?: boolean } = {},
) {
  if (value === null || value === undefined) return "—";
  const ratio = alreadyRatio ? value : value / 100;
  return percentFormatter.format(ratio);
}

function formatDuration(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (value >= 1000) {
    return `${decimalFormatter.format(value / 1000)} s`;
  }
  return `${integerFormatter.format(value)} ms`;
}

function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let current = value;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  const formatter = index === 0 ? integerFormatter : decimalFormatter;
  return `${formatter.format(current)} ${units[index]}`;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRupees(value: number | string | null | undefined) {
  const numeric = toNumber(value);
  return `₹${integerFormatter.format(numeric)}`;
}

function formatDateTime(value: string | number | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

type FrontendMetricName = MonitoringSnapshot["frontend"]["metrics"][number]["name"];

function formatFrontendMetricValue(
  name: FrontendMetricName,
  value: number | null | undefined,
) {
  if (value === null || value === undefined) return "—";
  if (name === "CLS") {
    return decimalFormatter.format(value);
  }
  return formatDuration(value);
}

type HealthResponse = Record<string, unknown>;
type AdminHealthStatus = {
  database: string;
  api: string;
  jobs: {
    bookingExpiration: string | null;
    paymentReminder: string | null;
  };
};

type LogEntry = {
  timestamp: string;
  level: string;
  message: string;
  category: LogCategory;
  metadata?: Record<string, unknown>;
};

// UI restricts to non-admin categories
type UiLogCategory = Exclude<LogCategory, "admin">;

type LogResponse = {
  logs: LogEntry[];
  availableCategories?: LogCategory[];
};

type TransactionsResponse = {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  transactions: Array<{
    id: number;
    status: string;
    paymentStatus: string | null;
    total: string;
    paymentReference: string | null;
    orderDate: string | null;
    customer: { id: number; name: string | null; email: string | null } | null;
    shop: { id: number; name: string | null; email: string | null } | null;
  }>;
};

export default function AdminMonitoring() {
  const monitoringQuery = useQuery<MonitoringSnapshot>({
    queryKey: ["/api/admin/monitoring/summary"],
    queryFn: () => apiRequest("GET", "/api/admin/monitoring/summary").then((r) => r.json()),
    refetchInterval: getVisibilityAwareInterval(OVERVIEW_REFRESH_INTERVAL),
  });

  const snapshot = monitoringQuery.data;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Monitoring &amp; Logging</h1>
        <p className="text-sm text-muted-foreground">
          Track platform health, performance, and audit events from one place.
        </p>
      </header>
      <MonitoringOverview
        snapshot={snapshot}
        isFetching={monitoringQuery.isFetching}
        onRefresh={() => monitoringQuery.refetch()}
      />
      <OperationalAlertsSection snapshot={snapshot} />
      <div className="grid gap-8 xl:grid-cols-2">
        <RequestPerformanceSection
          snapshot={snapshot}
          isFetching={monitoringQuery.isFetching}
        />
        <ErrorRateSection
          snapshot={snapshot}
          isFetching={monitoringQuery.isFetching}
        />
      </div>
      <ResourceUsageSection
        snapshot={snapshot}
        isFetching={monitoringQuery.isFetching}
      />
      <FrontendMetricsSection
        snapshot={snapshot}
        isFetching={monitoringQuery.isFetching}
      />
      <ApiStatusSection />
      <LogViewerSection />
      <TransactionViewerSection />
    </div>
  );
}

type SectionProps = {
  snapshot: MonitoringSnapshot | undefined;
  isFetching: boolean;
};

function MonitoringOverview({ snapshot, isFetching, onRefresh }: SectionProps & { onRefresh: () => void }) {
  const requests = snapshot?.requests;
  const errors = snapshot?.errors;
  const resources = snapshot?.resources;

  const errorCount = requests
    ? requests.statusBuckets.clientError + requests.statusBuckets.serverError
    : 0;
  const errorRate = requests?.total ? errorCount / requests.total : 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Live Overview</h2>
          <p className="text-sm text-muted-foreground">
            Updated every {OVERVIEW_REFRESH_INTERVAL / 1000}s. Use refresh to sample on demand.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
        >
          Refresh
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Requests / minute</CardDescription>
            <CardTitle className="text-2xl">
              {formatNumber(requests?.rpm ?? null)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Total in window: {formatNumber(requests?.total ?? null, 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average latency</CardDescription>
            <CardTitle className="text-2xl">
              {formatDuration(requests?.avgDurationMs ?? null)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            P95 {formatDuration(requests?.p95DurationMs ?? null)} · P99 {formatDuration(requests?.p99DurationMs ?? null)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Error rate</CardDescription>
            <CardTitle className="text-2xl">
              {formatPercent(errorRate, { alreadyRatio: true })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {formatNumber(errors?.perMinute ?? null)} errors / minute
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resource usage</CardDescription>
            <CardTitle className="text-2xl">
              Heap {formatBytes(resources?.memory.heapUsedBytes ?? null)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <div>CPU {formatPercent(resources?.cpu.percent ?? null)}</div>
            <div>In-flight {formatNumber(requests?.inFlight ?? null, 0)}</div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

type AlertSeverity = "critical" | "warning" | "info";

type AlertItem = {
  title: string;
  description: string;
  severity: AlertSeverity;
};

const ALERT_LIMITS = {
  errorRateWarning: 0.02,
  errorRateCritical: 0.05,
  p95LatencyMsWarning: 1500,
  p95LatencyMsCritical: 2500,
  cpuWarning: 75,
  cpuCritical: 90,
  heapWarning: 80,
  heapCritical: 90,
  eventLoopWarning: 200,
  eventLoopCritical: 400,
};

function OperationalAlertsSection({ snapshot }: { snapshot: MonitoringSnapshot | undefined }) {
  const alerts = useMemo<AlertItem[]>(() => {
    if (!snapshot) return [];
    const requests = snapshot.requests;
    const errors = snapshot.errors;
    const resources = snapshot.resources;
    const frontend = snapshot.frontend;

    const errorCount = requests.statusBuckets.clientError + requests.statusBuckets.serverError;
    const errorRate = requests.total ? errorCount / requests.total : 0;
    const heapPercent = resources.memory.heapTotalBytes
      ? (resources.memory.heapUsedBytes / resources.memory.heapTotalBytes) * 100
      : null;
    const eventLoopP95 = resources.eventLoopDelayMs?.p95 ?? null;

    const items: AlertItem[] = [];

    if (errorRate >= ALERT_LIMITS.errorRateCritical) {
      items.push({
        title: "High error rate",
        description: `Error rate at ${formatPercent(errorRate, { alreadyRatio: true })}. Investigate failing endpoints.`,
        severity: "critical",
      });
    } else if (errorRate >= ALERT_LIMITS.errorRateWarning) {
      items.push({
        title: "Elevated error rate",
        description: `Error rate at ${formatPercent(errorRate, { alreadyRatio: true })}. Watch regression spikes.`,
        severity: "warning",
      });
    }

    if (requests.p95DurationMs && requests.p95DurationMs >= ALERT_LIMITS.p95LatencyMsCritical) {
      items.push({
        title: "Latency breach",
        description: `P95 latency at ${formatDuration(requests.p95DurationMs)}.`,
        severity: "critical",
      });
    } else if (requests.p95DurationMs && requests.p95DurationMs >= ALERT_LIMITS.p95LatencyMsWarning) {
      items.push({
        title: "Latency rising",
        description: `P95 latency at ${formatDuration(requests.p95DurationMs)}.`,
        severity: "warning",
      });
    }

    if (resources.cpu.percent >= ALERT_LIMITS.cpuCritical) {
      items.push({
        title: "CPU saturation",
        description: `CPU at ${formatPercent(resources.cpu.percent)}.`,
        severity: "critical",
      });
    } else if (resources.cpu.percent >= ALERT_LIMITS.cpuWarning) {
      items.push({
        title: "CPU elevated",
        description: `CPU at ${formatPercent(resources.cpu.percent)}.`,
        severity: "warning",
      });
    }

    if (heapPercent !== null && heapPercent >= ALERT_LIMITS.heapCritical) {
      items.push({
        title: "Memory pressure",
        description: `Heap usage at ${formatPercent(heapPercent)}.`,
        severity: "critical",
      });
    } else if (heapPercent !== null && heapPercent >= ALERT_LIMITS.heapWarning) {
      items.push({
        title: "Heap utilization high",
        description: `Heap usage at ${formatPercent(heapPercent)}.`,
        severity: "warning",
      });
    }

    if (eventLoopP95 !== null && eventLoopP95 >= ALERT_LIMITS.eventLoopCritical) {
      items.push({
        title: "Event loop lag",
        description: `P95 event loop delay at ${formatDuration(eventLoopP95)}.`,
        severity: "critical",
      });
    } else if (eventLoopP95 !== null && eventLoopP95 >= ALERT_LIMITS.eventLoopWarning) {
      items.push({
        title: "Event loop delay",
        description: `P95 event loop delay at ${formatDuration(eventLoopP95)}.`,
        severity: "warning",
      });
    }

    if (errors.perMinute > 0 && errors.perMinute < 3) {
      items.push({
        title: "Intermittent errors",
        description: `${formatNumber(errors.perMinute)} errors per minute in the last window.`,
        severity: "info",
      });
    }

    frontend.metrics.forEach((metric) => {
      const goodRatio = metric.sampleCount
        ? metric.ratingCounts.good / metric.sampleCount
        : null;
      if (goodRatio !== null && goodRatio < 0.7) {
        items.push({
          title: `${metric.name} quality drop`,
          description: `${formatPercent(goodRatio, { alreadyRatio: true })} good samples.`,
          severity: goodRatio < 0.5 ? "critical" : "warning",
        });
      }
    });

    return items;
  }, [snapshot]);

  const requests = snapshot?.requests;
  const errorCount = requests
    ? requests.statusBuckets.clientError + requests.statusBuckets.serverError
    : 0;
  const successRate = requests?.total ? 1 - errorCount / requests.total : null;
  const p95Latency = requests?.p95DurationMs ?? null;
  const latencyTarget = ALERT_LIMITS.p95LatencyMsWarning;
  const latencyScore = p95Latency ? Math.min((latencyTarget / p95Latency) * 100, 100) : 0;
  const cpu = snapshot?.resources.cpu.percent ?? null;
  const heapUsedRatio = snapshot?.resources.memory.heapTotalBytes
    ? snapshot.resources.memory.heapUsedBytes / snapshot.resources.memory.heapTotalBytes
    : null;
  const uptimeHours = snapshot ? Math.round(snapshot.resources.uptimeSeconds / 3600) : null;

  const alertVariant = (severity: AlertSeverity) => {
    if (severity === "critical") return "destructive";
    if (severity === "warning") return "secondary";
    return "outline";
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[2fr,1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Operational Alerts</CardTitle>
          <CardDescription>Signals pulled from live performance and telemetry windows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {alerts.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-muted-foreground">
              All clear. No active alerts in the current sampling window.
            </div>
          )}
          {alerts.map((alert, index) => (
            <div key={`${alert.title}-${index}`} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{alert.title}</span>
                <Badge variant={alertVariant(alert.severity)} className="uppercase">
                  {alert.severity}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{alert.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Service Level Snapshot</CardTitle>
          <CardDescription>Quick pulse on availability and latency health.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Success rate</span>
              <span>
                {successRate !== null
                  ? formatPercent(successRate, { alreadyRatio: true })
                  : "—"}
              </span>
            </div>
            <Progress value={successRate !== null ? successRate * 100 : 0} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>P95 latency target</span>
              <span>{p95Latency ? formatDuration(p95Latency) : "—"}</span>
            </div>
            <Progress value={latencyScore} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>CPU headroom</span>
              <span>{cpu !== null ? formatPercent(100 - cpu) : "—"}</span>
            </div>
            <Progress value={cpu !== null ? 100 - cpu : 0} />
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            Uptime {uptimeHours !== null ? `${uptimeHours}h` : "—"}
            {heapUsedRatio !== null &&
              ` · Heap ${(heapUsedRatio * 100).toFixed(0)}%`}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function RequestPerformanceSection({ snapshot, isFetching }: SectionProps) {
  const requests = snapshot?.requests;

  const statusBreakdown = useMemo(() => {
    if (!requests) return null;
    return [
      { label: "2xx", value: requests.statusBuckets.success },
      { label: "4xx", value: requests.statusBuckets.clientError },
      { label: "5xx", value: requests.statusBuckets.serverError },
    ];
  }, [requests]);

  // Exclude admin endpoints from the table to avoid noisy self-admin calls
  const filteredTopEndpoints = useMemo(() => {
    const list = requests?.topEndpoints ?? [];
    return list.filter((endpoint) => !endpoint.path.startsWith("/api/admin"));
  }, [requests?.topEndpoints]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Request Performance</h2>
        <span className="text-sm text-muted-foreground">
          {isFetching ? "Refreshing..." : `Window: ${requests?.windowMs ? Math.round(requests.windowMs / 60000) : 0}m`}
        </span>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground">Latency</div>
              <div className="text-lg font-semibold">
                {formatDuration(requests?.p95DurationMs ?? null)}
              </div>
              <div className="text-xs text-muted-foreground">
                P95 ({formatDuration(requests?.p99DurationMs ?? null)} at P99)
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Status distribution</div>
              <div className="mt-1 flex flex-wrap gap-3 text-sm">
                {statusBreakdown?.map((bucket) => (
                  <span key={bucket.label} className="rounded border px-2 py-1">
                    {bucket.label}: {formatNumber(bucket.value, 0)}
                  </span>
                )) ?? <span className="text-muted-foreground">No samples</span>}
              </div>
            </div>
          </div>
          <div className="mt-6 overflow-hidden rounded border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Endpoint</th>
                  <th className="px-3 py-2 font-medium">Requests</th>
                  <th className="px-3 py-2 font-medium">Avg</th>
                  <th className="px-3 py-2 font-medium">P95</th>
                  <th className="px-3 py-2 font-medium">Error %</th>
                </tr>
              </thead>
              <tbody>
                {filteredTopEndpoints.length ? (
                  filteredTopEndpoints.map((endpoint) => (
                    <tr key={`${endpoint.method}-${endpoint.path}`} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{endpoint.method}</div>
                        <div className="text-xs text-muted-foreground break-all">{endpoint.path}</div>
                      </td>
                      <td className="px-3 py-2">{formatNumber(endpoint.count, 0)}</td>
                      <td className="px-3 py-2">{formatDuration(endpoint.avgDurationMs ?? null)}</td>
                      <td className="px-3 py-2">{formatDuration(endpoint.p95DurationMs ?? null)}</td>
                      <td className="px-3 py-2">{formatPercent(endpoint.errorRate ?? null, { alreadyRatio: true })}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                      {isFetching ? "Loading request data..." : "No request samples captured yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ErrorRateSection({ snapshot, isFetching }: SectionProps) {
  const errors = snapshot?.errors;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Error Tracking</h2>
        <span className="text-sm text-muted-foreground">
          {isFetching ? "Refreshing..." : "Last hour window"}
        </span>
      </div>
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-sm text-muted-foreground">Errors / minute</div>
              <div className="text-lg font-semibold">{formatNumber(errors?.perMinute ?? null)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Last 5 minutes</div>
              <div className="text-lg font-semibold">{formatNumber(errors?.lastFiveMinutes ?? null, 0)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Last hour</div>
              <div className="text-lg font-semibold">{formatNumber(errors?.lastHour ?? null, 0)}</div>
            </div>
          </div>
          <div className="overflow-hidden rounded border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-3 py-2 font-medium">Path</th>
                  <th className="px-3 py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {errors?.recent.length ? (
                  [...errors.recent]
                    .slice()
                    .reverse()
                    .map((entry) => (
                      <tr key={`${entry.timestamp}-${entry.method}-${entry.path}`} className="border-t">
                        <td className="px-3 py-2 text-xs">
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-xs uppercase">{entry.status}</td>
                        <td className="px-3 py-2 text-xs uppercase">{entry.method}</td>
                        <td className="px-3 py-2 text-xs break-all">{entry.path}</td>
                        <td className="px-3 py-2 text-xs">{formatDuration(entry.durationMs)}</td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                      {isFetching ? "Loading errors..." : "No errors captured in the last hour."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ResourceUsageSection({ snapshot, isFetching }: SectionProps) {
  const resources = snapshot?.resources;
  const uptime = resources ? Math.round(resources.uptimeSeconds / 3600) : null;
  const heapPercent = resources?.memory.heapTotalBytes
    ? (resources.memory.heapUsedBytes / resources.memory.heapTotalBytes) * 100
    : null;
  const cpuPercent = resources?.cpu.percent ?? null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Resource Usage</h2>
        <span className="text-sm text-muted-foreground">
          {isFetching ? "Refreshing..." : "Instantaneous sample"}
        </span>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground">CPU</div>
              <div className="text-lg font-semibold">
                {formatPercent(cpuPercent ?? null)}
              </div>
              <div className="text-xs text-muted-foreground">
                User {formatPercent(resources?.cpu.userPercent ?? null)} · System {formatPercent(resources?.cpu.systemPercent ?? null)}
              </div>
              {cpuPercent !== null && <Progress value={cpuPercent} className="mt-2 h-2" />}
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Memory</div>
              <div className="text-lg font-semibold">
                {formatBytes(resources?.memory.heapUsedBytes ?? null)}
              </div>
              <div className="text-xs text-muted-foreground">
                Heap {formatBytes(resources?.memory.heapTotalBytes ?? null)} · RSS {formatBytes(resources?.memory.rssBytes ?? null)}
              </div>
              {heapPercent !== null && <Progress value={heapPercent} className="mt-2 h-2" />}
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Load average</div>
              <div className="text-lg font-semibold">
                {resources?.loadAverage
                  ? resources.loadAverage.map((value) => decimalFormatter.format(value)).join(" · ")
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">1m · 5m · 15m</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Event loop</div>
              <div className="text-lg font-semibold">
                {resources?.eventLoopDelayMs
                  ? `${formatDuration(resources.eventLoopDelayMs.mean)} avg`
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {resources?.eventLoopDelayMs
                  ? `P95 ${formatDuration(resources.eventLoopDelayMs.p95)} · Max ${formatDuration(resources.eventLoopDelayMs.max)}`
                  : "Awaiting samples"}
              </div>
            </div>
          </div>
          <div className="mt-6 text-sm text-muted-foreground">
            Uptime {uptime !== null ? `${uptime}h` : "—"}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function FrontendMetricsSection({ snapshot, isFetching }: SectionProps) {
  const frontend = snapshot?.frontend;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Frontend Performance Telemetry</h2>
        <span className="text-sm text-muted-foreground">
          {isFetching ? "Refreshing..." : `Window: ${frontend ? Math.round(frontend.windowMs / 60000) : 0}m`}
        </span>
      </div>
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="overflow-hidden rounded border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Metric</th>
                  <th className="px-3 py-2 font-medium">Average</th>
                  <th className="px-3 py-2 font-medium">P95</th>
                  <th className="px-3 py-2 font-medium">Samples</th>
                  <th className="px-3 py-2 font-medium">Good%</th>
                </tr>
              </thead>
              <tbody>
                {frontend?.metrics.length ? (
                  frontend.metrics.map((metric) => {
                    const goodRatio = metric.sampleCount
                      ? metric.ratingCounts.good / metric.sampleCount
                      : null;
                    return (
                      <tr key={metric.name} className="border-t">
                        <td className="px-3 py-2 font-medium">{metric.name}</td>
                        <td className="px-3 py-2">
                          {formatFrontendMetricValue(metric.name, metric.average ?? null)}
                        </td>
                        <td className="px-3 py-2">
                          {formatFrontendMetricValue(metric.name, metric.p95 ?? null)}
                        </td>
                        <td className="px-3 py-2">{formatNumber(metric.sampleCount, 0)}</td>
                        <td className="px-3 py-2">
                          {goodRatio !== null
                            ? formatPercent(goodRatio, { alreadyRatio: true })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                      {isFetching ? "Loading browser telemetry..." : "No frontend metrics received yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {frontend?.metrics.length ? (
              frontend.metrics.map((metric) => {
                const goodRatio = metric.sampleCount
                  ? metric.ratingCounts.good / metric.sampleCount
                  : 0;
                return (
                  <div key={`${metric.name}-quality`} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{metric.name} quality</span>
                      <Badge variant={goodRatio >= 0.8 ? "secondary" : "outline"}>
                        {formatPercent(goodRatio, { alreadyRatio: true })}
                      </Badge>
                    </div>
                    <Progress value={goodRatio * 100} className="mt-2 h-2" />
                    <div className="mt-2 text-xs text-muted-foreground">
                      Good {formatNumber(metric.ratingCounts.good, 0)} · Needs improvement {formatNumber(metric.ratingCounts["needs-improvement"], 0)} · Poor {formatNumber(metric.ratingCounts.poor, 0)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Quality distribution will appear once frontend samples arrive.
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium">Recent samples</h3>
            <div className="mt-2 overflow-auto rounded border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Metric</th>
                    <th className="px-3 py-2 font-medium">Value</th>
                    <th className="px-3 py-2 font-medium">Rating</th>
                    <th className="px-3 py-2 font-medium">Page</th>
                  </tr>
                </thead>
                <tbody>
                  {frontend?.recentSamples.length ? (
                    [...frontend.recentSamples]
                      .slice()
                      .reverse()
                      .map((sample) => (
                        <tr key={`${sample.timestamp}-${sample.name}-${sample.page}`} className="border-t">
                          <td className="px-3 py-2 text-xs">
                            {new Date(sample.timestamp).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-xs uppercase">{sample.name}</td>
                          <td className="px-3 py-2 text-xs">
                            {formatFrontendMetricValue(sample.name, sample.value)}
                          </td>
                          <td className="px-3 py-2 text-xs capitalize">{sample.rating}</td>
                          <td className="px-3 py-2 text-xs break-all">{sample.page}</td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                        {isFetching ? "Waiting for samples..." : "No telemetry captured in the window."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ApiStatusSection() {
  const { data, isFetching, refetch } = useQuery<HealthResponse>({
    queryKey: ["/api/health"],
    queryFn: () => apiRequest("GET", "/api/health").then((r) => r.json()),
    refetchInterval: getVisibilityAwareInterval(HEALTH_REFRESH_INTERVAL),
  });
  const { data: adminHealth, isFetching: isAdminHealthFetching } = useQuery<AdminHealthStatus>({
    queryKey: ["/api/admin/health-status"],
    queryFn: () => apiRequest("GET", "/api/admin/health-status").then((r) => r.json()),
    refetchInterval: getVisibilityAwareInterval(HEALTH_REFRESH_INTERVAL),
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">API Status</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          Refresh
        </Button>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr,1fr]">
        <div className="rounded border bg-muted/30 p-4 text-sm">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Public health payload</span>
            <Badge variant="outline">{isFetching ? "refreshing" : "live"}</Badge>
          </div>
          <pre className="whitespace-pre-wrap break-words">
            {data ? JSON.stringify(data, null, 2) : "No status data yet."}
          </pre>
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Admin health checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Database</span>
              <Badge variant={adminHealth?.database === "ok" ? "secondary" : "destructive"}>
                {adminHealth?.database ?? (isAdminHealthFetching ? "checking" : "unknown")}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>API gateway</span>
              <Badge variant={adminHealth?.api === "ok" ? "secondary" : "destructive"}>
                {adminHealth?.api ?? (isAdminHealthFetching ? "checking" : "unknown")}
              </Badge>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <div className="font-semibold text-muted-foreground">Job heartbeats</div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Booking expiry</span>
                  <span>{formatDateTime(adminHealth?.jobs?.bookingExpiration ?? null)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Payment reminders</span>
                  <span>{formatDateTime(adminHealth?.jobs?.paymentReminder ?? null)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

const LOG_LEVEL_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Error", value: "error" },
  { label: "Warn", value: "warn" },
  { label: "Info", value: "info" },
  { label: "Debug", value: "debug" },
];

const LOG_CATEGORY_OPTIONS: Array<{
  label: string;
  value: UiLogCategory;
  description: string;
}> = [
  {
    label: "Service Providers",
    value: "service_provider",
    description: "Logs emitted while providers and workers manage services or bookings.",
  },
  {
    label: "Customers",
    value: "customer",
    description: "Activity triggered from the customer apps such as orders and bookings.",
  },
  {
    label: "Shop Owners",
    value: "shop_owner",
    description: "Shop management actions including catalog updates and fulfilment.",
  },
  {
    label: "Other",
    value: "other",
    description: "Background jobs, integrations, and any uncategorised system logs.",
  },
];

const CATEGORY_LABELS = LOG_CATEGORY_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<UiLogCategory, string>,
);

function LogViewerSection() {
  const [level, setLevel] = useState("all");
  // Default to a non-admin category; admin category is hidden.
  const [category, setCategory] = useState<UiLogCategory>("customer");
  const [search, setSearch] = useState("");

  const logQuery = useQuery<LogResponse>({
    queryKey: ["/api/admin/logs", { level, category }],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "200" });
      if (level !== "all") params.set("level", level);
      if (category) params.set("category", category);
      const query = params.toString();
      return apiRequest("GET", `/api/admin/logs${query ? `?${query}` : ""}`).then((r) => r.json());
    },
    refetchInterval: getVisibilityAwareInterval(LOGS_REFRESH_INTERVAL),
  });

  useEffect(() => {
    const categories = logQuery.data?.availableCategories;
    if (!categories || categories.length === 0) return;
    // Narrow to UI categories (exclude admin)
    const uiCategories = categories.filter(
      (c): c is UiLogCategory => c !== "admin",
    );
    if (uiCategories.includes(category)) return;
    setCategory(uiCategories[0] ?? "customer");
  }, [category, logQuery.data?.availableCategories]);

  const logData = useMemo(() => logQuery.data?.logs ?? [], [logQuery.data?.logs]);
  // Hide admin category from the available set even if server provides it
  const availableCategories = new Set<UiLogCategory>(
    (
      logQuery.data?.availableCategories?.filter(
        (c): c is UiLogCategory => c !== "admin",
      ) ?? LOG_CATEGORY_OPTIONS.map((option) => option.value)
    ),
  );
  const activeCategory = LOG_CATEGORY_OPTIONS.find((option) => option.value === category);
  const activeDescription =
    activeCategory?.description ?? "Visualise logs grouped by user segment.";
  const normalizedSearch = search.trim().toLowerCase();

  const logStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let latestTimestamp: number | null = null;
    logData.forEach((log) => {
      const key = log.level.toLowerCase();
      counts[key] = (counts[key] ?? 0) + 1;
      const ts = Date.parse(log.timestamp);
      if (!Number.isNaN(ts) && (latestTimestamp === null || ts > latestTimestamp)) {
        latestTimestamp = ts;
      }
    });
    return {
      counts,
      latestTimestamp: latestTimestamp ? new Date(latestTimestamp).toISOString() : null,
    };
  }, [logData]);

  const filteredLogs = useMemo(() => {
    if (!normalizedSearch) return logData;
    return logData.filter((log) => {
      const haystack = [
        log.message,
        log.category,
        log.level,
        log.timestamp,
        log.metadata ? JSON.stringify(log.metadata) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [logData, normalizedSearch]);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Log Viewer</h2>
        <p className="text-sm text-muted-foreground">
          Segment platform logs by audience. Automatically refreshes every {LOGS_REFRESH_INTERVAL / 1000}s. Use
          the level filter to adjust verbosity.
        </p>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={category}
            onValueChange={(value) => value && setCategory(value as UiLogCategory)}
            className="flex flex-wrap gap-2"
          >
            {LOG_CATEGORY_OPTIONS.map((option) => {
              const isAvailable = availableCategories.has(option.value);
              const disableOption = !isAvailable && category !== option.value && !logQuery.isFetching;
              return (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={`${option.label} logs`}
                  disabled={disableOption}
                >
                  {option.label}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">{activeDescription}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 w-48"
          />
          <label className="text-sm text-muted-foreground" htmlFor="log-level">
            Level
          </label>
          <select
            id="log-level"
            className="rounded border px-2 py-1 text-sm"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            {LOG_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logQuery.refetch()}
            disabled={logQuery.isFetching}
          >
            Refresh
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="destructive">Errors {formatNumber(logStats.counts.error ?? 0, 0)}</Badge>
        <Badge variant="secondary">Warn {formatNumber(logStats.counts.warn ?? 0, 0)}</Badge>
        <Badge variant="outline">Info {formatNumber(logStats.counts.info ?? 0, 0)}</Badge>
        <Badge variant="outline">Debug {formatNumber(logStats.counts.debug ?? 0, 0)}</Badge>
        <span>
          Last entry {logStats.latestTimestamp ? formatDateTime(logStats.latestTimestamp) : "—"}
        </span>
      </div>
      <div className="overflow-hidden rounded border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 font-medium">Timestamp</th>
              <th className="px-3 py-2 font-medium">Level</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Message</th>
              <th className="px-3 py-2 font-medium">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                  {logQuery.isFetching ? "Loading logs..." : "No log entries found for this segment."}
                </td>
              </tr>
            )}
            {filteredLogs.map((log, index) => (
              <tr key={`${log.timestamp}-${index}`} className="border-t">
                <td className="px-3 py-2 align-top font-mono text-xs">{log.timestamp}</td>
                <td className="px-3 py-2 align-top text-xs uppercase">{log.level}</td>
                <td className="px-3 py-2 align-top text-xs uppercase text-muted-foreground">
                  {log.category !== "admin"
                    ? CATEGORY_LABELS[log.category as UiLogCategory] ?? log.category
                    : "Admin"}
                </td>
                <td className="px-3 py-2 align-top text-sm">{log.message || ""}</td>
                <td className="px-3 py-2 align-top text-xs">
                  {log.metadata ? (
                    <details>
                      <summary className="cursor-pointer text-muted-foreground">View</summary>
                      <pre className="mt-2 whitespace-pre-wrap break-words">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TransactionViewerSection() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("");
  const [shop, setShop] = useState("");

  const params = useMemo(() => {
    const searchParams = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (status) searchParams.set("status", status);
    if (search) searchParams.set("search", search);
    if (customer) searchParams.set("customer", customer);
    if (shop) searchParams.set("shop", shop);
    return searchParams;
  }, [customer, page, pageSize, search, shop, status]);

  const queryKey = params.toString();

  const transactionsQuery = useQuery<TransactionsResponse>({
    queryKey: ["/api/admin/transactions", queryKey],
    queryFn: () =>
      apiRequest("GET", `/api/admin/transactions?${queryKey}`).then((r) => r.json()),
    placeholderData: (previousData) => previousData,
  });

  const data = transactionsQuery.data;
  const transactions = useMemo(() => data?.transactions ?? [], [data?.transactions]);
  const totalCount = data?.total ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min((page - 1) * pageSize + transactions.length, totalCount);

  const summary = useMemo(() => {
    const statusCounts = new Map<string, number>();
    const customerTotals = new Map<string, number>();
    const shopTotals = new Map<string, number>();
    let totalValue = 0;
    let paidValue = 0;
    let paidCount = 0;

    transactions.forEach((transaction) => {
      statusCounts.set(
        transaction.status,
        (statusCounts.get(transaction.status) ?? 0) + 1,
      );
      const total = toNumber(transaction.total);
      totalValue += total;
      if (transaction.paymentStatus === "paid") {
        paidValue += total;
        paidCount += 1;
      }
      if (transaction.customer) {
        const key = transaction.customer.name ?? transaction.customer.email ?? `Customer ${transaction.customer.id}`;
        customerTotals.set(key, (customerTotals.get(key) ?? 0) + total);
      }
      if (transaction.shop) {
        const key = transaction.shop.name ?? transaction.shop.email ?? `Shop ${transaction.shop.id}`;
        shopTotals.set(key, (shopTotals.get(key) ?? 0) + total);
      }
    });

    const topCustomer = Array.from(customerTotals.entries()).sort((a, b) => b[1] - a[1])[0];
    const topShop = Array.from(shopTotals.entries()).sort((a, b) => b[1] - a[1])[0];
    const count = transactions.length;

    return {
      count,
      totalValue,
      paidValue,
      paidCount,
      statusCounts,
      topCustomer,
      topShop,
      paidRatio: count ? paidCount / count : 0,
      avgValue: count ? totalValue / count : 0,
    };
  }, [transactions]);

  const resetPage = () => setPage(1);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Transactions</h2>
        <p className="text-sm text-muted-foreground">
          Search by customer or shop, filter by status, and page through recorded transactions.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue (page)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">{formatRupees(summary.totalValue)}</div>
            <div className="text-xs text-muted-foreground">
              Paid {formatRupees(summary.paidValue)} · Avg {formatRupees(summary.avgValue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment success</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">
              {summary.count
                ? formatPercent(summary.paidRatio, { alreadyRatio: true })
                : "—"}
            </div>
            <Progress value={summary.count ? summary.paidRatio * 100 : 0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-sm font-medium">{summary.topCustomer?.[0] ?? "—"}</div>
            <div className="text-xs text-muted-foreground">
              {summary.topCustomer ? formatRupees(summary.topCustomer[1]) : "No orders yet"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top shop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-sm font-medium">{summary.topShop?.[0] ?? "—"}</div>
            <div className="text-xs text-muted-foreground">
              {summary.topShop ? formatRupees(summary.topShop[1]) : "No orders yet"}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input
          placeholder="Search everywhere..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            resetPage();
          }}
        />
        <Input
          placeholder="Filter by customer"
          value={customer}
          onChange={(event) => {
            setCustomer(event.target.value);
            resetPage();
          }}
        />
        <Input
          placeholder="Filter by shop"
          value={shop}
          onChange={(event) => {
            setShop(event.target.value);
            resetPage();
          }}
        />
        <select
          className="rounded border px-2 py-2 text-sm"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            resetPage();
          }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="processing">Processing</option>
          <option value="packed">Packed</option>
          <option value="dispatched">Dispatched</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="returned">Returned</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {Array.from(summary.statusCounts.entries()).map(([statusKey, count]) => (
          <Badge key={statusKey} variant="outline" className="uppercase">
            {statusKey} {formatNumber(count, 0)}
          </Badge>
        ))}
        {summary.statusCounts.size === 0 && <span>No status samples yet.</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted-foreground" htmlFor="page-size">
          Rows
        </label>
        <select
          id="page-size"
          className="rounded border px-2 py-1 text-sm"
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value));
            resetPage();
          }}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => transactionsQuery.refetch()}
          disabled={transactionsQuery.isFetching}
        >
          Refresh
        </Button>
      </div>
      <div className="overflow-auto rounded border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 font-medium">Order ID</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Shop</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Payment</th>
              <th className="px-3 py-2 font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Ordered</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-muted-foreground" colSpan={7}>
                  {transactionsQuery.isFetching ? "Loading transactions..." : "No transactions found."}
                </td>
              </tr>
            )}
            {transactions.map((transaction: TransactionsResponse["transactions"][number]) => (
              <tr key={transaction.id} className="border-t">
                <td className="px-3 py-2 align-top font-mono text-xs">{transaction.id}</td>
                <td className="px-3 py-2 align-top text-sm">
                  {transaction.customer ? (
                    <div className="space-y-1">
                      <span>{transaction.customer.name ?? "Unnamed"}</span>
                      {transaction.customer.email && (
                        <div className="text-xs text-muted-foreground">{transaction.customer.email}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-sm">
                  {transaction.shop ? (
                    <div className="space-y-1">
                      <span>{transaction.shop.name ?? "Unassigned"}</span>
                      {transaction.shop.email && (
                        <div className="text-xs text-muted-foreground">{transaction.shop.email}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-xs uppercase">{transaction.status}</td>
                <td className="px-3 py-2 align-top text-xs uppercase">
                  {transaction.paymentStatus ?? "unknown"}
                </td>
                <td className="px-3 py-2 align-top font-mono text-xs">₹{transaction.total}</td>
                <td className="px-3 py-2 align-top text-xs">
                  {transaction.orderDate ? new Date(transaction.orderDate).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Showing {rangeStart}–{rangeEnd} of {totalCount}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || transactionsQuery.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <span className="text-sm">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.hasMore || transactionsQuery.isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
