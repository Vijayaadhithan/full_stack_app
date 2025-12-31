import os from "node:os";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import type {
  ErrorSummary,
  FrontendSummary,
  MonitoringSnapshot,
  RequestRecord,
  RequestSummary,
  ResourceSnapshot,
} from "@shared/monitoring";
import type { PerformanceMetric } from "@shared/performance";

const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const ERROR_WINDOW_MS = 60 * 60 * 1000;
const FRONTEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUEST_SAMPLES = 2000;
const MAX_FRONTEND_SAMPLES = 500;
const MAX_RECENT_ERRORS = 100;

type RequestSample = {
  timestamp: number;
  method: string;
  path: string;
  status: number;
  durationMs: number;
};

type FrontendSegment = "admin" | "customer" | "provider" | "shop" | "worker" | "other";

type FrontendRecord = PerformanceMetric & { segment: FrontendSegment };

type EndpointAggregate = {
  method: string;
  path: string;
  count: number;
  durations: number[];
  errorCount: number;
};

type StatusBuckets = {
  informational: number;
  success: number;
  redirect: number;
  clientError: number;
  serverError: number;
};

// PERFORMANCE FIX: Circular buffer class for O(1) insert/eviction instead of O(n) shift()
class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private tail = 0;
  private count = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    } else {
      // Buffer is full, move head forward (overwrite oldest)
      this.head = (this.head + 1) % this.capacity;
    }
  }

  // Get all items in order (oldest first)
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head + i) % this.capacity;
      const item = this.buffer[idx];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  // Filter items by predicate (for time-based pruning)
  filter(predicate: (item: T) => boolean): T[] {
    return this.toArray().filter(predicate);
  }

  get size(): number {
    return this.count;
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
}

const requestRecords = new CircularBuffer<RequestSample>(MAX_REQUEST_SAMPLES);
const recentErrors = new CircularBuffer<RequestRecord>(MAX_RECENT_ERRORS);
const frontendRecords = new CircularBuffer<FrontendRecord>(MAX_FRONTEND_SAMPLES);

let inFlightRequests = 0;

const loopDelayHistogram = monitorEventLoopDelay({ resolution: 20 });
loopDelayHistogram.enable();

let lastCpuUsage = process.cpuUsage();
let lastCpuTimestamp = performance.now();

// Simplified prune - circular buffer handles size limits, just filter by time when reading
function getFilteredRequests(now: number): RequestSample[] {
  const cutoff = now - REQUEST_WINDOW_MS;
  return requestRecords.filter(r => r.timestamp >= cutoff);
}

function getFilteredErrors(now: number): RequestRecord[] {
  const cutoff = now - ERROR_WINDOW_MS;
  return recentErrors.filter(r => r.timestamp >= cutoff);
}

function getFilteredFrontend(now: number): FrontendRecord[] {
  const cutoff = now - FRONTEND_WINDOW_MS;
  return frontendRecords.filter(r => r.timestamp >= cutoff);
}

function calculateAverage(values: number[]): number | null {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function calculatePercentile(values: number[], percentile: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentile * sorted.length) - 1));
  return sorted[rank] ?? null;
}

function createStatusBuckets(): StatusBuckets {
  return {
    informational: 0,
    success: 0,
    redirect: 0,
    clientError: 0,
    serverError: 0,
  };
}

