/**
 * Utility functions for handling dates with Indian Standard Time (IST)
 */

// IST offset is UTC+5:30
const IST_OFFSET = 330; // 5 hours and 30 minutes in minutes

/**
 * Converts a Date object or date string to Indian Standard Time (IST)
 * @param date Date object or date string to convert
 * @returns Date object in IST
 */
export function toIndianTime(date: Date | string): Date {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  
  // Create a new date object with the IST offset
  const istDate = new Date(inputDate.getTime());
  
  // Adjust for IST (UTC+5:30)
  istDate.setMinutes(istDate.getMinutes() + IST_OFFSET - inputDate.getTimezoneOffset());
  
  return istDate;
}

/**
 * Formats a date to a string in IST
 * @param date Date to format
 * @param options Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date string in IST
 */
export function formatIndianTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const istDate = toIndianTime(date);
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    ...options
  };
  
  return new Intl.DateTimeFormat('en-IN', defaultOptions).format(istDate);
}

/**
 * Creates a new Date object in IST timezone
 * @returns Date object in IST
 */
export function newIndianDate(): Date {
  return toIndianTime(new Date());
}

/**
 * Converts a date string to an ISO string in IST
 * @param dateStr Date string to convert
 * @returns ISO string in IST
 */
export function toIndianISOString(dateStr: string | Date): string {
  return toIndianTime(dateStr).toISOString();
}

/**
 * Formats a date for display with Indian time
 * @param date Date to format
 * @param formatType Type of format to use ('date', 'time', 'datetime')
 * @returns Formatted date string
 */
export function formatIndianDisplay(date: Date | string, formatType: 'date' | 'time' | 'datetime' = 'datetime'): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
  };
  
  if (formatType === 'date' || formatType === 'datetime') {
    options.year = 'numeric';
    options.month = 'long';
    options.day = 'numeric';
  }
  
  if (formatType === 'time' || formatType === 'datetime') {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = true;
  }
  
  return formatIndianTime(date, options);
}