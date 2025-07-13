declare module 'node-cron' {
  interface ScheduledTask {
    start: () => void;
    stop: () => void;
  }

  export function schedule(expression: string, task: () => void): ScheduledTask;
}