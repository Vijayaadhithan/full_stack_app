export type LogCategory =
  | "admin"
  | "service_provider"
  | "customer"
  | "shop_owner"
  | "other";

export type LogContext = {
  category?: LogCategory;
  userId?: string | number;
  userRole?: string;
  adminId?: string;
  requestId?: string;
};
