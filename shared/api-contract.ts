import { makeApi } from "@zodios/core";
import { z } from "zod";
import { PaymentMethodType } from "./schema";

const idParam = z.coerce.number().int().positive();

const nullableString = z.string().nullable();
const optionalNullableString = nullableString.optional();
const isoDateString = z.string();

const userContactSchema = z.object({
  id: z.number(),
  name: nullableString,
  email: nullableString,
  phone: nullableString,
  profilePicture: nullableString,
  addressStreet: nullableString,
  addressCity: nullableString,
  addressState: nullableString,
  addressPostalCode: nullableString,
  addressCountry: nullableString,
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

const workingDaySchema = z.object({
  isAvailable: z.boolean(),
  start: z.string(),
  end: z.string(),
});

const workingHoursSchema = z
  .object({
    monday: workingDaySchema,
    tuesday: workingDaySchema,
    wednesday: workingDaySchema,
    thursday: workingDaySchema,
    friday: workingDaySchema,
    saturday: workingDaySchema,
    sunday: workingDaySchema,
  })
  .partial()
  .strict();

const breakTimeSchema = z.object({
  start: z.string(),
  end: z.string(),
});

const serviceReviewSchema = z.object({
  id: z.number(),
  customerId: z.number().nullable(),
  serviceId: z.number().nullable(),
  bookingId: z.number().nullable(),
  rating: z.number(),
  review: nullableString,
  createdAt: isoDateString.nullable().optional(),
  providerReply: nullableString,
  isVerifiedService: z.boolean().optional(),
});

export const serviceDetailSchema = z.object({
  id: z.number(),
  providerId: z.number().nullable(),
  name: z.string(),
  description: z.string(),
  price: z.string(),
  duration: z.number(),
  isAvailable: z.boolean().optional(),
  isAvailableNow: z.boolean().optional(),
  availabilityNote: nullableString,
  isDeleted: z.boolean().optional(),
  category: z.string(),
  images: z.array(z.string()).nullable(),
  addressStreet: nullableString,
  addressCity: nullableString,
  addressState: nullableString,
  addressPostalCode: nullableString,
  addressCountry: nullableString,
  bufferTime: z.number().nullable().optional(),
  workingHours: workingHoursSchema.nullable().optional(),
  breakTime: z.array(breakTimeSchema).nullable().optional(),
  maxDailyBookings: z.number().nullable().optional(),
  serviceLocationType: z.enum(["customer_location", "provider_location"]).optional(),
  rating: z.number().nullable(),
  provider: userContactSchema,
  reviews: z.array(serviceReviewSchema),
  allowedSlots: z.array(z.string()).nullable().optional(),
});

const productDimensionsSchema = z
  .object({
    length: z.number(),
    width: z.number(),
    height: z.number(),
  })
  .strict()
  .optional();

export const productDetailSchema = z.object({
  id: z.number(),
  shopId: z.number().nullable(),
  name: z.string(),
  description: z.string(),
  price: z.string(),
  mrp: z.string().nullable(),
  stock: z.number(),
  category: z.string(),
  images: z.array(z.string()).nullable(),
  isAvailable: z.boolean().optional(),
  sku: optionalNullableString,
  barcode: optionalNullableString,
  weight: optionalNullableString,
  dimensions: productDimensionsSchema.nullable(),
  specifications: z.record(z.string()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  minOrderQuantity: z.number().nullable().optional(),
  maxOrderQuantity: z.number().nullable().optional(),
  lowStockThreshold: z.number().nullable().optional(),
  createdAt: isoDateString.nullable().optional(),
  updatedAt: isoDateString.nullable().optional(),
  catalogModeEnabled: z.boolean().optional(),
  openOrderMode: z.boolean().optional(),
  allowPayLater: z.boolean().optional(),
});

const orderStatusSchema = z.enum([
  "pending",
  "cancelled",
  "confirmed",
  "processing",
  "packed",
  "dispatched",
  "shipped",
  "delivered",
  "returned",
]);

const paymentStatusSchema = z.enum(["pending", "verifying", "paid", "failed"]);

const orderItemSchema = z.object({
  id: z.number(),
  productId: z.number().nullable(),
  name: z.string(),
  quantity: z.number(),
  price: z.string(),
  total: z.string(),
});

const orderPartySchema = z.object({
  name: nullableString,
  phone: nullableString,
  email: nullableString,
  address: nullableString,
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

const shopPartySchema = orderPartySchema.extend({
  upiId: nullableString,
  returnsEnabled: z.boolean().nullable().optional(),
});

export const orderDetailSchema = z.object({
  id: z.number(),
  customerId: z.number().nullable(),
  shopId: z.number().nullable(),
  status: orderStatusSchema,
  paymentStatus: paymentStatusSchema.nullable(),
  deliveryMethod: z.enum(["delivery", "pickup"]).nullable(),
  total: z.string(),
  shippingAddress: z.string(),
  billingAddress: nullableString,
  paymentMethod: PaymentMethodType.nullable(),
  trackingInfo: nullableString,
  notes: nullableString,
  eReceiptId: nullableString,
  eReceiptUrl: nullableString,
  eReceiptGeneratedAt: nullableString,
  paymentReference: nullableString,
  orderDate: nullableString,
  returnRequested: z.boolean().optional(),
  items: z.array(orderItemSchema),
  customer: orderPartySchema.optional(),
  shop: shopPartySchema.optional(),
});

export const orderTimelineEntrySchema = z.object({
  orderId: z.number(),
  status: orderStatusSchema,
  trackingInfo: nullableString,
  timestamp: isoDateString,
});

export const appApi = makeApi([
  {
    method: "get",
    path: "/api/services/:id",
    alias: "getServiceDetail",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: idParam,
      },
    ],
    response: serviceDetailSchema,
  },
  {
    method: "get",
    path: "/api/shops/:shopId/products/:productId",
    alias: "getProductDetail",
    parameters: [
      {
        name: "shopId",
        type: "Path",
        schema: idParam,
      },
      {
        name: "productId",
        type: "Path",
        schema: idParam,
      },
    ],
    response: productDetailSchema,
  },
  {
    method: "get",
    path: "/api/orders/:id",
    alias: "getOrderDetail",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: idParam,
      },
    ],
    response: orderDetailSchema,
  },
  {
    method: "get",
    path: "/api/orders/:id/timeline",
    alias: "getOrderTimeline",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: idParam,
      },
    ],
    response: z.array(orderTimelineEntrySchema),
  },
]);

export type AppApi = typeof appApi;
export type ServiceDetail = z.infer<typeof serviceDetailSchema>;
export type ProductDetail = z.infer<typeof productDetailSchema>;
export type OrderDetail = z.infer<typeof orderDetailSchema>;
export type OrderTimelineEntry = z.infer<typeof orderTimelineEntrySchema>;
