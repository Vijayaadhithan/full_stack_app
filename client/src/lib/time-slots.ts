export const SLOT_LABEL_COPY: Record<string, string> = {
  morning: "Morning (Flexible)",
  afternoon: "Afternoon (Flexible)",
  evening: "Evening (Flexible)",
};

export const describeSlotLabel = (label?: string | null): string | null => {
  if (!label) return null;
  return SLOT_LABEL_COPY[label] ?? null;
};
