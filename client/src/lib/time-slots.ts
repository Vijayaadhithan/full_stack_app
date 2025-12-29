import { formatIndianDisplay, formatInIndianTime } from "@shared/date-utils";

export const SLOT_LABEL_COPY: Record<string, string> = {
  morning: "Morning (Flexible)",
  afternoon: "Afternoon (Flexible)",
  evening: "Evening (Flexible)",
};

const SLOT_START_TIMES: Record<string, string> = {
  morning: "09:00",
  afternoon: "12:00",
  evening: "16:00",
};

export const describeSlotLabel = (label?: string | null): string | null => {
  if (!label) return null;
  return SLOT_LABEL_COPY[label] ?? null;
};

const isSlotStartTime = (
  bookingDate: Date | string | null | undefined,
  label?: string | null,
): boolean => {
  if (!bookingDate || !label) return false;
  const slotStart = SLOT_START_TIMES[label];
  if (!slotStart) return false;
  return formatInIndianTime(bookingDate, "HH:mm") === slotStart;
};

export const formatBookingTimeLabel = (
  bookingDate: Date | string | null | undefined,
  label?: string | null,
): string | null => {
  if (!bookingDate) return null;
  if (label && isSlotStartTime(bookingDate, label)) {
    return describeSlotLabel(label);
  }
  return formatIndianDisplay(bookingDate, "time");
};
