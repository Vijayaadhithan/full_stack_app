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
const PLACEHOLDER_REGEX = /\$\{([^}]+)\}/g;

function resolveConfigPath(): string {
  const overridePath = process.env.NETWORK_CONFIG_PATH;
  if (overridePath && overridePath.trim().length > 0) {
    return path.resolve(process.cwd(), overridePath.trim());
  }
  return path.resolve(process.cwd(), "config", "network-config.json");
}

function substituteEnvPlaceholders<T>(input: T): T {
  if (typeof input === "string") {
    return input.replace(PLACEHOLDER_REGEX, (_match, varName: string) => {
      const envValue = process.env[varName.trim()];
      return envValue !== undefined ? envValue.trim() : "";
    }) as T;
  }

  if (Array.isArray(input)) {
    return input.map((value) => substituteEnvPlaceholders(value)) as T;
  }

  if (input && typeof input === "object") {
    const entries = Object.entries(
      input as Record<string, unknown>,
    ).map(([key, value]) => [key, substituteEnvPlaceholders(value)]);
    return Object.fromEntries(entries) as T;
  }

  return input;
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
    cachedConfig = substituteEnvPlaceholders(parsed);
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
