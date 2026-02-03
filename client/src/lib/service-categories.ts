import { serviceFilterConfig } from "@shared/config";

export type ServiceCategoryOption = {
  value: string;
  label: string;
  translationKey?: string;
};

export const SERVICE_CATEGORY_OPTIONS: ServiceCategoryOption[] =
  serviceFilterConfig.categories
    .filter((category) => category.value !== "all")
    .map((category) => ({
      value: category.value,
      label: category.label,
      translationKey: category.translationKey,
    }));

const SERVICE_CATEGORY_MAP = new Map(
  SERVICE_CATEGORY_OPTIONS.map((option) => [option.value.toLowerCase(), option]),
);
const SERVICE_CATEGORY_LABEL_MAP = new Map(
  SERVICE_CATEGORY_OPTIONS.map((option) => [
    option.label.toLowerCase(),
    option,
  ]),
);

export const resolveServiceCategoryOption = (
  value: string | null | undefined,
): ServiceCategoryOption | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return (
    SERVICE_CATEGORY_MAP.get(normalized) ??
    SERVICE_CATEGORY_LABEL_MAP.get(normalized)
  );
};

export const getServiceCategoryLabel = (
  value: string | null | undefined,
  translate?: (key: string) => string,
): string => {
  if (!value) return "";
  const option = resolveServiceCategoryOption(value);
  if (!option) return value;
  if (translate && option.translationKey) {
    const translated = translate(option.translationKey);
    if (translated && translated !== option.translationKey) {
      return translated;
    }
  }
  return option.label;
};
