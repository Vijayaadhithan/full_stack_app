import { Queue, Worker, Job } from "bullmq";
import { getRedisConnection } from "./queue/connection";
import logger from "./logger";

const QUEUE_NAME = "background-jobs";

let queue: Queue | null = null;
let worker: Worker | null = null;

interface JobPayload {
  type: string;
  data?: Record<string, unknown>;
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
const jobHandlers: Map<string, (data: Record<string, unknown>) => Promise<void>> = new Map();

export function registerJobHandler(
  type: string,
  handler: (data: Record<string, unknown>) => Promise<void>
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

      logger.info({ jobId: job.id, jobType: job.data.type }, "[JobQueue] Processing job");
      await handler(job.data.data || {});
      logger.info({ jobId: job.id, jobType: job.data.type }, "[JobQueue] Job completed");
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
  options?: { delay?: number; priority?: number }
): Promise<void> {
  const q = getJobQueue();
  await q.add(type, { type, data }, options);
  logger.debug({ jobType: type }, "[JobQueue] Job added");
}

// Helper to add repeatable/scheduled jobs
export async function addRepeatableJob(
  type: string,
  data: Record<string, unknown>,
  pattern: string, // cron pattern e.g. "0 * * * *"
  options?: { timezone?: string }
): Promise<void> {
  const q = getJobQueue();
  await q.add(
    type,
    { type, data },
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
