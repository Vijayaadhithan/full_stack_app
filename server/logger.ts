import fs from "node:fs";
import path from "node:path";
import pino from "pino";
import type { Logger } from "pino";
import type { LogContext } from "@shared/logging";
import {
  getRequestContextStore,
  runWithRequestContext,
  updateLogContext,
} from "./requestContext";

type PinoTransportTarget = {
  level: string;
  target: string;
  options: {
    destination: string | number;
    mkdir?: boolean;
  };
};

export function runWithLogContext<T>(callback: () => T, initialContext: LogContext = {}): T {
  return runWithRequestContext(callback, { log: initialContext });
}

export function setLogContext(context: Partial<LogContext>): void {
  updateLogContext(context);
}

export function getLogContext(): LogContext | undefined {
  return getRequestContextStore()?.log;
}

const level = process.env.LOG_LEVEL || "info";
const logFilePath =
  process.env.LOG_FILE_PATH || path.join(process.cwd(), "logs", "app.log");

// Ensure log directory exists so the admin log reader can access the file.
fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
if (!fs.existsSync(logFilePath)) {
  fs.closeSync(fs.openSync(logFilePath, "a"));
}

const targets: PinoTransportTarget[] = [
  {
    level,
    target: "pino/file",
    options: { destination: logFilePath, mkdir: true },
  },
];

if (process.env.LOG_TO_STDOUT !== "false") {
  targets.push({
    level,
    target: "pino/file",
    options: { destination: 1 },
  });
}

const transport = pino.transport({ targets });

// Allow passing arbitrary arguments to log methods without TypeScript complaints.
type LooseLogMethod = (...args: unknown[]) => void;
type LooseLogger = Logger &
  Record<"fatal" | "error" | "warn" | "info" | "debug" | "trace", LooseLogMethod>;

const logger = pino(
  {
    level,
    mixin() {
      const context = getRequestContextStore()?.log;
      return context ? { ...context } : {};
    },
  },
  transport,
);

const looseLogger = logger as LooseLogger;

export const LOG_FILE_PATH = logFilePath;

export default looseLogger;
