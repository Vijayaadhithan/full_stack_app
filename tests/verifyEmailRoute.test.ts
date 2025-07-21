import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verifyEmailHandler } from "../server/auth";
import { db } from "../server/db";
import { storage } from "../server/storage";

function mockRes() {
  return {
    statusCode: 200,
    body: "",
    status(code: number) {
      this.statusCode = code; return this;
    },
    send(msg: string) {
      this.body = msg; return this;
    },
  } as any;
}

describe("/api/verify-email", () => {
  it("activates user with valid token", async () => {
    const req = { query: { token: "t", userId: "1" } } as any;
    const res = mockRes();
    const now = new Date(Date.now() + 10000);
    const selectOrig = db.select;
    const deleteOrig = db.delete;
    const updateOrig = storage.updateUser;
    db.select = () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ token: "t", userId: 1, expiresAt: now }]),
        }),
      }),
    }) as any;
    let updated = false;
    storage.updateUser = async (id: number, data: any) => { updated = true; return {} as any; };
    db.delete = () => ({ where: () => Promise.resolve() }) as any;

    await verifyEmailHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.includes("Email verified"));
    assert.ok(updated);

    db.select = selectOrig;
    db.delete = deleteOrig;
    storage.updateUser = updateOrig;
  });

  it("rejects invalid token", async () => {
    const req = { query: { token: "bad", userId: "1" } } as any;
    const res = mockRes();
    const selectOrig = db.select;
    db.select = () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }) as any;

    await verifyEmailHandler(req, res);
    assert.equal(res.statusCode, 400);

    db.select = selectOrig;
  });

  it("rejects expired token", async () => {
    const req = { query: { token: "expired", userId: "1" } } as any;
    const res = mockRes();
    const past = new Date(Date.now() - 1000);
    const selectOrig = db.select;
    db.select = () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ token: "expired", userId: 1, expiresAt: past }]),
        }),
      }),
    }) as any;

    await verifyEmailHandler(req, res);
    assert.equal(res.statusCode, 400);

    db.select = selectOrig;
  });
});