import assert from "node:assert/strict";
import { describe, it } from "node:test";
import IORedis from "ioredis";

function isTruthyEnv(value: string | undefined): boolean {
  const normalized = value ? value.trim().toLowerCase() : "";
  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

async function canReachRedis(url: string): Promise<boolean> {
  const probe = new IORedis(url, {
    connectTimeout: 1_000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  try {
    await probe.ping();
    return true;
  } catch {
    return false;
  } finally {
    probe.disconnect();
  }
}

const redisDisabled = isTruthyEnv(process.env.DISABLE_REDIS);

describe("jobQueue integration", () => {
  if (redisDisabled) {
    return;
  }

  it(
    "processes a BullMQ job end-to-end with metadata",
    { timeout: 20_000 },
    async (t) => {
      const redisUrl = process.env.REDIS_URL?.trim() || "redis://localhost:6379";
      if (!(await canReachRedis(redisUrl))) {
        t.skip(`Redis is unreachable at ${redisUrl}`);
        return;
      }

      const originalQueueName = process.env.BULLMQ_QUEUE_NAME;
      process.env.BULLMQ_QUEUE_NAME = `background-jobs-integration-${Date.now()}-${Math.floor(
        Math.random() * 10_000,
      )}`;

      const { addJob, closeJobQueue, initializeWorker, registerJobHandler } = await import(
        "../server/jobQueue.js"
      );
      const { closeRedisConnection } = await import(
        "../server/queue/connection.js"
      );

      t.after(async () => {
        await closeJobQueue();
        await closeRedisConnection();
        if (originalQueueName === undefined) {
          delete process.env.BULLMQ_QUEUE_NAME;
        } else {
          process.env.BULLMQ_QUEUE_NAME = originalQueueName;
        }
      });

      const jobType = `integration-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
      const payload = { token: `value-${Date.now()}` };

      let resolveProcessed: (() => void) | null = null;
      const processed = new Promise<void>((resolve) => {
        resolveProcessed = resolve;
      });

      let observedMetaSource: string | undefined;
      let observedEnqueuedAt: string | undefined;
      let observedToken: string | undefined;

      registerJobHandler(jobType, async (data, meta) => {
        observedMetaSource = meta.source;
        observedEnqueuedAt = meta.enqueuedAt;
        observedToken = typeof data.token === "string" ? data.token : undefined;
        resolveProcessed?.();
      });

      initializeWorker();
      await addJob(jobType, payload, { source: "system" });

      await Promise.race([
        processed,
        new Promise<void>((_, reject) => {
          const timer = setTimeout(() => {
            reject(new Error("Timed out waiting for BullMQ job processing"));
          }, 8_000);
          timer.unref();
        }),
      ]);

      assert.equal(observedToken, payload.token);
      assert.equal(observedMetaSource, "system");
      assert.equal(typeof observedEnqueuedAt, "string");
      assert.ok(observedEnqueuedAt && observedEnqueuedAt.length > 0);
    },
  );
});
