import type { CapacitorConfig } from "@capacitor/cli";
import { config as loadEnv } from "dotenv";

loadEnv();

const liveReloadHost = process.env.DEV_SERVER_HOST ?? "192.168.1.6";
const liveReloadPort = process.env.DEV_SERVER_HMR_PORT ?? "5173";
const serverUrl = process.env.CAPACITOR_SERVER_URL ?? `http://${liveReloadHost}:${liveReloadPort}`;

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
