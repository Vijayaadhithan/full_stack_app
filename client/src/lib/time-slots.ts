export const SLOT_LABEL_COPY: Record<string, string> = {
  morning: "Morning (9 AM - 12 PM)",
  afternoon: "Afternoon (12 PM - 4 PM)",
  evening: "Evening (4 PM - 8 PM)",
};

export const describeSlotLabel = (label?: string | null): string | null => {
  if (!label) return null;
  return SLOT_LABEL_COPY[label] ?? null;
};
