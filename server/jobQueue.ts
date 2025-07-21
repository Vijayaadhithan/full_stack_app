export type Job = () => Promise<void>;

const queue: Job[] = [];
let processing = false;

async function runQueue() {
  processing = true;
  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) continue;
    try {
      await job();
    } catch (err) {
      console.error("[JobQueue] Job failed:", err);
    }
  }
  processing = false;
}

export function addJob(job: Job) {
  queue.push(job);
  if (!processing) {
    // Defer processing to next tick so request can finish
    setImmediate(runQueue);
  }
}
