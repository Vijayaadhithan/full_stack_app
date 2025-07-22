declare module "node-cron" {
  interface ScheduledTask {
    start: () => void;
    stop: () => void;
  }

  interface ScheduleOptions {
    scheduled?: boolean;
    timezone?: string;
  }

  export function schedule(
    expression: string,
    task: () => void,
    options?: ScheduleOptions,
  ): ScheduledTask;
}
