/**
 * Utility functions for handling dates with Indian Standard Time (IST) in server operations
 */
import { toIndianTime, newIndianDate } from "@shared/date-utils";

/**
 * Converts a Date object to IST before storing in database
 * @param date Date to convert to IST
 * @returns Date object in IST
 */
export function toISTForStorage(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  return toIndianTime(date);
}

/**
 * Gets the current date and time in IST for database operations
 * @returns Current date and time in IST
 */
export function getCurrentISTDate(): Date {
  return newIndianDate();
}

/**
 * Converts a date from database to IST for consistent display
 * @param date Date from database
 * @returns Date object in IST
 */
export function fromDatabaseToIST(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  return toIndianTime(date);
}

/**
 * Calculates expiration date in IST
 * @param hours Number of hours from now
 * @returns Expiration date in IST
 */
export function getExpirationDate(hours: number): Date {
  const expDate = getCurrentISTDate();
  expDate.setHours(expDate.getHours() + hours);
  return expDate;
}

/**
 * Converts an array of objects with date fields to IST
 * @param items Array of objects with date fields
 * @param dateFields Array of field names that contain dates
 * @returns Array with date fields converted to IST
 */
export function convertArrayDatesToIST<T>(items: T[], dateFields: (keyof T)[]): T[] {
  return items.map(item => {
    const newItem = { ...item };
    dateFields.forEach(field => {
      const value = item[field];
      if (value instanceof Date || typeof value === 'string') {
        (newItem[field] as any) = toIndianTime(value as any);
      }
    });
    return newItem;
  });
}