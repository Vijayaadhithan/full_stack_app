# DoorStep TN — Complete API Endpoints Reference

> **Last Updated**: February 22, 2026 · **Total Endpoints**: 166
>
> **Base URL (dev)**: `http://localhost:5000`
> **Base URL (prod)**: `https://doorsteptn.in`
>
> **Authentication**: Cookie-session based. All state-changing requests (POST/PATCH/PUT/DELETE) require a valid `x-csrf-token` header sourced from `GET /api/csrf-token`.
>
> **Source**: Code-verified from `server/routes.ts`, `server/auth.ts`, `server/routes/admin.ts`, `server/routes/workers.ts`, `server/routes/promotions.ts`, `server/routes/bookings.ts`, `server/routes/orders.ts`.

---

## Table of Contents

1. [Platform Core & Health](#1-platform-core--health)
2. [Authentication — Standard](#2-authentication--standard)
3. [Authentication — Rural-First (Phone + PIN)](#3-authentication--rural-first-phone--pin)
4. [Authentication — Worker Login](#4-authentication--worker-login)
5. [Authentication — Forgot Password (OTP)](#5-authentication--forgot-password-otp)
6. [Auth — Multi-Profile Management](#6-auth--multi-profile-management)
7. [User & Profile Management](#7-user--profile-management)
8. [Shop Management & Discovery](#8-shop-management--discovery)
9. [Search & Recommendations](#9-search--recommendations)
10. [Product Management](#10-product-management)
11. [Cart & Wishlist](#11-cart--wishlist)
12. [Service Management](#12-service-management)
13. [Service Reviews](#13-service-reviews)
14. [Product Reviews](#14-product-reviews)
15. [Booking Management — Customer](#15-booking-management--customer)
16. [Booking Management — Provider](#16-booking-management--provider)
17. [Booking — Disputes & Admin Resolution](#17-booking--disputes--admin-resolution)
18. [Order Management](#18-order-management)
19. [Pay-Later Whitelist Management](#19-pay-later-whitelist-management)
20. [Returns & Refunds](#20-returns--refunds)
21. [Promotions & Discount Codes](#21-promotions--discount-codes)
22. [Worker (Staff) Management](#22-worker-staff-management)
23. [Notifications](#23-notifications)
24. [FCM Push Notifications](#24-fcm-push-notifications)
25. [Realtime Events (SSE)](#25-realtime-events-sse)
26. [Performance Metrics & Telemetry](#26-performance-metrics--telemetry)
27. [Admin Console](#27-admin-console)
28. [Error Responses & Status Codes](#28-error-responses--status-codes)

---

## 1. Platform Core & Health

System liveness, readiness, and CSRF token issuance.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/api/health` | Public | Liveness probe for load balancers. Returns `{ status: "ok" }`. First check in any deployment. |
| `GET` | `/api/health/ready` | Public | Readiness probe. Verifies that PostgreSQL, Redis, and BullMQ are reachable before accepting traffic. Returns component health object. |
| `GET` | `/api/csrf-token` | Public | Issues a CSRF token tied to the current session. Must be passed as `x-csrf-token` header on all state-changing requests. |
| `GET` | `/api` | Authenticated | Returns the full list of registered API routes from the Express router stack. Useful for runtime endpoint discovery. |
| `GET` | `/api/docs` | Public | Serves the Swagger/OpenAPI interactive documentation UI. |

**`GET /api/health/ready` — Response Example**
```json
{
  "status": "ready",
  "database": "connected",
  "redis": "connected",
  "queue": "running"
}
```

---

## 2. Authentication — Standard

Username/email/phone + password registration and login (traditional flow). Sessions are stored in PostgreSQL (production) or memory (development). All write endpoints are rate-limited.

| Method | Endpoint | Auth | Rate Limited | Description |
|--------|----------|------|--------------|-------------|
| `POST` | `/api/register` | No | ✅ | Register new user with username, password, name, phone, email, and role (`customer`/`provider`/`shop`). Immediately starts a login session. |
| `POST` | `/api/login` | No | ✅ | Login with username, email, or phone + password via Passport local strategy. Sets session cookie. |
| `POST` | `/api/logout` | Yes | — | Destroys the active session via `req.logout`. |
| `GET` | `/api/user` | No | — | Returns the authenticated user payload or `null` when no session exists. Safe to call on page load. |
| `POST` | `/api/delete-account` | Yes | ✅ | Permanently hard-deletes user account and all associated data, then destroys the session. Irreversible. |
| `POST` | `/api/auth/check-username` | No | ✅ | Check username availability before registration. Returns `{ available: boolean }`. Rate-limited to prevent enumeration. |

**`POST /api/register` — Request**
```json
{
  "username": "ravi_kumar",
  "password": "SecurePass123",
  "name": "Ravi Kumar",
  "phone": "9876543210",
  "email": "ravi@example.com",
  "role": "customer"
}
```
**`POST /api/register` — Response `201 Created`**
```json
{
  "id": 42,
  "username": "ravi_kumar",
  "name": "Ravi Kumar",
  "role": "customer",
  "phone": "9876543210",
  "email": "ravi@example.com"
}
```

**`POST /api/login` — Request**
```json
{ "username": "ravi_kumar", "password": "SecurePass123" }
```
> The `username` field also accepts email address or phone number.

---

## 3. Authentication — Rural-First (Phone + PIN)

Purpose-built for rural users with limited data and prepaid SIM cards. After the first Firebase OTP verification, returning users log in with a 4-digit PIN — no further SMS charges. This is the **primary authentication flow** on the Android app.

| Method | Endpoint | Auth | Rate Limited | Description |
|--------|----------|------|--------------|-------------|
| `POST` | `/api/auth/check-user` | No | ✅ | Checks if a normalized phone number is already registered. Returns `{ exists, name, isPhoneVerified }`. Used by rural onboarding to route to login vs registration. |
| `POST` | `/api/auth/rural-register` | No | ✅ | Register a phone-first user after Firebase ID token verification on the server. Also hashes and stores the 4-digit PIN. |
| `POST` | `/api/auth/login-pin` | No | ✅ | Authenticate returning user with phone + 4-digit PIN. No SMS required on repeat logins. |
| `POST` | `/api/auth/reset-pin` | No | ✅ | Reset PIN after fresh Firebase OTP verification. Also marks the phone number as verified. |

**Rural Registration Flow**
```
New User:      check-user → not found → Firebase OTP (client-side) → rural-register (PIN set)
Returning:     check-user → found → login-pin (PIN, no SMS)
Forgot PIN:    Firebase OTP (client-side) → reset-pin
```

**`POST /api/auth/rural-register` — Request**
```json
{
  "firebaseIdToken": "<Firebase ID token from phone OTP>",
  "name": "Lakshmi Devi",
  "pin": "5678",
  "initialRole": "customer",
  "language": "ta"
}
```

**`POST /api/auth/login-pin` — Request**
```json
{
  "phone": "9876543210",
  "pin": "5678"
}
```

> 💡 **Cost Saving:** Each SMS OTP in India costs ₹0.25–₹1.00. This flow eliminates recurring OTP charges for returning users.

---

## 4. Authentication — Worker Login

Worker accounts are sub-accounts created by shop owners for their employees. Workers authenticate with a system-generated 10-digit worker number and a 4-digit PIN. No email required.

| Method | Endpoint | Auth | Rate Limited | Description |
|--------|----------|------|--------------|-------------|
| `POST` | `/api/auth/worker-login` | No | ✅ | Authenticate shop worker using 10-digit worker number + 4-digit PIN. Validates active worker-shop linkage before granting access. |

**`POST /api/auth/worker-login` — Request**
```json
{
  "workerNumber": "1234567890",
  "pin": "1234"
}
```
> Worker sessions operate under the shop's context with scoped permissions defined in `shop_workers.responsibilities`.

---

## 5. Authentication — Forgot Password (OTP)

Two-step OTP flow for PIN reset on standard accounts (not Firebase flow). OTPs are hashed server-side and have a time-limited expiry.

| Method | Endpoint | Auth | Rate Limited | Description |
|--------|----------|------|--------------|-------------|
| `POST` | `/api/auth/forgot-password-otp` | No | ✅ | Generate a 6-digit OTP, hash it, store it with expiry, and dispatch it to the user's registered phone. |
| `POST` | `/api/auth/verify-reset-otp` | No | ✅ | Verify that the submitted OTP matches the stored hash and has not expired. Does **not** consume the OTP — use as a pre-check before the reset step. |
| `POST` | `/api/auth/reset-password` | No | ✅ | Consume the verified OTP and update the PIN hash. Legacy path name; actually resets PIN for phone-first users. |

**`POST /api/auth/forgot-password-otp` — Request**
```json
{ "phone": "9876543210" }
```
**`POST /api/auth/verify-reset-otp` — Request**
```json
{ "phone": "9876543210", "otp": "482916" }
```
**`POST /api/auth/reset-password` — Request**
```json
{ "phone": "9876543210", "otp": "482916", "newPin": "9012" }
```

---

## 6. Auth — Multi-Profile Management

A single user account can hold multiple role profiles (e.g., `customer` + `shop`, or `customer` + `provider`). These endpoints manage profile creation and discovery.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/auth/profiles` | Yes | Returns `{ hasShop, shop, hasProvider, provider }` for the current user. Used to show/hide role-specific UI elements. |
| `POST` | `/api/auth/create-shop` | Yes | Creates a shop profile row for the authenticated user. One shop per owner. Body: `{ shopName, description?, businessType?, location? }` |
| `POST` | `/api/auth/create-provider` | Yes | Creates a provider profile row for the authenticated user. One provider profile per user. Body: `{ bio?, skills?, experience? }` |

---

## 7. User & Profile Management

Fetch and update user profiles. Access rules: full profile for self or admin sessions; minimal public profile (name, role, ratings) for other users.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/users/:id` | Yes | Get user profile by user ID. Returns full enriched profile (including shop/pay-later metadata) for self/admin. Returns minimal `{ id, name, role, profilePicture, averageRating, totalReviews }` for others. |
| `PATCH` | `/api/users/:id` | Yes | Update own profile. Enforces strict ownership — users can only update their own profile. Supports all user fields. |
| `POST` | `/api/profile/location` | Yes | Update GPS coordinates for user or shop. Body: `{ latitude, longitude, context? }`. Pass `context: "shop"` to update shop location rather than personal location. Invalidates related caches. |

**Notable `PATCH /api/users/:id` update fields:**
- `name`, `phone`, `email`, `bio`, `profilePicture`
- `addressStreet`, `addressLandmark`, `addressCity`, `addressState`, `addressPostalCode`, `addressCountry`
- `upiId`, `upiQrCodeUrl` — for receiving payments
- `deliveryAvailable`, `pickupAvailable`, `returnsEnabled`
- `shopProfile` — embedded shop settings (working hours, delivery, catalog mode, pay-later, etc.)
- `paymentMethods` — array of `{ type: "upi"|"cash"|"pay_later", details? }`
- `shopBannerImageUrl`, `shopLogoImageUrl`

---

## 8. Shop Management & Discovery

Browse shops, retrieve shop data, and access shop-specific metrics. Most shop list/detail endpoints are public for discovery without login.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/shops` | Public | List all shops with optional location filters. Query: `?locationCity=&locationState=`. Excludes the requester's own shop if logged in. |
| `GET` | `/api/shops/:id` | Public | Get shop details by owner user ID or shops-table ID (fallback resolution). Returns public shop profile including trading modes and delivery info. |
| `GET` | `/api/shops/:shopId` | Public | **Cached** storefront-style shop detail endpoint. Functionally overlaps with `/api/shops/:id` but uses the cache layer and a slightly different resolver path. Preferred for public storefront pages. |
| `GET` | `/api/shops/:shopId/products/:productId` | Public | Returns cached product detail scoped to a specific shop-product pair. Useful for deep-linking to a product within a shop. |
| `GET` | `/api/shops/current` | Yes | Get the authenticated owner's own shop record from the `shops` table. Used by the shop dashboard to load the owner's own shop context. |
| `GET` | `/api/shops/dashboard-stats` | Yes (shop/worker) | Dashboard KPI: total orders, revenue, active products, pending orders. Accessible to shop owners and workers in a shop context. |
| `GET` | `/api/shops/:shopId/pay-later-eligibility/:customerId` | Yes | Check if a specific customer is eligible for pay-later at a specific shop. Checks whitelist membership and prior successful order history. |

**Public Shop Response Shape**
```json
{
  "id": 5,
  "ownerId": 5,
  "shopTableId": 3,
  "name": "Kumar's Grocery",
  "phone": "9876543210",
  "shopProfile": {
    "shopName": "Kumar's Grocery",
    "description": "Fresh groceries and household essentials",
    "businessType": "Grocery",
    "workingHours": { "from": "08:00", "to": "20:00", "days": ["Mon","Tue","Wed","Thu","Fri","Sat"] }
  },
  "latitude": "11.0168",
  "longitude": "76.9558",
  "addressCity": "Coimbatore",
  "addressState": "Tamil Nadu",
  "deliveryAvailable": true,
  "pickupAvailable": true,
  "returnsEnabled": true,
  "catalogModeEnabled": false,
  "openOrderMode": false,
  "allowPayLater": true,
  "averageRating": "4.3",
  "totalReviews": 127
}
```

**Shop Operating Modes Explained:**
- **Standard Mode**: Full catalog with stock tracking, add-to-cart ordering
- **Catalog Mode** (`catalogModeEnabled: true`): Display products for browsing/price-checking only — no order placement
- **Open Order Mode** (`openOrderMode: true`): Customers send a free-text description of what they need; shop responds with a quote
- **Pay Later** (`allowPayLater: true`): Trusted/repeat customers can defer payment to a later time

---

## 9. Search & Recommendations

Full-text and geo-spatial discovery across the entire platform.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/search/global` | Public | Unified full-text search across products, services, and shops. Query: `?q=search+term&lat=&lng=&radius=&limit=`. Results are optionally geo-sorted by distance. Cap: 25 results. |
| `GET` | `/api/search` | Public | Alias for `/api/search/global` — identical handler and response contract. |
| `GET` | `/api/search/nearby` | Yes | Haversine-formula radius search for nearby shops using user or shop coordinates. Query: `?lat=&lng=&radius=` (radius in km, default 10, max 100). Returns distance-annotated shop list. |
| `GET` | `/api/recommendations/buy-again` | Yes (customer) | Personalized "buy again" / "rebook" recommendations built from the customer's recent successful orders and complete bookings. |
| `GET` | `/api/waitlist` | Yes (customer) | Get the current customer's waitlist entries for fully-booked services. |
| `POST` | `/api/waitlist` | Yes (customer) | Join a service waitlist for a preferred date. Body: `{ serviceId, preferredDate }`. Customer receives notification when a slot opens. |

---

## 10. Product Management

Create and manage products within shops. All write operations require a verified shop profile. Soft deletion is used — products are never physically removed.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/products` | Public | Paginated product catalog. Filters: `?category=&minPrice=&maxPrice=&searchTerm=&shopId=&tags=&lat=&lng=&radius=&page=&pageSize=`. Also returns shop-mode flags per product. |
| `GET` | `/api/products/:id` | Public | Cached product detail including shop info, review aggregates, rating, and operating-mode flags (catalog/open-order/pay-later). |
| `GET` | `/api/products/shop/:id` | Public | All products belonging to a specific shop owner ID. |
| `POST` | `/api/products` | Yes (shop/worker `products:write`) | Create a product. Requires verified shop profile (`verificationStatus: "verified"`). Supports category normalization. |
| `POST` | `/api/products/quick-add` | Yes (shop/worker `products:write`) | Quick-add product with minimal required fields: `{ name, price, image?, category? }`. Defaults are derived from shop mode settings. Designed for fast inventory entry. |
| `PATCH` | `/api/products/:id` | Yes (shop/worker `products:write`) | Partial update of product fields with ownership validation, numeric sanitization, and automatic cache invalidation. |
| `PATCH` | `/api/products/bulk-update` | Yes (shop/worker `products:write`) | Bulk update stock and low-stock thresholds for multiple products in one request. Body: `{ updates: [{ productId, stock, lowStockThreshold? }] }`. |
| `DELETE` | `/api/products/:id` | Yes (shop owner) | Delete (soft-delete via `isDeleted` flag) a shop product. Also removes any cart references to this product before deletion. |

**`POST /api/products` — Request**
```json
{
  "name": "Ponni Rice 5kg",
  "description": "Premium grade Ponni rice from Thanjavur",
  "price": 285,
  "mrp": 320,
  "category": "Groceries",
  "stock": 150,
  "lowStockThreshold": 20,
  "images": ["https://cdn.example.com/rice.jpg"],
  "tags": ["rice", "staples", "bulk"],
  "unit": "kg",
  "weight": 5
}
```

**Product Business Rules:**
- Products can only be created by shop owners with `verificationStatus: "verified"`
- Soft-deleted products (`isDeleted: true`) don't appear in catalog but data is preserved
- Low-stock alerts are triggered via FCM when `stock <= lowStockThreshold`
- In catalog mode, products display price but disable ordering

---

## 11. Cart & Wishlist

Customer-side cart and wishlist management. Cart is per-customer and cleared on order placement.

### Cart

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/cart` | Yes (customer) | Get all items in customer's current cart. |
| `POST` | `/api/cart` | Yes (customer) | Add or update a cart line item. Body: `{ productId, quantity }`. Quantity is updated if product already exists in cart. |
| `DELETE` | `/api/cart/:productId` | Yes (customer) | Remove a single product from the cart by product ID. |
| `DELETE` | `/api/cart` | Yes (customer) | Clear the entire cart at once (used after order placement). |

### Wishlist

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/wishlist` | Yes (customer) | Get all wishlisted products for the customer. |
| `POST` | `/api/wishlist` | Yes (customer) | Add a product to the wishlist. Body: `{ productId }`. |
| `DELETE` | `/api/wishlist/:productId` | Yes (customer) | Remove a specific product from the wishlist by product ID. |

---

## 12. Service Management

Create and manage service listings offered by providers (e.g., plumbers, tutors, electricians, beauticians). Full time-slot and availability management included.

### Service CRUD

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/services` | Public | Paginated service catalog. Filters: `?category=&minPrice=&maxPrice=&searchTerm=&availableNow=&providerId=&locationCity=&lat=&lng=&radius=&page=&pageSize=`. |
| `GET` | `/api/services/:id` | Public | Cached service detail including provider profile (bio, specializations), parsed working hours, break times, and review aggregates. |
| `GET` | `/api/services/provider/:id` | Public | All services offered by a specific provider by provider user ID. |
| `POST` | `/api/services` | Yes (provider) | Create a new service listing. Requires verified provider profile. Includes category normalization. |
| `PATCH` | `/api/services/:id` | Yes (provider) | Partial update of own service fields with ownership check and cache invalidation. |
| `DELETE` | `/api/services/:id` | Yes (provider) | Soft-delete a service. Checks for active booking dependencies before allowing deletion. |
| `PATCH` | `/api/provider/availability` | Yes (provider) | Batch toggle availability across all services for the logged-in provider. Body: `{ isAvailableNow: boolean, availabilityNote? }`. |

### Time Slot Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/services/:id/availability` | Public | Check available time slots for a service on a specific date. Query: `?date=YYYY-MM-DD`. Returns computed availability excluding booked and blocked slots. |
| `GET` | `/api/services/:id/bookings` | Yes | Returns computed slot availability for a service. Functionally equivalent to the availability endpoint. |
| `GET` | `/api/bookings/service/:id` | Yes | Legacy alias for `/api/services/:id/bookings`. |
| `GET` | `/api/services/:id/blocked-slots` | Yes | List all blocked time ranges configured for a service. |
| `POST` | `/api/services/:id/block-time` | Yes (provider) | Block a time range for a service (e.g., personal leave, holiday). Sends notifications to customers with overlapping bookings. Body: `{ date, startTime, endTime, reason?, isRecurring?, recurringEndDate? }` |
| `DELETE` | `/api/services/:serviceId/blocked-slots/:slotId` | Yes (provider) | Remove (unblock) a previously blocked time slot. |

**`POST /api/services` — Request**
```json
{
  "name": "Home Electrical Repair",
  "description": "Licensed electrician for residential wiring, switch repair, fan installation",
  "category": "Electrical",
  "price": 300,
  "priceUnit": "per_visit",
  "duration": 60,
  "serviceLocationType": "customer_location",
  "locationCity": "Erode",
  "locationState": "Tamil Nadu",
  "workingHours": {
    "monday": { "start": "08:00", "end": "18:00", "isWorking": true },
    "tuesday": { "start": "08:00", "end": "18:00", "isWorking": true }
  },
  "breakTimes": [{ "start": "13:00", "end": "14:00" }],
  "timeSlots": ["morning", "afternoon", "evening"]
}
```

---

## 13. Service Reviews

Customers leave reviews for completed service bookings. Providers can reply. One review per booking is enforced.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/reviews/service/:id` | Public | Get all reviews for a specific service by service ID. |
| `GET` | `/api/reviews/provider/:id` | Public | Get all reviews across all services belonging to a specific provider. |
| `GET` | `/api/reviews/customer` | Yes (customer) | Get all reviews written by the currently authenticated customer. |
| `POST` | `/api/reviews` | Yes (customer) | Create a service review. Body: `{ serviceId, bookingId, rating (1–5), review? }`. Prevents duplicate reviews per booking. |
| `PATCH` | `/api/reviews/:id` | Yes (customer) | Update own service review (rating and/or comment). Ownership enforced. |
| `POST` | `/api/reviews/:id/reply` | Yes (provider) | Provider posts a reply to a service review. Body: `{ reply }` or `{ response }`. |

---

## 14. Product Reviews

Customers leave reviews for purchased products. Shop owners can reply.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/product-reviews/product/:id` | Public | Get all reviews for a product. Also available as alias at `GET /api/reviews/product/:id`. |
| `GET` | `/api/reviews/shop/:id` | Public | Get all product reviews aggregated under a shop (by shop/owner ID). |
| `GET` | `/api/product-reviews/customer` | Yes (customer) | Get all product reviews written by the currently authenticated customer. |
| `POST` | `/api/product-reviews` | Yes (customer) | Create a product review. Must be tied to a customer-owned order. Body: `{ productId, orderId, rating (1–5), review?, images? }` |
| `PATCH` | `/api/product-reviews/:id` | Yes (customer) | Edit own product review. Ownership enforced. |
| `POST` | `/api/product-reviews/:id/reply` | Yes (shop) | Shop owner replies to a product review. Body: `{ reply }`. |

---

## 15. Booking Management — Customer

Full customer-side booking lifecycle from creation through payment submission.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/bookings` | Yes (customer) | Create a new booking. Runs slot validation, availability checks, and anti-duplicate guardrails. Body: `{ serviceId, bookingDate, serviceLocation: "customer"\|"provider", timeSlotLabel?: "morning"\|"afternoon"\|"evening" }` |
| `GET` | `/api/bookings` | Yes (customer) | Get own bookings with optional `?status=` filter and provider enrichment. |
| `GET` | `/api/bookings/customer` | Yes (customer) | Lightweight booking list for the customer (alternate endpoint, same data). |
| `GET` | `/api/bookings/customer/requests` | Yes (customer) | Paginated active booking requests (pending + in-progress). Query: `?limit=&offset=`. |
| `GET` | `/api/bookings/customer/history` | Yes (customer) | Paginated historical bookings (completed/cancelled/expired). Query: `?limit=&offset=`. |
| `PATCH` | `/api/bookings/:id` | Yes | General booking action endpoint — handles customer/provider reschedules, provider accept/reject, and customer cancellation. |
| `PATCH` | `/api/bookings/:id/customer-complete` | Yes (customer) | Customer submits payment reference and moves booking to `awaiting_payment` status. Body: `{ paymentReference }` |
| `PATCH` | `/api/bookings/:id/update-reference` | Yes (customer) | Update a previously submitted payment reference while still in `awaiting_payment` state. Body: `{ paymentReference }` |
| `POST` | `/api/bookings/:id/payment` | Yes (customer) | **DISABLED** — compatibility placeholder retained for older clients. Returns a disabled-payment response. |

**Booking Status Lifecycle:**
```
pending → accepted → en_route → awaiting_payment → completed
                  ↘ rejected
                  ↘ rescheduled → rescheduled_pending_provider_approval
cancelled (by customer, any pre-completion stage)
expired (automated, stale pending bookings)
disputed (raised from awaiting_payment if payment disputed)
```

---

## 16. Booking Management — Provider

Provider-side booking management from queue visibility to completion confirmation.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/bookings/provider` | Yes (provider) | Paginated provider booking queue with enriched customer/service context. Query: `?page=&limit=` |
| `GET` | `/api/bookings/provider/:id` | Yes (provider) | Booking list scoped to a specific provider by ID. Self-only access enforced. |
| `GET` | `/api/bookings/provider/pending` | Yes (provider) | Pending booking requests enriched with customer/provider/service context and **proximity hints** — shows distance between bookings to help providers optimize travel routes. |
| `GET` | `/api/bookings/provider/history` | Yes (provider) | Paginated provider booking history. Query: `?page=&limit=` |
| `PATCH` | `/api/bookings/:id/status` | Yes (provider) | Accept, reject, or reschedule a booking with structured notifications. Body: `{ status: "accepted"\|"rejected"\|"rescheduled", rejectionReason?, rescheduleDate?, rescheduleReason? }` |
| `PATCH` | `/api/bookings/:id/en-route` | Yes (provider) | Mark booking as `en_route` (provider has started trip). Sends notification to customer. |
| `PATCH` | `/api/bookings/:id/provider-complete` | Yes (provider) | Provider confirms payment received and marks booking as `completed`. |
| `POST` | `/api/bookings/:id/confirm` | Yes (provider) | Shortcut for confirming bookings with notification trigger. |
| `POST` | `/api/bookings/:id/notify-customer-accepted` | Yes (provider) | **LEGACY** — Email hook endpoint. Email delivery is currently disabled; returns success message. |
| `POST` | `/api/bookings/:id/notify-customer-rejected` | Yes (provider) | **LEGACY** — Email hook endpoint. Email delivery is currently disabled; returns success message. |
| `POST` | `/api/bookings/process-expired` | Yes (admin) | Admin-triggered maintenance endpoint to scan and expire stale pending bookings past their expiry threshold. |

---

## 17. Booking — Disputes & Admin Resolution

When a payment dispute arises at the `awaiting_payment` stage, either party can report it. Admins review and resolve disputed bookings.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/bookings/:id/report-dispute` | Yes | Flag a booking in `awaiting_payment` status as disputed. Body: `{ reason }`. Creates a dispute record with reason metadata. |
| `GET` | `/api/admin/disputes` | Yes (admin) | Fetch all disputed bookings for admin review queue. |
| `PATCH` | `/api/admin/bookings/:id/resolve` | Yes (admin) | Admin resolves a disputed booking. Body: `{ resolutionStatus: "completed"\|"cancelled" }`. Updates both parties and clears dispute flag. |

---

## 18. Order Management

Full product order lifecycle from placement through delivery, payment verification, and timeline tracking.

### Creating Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/orders` | Yes (customer) | Create a product order. Server-side recomputes totals, checks stock, applies promotions, calculates delivery fees, and validates pay-later eligibility. Body: `{ shopId, items: [{ productId, quantity }], deliveryMethod, paymentMethod?, notes? }` |
| `POST` | `/api/orders/text` | Yes (customer) | Create a text/open order — customer describes needs in free text; shop quotes final bill later. Body: `{ shopId, orderText, deliveryMethod? }` |

### Customer Order Views

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/orders/customer` | Yes (customer) | Customer order history with optional `?status=` filters and hydrated order detail (items, shop info). |
| `GET` | `/api/orders/:id` | Yes | Full order detail: items, totals, delivery, participants, and payment metadata. Authorization checks ensure only the order's customer or shop can access. |
| `GET` | `/api/orders/:id/timeline` | Yes | Chronological timeline of status change events for an order. Accessible to customer (self) and shop/worker (with `orders:read`). |

### Shop Order Operations

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/orders/shop` | Yes (shop/worker `orders:read`) | Shop order feed with optional `?status=` filter and customer enrichment. |
| `GET` | `/api/orders/shop/recent` | Yes (shop/worker `orders:read`) | Most recent orders optimized for the operational dashboard. |
| `GET` | `/api/shops/orders/active` | Yes (shop/worker `orders:read`) | **Kanban active-order board** grouped into lanes: `{ new: [...], packing: [...], ready: [...] }`. Designed for the shop's live operations screen. |
| `GET` | `/api/orders/shop/:orderId` | Yes (shop/worker `orders:read`) | Specific shop order detail view. |
| `PATCH` | `/api/orders/:id/status` | Yes (shop/worker `orders:update`) | Update order lifecycle state with notifications and optional SMS for key transitions. |
| `POST` | `/api/orders/:id/quote-text-order` | Yes (shop/worker `orders:update`) | For text orders: shop sets the final quoted bill and requests customer agreement. Body: `{ finalBill, items }` |
| `POST` | `/api/orders/:id/approve-pay-later` | Yes (shop/worker `orders:update`) | Approve a pay-later order after eligibility and state checks. |
| `POST` | `/api/orders/:id/confirm-payment` | Yes (shop/worker `orders:update`) | Shop/worker confirms manual payment received and advances order state. |

### Customer Order Actions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/orders/:id/cancel` | Yes (customer) | Cancel an order. Enforces stage and payment-state guardrails (cannot cancel after dispatch). Body: `{ reason? }` |
| `POST` | `/api/orders/:id/submit-payment-reference` | Yes | Customer submits manual payment proof (UPI reference number, transaction ID) for shop verification. |
| `POST` | `/api/orders/:id/agree-final-bill` | Yes (customer) | Customer accepts the shop's quoted final bill for text orders. Advances order to next stage. |
| `POST` | `/api/orders/:id/payment-method` | Yes (customer) | Customer sets payment method for confirmed text orders with pay-later policy validation. |
| `POST` | `/api/orders/:id/payment` | Yes (customer) | **DISABLED** — compatibility placeholder. Returns a payment-disabled response. |

**Order Status Lifecycle:**
```
[Standard Order]:
pending → confirmed → processing → packed → dispatched → shipped → delivered

[Text/Open Order]:
pending → awaiting_customer_agreement → confirmed → processing → packed → dispatched → shipped → delivered

[Cancellation]: cancelled (from any pre-dispatch stage)
[Return]: returned (from delivered stage via return request)
```

---

## 19. Pay-Later Whitelist Management

Shop owners can grant specific trusted customers the ability to defer payment ("buy now, pay later"). This is managed via a whitelist.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/shops/pay-later/whitelist` | Yes (shop/worker `orders:read`) | Returns pay-later enablement state, current whitelist members with contact info, and outstanding dues summary. |
| `POST` | `/api/shops/pay-later/whitelist` | Yes (shop/worker `orders:update`) | Add a customer to the pay-later whitelist by customer ID or phone number. Returns updated roster. Body: `{ customerId?\|phone? }` |
| `DELETE` | `/api/shops/pay-later/whitelist/:customerId` | Yes (shop/worker `orders:update`) | Remove a customer from the pay-later whitelist. Returns updated roster. |

---

## 20. Returns & Refunds

Customers can request returns for delivered orders. Shop owners/workers process and approve/reject return requests.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/orders/:orderId/return` | Yes (customer) | Request a return for a delivered order. Body: `{ orderItemId?, reason, description?, images? }`. Notifies both customer and shop. |
| `GET` | `/api/returns/shop` | Yes (shop/worker `returns:manage`) | Shop's return-request queue for fulfilment management. |
| `POST` | `/api/returns/:id/approve` | Yes (shop/worker `returns:manage`) | Approve a return request, trigger refund processing, and notify the customer. |

**Return Status Flow:**
```
requested → approved → received → refunded → completed
           → rejected
```

---

## 21. Promotions & Discount Codes

Shop-level promotions with percentage or fixed-amount discounts, usage limits, date windows, and product scoping.

### Shop Management of Promotions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/promotions` | Yes (shop/worker `promotions:manage`) | Create a promotion campaign. Body: `{ name, type: "percentage"\|"fixed_amount", value, code?, startDate, endDate?, minPurchase?, maxDiscount?, usageLimit?, applicableProducts?, excludedProducts? }` |
| `GET` | `/api/promotions/shop/:id` | Yes (shop/worker `promotions:manage`) | Get all promotions for the shop context (including expired and inactive ones). |
| `PATCH` | `/api/promotions/:id` | Yes (shop/worker `promotions:manage`) | Partial update: metadata, value, schedule, or product scope. |
| `PATCH` | `/api/promotions/:id/status` | Yes (shop/worker `promotions:manage`) | Toggle promotion active/inactive state. Body: `{ isActive: boolean }` |
| `DELETE` | `/api/promotions/:id` | Yes (shop/worker `promotions:manage`) | Delete a promotion and broadcast cache invalidation to subscribers. |

### Customer-Facing Promotion Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/promotions/active/:shopId` | Yes | Get currently active, in-window, usage-eligible promotions for a shop. Customer-facing discovery. |
| `POST` | `/api/promotions/validate` | Yes (customer) | Validate a promo code and calculate the effective discount for eligible cart lines. Body: `{ code, shopId, cartItems: [{ productId, quantity, price }] }` |
| `POST` | `/api/promotions/:id/apply` | Yes (customer) | Apply/redeem a promotion after validity checks. Increments usage count. Body: `{ orderId }` |

**`POST /api/promotions` — Request**
```json
{
  "name": "Pongal Festival Sale",
  "type": "percentage",
  "value": 15,
  "code": "PONGAL15",
  "startDate": "2026-01-14",
  "endDate": "2026-01-16",
  "minPurchase": 500,
  "maxDiscount": 200,
  "usageLimit": 500,
  "applicableProducts": [12, 45, 67]
}
```

---

## 22. Worker (Staff) Management

Shop owners create and manage sub-accounts for their employees. Workers get scoped permissions; they cannot access sensitive owner data.

### Worker CRUD

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/shops/workers/responsibilities` | Yes (shop) | Returns the canonical list of worker responsibilities and curated preset bundles (e.g., "Cashier preset", "Inventory preset"). |
| `GET` | `/api/shops/workers/check-number` | Yes (shop) | Check if a proposed 10-digit worker number is available before creation. |
| `GET` | `/api/shops/workers` | Yes (shop) | List all workers linked to the authenticated shop owner. |
| `POST` | `/api/shops/workers` | Yes (shop) | Create a worker sub-account. Hashes PIN, links worker to shop, and sets responsibilities. Body: `{ workerNumber, name, pin, responsibilities: [...], phone?, email? }` |
| `GET` | `/api/shops/workers/:workerUserId` | Yes (shop) | Get one worker's profile scoped to the authenticated shop. |
| `PATCH` | `/api/shops/workers/:workerUserId` | Yes (shop) | Update worker identity, responsibilities, active state, or reset PIN. |
| `DELETE` | `/api/shops/workers/:workerUserId` | Yes (shop) | Unlink and remove the worker account from the shop context. |
| `GET` | `/api/worker/me` | Yes (worker) | Worker views own profile: shop-link info, active flag, and assigned responsibilities. |

_**Note**: Legacy endpoints `GET /api/workers`, `POST /api/workers` etc. may also exist as compatibility aliases pointing to the same handlers._

**Worker Responsibilities (Granular Permission Set):**

| Permission | What It Allows |
|------------|----------------|
| `products:read` | View shop products and inventory |
| `products:write` | Create and update shop products |
| `inventory:adjust` | Adjust stock levels |
| `orders:read` | View shop orders and active board |
| `orders:update` | Update order status, approve pay-later, confirm payments |
| `returns:manage` | View and approve return requests |
| `promotions:manage` | Create, edit, and delete promotions |
| `customers:message` | Send messages to customers |
| `bookings:manage` | Manage service bookings (for hybrid shops with services) |
| `analytics:view` | View dashboard stats and analytics |

---

## 23. Notifications

In-app notification management for all user roles.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/notifications` | Yes | Get paginated notifications for the authenticated user. |
| `PATCH` | `/api/notifications/:id/read` | Yes | Mark a single notification as read by notification ID. |
| `PATCH` | `/api/notifications/mark-all-read` | Yes | Mark all notifications as read. Body: `{ role? }` — optionally filter by role context. |
| `GET` | `/api/notifications/unread-count` | Yes | Get the count of unread notifications for the badge indicator. |
| `DELETE` | `/api/notifications/:id` | Yes | Delete a single notification by ID. |

**Notification Trigger Events:**
- New booking received (provider)
- Booking accepted/rejected/rescheduled (customer)
- Provider en-route (customer)
- Order status changes (customer & shop)
- Low stock alert (shop)
- Return request received (shop)
- Dispute filed (both parties)

---

## 24. FCM Push Notifications

Firebase Cloud Messaging token management for Android push notifications.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/fcm/register` | Yes | Register or refresh an FCM device token. Body: `{ token, deviceId? }`. Called on app launch and token refresh. |
| `DELETE` | `/api/fcm/unregister` | Yes | Unregister an FCM token, typically on logout or device unlink. Body: `{ token }` |

**Push Notification Types Delivered:**
- Order status updates (pending → confirmed → dispatched → delivered)
- Booking confirmations and updates
- Low stock alerts to shop owners
- Payment reminders for pending bookings
- Dispute notifications for both parties

---

## 25. Realtime Events (SSE)

Long-lived Server-Sent Events connection for live updates. The web and Android clients connect once and receive push events without polling.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/events` | Yes | Opens a persistent SSE stream for the authenticated user. Delivers realtime updates for order/booking status changes, new notifications, inventory alerts, and promotion changes. |

**SSE Event Types:**

| Event | Payload | Description |
|-------|---------|-------------|
| `notification` | `{ id, type, message, data }` | New notification pushed to client |
| `invalidate` | `{ keys: [...] }` | Cache invalidation signal — tells TanStack Query which cache keys to refetch |
| `keepalive` | `{ timestamp }` | Heartbeat sent every 30 seconds to keep connection alive |

**SSE Connection Example (curl):**
```bash
curl -N -b cookies.txt http://localhost:5000/api/events
```

---

## 26. Performance Metrics & Telemetry

Web Vitals and frontend performance metric collection for operational monitoring.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/performance-metrics` | Public | Accept Web Vitals metric envelopes from the browser (sent via `navigator.sendBeacon`). Payload size is validated to reject oversized batches. |

---

## 27. Admin Console

Separate admin session system. Admin users authenticate independently from platform users and have role-based permission sets. All endpoints are prefixed `/api/admin/`.

### Admin Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/admin/login` | Public | Admin login with email + password. Returns `{ id, email, permissions, mustChangePassword }`. Opens a dedicated admin session. |
| `POST` | `/api/admin/logout` | Admin | Clear the admin session identifier. |
| `GET` | `/api/admin/me` | Admin | Returns current admin identity, role, permissions, and password-change requirement flag. |
| `POST` | `/api/admin/change-password` | Admin | Rotate the admin password and clear the `mustChangePassword` flag. Body: `{ currentPassword, newPassword }` |

### Dashboard & Monitoring

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| `GET` | `/api/admin/dashboard-stats` | Admin | — | Platform KPI summary: total users, orders, revenue, bookings, pending orders, today's bookings. |
| `GET` | `/api/admin/health-status` | Admin | `view_health` | DB reachability, API status, and background job last-run timestamps. |
| `GET` | `/api/admin/monitoring/summary` | Admin | `view_health` | Aggregated frontend performance monitoring snapshot (Web Vitals, error rates). |
| `GET` | `/api/admin/logs` | Admin | `view_health` | Filtered application log slices. Query: `?limit=&level=&category=` |
| `POST` | `/api/admin/performance-metrics` | Admin | — | Record admin-panel Web Vitals metrics in the monitoring pipeline. |

### User Management

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| `GET` | `/api/admin/platform-users` | Admin | `manage_users` | Paginated platform user list. Query: `?page=&limit=&search=` |
| `PATCH` | `/api/admin/platform-users/:userId/suspend` | Admin | `manage_users` | Suspend or unsuspend a user. Body: `{ isSuspended: boolean }`. Suspended users receive `403` on all authenticated requests. Audit log written. |
| `DELETE` | `/api/admin/platform-users/:userId` | Admin | `manage_users` | Delete a user and all associated data. Audit log written. |

### Transactions & Orders

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| `GET` | `/api/admin/transactions` | Admin | `view_all_orders` | Paginated transaction records. Filters: `?page=&pageSize=&status=&paymentStatus=&customer=&shop=&search=` |
| `GET` | `/api/admin/all-orders` | Admin | `view_all_orders` | Full unfiltered order dataset for admin-level operations. |
| `GET` | `/api/admin/shops/transactions` | Admin | `view_all_orders` | Per-shop paid transaction counts for leaderboard/oversight reporting. |
| `GET` | `/api/admin/all-bookings` | Admin | `view_all_bookings` | Full unfiltered bookings dataset. |

### Disputes

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| `GET` | `/api/admin/disputes` | Admin | — | List all disputed bookings awaiting admin resolution. |
| `PATCH` | `/api/admin/bookings/:id/resolve` | Admin | — | Resolve a disputed booking. Body: `{ resolutionStatus: "completed"\|"cancelled" }` |

### Review Management

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| `DELETE` | `/api/admin/reviews/:reviewId` | Admin | `manage_reviews` | Delete any review (product or service). Audit log written. |

### Admin Account & Role Management

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| `GET` | `/api/admin/accounts` | Admin | `manage_admins` | List admin accounts with role linkage metadata. |
| `POST` | `/api/admin/accounts` | Admin | `manage_admins` | Create a new admin account. Body: `{ email, password, roleId? }`. Audit log written. |
| `GET` | `/api/admin/roles` | Admin | `manage_admins` | List available admin role definitions. |
| `POST` | `/api/admin/roles` | Admin | `manage_admins` | Create an admin role definition. Body: `{ name, description? }` |
| `PUT` | `/api/admin/roles/:roleId/permissions` | Admin | `manage_admins` | Replace the permission set for a role. Body: `{ permissionIds: [] }` |
| `GET` | `/api/admin/audit-logs` | Admin | `manage_admins` | View admin action audit log entries (ordered by creation time). |

---

## 28. Error Responses & Status Codes

### Standard Error Response Format

All API errors return a consistent JSON structure:

```json
{
  "message": "Human-readable error description",
  "errors": [
    { "path": ["fieldName"], "message": "Validation detail" }
  ],
  "errorId": "uuid-for-monitoring-correlation"
}
```

### HTTP Status Code Reference

| Code | Meaning | Common Triggers |
|------|---------|-----------------|
| `200` | OK | Standard success for GET, PATCH, POST (non-creation) |
| `201` | Created | Resource created (registration, product/service creation) |
| `204` | No Content | Success with no response body (DELETE, background actions) |
| `400` | Bad Request | Zod schema validation failure, malformed JSON |
| `401` | Unauthorized | No active session, missing/expired cookie |
| `403` | Forbidden | CSRF token mismatch, insufficient permissions, suspended account |
| `404` | Not Found | Resource or route does not exist |
| `409` | Conflict | Duplicate resource (duplicate booking, username taken) |
| `422` | Unprocessable Entity | Semantic validation failure (business-rule violation) |
| `429` | Too Many Requests | Rate limit exceeded — wait before retrying |
| `500` | Internal Server Error | Unexpected server failure; `errorId` included for monitoring |
| `502` | Bad Gateway | Upstream dependency returned invalid response |
| `503` | Service Unavailable | DB/Redis/external API offline or Firebase not configured |

### Authentication & Security Notes

- **Session-based**: Cookies are used for authentication. Sessions stored in PostgreSQL (production) or memory (development). Redis-backed session store for high-availability setups.
- **CSRF Protection**: All state-changing requests (POST/PATCH/PUT/DELETE) require `x-csrf-token` header from `GET /api/csrf-token`.
- **Rate Limiting**: Login, registration, OTP, and username-check endpoints are rate-limited via `express-rate-limit` to prevent brute force.
- **Suspended Accounts**: Suspended users receive `403 Forbidden` on all authenticated requests.
- **Profile Verification**: Shops must have `verificationStatus: "verified"` to create products. Providers must be verified to create services.
- **Numeric Route Safety**: `id`, `orderId`, `shopId`, `serviceId` params are globally validated as positive integers before handlers run.
- **Worker Permissions**: All shop endpoints accessed by workers enforce the specific `responsibilities` attached to the worker's account.

### Role-Permission Quick Reference

| Role | Registration | Products | Services | Bookings | Orders | Admin |
|------|-------------|----------|----------|----------|--------|-------|
| **Customer** | ✅ | Read | Read | Create/Cancel | Create/Cancel | ❌ |
| **Provider** | ✅ | ❌ | CRUD | Manage received | ❌ | ❌ |
| **Shop** | ✅ | CRUD | ❌ | ❌ | Manage received | ❌ |
| **Worker** | Via shop | Scoped | ❌ | Scoped | Scoped | ❌ |
| **Admin** | Via admin panel | Read all | Read all | Override | Override | Full |

### API Quickstart (curl)

```bash
# 1. Get CSRF token
CSRF=$(curl -s -c cookies.txt http://localhost:5000/api/csrf-token | jq -r .csrfToken)

# 2. Register a new customer
curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"username":"ravi","password":"Pass123!","name":"Ravi Kumar","phone":"9876543210","email":"ravi@example.com","role":"customer"}' \
  http://localhost:5000/api/register

# 3. Browse the catalog
curl -s "http://localhost:5000/api/products?searchTerm=rice"
curl -s "http://localhost:5000/api/services?locationCity=Coimbatore"
curl -s "http://localhost:5000/api/shops"

# 4. Rural PIN login (returning user)
curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","pin":"1234"}' \
  http://localhost:5000/api/auth/login-pin

# 5. Open SSE stream for realtime events
curl -N -b cookies.txt http://localhost:5000/api/events
```

---

*DoorStep TN API Reference — Version 2.0 · February 2026*
