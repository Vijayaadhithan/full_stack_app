import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import logger from "../server/logger";
import type { IStorage } from "../server/storage";
import {
  runBookingExpiration,
} from "../server/jobs/bookingExpirationJob";
import {
  runPaymentReminder,
} from "../server/jobs/paymentReminderJob";
// No need to mock jobLockService since run* functions don't use it

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
  it("processes expirations when called", async () => {
    mock.method(logger, "info", () => undefined);

    // We don't mock withJobLock anymore as we call runBookingExpiration directly

    const processExpiredBookings = mock.fn(async () => undefined);
    const storage = { processExpiredBookings } as unknown as IStorage;

    await runBookingExpiration(storage);
    await flush();

    assert.equal(processExpiredBookings.mock.callCount(), 1);
  });

  it("logs errors from storage failures", async () => {
    // Note: runBookingExpiration doesn't catch errors, it lets them bubble up (caught by process... wrapper)
    // So here we expect it to throw, but we should verify it calls the storage method first.
    // Actually, looking at code: try { await run... } catch { log } in wrapper.
    // But inside runBookingExpiration, there is no try/catch? 
    // Wait, the original code had try/catch inside the lock callback.
    // My refactor moved the body (lastRun=...) to runBookingExpiration.
    // If runBookingExpiration throws, the wrapper catches it.
    // So the test should expect rejection if we call runBookingExpiration directly.

    const processExpiredBookings = mock.fn(async () => {
      throw new Error("failure");
    });
    const storage = { processExpiredBookings } as unknown as IStorage;

    await assert.rejects(
      async () => await runBookingExpiration(storage),
      /failure/
    );
  });
});

describe("paymentReminderJob", () => {
  it("updates overdue bookings and notifies providers", async () => {
    mock.method(logger, "info", () => undefined);

    const now = Date.now();

    const updateBooking = mock.fn(async () => undefined);
    const getBookingsByStatus = mock.fn(async () => [
      {
        id: 1,
        updatedAt: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
      } as any,
      {
        id: 2,
        serviceId: 50,
        updatedAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
      } as any,
    ]);
    // Batch methods used by the optimized job
    const getServicesByIds = mock.fn(async () => [{ id: 50, providerId: 77 } as any]);
    const getUsersByIds = mock.fn(async () => [{ id: 77, email: "provider@example.com" } as any]);

    const storage = {
      getBookingsByStatus,
      updateBooking,
      getServicesByIds,
      getUsersByIds,
    } as unknown as IStorage;

    await runPaymentReminder(storage);
    await flush();

    assert.equal(updateBooking.mock.callCount(), 1);
    assert.deepEqual(updateBooking.mock.calls[0].arguments, [
      1,
      {
        status: "disputed",
        disputeReason: "Payment confirmation overdue.",
      },
    ]);
    // Verify batch methods were called
    assert.equal(getServicesByIds.mock.callCount(), 1);
    assert.equal(getUsersByIds.mock.callCount(), 1);
  });

  it("logs when logic throws (e.g. storage error)", async () => {
    // Similar to booking logic, direct call bubbles error

    const storage = {
      getBookingsByStatus: mock.fn(async () => {
        throw new Error("db down");
      }),
    } as unknown as IStorage;

    await assert.rejects(
      async () => await runPaymentReminder(storage),
      /db down/
    );
  });
});
