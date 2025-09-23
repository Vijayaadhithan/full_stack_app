import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost/test";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret";

const { app } = await import("../server/index");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../uploads");
let createdFiles: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdFiles.map(async (file) => {
      try {
        await fs.unlink(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    }),
  );
  createdFiles = [];
});

describe("/api/upload", () => {
  it("accepts image uploads and returns file info", async () => {
    await fs.mkdir(uploadsDir, { recursive: true });

    const res = await request(app)
      .post("/api/upload")
      .attach("file", Buffer.from("fake image data"), {
        filename: "test.png",
        contentType: "image/png",
      });

    assert.equal(res.status, 200);
    assert.ok(res.body.filename);
    assert.ok(res.body.path.startsWith("/uploads/"));

    const storedPath = path.join(uploadsDir, res.body.filename);
    createdFiles.push(storedPath);
    const stat = await fs.stat(storedPath);
    assert.ok(stat.isFile());
  });

  it("rejects unsupported file types", async () => {
    const res = await request(app)
      .post("/api/upload")
      .attach("file", Buffer.from("not an image"), {
        filename: "test.txt",
        contentType: "text/plain",
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Invalid file type");
  });

  it("requires a file to be uploaded", async () => {
    const res = await request(app).post("/api/upload");
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "No file uploaded");
  });
});
