import type { CapacitorConfig } from "@capacitor/cli";
import { config as loadEnv } from "dotenv";

loadEnv();

const liveReloadHost =
  process.env.DEV_SERVER_HOST?.trim() && process.env.DEV_SERVER_HOST.trim().length > 0
    ? process.env.DEV_SERVER_HOST.trim()
    : "localhost";
const liveReloadPort =
  process.env.DEV_SERVER_HMR_PORT?.trim() && process.env.DEV_SERVER_HMR_PORT.trim().length > 0
    ? process.env.DEV_SERVER_HMR_PORT.trim()
    : "5173";
const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() && process.env.CAPACITOR_SERVER_URL.trim().length > 0
    ? process.env.CAPACITOR_SERVER_URL.trim()
    : `http://${liveReloadHost}:${liveReloadPort}`;

const config: CapacitorConfig = {
  appId: "com.example.app",
  appName: "DoorStep",
  webDir: "dist/public",
  server: {
    url: serverUrl,
    cleartext: true,
  },
};

export default config;
