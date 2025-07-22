import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../server/index";
import type { Server } from "http";
import { AddressInfo } from "net";

let server: Server;
let baseUrl: string;

before(async () => {
  process.env.NODE_ENV = "test";
  server = await startServer(0);
  const addr = server.address() as AddressInfo;
  baseUrl = `http://localhost:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
});

describe("/api/health", () => {
  it("returns service info", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "ok");
  });
});