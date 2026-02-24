import { productFilterConfig } from "@shared/config";

export type ProductCategoryOption = {
  value: string;
  label: string;
  translationKey?: string;
};

export const PRODUCT_CATEGORY_OPTIONS: ProductCategoryOption[] =
  productFilterConfig.categories.map((category) => ({
    value: category.value,
    label: category.label,
    translationKey: category.translationKey,
  }));

const PRODUCT_CATEGORY_MAP = new Map(
  PRODUCT_CATEGORY_OPTIONS.map((option) => [option.value.toLowerCase(), option]),
);
const PRODUCT_CATEGORY_LABEL_MAP = new Map(
  PRODUCT_CATEGORY_OPTIONS.map((option) => [option.label.toLowerCase(), option]),
);

export const resolveProductCategoryOption = (
  value: string | null | undefined,
): ProductCategoryOption | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return (
    PRODUCT_CATEGORY_MAP.get(normalized) ??
    PRODUCT_CATEGORY_LABEL_MAP.get(normalized)
  );
};

export const getProductCategoryLabel = (
  value: string | null | undefined,
  translate?: (key: string) => string,
): string => {
  if (!value) return "";
  const option = resolveProductCategoryOption(value);
  if (!option) return value;
  if (translate && option.translationKey) {
    const translated = translate(option.translationKey);
    if (translated && translated !== option.translationKey) {
      return translated;
    }
  }
  return option.label;
};
