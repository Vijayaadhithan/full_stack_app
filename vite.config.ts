import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import { getNetworkConfig } from "./config/network";

const networkConfig = getNetworkConfig();

const devServerBind = process.env.DEV_SERVER_BIND || "0.0.0.0";
const devServerPort = Number(
  process.env.DEV_SERVER_PORT || networkConfig?.devServerPort || 5173,
);
const devServerHost =
  process.env.DEV_SERVER_HOST || networkConfig?.devServerHost;
const hmrHost =
  process.env.DEV_SERVER_HMR_HOST ||
  networkConfig?.devServerHmrHost ||
  devServerHost ||
  undefined;
const hmrPort = process.env.DEV_SERVER_HMR_PORT
  ? Number(process.env.DEV_SERVER_HMR_PORT)
  : networkConfig?.devServerHmrPort;
const hmrProtocol =
  process.env.DEV_SERVER_HMR_PROTOCOL || networkConfig?.devServerHmrProtocol;
const apiProxyTarget =
  process.env.API_PROXY_TARGET ||
  networkConfig?.apiProxyTarget ||
  "http://localhost:5000";

const hmrConfig: {
  host?: string;
  port?: number;
  protocol?: string;
} = {};

if (hmrHost) {
  hmrConfig.host = hmrHost;
}
if (hmrPort) {
  hmrConfig.port = hmrPort;
}
if (hmrProtocol) {
  hmrConfig.protocol = hmrProtocol;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  server: {
    host: devServerBind,
    port: devServerPort,
    hmr: hmrConfig,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
