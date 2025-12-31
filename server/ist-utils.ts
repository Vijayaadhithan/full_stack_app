/**
 * Utility functions for handling dates in server operations.
 * Store dates in UTC and only convert to IST for display.
 */
import { toIndianTime, fromIndianTime } from "@shared/date-utils";

/**
 * Normalizes a Date or date string for UTC storage.
 * This does not shift the underlying instant in time.
 * @param date Date or date string to normalize
 * @returns Date object for storage
 */
export function toUTCForStorage(
  date: Date | string | null | undefined,
): Date | null {
  if (!date) return null;
  return typeof date === "string" ? new Date(date) : new Date(date);
}

/**
 * Gets the current date and time in IST for display operations
 * @returns Current date and time in IST
 */
export function getCurrentISTDate(): Date {
  return toIndianTime(new Date());
}

/**
 * Converts a date from database to IST for consistent display
 * @param date Date from database
 * @returns Date object in IST
 */
export function fromDatabaseToIST(
  date: Date | string | null | undefined,
): Date | null {
  if (!date) return null;
  return toIndianTime(date);
}

/**
 * Calculates expiration date in UTC
 * @param hours Number of hours from now
 * @returns Expiration date in UTC
 */
export function getExpirationDate(hours: number): Date {
  const expDate = new Date();
  expDate.setUTCHours(expDate.getUTCHours() + hours);
  return expDate;
}

/**
 * Gets UTC bounds for the IST day containing the provided date.
 * @param date Reference date
 * @returns Start/end UTC instants for the IST day
 */
export function getISTDayBoundsUtc(date: Date): { start: Date; end: Date } {
  const zoned = toIndianTime(date);
  const startZoned = new Date(zoned);
  startZoned.setHours(0, 0, 0, 0);
  const endZoned = new Date(startZoned);
  endZoned.setDate(endZoned.getDate() + 1);
  return {
    start: fromIndianTime(startZoned),
    end: fromIndianTime(endZoned),
  };
}

/**
 * Converts an array of objects with date fields to IST
 * @param items Array of objects with date fields
 * @param dateFields Array of field names that contain dates
 * @returns Array with date fields converted to IST
 */
export function convertArrayDatesToIST<T>(
  items: T[],
  dateFields: (keyof T)[],
): T[] {
  return items.map((item) => {
    const newItem = { ...item };
    dateFields.forEach((field) => {
      const value = item[field];
      if (value instanceof Date || typeof value === "string") {
        (newItem[field] as any) = toIndianTime(value as any);
      }
    });
    return newItem;
  });
}
