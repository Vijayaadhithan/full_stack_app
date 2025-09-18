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

export type EmailRecipient = "customer" | "serviceProvider" | "shop";

export type EmailNotificationAudience = {
  /** Toggle customer-facing emails for this template */
  customer: boolean;
  /** Toggle provider-facing emails for this template */
  serviceProvider: boolean;
  /** Toggle shop-facing emails for this template */
  shop: boolean;
};

export type EmailNotificationType =
  | "welcome"
  | "verification"
  | "passwordReset"
  | "orderConfirmation"
  | "bookingRequest"
  | "bookingPendingCustomer"
  | "bookingUpdate"
  | "bookingAccepted"
  | "bookingRejected"
  | "bookingRescheduledByCustomer"
  | "bookingRescheduledByProvider"
  | "servicePaymentConfirmedCustomer"
  | "serviceProviderPaymentReceived"
  | "genericNotification";

export const emailNotificationPreferences: Record<
  EmailNotificationType,
  EmailNotificationAudience
> = {
  welcome: {
    customer: true,
    serviceProvider: true,
    shop: true,
  },
  verification: {
    customer: true,
    serviceProvider: true,
    shop: true,
  },
  passwordReset: {
    customer: true,
    serviceProvider: true,
    shop: true,
  },
  orderConfirmation: {
    customer: true,
    serviceProvider: false,
    shop: true,
  },
  bookingRequest: {
    customer: false,
    serviceProvider: true,
    shop: false,
  },
  bookingPendingCustomer: {
    customer: true,
    serviceProvider: false,
    shop: false,
  },
  bookingUpdate: {
    customer: true,
    serviceProvider: true,
    shop: false,
  },
  bookingAccepted: {
    customer: true,
    serviceProvider: false,
    shop: false,
  },
  bookingRejected: {
    customer: true,
    serviceProvider: false,
    shop: false,
  },
  bookingRescheduledByCustomer: {
    customer: false,
    serviceProvider: true,
    shop: false,
  },
  bookingRescheduledByProvider: {
    customer: true,
    serviceProvider: false,
    shop: false,
  },
  servicePaymentConfirmedCustomer: {
    customer: true,
    serviceProvider: false,
    shop: false,
  },
  serviceProviderPaymentReceived: {
    customer: false,
    serviceProvider: true,
    shop: false,
  },
  genericNotification: {
    customer: true,
    serviceProvider: true,
    shop: true,
  },
} as const;

export const emailNotificationTypes = Object.keys(
  emailNotificationPreferences,
) as EmailNotificationType[];

export const emailRecipients: EmailRecipient[] = [
  "customer",
  "serviceProvider",
  "shop",
];

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
