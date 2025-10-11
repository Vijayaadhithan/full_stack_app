import fs from "node:fs";
import path from "node:path";

export type NetworkConfig = {
  frontendUrl?: string;
  appBaseUrl?: string;
  allowedOrigins?: string[];
  devServerHost?: string;
  devServerPort?: number;
  devServerHmrHost?: string;
  devServerHmrPort?: number;
  devServerHmrProtocol?: string;
  apiProxyTarget?: string;
};

let cachedConfig: NetworkConfig | null | undefined;

function resolveConfigPath(): string {
  const overridePath = process.env.NETWORK_CONFIG_PATH;
  if (overridePath && overridePath.trim().length > 0) {
    return path.resolve(process.cwd(), overridePath.trim());
  }
  return path.resolve(process.cwd(), "config", "network-config.json");
}

export function getNetworkConfig(): NetworkConfig | null {
  if (cachedConfig !== undefined) {
    return cachedConfig;
  }

  const configPath = resolveConfigPath();
  if (!fs.existsSync(configPath)) {
    cachedConfig = null;
    return cachedConfig;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as NetworkConfig;
    cachedConfig = parsed;
  } catch (error) {
    console.error(
      `[network-config] Failed to parse ${configPath}:`,
      error instanceof Error ? error.message : error,
    );
    cachedConfig = null;
  }
  return cachedConfig;
}

export function resetNetworkConfigCache() {
  cachedConfig = undefined;
}
