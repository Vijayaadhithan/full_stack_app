import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const originalEnv = { ...process.env };

const networkModule = await import("../config/network");
const { getNetworkConfig, resetNetworkConfigCache } = networkModule;

describe("config/network", () => {
  beforeEach(() => {
    resetNetworkConfigCache();
    Object.assign(process.env, originalEnv);
  });

  afterEach(() => {
    mock.restoreAll();
    resetNetworkConfigCache();
    process.env = { ...originalEnv };
  });

  it("returns null when config file is missing", () => {
    mock.method(fs, "existsSync", () => false);
    assert.equal(getNetworkConfig(), null);
    // Cached result should avoid subsequent filesystem checks
    assert.equal(getNetworkConfig(), null);
    assert.equal(fs.existsSync.mock.callCount(), 1);
  });

  it("loads configuration from override path when provided", () => {
    const override = "config/alt-network.json";
    process.env.NETWORK_CONFIG_PATH = override;

    const resolvedPath = path.resolve(process.cwd(), override);
    mock.method(fs, "existsSync", (file) => file === resolvedPath);
    mock.method(fs, "readFileSync", (file) => {
      assert.equal(file, resolvedPath);
      return JSON.stringify({
        frontendUrl: "https://example.com",
        allowedOrigins: ["https://alt.com"],
      });
    });

    const config = getNetworkConfig();
    assert.deepEqual(config, {
      frontendUrl: "https://example.com",
      allowedOrigins: ["https://alt.com"],
    });
  });

  it("handles malformed JSON by returning null", () => {
    mock.method(fs, "existsSync", () => true);
    mock.method(fs, "readFileSync", () => "{ invalid json");
    assert.equal(getNetworkConfig(), null);
  });

  it("substitutes environment placeholders", () => {
    mock.method(fs, "existsSync", () => true);
    process.env.APP_BASE_URL = "http://localhost:5000";
    process.env.FRONTEND_URL = "http://localhost:5173";
    process.env.DEV_SERVER_HOST = "127.0.0.1";

    mock.method(fs, "readFileSync", () =>
      JSON.stringify({
        appBaseUrl: "${APP_BASE_URL}",
        frontendUrl: "${FRONTEND_URL}",
        allowedOrigins: ["${FRONTEND_URL}", "${APP_BASE_URL}"],
        devServerHost: "${DEV_SERVER_HOST}",
        apiProxyTarget: "${APP_BASE_URL}",
      }),
    );

    const config = getNetworkConfig();
    assert.deepEqual(config, {
      appBaseUrl: "http://localhost:5000",
      frontendUrl: "http://localhost:5173",
      allowedOrigins: ["http://localhost:5173", "http://localhost:5000"],
      devServerHost: "127.0.0.1",
      apiProxyTarget: "http://localhost:5000",
    });
  });

  it("replaces missing environment values with empty strings", () => {
    mock.method(fs, "existsSync", () => true);

    delete process.env.APP_BASE_URL;
    mock.method(fs, "readFileSync", () =>
      JSON.stringify({
        appBaseUrl: "${APP_BASE_URL}",
        apiProxyTarget: "${APP_BASE_URL}",
      }),
    );

    const config = getNetworkConfig();
    assert.deepEqual(config, {
      appBaseUrl: "",
      apiProxyTarget: "",
    });
  });
});
