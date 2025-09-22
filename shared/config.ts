export type FilterOption = {
  value: string;
  label: string;
  translationKey?: string;
};

export type AttributeFilterConfig = {
  key: string;
  label: string;
  type: "text" | "select";
  options?: FilterOption[];
  placeholder?: string;
};

export const platformFees = {
  /** Default fee applied to product orders and cart calculations */
  productOrder: 1,
  /** Fee applied when customers book services */
  serviceBooking: 1,
} as const;

export const productFilterConfig: {
  categories: FilterOption[];
  attributeFilters: AttributeFilterConfig[];
} = {
  categories: [
    { value: "electronics", label: "Electronics", translationKey: "electronics" },
    { value: "fashion", label: "Fashion & Apparel", translationKey: "fashion" },
    { value: "home", label: "Home & Living", translationKey: "home_living" },
    { value: "beauty", label: "Beauty & Personal Care", translationKey: "beauty_personal_care" },
    { value: "books", label: "Books & Stationery", translationKey: "books_stationery" },
    { value: "food", label: "Food & Beverages", translationKey: "food_beverages" },
  ],
  attributeFilters: [
    {
      key: "color",
      label: "Color",
      type: "text",
      placeholder: "e.g., Red",
    },
    {
      key: "size",
      label: "Size",
      type: "text",
      placeholder: "e.g., M",
    },
  ],
};

export const serviceFilterConfig: {
  categories: FilterOption[];
} = {
  categories: [
    { value: "all", label: "All" },
    { value: "Beauty & Wellness", label: "Beauty & Wellness" },
    { value: "Home Services", label: "Home Services" },
    { value: "Professional Services", label: "Professional Services" },
    { value: "Health & Fitness", label: "Health & Fitness" },
    { value: "Education & Training", label: "Education & Training" },
  ],
};
