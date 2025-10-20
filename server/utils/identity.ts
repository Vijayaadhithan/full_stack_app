export type NormalizedString = string | null;

function toTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeUsername(value: unknown): NormalizedString {
  const trimmed = toTrimmed(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

export function normalizeEmail(value: unknown): NormalizedString {
  const trimmed = toTrimmed(value);
  if (!trimmed) {
    return null;
  }
  return trimmed.toLowerCase();
}

export function normalizePhone(value: unknown): NormalizedString {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D+/g, "");
  return digits.length > 0 ? digits : null;
}

export function normalizeOptionalString(value: unknown): NormalizedString {
  return toTrimmed(value);
}
