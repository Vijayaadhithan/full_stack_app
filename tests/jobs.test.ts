import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import cron from "node-cron";
import logger from "../server/logger";
import type { IStorage } from "../server/storage";
import {
  startBookingExpirationJob,
  lastRun as bookingLastRun,
} from "../server/jobs/bookingExpirationJob";
import {
  startPaymentReminderJob,
  lastRun as paymentLastRun,
} from "../server/jobs/paymentReminderJob";

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  mock.restoreAll();
});

afterEach(() => {
  mock.restoreAll();
});

describe("bookingExpirationJob", () => {
  it("schedules cron task and processes expirations immediately", async () => {
    const scheduled: Array<() => Promise<void>> = [];
    const scheduleMock = mock.method(cron, "schedule", (_expr, job) => {
      scheduled.push(job);
      return {} as any;
    });
    mock.method(logger, "info", () => undefined);

    const processExpiredBookings = mock.fn(async () => undefined);
    const storage: Partial<IStorage> = { processExpiredBookings };

    startBookingExpirationJob(storage as IStorage);
    await flush();

    assert.equal(processExpiredBookings.mock.callCount(), 1);
    assert.equal(scheduleMock.mock.callCount(), 1);
    assert.ok(scheduled[0]);
    assert.ok(bookingLastRun instanceof Date);
  });

  it("logs errors from storage failures", async () => {
    mock.method(cron, "schedule", () => ({} as any));
    const errorMock = mock.method(logger, "error", () => undefined);
    const processExpiredBookings = mock.fn(async () => {
      throw new Error("failure");
    });
    const storage: Partial<IStorage> = { processExpiredBookings };

    startBookingExpirationJob(storage as IStorage);
    await flush();

    assert.equal(errorMock.mock.callCount(), 1);
  });
});

describe("paymentReminderJob", () => {
  it("updates overdue bookings and notifies providers", async () => {
    mock.method(cron, "schedule", () => ({} as any));
    mock.method(logger, "info", () => undefined);

    const now = Date.now();

    const updateBooking = mock.fn(async () => undefined);
    const getBookingsByStatus = mock.fn(async () => [
      {
        id: 1,
        updatedAt: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 2,
        serviceId: 50,
        updatedAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]);
    const getService = mock.fn(async () => ({ providerId: 77 }));
    const getUser = mock.fn(async () => ({ email: "provider@example.com" }));

    const storage: Partial<IStorage> = {
      getBookingsByStatus,
      updateBooking,
      getService,
      getUser,
    };

    startPaymentReminderJob(storage as IStorage);
    await flush();

    assert.equal(paymentLastRun instanceof Date, true);
    assert.equal(updateBooking.mock.callCount(), 1);
    assert.deepEqual(updateBooking.mock.calls[0].arguments, [
      1,
      {
        status: "disputed",
        disputeReason: "Payment confirmation overdue.",
      },
    ]);
    assert.equal(getService.mock.callCount(), 1);
    assert.equal(getUser.mock.callCount(), 1);
  });

  it("logs when reminder job throws", async () => {
    mock.method(cron, "schedule", () => ({} as any));
    const errorMock = mock.method(logger, "error", () => undefined);
    const storage: Partial<IStorage> = {
      getBookingsByStatus: mock.fn(async () => {
        throw new Error("db down");
      }),
    };

    startPaymentReminderJob(storage as IStorage);
    await flush();

    assert.equal(errorMock.mock.callCount(), 1);
  });
});
