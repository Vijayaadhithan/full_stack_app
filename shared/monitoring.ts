import { z } from "zod";
import { performanceMetricSchema } from "./performance";

const requestRecordSchema = z.object({
  timestamp: z.number(),
  method: z.string(),
  path: z.string(),
  status: z.number(),
  durationMs: z.number(),
});

const statusBucketsSchema = z.object({
  informational: z.number(),
  success: z.number(),
  redirect: z.number(),
  clientError: z.number(),
  serverError: z.number(),
});

export const requestSummarySchema = z.object({
  windowMs: z.number(),
  total: z.number(),
  rpm: z.number(),
  avgDurationMs: z.number().nullable(),
  p95DurationMs: z.number().nullable(),
  p99DurationMs: z.number().nullable(),
  statusBuckets: statusBucketsSchema,
  inFlight: z.number(),
  topEndpoints: z.array(
    z.object({
      method: z.string(),
      path: z.string(),
      count: z.number(),
      avgDurationMs: z.number().nullable(),
      p95DurationMs: z.number().nullable(),
      errorRate: z.number(),
    }),
  ),
});

export const errorSummarySchema = z.object({
  lastFiveMinutes: z.number(),
  lastHour: z.number(),
  perMinute: z.number(),
  recent: z.array(requestRecordSchema),
});

export const resourceSnapshotSchema = z.object({
  uptimeSeconds: z.number(),
  memory: z.object({
    rssBytes: z.number(),
    heapUsedBytes: z.number(),
    heapTotalBytes: z.number(),
    heapLimitBytes: z.number(),
    externalBytes: z.number(),
  }),
  cpu: z.object({
    percent: z.number(),
    userPercent: z.number(),
    systemPercent: z.number(),
  }),
  loadAverage: z.tuple([z.number(), z.number(), z.number()]),
  eventLoopDelayMs: z
    .object({
      mean: z.number(),
      max: z.number(),
      p95: z.number(),
    })
    .nullable(),
});

export const frontendSummarySchema = z.object({
  metrics: z.array(
    z.object({
      name: performanceMetricSchema.shape.name,
      sampleCount: z.number(),
      average: z.number().nullable(),
      p95: z.number().nullable(),
      ratingCounts: z.object({
        good: z.number(),
        "needs-improvement": z.number(),
        poor: z.number(),
      }),
      latest: performanceMetricSchema.optional(),
    }),
  ),
  recentSamples: z.array(performanceMetricSchema),
  windowMs: z.number(),
});

export const monitoringSnapshotSchema = z.object({
  updatedAt: z.number(),
  requests: requestSummarySchema,
  errors: errorSummarySchema,
  resources: resourceSnapshotSchema,
  frontend: frontendSummarySchema,
});

export type RequestRecord = z.infer<typeof requestRecordSchema>;
export type RequestSummary = z.infer<typeof requestSummarySchema>;
export type ErrorSummary = z.infer<typeof errorSummarySchema>;
export type ResourceSnapshot = z.infer<typeof resourceSnapshotSchema>;
export type FrontendSummary = z.infer<typeof frontendSummarySchema>;
export type MonitoringSnapshot = z.infer<typeof monitoringSnapshotSchema>;
