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
});
