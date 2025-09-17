import fs from "node:fs";
import path from "node:path";
import pino from "pino";

type PinoTransportTarget = {
  level: string;
  target: string;
  options: {
    destination: string | number;
    mkdir?: boolean;
  };
};

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

const logger = pino({ level }, transport);

export const LOG_FILE_PATH = logFilePath;

export default logger;
