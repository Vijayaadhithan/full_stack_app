const UPI_HANDLES = [
  "@upi",
  "@ybl",
  "@ibl",
  "@okicici",
  "@okhdfcbank",
  "@oksbi",
  "@axl",
  "@paytm",
  "@apl",
] as const;

export function getUpiSuggestions(rawValue: string): string[] {
  const trimmed = rawValue.trim();
  if (!trimmed || trimmed.includes("@")) {
    return [];
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length !== 10) {
    return [];
  }

  return UPI_HANDLES.map((handle) => `${digits}${handle}`);
}
