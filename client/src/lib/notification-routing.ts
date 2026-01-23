import type { AppMode, Notification, User } from "@shared/schema";

export type NotificationLike = Pick<
  Notification,
  "type" | "title" | "message" | "relatedBookingId"
>;

export interface NotificationRoutingContext {
  userRole?: User["role"] | null;
  hasShop: boolean;
  hasProvider: boolean;
}

export interface NotificationNavigationResult {
  path: string;
  appMode: AppMode;
}

export function buildNotificationRoutingContext(
  user: Pick<User, "role"> | null | undefined,
  profiles:
    | {
        hasShop?: boolean;
        hasProvider?: boolean;
      }
    | null
    | undefined,
): NotificationRoutingContext {
  const userRole = user?.role ?? null;
  const hasShop = Boolean(profiles?.hasShop) || userRole === "shop" || userRole === "worker";
  const hasProvider = Boolean(profiles?.hasProvider) || userRole === "provider";

  return {
    userRole,
    hasShop,
    hasProvider,
  };
}

const extractEntityId = (notification: NotificationLike): string | undefined => {
  if (notification.relatedBookingId != null) {
    return String(notification.relatedBookingId);
  }

  const haystack = `${notification.title ?? ""} ${notification.message ?? ""}`;
  const byExplicitId = haystack.match(/ID:\s*(\d+)/i);
  if (byExplicitId?.[1]) return byExplicitId[1];

  const byOrder = haystack.match(/\border\s*#\s*(\d+)/i);
  if (byOrder?.[1]) return byOrder[1];

  const byBooking = haystack.match(/\bbooking\s*#\s*(\d+)/i);
  if (byBooking?.[1]) return byBooking[1];

  const byHash = haystack.match(/#\s*(\d+)/);
  if (byHash?.[1]) return byHash[1];

  return undefined;
};

const buildCustomerBookingsUrl = (bookingId?: string) => {
  if (!bookingId) return "/customer/bookings";
  return `/customer/bookings?bookingId=${encodeURIComponent(bookingId)}`;
};

const buildProviderBookingsUrl = (status?: string) => {
  if (!status) return "/provider/bookings";
  return `/provider/bookings?status=${encodeURIComponent(status)}`;
};

const buildCustomerOrdersUrl = (orderId?: string) => {
  if (!orderId) return "/customer/orders";
  return `/customer/order/${encodeURIComponent(orderId)}`;
};

export function resolveNotificationNavigation(
  notification: NotificationLike,
  context: NotificationRoutingContext,
): NotificationNavigationResult {
  const id = extractEntityId(notification);
  const title = (notification.title || "").toLowerCase();
  const message = (notification.message || "").toLowerCase();
  const { hasShop, hasProvider } = context;

  switch (notification.type) {
    case "order": {
      const isForShop =
        title.includes("new order") ||
        title.includes("order received") ||
        title.includes("approval needed") ||
        title.includes("quick order") ||
        title.includes("action required") ||
        title.includes("payment reference") ||
        title.includes("agreed to final bill") ||
        title.includes("customer agreed");

      if (isForShop && hasShop) {
        return { appMode: "SHOP", path: "/shop/orders" };
      }

      return { appMode: "CUSTOMER", path: buildCustomerOrdersUrl(id) };
    }

    case "return": {
      const isForShop =
        title.includes("new return") ||
        (title.includes("return request") && !title.includes("received"));

      if (isForShop && hasShop) {
        return { appMode: "SHOP", path: "/shop/orders" };
      }

      return { appMode: "CUSTOMER", path: buildCustomerOrdersUrl(id) };
    }

    case "booking_request":
    case "booking_cancelled_by_customer":
      if (hasProvider) {
        return { appMode: "PROVIDER", path: buildProviderBookingsUrl("pending") };
      }
      return { appMode: "CUSTOMER", path: buildCustomerBookingsUrl(id) };

    case "booking_update": {
      const isProviderPaymentUpdate =
        hasProvider &&
        (title.includes("payment submitted") ||
          message.includes("payment reference") ||
          message.includes("submitted payment"));

      if (isProviderPaymentUpdate) {
        return { appMode: "PROVIDER", path: buildProviderBookingsUrl("awaiting_payment") };
      }

      return { appMode: "CUSTOMER", path: buildCustomerBookingsUrl(id) };
    }

    case "booking_rescheduled_request":
      if (hasProvider) {
        return {
          appMode: "PROVIDER",
          path: buildProviderBookingsUrl("rescheduled_pending_provider_approval"),
        };
      }
      return { appMode: "CUSTOMER", path: buildCustomerBookingsUrl(id) };

    case "booking_confirmed":
    case "booking_rejected":
    case "booking_rescheduled_by_provider":
      return { appMode: "CUSTOMER", path: buildCustomerBookingsUrl(id) };

    case "booking":
    case "service":
    case "service_request": {
      const isForProvider =
        title.includes("new booking") ||
        title.includes("booking request") ||
        title.includes("new service") ||
        title.includes("service request");

      if (isForProvider && hasProvider) {
        return { appMode: "PROVIDER", path: buildProviderBookingsUrl("pending") };
      }

      return { appMode: "CUSTOMER", path: buildCustomerBookingsUrl(id) };
    }

    case "shop":
      if (hasShop) {
        return { appMode: "SHOP", path: "/shop/inventory" };
      }
      return { appMode: "CUSTOMER", path: "/customer" };

    case "promotion":
      return { appMode: "CUSTOMER", path: "/customer/browse-products" };

    case "system":
      if (hasShop) {
        return { appMode: "SHOP", path: "/shop" };
      }
      if (hasProvider) {
        return { appMode: "PROVIDER", path: "/provider" };
      }
      return { appMode: "CUSTOMER", path: "/customer" };

    default:
      return { appMode: "CUSTOMER", path: "/customer" };
  }
}
