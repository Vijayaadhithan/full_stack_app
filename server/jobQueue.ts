import { Queue, Worker, Job } from "bullmq";
import { getRedisConnection } from "./queue/connection";
import logger from "./logger";
import { getRequestMetadata, runWithRequestContext } from "./requestContext";
import { resolveTraceContextFromSeed } from "./tracing";

const QUEUE_NAME = "background-jobs";

let queue: Queue | null = null;
let worker: Worker | null = null;

export type JobMetadata = {
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  traceFlags?: string;
  traceparent?: string;
  apiVersion?: string;
  source?: "http" | "scheduler" | "startup" | "system";
  enqueuedAt?: string;
};

interface JobPayload {
  type: string;
  data?: Record<string, unknown>;
  meta?: JobMetadata;
}

export function getJobQueue(): Queue<JobPayload> {
  if (!queue) {
    queue = new Queue<JobPayload>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs
      },
    });

    logger.info("[JobQueue] Queue initialized");
  }
  return queue;
}

// Job handler registry - jobs register their handlers here
const jobHandlers: Map<
  string,
  (data: Record<string, unknown>, meta: JobMetadata) => Promise<void>
> = new Map();

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildJobMetadata(source: JobMetadata["source"]): JobMetadata {
  const requestMetadata = getRequestMetadata();
  return {
    requestId: asString(requestMetadata?.requestId),
    correlationId: asString(requestMetadata?.correlationId),
    traceId: asString(requestMetadata?.traceId),
    spanId: asString(requestMetadata?.spanId),
    parentSpanId: asString(requestMetadata?.parentSpanId),
    traceFlags: asString(requestMetadata?.traceFlags),
    traceparent: asString(requestMetadata?.traceparent),
    apiVersion: asString(requestMetadata?.apiVersion),
    source,
    enqueuedAt: new Date().toISOString(),
  };
}

export function registerJobHandler(
  type: string,
  handler: (data: Record<string, unknown>, meta: JobMetadata) => Promise<void>
): void {
  jobHandlers.set(type, handler);
  logger.info({ jobType: type }, "[JobQueue] Registered job handler");
}

export function initializeWorker(): Worker<JobPayload> {
  if (worker) return worker;

  worker = new Worker<JobPayload>(
    QUEUE_NAME,
    async (job: Job<JobPayload>) => {
      const handler = jobHandlers.get(job.data.type);
      if (!handler) {
        logger.warn({ jobType: job.data.type }, "[JobQueue] No handler for job type");
        return;
      }

      const inputMeta = job.data.meta ?? {};
      const trace = resolveTraceContextFromSeed({
        requestId: inputMeta.requestId,
        correlationId: inputMeta.correlationId,
        traceId: inputMeta.traceId,
        parentSpanId: inputMeta.spanId ?? inputMeta.parentSpanId,
        traceFlags: inputMeta.traceFlags,
      });
      const jobMeta: JobMetadata = {
        ...inputMeta,
        requestId: trace.requestId,
        correlationId: trace.correlationId,
        traceId: trace.traceId,
        spanId: trace.spanId,
        parentSpanId: trace.parentSpanId,
        traceFlags: trace.traceFlags,
        traceparent: trace.traceparent,
      };

      await runWithRequestContext(
        async () => {
          logger.info(
            {
              jobId: job.id,
              jobType: job.data.type,
              requestId: jobMeta.requestId,
              traceId: jobMeta.traceId,
              spanId: jobMeta.spanId,
              parentSpanId: jobMeta.parentSpanId,
            },
            "[JobQueue] Processing job",
          );
          await handler(job.data.data || {}, jobMeta);
          logger.info(
            {
              jobId: job.id,
              jobType: job.data.type,
              requestId: jobMeta.requestId,
              traceId: jobMeta.traceId,
              spanId: jobMeta.spanId,
            },
            "[JobQueue] Job completed",
          );
        },
        {
          request: {
            requestId: jobMeta.requestId,
            correlationId: jobMeta.correlationId,
            traceId: jobMeta.traceId,
            spanId: jobMeta.spanId,
            parentSpanId: jobMeta.parentSpanId,
            traceFlags: jobMeta.traceFlags,
            traceparent: jobMeta.traceparent,
            method: "JOB",
            path: job.data.type,
            apiVersion: jobMeta.apiVersion,
            jobId: job.id,
            jobType: job.data.type,
          },
          log: {
            requestId: jobMeta.requestId,
            correlationId: jobMeta.correlationId,
            traceId: jobMeta.traceId,
            spanId: jobMeta.spanId,
            parentSpanId: jobMeta.parentSpanId,
            traceparent: jobMeta.traceparent,
            jobId: job.id != null ? String(job.id) : undefined,
            jobType: job.data.type,
          },
        },
      );
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
    }
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, jobType: job?.data.type, err },
      "[JobQueue] Job failed"
    );
  });

  worker.on("error", (err) => {
    logger.error({ err }, "[JobQueue] Worker error");
  });

  logger.info("[JobQueue] Worker initialized");
  return worker;
}

// Helper to add one-off jobs
export async function addJob(
  type: string,
  data?: Record<string, unknown>,
  options?: {
    delay?: number;
    priority?: number;
    source?: JobMetadata["source"];
  },
): Promise<void> {
  const q = getJobQueue();
  await q.add(
    type,
    {
      type,
      data,
      meta: buildJobMetadata(options?.source ?? "system"),
    },
    {
      delay: options?.delay,
      priority: options?.priority,
    },
  );
  logger.debug({ jobType: type }, "[JobQueue] Job added");
}

// Helper to add repeatable/scheduled jobs
export async function addRepeatableJob(
  type: string,
  data: Record<string, unknown>,
  pattern: string, // cron pattern e.g. "0 * * * *"
  options?: { timezone?: string; source?: JobMetadata["source"] },
): Promise<void> {
  const q = getJobQueue();
  await q.add(
    type,
    {
      type,
      data,
      meta: buildJobMetadata(options?.source ?? "scheduler"),
    },
    {
      repeat: {
        pattern,
        tz: options?.timezone || process.env.CRON_TZ || "Asia/Kolkata",
      },
    }
  );
  logger.info({ jobType: type, pattern }, "[JobQueue] Repeatable job scheduled");
}

export async function closeJobQueue(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  logger.info("[JobQueue] Queue and worker closed");
}