function bucketStatus(status: number, buckets: StatusBuckets) {
  if (status >= 100 && status < 200) buckets.informational += 1;
  else if (status >= 200 && status < 300) buckets.success += 1;
  else if (status >= 300 && status < 400) buckets.redirect += 1;
  else if (status >= 400 && status < 500) buckets.clientError += 1;
  else if (status >= 500 && status < 600) buckets.serverError += 1;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function isAdminTelemetry(
  page: string,
  segment: FrontendSegment,
  details?: PerformanceMetric["details"],
) {
  if (segment === "admin" || page.startsWith("/admin")) {
    return true;
  }

  const detailSegment = details?.segment;
  return typeof detailSegment === "string" && detailSegment.toLowerCase() === "admin";
}

function collectCpuUsage(now: number) {
  const usage = process.cpuUsage();
  const elapsedMs = Math.max(1, now - lastCpuTimestamp);
  const userMicros = usage.user - lastCpuUsage.user;
  const systemMicros = usage.system - lastCpuUsage.system;
  const totalMicros = Math.max(0, userMicros + systemMicros);
  const percent = (totalMicros / (elapsedMs * 1000)) * 100;
  const userPercent = (userMicros / (elapsedMs * 1000)) * 100;
  const systemPercent = (systemMicros / (elapsedMs * 1000)) * 100;

  lastCpuUsage = usage;
  lastCpuTimestamp = now;

  return {
    percent: clampPercent(percent),
    userPercent: clampPercent(userPercent),
    systemPercent: clampPercent(systemPercent),
  };
}

function collectEventLoopDelay() {
  const mean = loopDelayHistogram.mean;
  if (!Number.isFinite(mean)) {
    return null;
  }

  const max = loopDelayHistogram.max;
  const p95 = loopDelayHistogram.percentile ? loopDelayHistogram.percentile(95) : NaN;

  const snapshot = {
    mean: Number.isFinite(mean) ? mean / 1e6 : 0,
    max: Number.isFinite(max) ? max / 1e6 : 0,
    p95: Number.isFinite(p95) ? p95 / 1e6 : 0,
  };

  loopDelayHistogram.reset();

  return snapshot;
}

export function trackRequestStart(): (details: {
  method: string;
  path: string;
  status: number;
}) => void {
  inFlightRequests += 1;
  const startedAt = performance.now();
  let completed = false;

  return ({ method, path, status }) => {
    if (completed) return;
    completed = true;

    const durationMs = Math.max(0, performance.now() - startedAt);
    const timestamp = Date.now();
    const record: RequestRecord = {
      timestamp,
      method,
      path,
      status,
      durationMs,
    };

    requestRecords.push(record);
    // Circular buffer handles size limit automatically - no need to shift or prune

    if (status >= 400) {
      recentErrors.push(record);
      // Circular buffer handles size limit automatically
    }

    inFlightRequests = Math.max(0, inFlightRequests - 1);
  };
}

export function recordFrontendMetric(
  metric: PerformanceMetric,
  segment: FrontendSegment = "other",
) {
  if (isAdminTelemetry(metric.page, segment, metric.details)) {
    return;
  }

  const record: FrontendRecord = {
    ...metric,
    details: {
      ...(metric.details ?? {}),
      segment,
    },
    segment,
  };

  frontendRecords.push(record);
  // Circular buffer handles size limit automatically
}

function buildRequestSummary(now: number): RequestSummary {
  const records = getFilteredRequests(now)
    .filter((record: RequestSample) =>
      !record.path.startsWith("/api/admin") &&
      !record.path.startsWith("/api/events")
    );
  const durations = records.map((record) => record.durationMs);
  const windowStart = records[0]?.timestamp ?? now;
  const effectiveWindow = Math.max(1000, Math.min(REQUEST_WINDOW_MS, now - windowStart));
  const total = records.length;
  const rpm = total === 0 ? 0 : (total * 60000) / effectiveWindow;
  const statusBuckets = createStatusBuckets();

  const aggregated = new Map<string, EndpointAggregate>();

  for (const record of records) {
    bucketStatus(record.status, statusBuckets);
    const key = `${record.method} ${record.path}`;
    const current = aggregated.get(key);
    if (current) {
      current.count += 1;
      current.durations.push(record.durationMs);
      if (record.status >= 400) current.errorCount += 1;
    } else {
      aggregated.set(key, {
        method: record.method,
        path: record.path,
        count: 1,
        durations: [record.durationMs],
        errorCount: record.status >= 400 ? 1 : 0,
      });
    }
  }

  const topEndpoints = Array.from(aggregated.values())
    .map((entry) => ({
      method: entry.method,
      path: entry.path,
      count: entry.count,
      avgDurationMs: calculateAverage(entry.durations),
      p95DurationMs: calculatePercentile(entry.durations, 0.95),
      errorRate: entry.count ? entry.errorCount / entry.count : 0,
    }))
    .sort((a, b) => (b.avgDurationMs ?? 0) - (a.avgDurationMs ?? 0))
    .slice(0, 5);

  return {
    windowMs: REQUEST_WINDOW_MS,
    total,
    rpm,
    avgDurationMs: calculateAverage(durations),
    p95DurationMs: calculatePercentile(durations, 0.95),
    p99DurationMs: calculatePercentile(durations, 0.99),
    statusBuckets,
    inFlight: inFlightRequests,
    topEndpoints,
  };
}

function buildErrorSummary(now: number): ErrorSummary {
  const fiveMinuteCutoff = now - 5 * 60 * 1000;
  const oneHourCutoff = now - 60 * 60 * 1000;

  const relevantErrors = getFilteredErrors(now).filter(
    (record: RequestRecord) => record.status !== 499 && !record.path.startsWith("/api/admin"),
  );

  let lastFiveMinutes = 0;
  let lastHour = 0;

  for (const record of relevantErrors) {
    if (record.timestamp >= fiveMinuteCutoff) {
      lastFiveMinutes += 1;
    }
    if (record.timestamp >= oneHourCutoff) {
      lastHour += 1;
    }
  }

  const windowStart = relevantErrors[0]?.timestamp ?? now;
  const effectiveWindow = Math.max(1000, Math.min(ERROR_WINDOW_MS, now - windowStart));
  const perMinute =
    relevantErrors.length === 0 ? 0 : (relevantErrors.length * 60000) / effectiveWindow;

  const recent = relevantErrors.slice(-20);

  return {
    lastFiveMinutes,
    lastHour,
    perMinute,
    recent,
  };
}

function buildResourceSnapshot(now: number): ResourceSnapshot {
  const memoryUsage = process.memoryUsage();
  const cpu = collectCpuUsage(now);
  const loadAverageTuple: [number, number, number] = os.platform() === "win32"
    ? [0, 0, 0]
    : (os.loadavg() as [number, number, number]);

  return {
    uptimeSeconds: process.uptime(),
    memory: {
      rssBytes: memoryUsage.rss,
      heapUsedBytes: memoryUsage.heapUsed,
      heapTotalBytes: memoryUsage.heapTotal,
      externalBytes: memoryUsage.external,
    },
    cpu,
    loadAverage: loadAverageTuple,
    eventLoopDelayMs: collectEventLoopDelay(),
  };
}

function buildFrontendSummary(now: number): FrontendSummary {
  const records = getFilteredFrontend(now)
    .filter(
      (record: FrontendRecord) => !isAdminTelemetry(record.page, record.segment, record.details),
    );
  const grouped = new Map<
    PerformanceMetric["name"],
    {
      values: number[];
      sampleCount: number;
      ratingCounts: Record<PerformanceMetric["rating"], number>;
      latest?: FrontendRecord;
    }
  >();

  for (const record of records) {
    const entry = grouped.get(record.name);
    if (entry) {
      entry.sampleCount += 1;
      entry.values.push(record.value);
      entry.ratingCounts[record.rating] += 1;
      entry.latest = record;
    } else {
      grouped.set(record.name, {
        values: [record.value],
        sampleCount: 1,
        ratingCounts: {
          good: record.rating === "good" ? 1 : 0,
          "needs-improvement": record.rating === "needs-improvement" ? 1 : 0,
          poor: record.rating === "poor" ? 1 : 0,
        },
        latest: record,
      });
    }
  }

  const metrics: FrontendSummary["metrics"] = Array.from(grouped.entries()).map(([name, entry]) => ({
    name,
    sampleCount: entry.sampleCount,
    average: calculateAverage(entry.values),
    p95: calculatePercentile(entry.values, 0.95),
    ratingCounts: entry.ratingCounts,
    latest: entry.latest,
  }));

  metrics.sort((a, b) => a.name.localeCompare(b.name));

  const recentSamples = records.slice(-20).map(({ segment: _segment, ...rest }: FrontendRecord) => rest);

  return {
    metrics,
    recentSamples,
    windowMs: FRONTEND_WINDOW_MS,
  };
}

export function getMonitoringSnapshot(): MonitoringSnapshot {
  const now = Date.now();
  return {
    updatedAt: now,
    requests: buildRequestSummary(now),
    errors: buildErrorSummary(now),
    resources: buildResourceSnapshot(performance.now()),
    frontend: buildFrontendSummary(now),
  };
}
