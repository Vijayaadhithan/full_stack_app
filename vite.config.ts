import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
// Removed @replit/vite-plugin-runtime-error-modal - causes spurious "unknown runtime error" overlays
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
const normalizedAppBaseUrl = process.env.APP_BASE_URL
  ? process.env.APP_BASE_URL.replace(/\/$/, "")
  : undefined;

const apiProxyTarget =
  process.env.API_PROXY_TARGET ||
  networkConfig?.apiProxyTarget ||
  normalizedAppBaseUrl ||
  "http://localhost:5000";

const hmrConfig: {
  host?: string;
  port?: number;
  protocol?: string;
  overlay?: boolean;
} = {
  overlay: false, // Disable error overlay
};

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

export default defineConfig(async ({ mode }) => {
  const isProd = mode === "production";
  const replitPlugins =
    !isProd && process.env.REPL_ID !== undefined
      ? [
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer(),
        ),
      ]
      : [];

  return {
    plugins: [react(), themePlugin(), ...replitPlugins],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@shared": path.resolve(__dirname, "shared"),
      },
    },
    esbuild: isProd
      ? {
        pure: ["console.log", "console.info", "console.debug"],
      }
      : undefined,
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
    envDir: path.resolve(__dirname), // Load .env from project root
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            // Split large libraries into separate chunks for better caching
            if (id.includes('node_modules')) {
              // Firebase - keep together due to interdependencies
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              // Charts
              if (id.includes('recharts') || id.includes('d3-')) {
                return 'vendor-charts';
              }
              // Maps
              if (id.includes('leaflet') || id.includes('react-leaflet')) {
                return 'vendor-maps';
              }
              // Radix UI components
              if (id.includes('@radix-ui')) {
                return 'vendor-ui';
              }
            }
            return undefined;
          },
        },
      },
    },
  };
});
