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

type FrontendRecord = PerformanceMetric;

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

const requestRecords: RequestSample[] = [];
const recentErrors: RequestRecord[] = [];
const frontendRecords: FrontendRecord[] = [];

let inFlightRequests = 0;

const loopDelayHistogram = monitorEventLoopDelay({ resolution: 20 });
loopDelayHistogram.enable();

let lastCpuUsage = process.cpuUsage();
let lastCpuTimestamp = performance.now();

function pruneRequests(now: number) {
  const requestCutoff = now - REQUEST_WINDOW_MS;
  while (requestRecords.length && requestRecords[0]!.timestamp < requestCutoff) {
    requestRecords.shift();
  }

  const errorCutoff = now - ERROR_WINDOW_MS;
  while (recentErrors.length && recentErrors[0]!.timestamp < errorCutoff) {
    recentErrors.shift();
  }
}

function pruneFrontend(now: number) {
  const cutoff = now - FRONTEND_WINDOW_MS;
  while (frontendRecords.length && frontendRecords[0]!.timestamp < cutoff) {
    frontendRecords.shift();
  }
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
    if (requestRecords.length > MAX_REQUEST_SAMPLES) {
      requestRecords.shift();
    }
    pruneRequests(timestamp);

    if (status >= 400) {
      recentErrors.push(record);
      if (recentErrors.length > MAX_RECENT_ERRORS) {
        recentErrors.shift();
      }
    }

    inFlightRequests = Math.max(0, inFlightRequests - 1);
  };
}

export function recordFrontendMetric(metric: PerformanceMetric) {
  frontendRecords.push(metric);
  if (frontendRecords.length > MAX_FRONTEND_SAMPLES) {
    frontendRecords.shift();
  }
  pruneFrontend(Date.now());
}

function buildRequestSummary(now: number): RequestSummary {
  pruneRequests(now);
  const records = requestRecords.slice();
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
  pruneRequests(now);
  const fiveMinuteCutoff = now - 5 * 60 * 1000;
  const oneHourCutoff = now - 60 * 60 * 1000;

  let lastFiveMinutes = 0;
  let lastHour = 0;

  for (const record of recentErrors) {
    if (record.timestamp >= fiveMinuteCutoff) {
      lastFiveMinutes += 1;
    }
    if (record.timestamp >= oneHourCutoff) {
      lastHour += 1;
    }
  }

  const windowStart = recentErrors[0]?.timestamp ?? now;
  const effectiveWindow = Math.max(1000, Math.min(ERROR_WINDOW_MS, now - windowStart));
  const perMinute = recentErrors.length === 0 ? 0 : (recentErrors.length * 60000) / effectiveWindow;

  const recent = recentErrors.slice(-20);

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
  pruneFrontend(now);
  const records = frontendRecords.slice();
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

  const recentSamples = records.slice(-20);

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
