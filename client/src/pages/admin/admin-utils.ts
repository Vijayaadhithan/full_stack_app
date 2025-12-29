const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
  notation: "compact",
});

type NumericValue = number | string | null | undefined;

export const toNumber = (value: NumericValue): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const formatNumber = (
  value: NumericValue,
  { compact = false }: { compact?: boolean } = {},
): string => {
  const numeric = toNumber(value);
  return compact
    ? compactNumberFormatter.format(numeric)
    : numberFormatter.format(numeric);
};

export const formatRupees = (
  value: NumericValue,
  {
    compact = false,
    maximumFractionDigits = 0,
  }: { compact?: boolean; maximumFractionDigits?: number } = {},
): string => {
  const numeric = toNumber(value);
  const formatter = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits,
    notation: compact ? "compact" : "standard",
  });
  return `₹${formatter.format(numeric)}`;
};

export const formatDateTime = (value: string | number | Date | null | undefined) => {
  if (!value) return "—";
  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

export const formatDate = (value: string | number | Date | null | undefined) => {
  if (!value) return "—";
  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

export const formatPercent = (
  value: number | null | undefined,
  { alreadyRatio = false }: { alreadyRatio?: boolean } = {},
): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const ratio = alreadyRatio ? value : value / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(ratio);
};

export const formatDuration = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  if (value >= 1000) {
    return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value / 1000)} s`;
  }
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)} ms`;
};

export const getInitials = (value: string | null | undefined) => {
  if (!value) return "—";
  const trimmed = value.trim();
  if (!trimmed) return "—";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};
