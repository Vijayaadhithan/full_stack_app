import { productFilterConfig, serviceFilterConfig } from "@shared/config";

type CategoryOption = {
  value: string;
  label: string;
};

const normalizeCategory = (
  input: string | null | undefined,
  options: CategoryOption[],
): string | null | undefined => {
  if (input == null) return input;
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  const normalized = trimmed.toLowerCase();
  const match = options.find(
    (option) =>
      option.value.toLowerCase() === normalized ||
      option.label.toLowerCase() === normalized,
  );
  return match ? match.value : trimmed;
};

export const normalizeProductCategory = (
  input: string | null | undefined,
): string | null | undefined =>
  normalizeCategory(input, productFilterConfig.categories);

export const normalizeServiceCategory = (
  input: string | null | undefined,
): string | null | undefined =>
  normalizeCategory(input, serviceFilterConfig.categories);
