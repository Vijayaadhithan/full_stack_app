/**
 * Utility functions for handling dates with Indian Standard Time (IST)
 */
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { format as formatBase, parseISO, isValid } from "date-fns";

const timeZone = "Asia/Kolkata";

/**
 * Converts a Date object or date string (assumed UTC if no timezone specified) to a Date object representing the equivalent time in IST.
 * Note: This primarily changes the internal representation for potential use with non-timezone-aware functions.
 * For formatting, prefer formatInTimeZone.
 * @param date Date object or date string to convert
 * @returns Date object representing the time in IST
 */
export function toIndianTime(date: Date | string): Date {
  const inputDate = typeof date === "string" ? parseISO(date) : date;
  return toZonedTime(inputDate, timeZone);
}

/**
 * Formats a date (Date object or string) directly into an IST string according to specified options.
 * This is the preferred method for displaying dates/times in IST.
 * @param date Date object or date string to format
 * @param formatString The date-fns format string (e.g., 'yyyy-MM-dd HH:mm:ss')
 * @returns Formatted date string in IST
 */
export function formatInIndianTime(
  date: Date | string,
  formatString: string,
): string {
  // Handle different date input types
  let inputDate: Date;
  if (typeof date === "string") {
    inputDate = parseISO(date);
  } else {
    inputDate = date;
  }

  // Validate date before formatting
  if (!isValid(inputDate)) {
    console.error("Invalid date passed to formatInIndianTime:", date);
    return "Invalid Date";
  }

  try {
    return formatInTimeZone(inputDate, timeZone, formatString);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Date Format Error";
  }
}

/**
 * Creates a new Date object representing the current time in IST.
 * @returns Date object representing the current time in IST
 */
export function newIndianDate(): Date {
  return toZonedTime(new Date(), timeZone);
}

/**
 * Converts a date string or Date object to an ISO string representing the equivalent time in IST.
 * @param dateStr Date string or Date object to convert
 * @returns ISO string representing the time in IST (with IST offset)
 */
export function toIndianISOString(dateStr: string | Date): string {
  const inputDate = typeof dateStr === "string" ? parseISO(dateStr) : dateStr;
  // Format in IST timezone with the ISO format including offset
  return formatInTimeZone(inputDate, timeZone, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
}

/**
 * Formats a date for display with Indian time
 * @param date Date to format
 * @param formatType Type of format to use ('date', 'time', 'datetime')
 * @returns Formatted date string
 */
export function formatIndianDisplay(
  date: Date | string,
  formatType: "date" | "time" | "datetime" = "datetime",
): string {
  if (!date) {
    console.error("Undefined date passed to formatIndianDisplay");
    return "N/A";
  }

  try {
    const parsedDate =
      typeof date === "string" ? parseISO(date) : new Date(date);

    if (!isValid(parsedDate)) {
      console.error("Invalid date in formatIndianDisplay:", date);
      return "Invalid Date";
    }

    let formatString = "";
    switch (formatType) {
      case "date":
        formatString = "dd MMMM yyyy";
        break;
      case "time":
        formatString = "hh:mm a";
        break;
      case "datetime":
      default:
        formatString = "dd MMMM yyyy, hh:mm a";
        break;
    }

    return formatInIndianTime(parsedDate, formatString);
  } catch (error) {
    console.error("Error in formatIndianDisplay:", error);
    return "Date Error";
  }
}
