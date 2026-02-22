# API Endpoints Reference (Code-Verified)

This document is generated from the current backend source on **February 22, 2026**. It contains **166** runtime `/api/*` endpoints with access rules and behavior notes.

## Scope and method

- Source files inspected: `server/routes.ts`, `server/auth.ts`, `server/routes/admin.ts`, `server/routes/workers.ts`, `server/routes/promotions.ts`, `server/routes/bookings.ts`, `server/routes/orders.ts`, `server/index.ts`.
- Session model: cookie session auth with CSRF protection on non-GET methods (except explicitly exempted telemetry/device-token paths).
- Access labels in this file reflect route middleware in code; worker permissions are shown where `requireShopOrWorkerPermission(...)` is used.
- Note: a few endpoints are legacy aliases or compatibility stubs (kept intentionally for older clients).

## Platform behavior details

- **CSRF and session**: write operations require a valid session cookie + `x-csrf-token` from `GET /api/csrf-token`.
- **Numeric route safety**: `id`, `orderId`, `shopId`, `serviceId`, and related params are globally validated as positive integers before handlers run.
- **Role and ownership checks**: provider, customer, shop-owner, worker, and admin flows enforce both role and resource ownership/context checks.
- **Shop-worker permission model**: staff access is constrained by responsibilities such as `orders:update`, `products:write`, `returns:manage`, and `promotions:manage`.
- **Business-rule heavy domains**: order totals are recomputed server-side, pay-later has eligibility checks, bookings enforce slot/state transitions, and promotions enforce date/usage/product scopes.
- **Realtime**: `GET /api/events` provides SSE events for client invalidation + notifications.
- **Telemetry**: frontend performance metrics are accepted on both user and admin telemetry endpoints with payload limits.

## Endpoint catalog

Coverage notes: all endpoints in this version have route-specific behavior summaries.

### Platform Core (4)

| Method | Endpoint | Access | Explanation | Source |
|---|---|---|---|---|
| GET | `/api` | Authenticated user | Returns the currently registered API routes from the Express router stack. Useful for runtime endpoint discovery in authenticated sessions. | `server/routes.ts:1480` |
| GET | `/api/csrf-token` | Public | Issues a CSRF token tied to the current session; required in the `x-csrf-token` header for state-changing requests. | `server/routes.ts:1428` |
| GET | `/api/health` | Public | Liveness endpoint for load balancers. Confirms the API process is running. | `server/index.ts:693` |
| GET | `/api/health/ready` | Public | Readiness endpoint that verifies dependencies (database, Redis, queue) before traffic is considered safe. | `server/index.ts:712` |

### Authentication & Identity (17)

| Method | Endpoint | Access | Explanation | Source |
|---|---|---|---|---|
| POST | `/api/auth/check-user` | Public | Checks whether a normalized phone number is already registered; used by rural onboarding flows. | `server/auth.ts:482` |
| POST | `/api/auth/check-username` | Public | Validates username availability against both direct DB lookup and storage abstraction checks. | `server/routes.ts:1494` |
| POST | `/api/auth/create-provider` | Authenticated user | Creates a provider profile row for the authenticated user (one provider profile per user). | `server/auth.ts:1067` |
| POST | `/api/auth/create-shop` | Authenticated user | Creates a structured shop profile row for the authenticated user (one shop per owner). | `server/auth.ts:1020` |
| POST | `/api/auth/forgot-password-otp` | Public | Generates, hashes, stores, and dispatches password-reset OTPs tied to phone numbers. | `server/auth.ts:797` |
| POST | `/api/auth/login-pin` | Public | Authenticates by phone + 4-digit PIN for low-friction repeat logins. | `server/auth.ts:606` |
| GET | `/api/auth/profiles` | Authenticated user | Returns whether the current user has shop/provider profile records and includes those records when present. | `server/auth.ts:985` |
| POST | `/api/auth/reset-password` | Public | Consumes a valid OTP and updates the user PIN hash (legacy naming keeps `reset-password` path). | `server/auth.ts:910` |
| POST | `/api/auth/reset-pin` | Public | Resets PIN after Firebase token verification and marks phone as verified. | `server/auth.ts:662` |
| POST | `/api/auth/rural-register` | Public | Registers a phone-first user after server-side Firebase token verification and PIN hashing. | `server/auth.ts:516` |
| POST | `/api/auth/verify-reset-otp` | Public | Verifies OTP validity and expiry without consuming it yet. | `server/auth.ts:860` |
| POST | `/api/auth/worker-login` | Public | Logs in shop workers using worker number + PIN and validates active worker linkage. | `server/auth.ts:720` |
| POST | `/api/delete-account` | Authenticated user | Hard-deletes user account data and then destroys the active session. | `server/auth.ts:451` |
| POST | `/api/login` | Public | Authenticates using username/email/phone + password via Passport local strategy and returns the sanitized user profile. | `server/auth.ts:416` |
| POST | `/api/logout` | Public | Invalidates the current user session via `req.logout`. | `server/auth.ts:431` |
| POST | `/api/register` | Public | Creates a standard account (username/email/phone/password), initializes baseline profile fields, and starts a login session. | `server/auth.ts:325` |
| GET | `/api/user` | Public | Returns the authenticated user payload or `null` when no active session exists. | `server/auth.ts:438` |

### Discovery, Shops & Profiles (12)

| Method | Endpoint | Access | Explanation | Source |
|---|---|---|---|---|
| POST | `/api/profile/location` | Authenticated user | Updates user or shop geo-coordinates based on context (`shop` vs personal profile) and invalidates related caches. | `server/routes.ts:2239` |
| GET | `/api/search` | Public | Alias of `/api/search/global` using the same global search handler and response contract. | `server/routes.ts:3511` |
| GET | `/api/search/global` | Public | Runs unified global search across indexed entities with optional geo-sorting and per-request result caps. | `server/routes.ts:3510` |
| GET | `/api/search/nearby` | Authenticated user | Performs haversine-radius shop search using shop/user coordinates and returns distance-aware nearby shops. | `server/routes.ts:2315` |
| GET | `/api/shops` | Public | Lists public shops with optional location filters and excludes requester-owned shops when applicable. | `server/routes.ts:2584` |
| GET | `/api/shops/:id` | Public | Resolves and returns shop details by owner-id or shop-table-id fallback, then normalizes to public shop payload. | `server/routes.ts:2662` |
| GET | `/api/shops/:shopId` | Public | Cached public shop detail endpoint used by storefront-style routes; functionally overlaps with `/api/shops/:id`. | `server/routes.ts:7801` |
| GET | `/api/shops/:shopId/products/:productId` | Public | Returns cached product details scoped to a specific shop-product pair. | `server/routes.ts:7741` |
| GET | `/api/shops/current` | Authenticated user | Returns the current authenticated owner's shop record from the dedicated `shops` table. | `server/routes.ts:2566` |
| GET | `/api/shops/dashboard-stats` | Shop owner or worker shop-context session | Returns operational shop metrics for the resolved shop context (owner or worker acting on behalf). | `server/routes.ts:2635` |
| GET | `/api/users/:id` | Authenticated user | Fetches a user profile plus shop/pay-later enrichment and eligibility metadata for the requesting context. | `server/routes.ts:2710` |
| PATCH | `/api/users/:id` | Authenticated user | Updates self-profile fields (including payment methods and shop profile mirrors) with strict ownership checks. | `server/routes.ts:2410` |

### Products, Cart & Wishlist (21)

| Method | Endpoint | Access | Explanation | Source |
|---|---|---|---|---|
| GET | `/api/cart` | Authenticated `customer` role | Returns the current customer cart contents. | `server/routes.ts:4946` |
| POST | `/api/cart` | Authenticated `customer` role | Adds or updates a customer cart line item. | `server/routes.ts:4898` |
| DELETE | `/api/cart/:productId` | Authenticated `customer` role | Removes one product from the customer cart. | `server/routes.ts:4922` |
| POST | `/api/product-reviews` | Authenticated `customer` role | Creates a verified product review tied to a customer-owned order. | `server/routes.ts:7947` |
| PATCH | `/api/product-reviews/:id` | Authenticated `customer` role | Allows customers to edit their own product reviews. | `server/routes.ts:7994` |
| POST | `/api/product-reviews/:id/reply` | Authenticated `shop` role | Allows shop owners to reply to product reviews for their products. | `server/routes.ts:8049` |
| GET | `/api/product-reviews/customer` | Authenticated `customer` role | Lists product reviews written by the current customer. | `server/routes.ts:7925` |
| GET | `/api/products` | Public | Returns paginated product catalog with category/price/tag/search/location filters and shop-mode flags. | `server/routes.ts:7566` |
| POST | `/api/products` | Shop owner or worker with `products:write` | Creates a shop product after permission checks, verification checks, schema validation, and category normalization. | `server/routes.ts:2778` |
| DELETE | `/api/products/:id` | Authenticated `shop` role | Deletes a shop product after removing cart references and enforcing ownership. | `server/routes.ts:7829` |
| GET | `/api/products/:id` | Public | Returns detailed cached product payload by product id, including catalog/open-order/pay-later mode flags. | `server/routes.ts:7689` |
| PATCH | `/api/products/:id` | Shop owner or worker with `products:write` | Updates product fields with ownership validation, numeric sanitization, and cache invalidation. | `server/routes.ts:3024` |
| PATCH | `/api/products/bulk-update` | Shop owner or worker with `products:write` | Bulk-updates stock/threshold values for multiple products in one request after authorization checks. | `server/routes.ts:2945` |
| POST | `/api/products/quick-add` | Shop owner or worker with `products:write` | Fast product creation flow for quick entry scenarios, with defaults derived from shop mode settings. | `server/routes.ts:2847` |
| GET | `/api/products/shop/:id` | Public | Lists products owned by a specific shop owner id. | `server/routes.ts:2929` |
| GET | `/api/reviews/product/:id` | Public | Lists product reviews for a product id. | `server/routes.ts:7893` |
| GET | `/api/reviews/shop/:id` | Public | Lists product reviews aggregated for a shop. | `server/routes.ts:7909` |
| POST | `/api/waitlist` | Authenticated `customer` role | Subscribes a customer to service-slot waitlist notifications for a preferred date. | `server/routes.ts:4856` |
| GET | `/api/wishlist` | Authenticated `customer` role | Returns customer wishlist records. | `server/routes.ts:5018` |
| POST | `/api/wishlist` | Authenticated `customer` role | Adds a product to customer wishlist. | `server/routes.ts:4966` |
| DELETE | `/api/wishlist/:productId` | Authenticated `customer` role | Removes a product from customer wishlist. | `server/routes.ts:4993` |

### Services & Service Reviews (17)

| Method | Endpoint | Access | Explanation | Source |
|---|---|---|---|---|
| PATCH | `/api/provider/availability` | Authenticated `provider` role | Batch-updates availability status/note across all services of the logged-in provider. | `server/routes.ts:3188` |
| POST | `/api/reviews` | Authenticated `customer` role | Creates a verified service review tied to a booking; prevents duplicate review per booking. | `server/routes.ts:5041` |
| PATCH | `/api/reviews/:id` | Authenticated `customer` role | Allows customers to edit their own service review rating/comment. | `server/routes.ts:5122` |
| POST | `/api/reviews/:id/reply` | Authenticated `provider` role | Allows provider owners to post replies on service reviews for their services. | `server/routes.ts:5218` |
| GET | `/api/reviews/customer` | Authenticated `customer` role | Lists service reviews authored by the current customer. | `server/routes.ts:4175` |
| GET | `/api/reviews/provider/:id` | Public | Lists public service reviews across a provider's services. | `server/routes.ts:5200` |
| GET | `/api/reviews/service/:id` | Public | Lists public service reviews for a service id. | `server/routes.ts:5183` |
| GET | `/api/services` | Public | Returns paginated service catalog with price, category, location, availability, and geospatial filters. | `server/routes.ts:3307` |
| POST | `/api/services` | Authenticated `provider` role | Creates a provider service listing after profile verification and category normalization. | `server/routes.ts:3112` |
| DELETE | `/api/services/:id` | Authenticated `provider` role | Soft-deletes provider-owned service, with safeguards for active booking dependencies. | `server/routes.ts:3764` |
| GET | `/api/services/:id` | Public | Returns typed service detail with provider profile, parsed working hours, and review aggregates (cached). | `server/routes.ts:3513` |
| PATCH | `/api/services/:id` | Authenticated `provider` role | Updates provider-owned service fields with strict ownership checks and cache invalidation. | `server/routes.ts:3238` |
| POST | `/api/services/:id/block-time` | Authenticated `provider` role | Blocks service time ranges and creates customer notifications for overlapping bookings. | `server/routes.ts:3660` |
| GET | `/api/services/:id/blocked-slots` | Authenticated user | Returns blocked time slots configured for a service. | `server/routes.ts:3636` |
| GET | `/api/services/:id/bookings` | Authenticated user | Returns computed slot availability for a service on a specific date. | `server/routes.ts:7119` |
| DELETE | `/api/services/:serviceId/blocked-slots/:slotId` | Authenticated `provider` role | Removes a blocked slot for provider-owned services. | `server/routes.ts:3727` |
| GET | `/api/services/provider/:id` | Public | Lists all services for a specific provider id. | `server/routes.ts:3170` |

### Bookings & Scheduling (22)

| Method | Endpoint | Access | Explanation | Source |
|---|---|---|---|---|
| GET | `/api/bookings` | Authenticated `customer` role | Returns customer bookings with optional status filters and provider enrichment. | `server/routes.ts:4382` |
| POST | `/api/bookings` | Authenticated `customer` role | Creates a new customer booking after slot validation, availability checks, and anti-duplicate guardrails. | `server/routes.ts:3824` |
| PATCH | `/api/bookings/:id` | Authenticated user | General booking action endpoint handling customer/provider reschedules, provider accept/reject, and customer cancel flows. | `server/routes.ts:1745` |
| POST | `/api/bookings/:id/confirm` | Authenticated `provider` role | Provider shortcut for confirming bookings and triggering outbound notifications. | `server/routes.ts:7178` |
| PATCH | `/api/bookings/:id/customer-complete` | Authenticated `customer` role | Customer submits payment reference and moves booking to `awaiting_payment`. | `server/routes.ts:4276` |
| PATCH | `/api/bookings/:id/en-route` | Authenticated `provider` role | Marks accepted booking as `en_route` and notifies customer. | `server/routes.ts:4102` |
| POST | `/api/bookings/:id/notify-customer-accepted` | Authenticated `provider` role | Legacy email hook endpoint; currently returns success message because booking email delivery is disabled. | `server/routes.ts:4244` |
| POST | `/api/bookings/:id/notify-customer-rejected` | Authenticated `provider` role | Legacy email hook endpoint; currently returns success message because booking email delivery is disabled. | `server/routes.ts:4260` |
| POST | `/api/bookings/:id/payment` | Authenticated `customer` role | Disabled payment placeholder endpoint retained for compatibility. | `server/routes.ts:4601` |
| PATCH | `/api/bookings/:id/provider-complete` | Authenticated `provider` role | Provider finalizes booking after payment verification. | `server/routes.ts:4192` |
| POST | `/api/bookings/:id/report-dispute` | Authenticated user | Flags an `awaiting_payment` booking as disputed with reason metadata. | `server/routes.ts:2135` |
| PATCH | `/api/bookings/:id/status` | Authenticated `provider` role | Provider status transition endpoint (accept/reject/reschedule) with structured notifications. | `server/routes.ts:3946` |
| PATCH | `/api/bookings/:id/update-reference` | Authenticated `customer` role | Allows customer to revise payment reference while awaiting provider confirmation. | `server/routes.ts:4340` |
| GET | `/api/bookings/customer` | Authenticated `customer` role | Returns customer booking list (lightweight view). | `server/routes.ts:4612` |
| GET | `/api/bookings/customer/history` | Authenticated `customer` role | Returns customer booking history with pagination and hydrated entities. | `server/routes.ts:2032` |
| GET | `/api/bookings/customer/requests` | Authenticated `customer` role | Returns customer booking requests/pending history with hydration. | `server/routes.ts:1979` |
| POST | `/api/bookings/process-expired` | Authenticated `admin` role | Admin-triggered maintenance endpoint to expire stale bookings. | `server/routes.ts:2112` |
| GET | `/api/bookings/provider` | Authenticated `provider` role | Returns paginated provider booking queue with enriched customer/service context. | `server/routes.ts:4524` |
| GET | `/api/bookings/provider/:id` | Authenticated `provider` role | Provider-scoped booking listing that enforces self-id match before returning data. | `server/routes.ts:4559` |
| GET | `/api/bookings/provider/history` | Authenticated `provider` role | Returns provider booking history with pagination. | `server/routes.ts:2084` |
| GET | `/api/bookings/provider/pending` | Authenticated `provider` role | Returns pending provider booking requests enriched with customer/provider/service context and proximity hints. | `server/routes.ts:1533` |
| GET | `/api/bookings/service/:id` | Authenticated user | Legacy alias for service slot-availability lookup. | `server/routes.ts:7147` |

### Orders, Returns & Pay-Later (24)

| Method | Endpoint | Access | Explanation | Source |
|---|---|---|---|---|
| POST | `/api/orders` | Authenticated `customer` role | Creates a product order with server-side total recomputation, stock checks, promotion checks, delivery fee logic, and pay-later eligibility checks. | `server/routes.ts:5430` |
| GET | `/api/orders/:id` | Authenticated user | Returns full order detail payload (items, totals, delivery, participants, and payment metadata) after authorization checks. | `server/routes.ts:6456` |
| POST | `/api/orders/:id/agree-final-bill` | Authenticated `customer` role | Customer accepts quoted final bill so downstream status/payment actions can proceed. | `server/routes.ts:6823` |
| POST | `/api/orders/:id/approve-pay-later` | Shop owner or worker with `orders:update` | Shop/worker approves pay-later orders after eligibility and state checks. | `server/routes.ts:6679` |
| POST | `/api/orders/:id/cancel` | Authenticated `customer` role | Customer cancellation endpoint with stage and payment-state guardrails. | `server/routes.ts:6985` |
| POST | `/api/orders/:id/confirm-payment` | Shop owner or worker with `orders:update` | Shop/worker confirms payment and advances order processing state. | `server/routes.ts:7054` |
| POST | `/api/orders/:id/payment` | Authenticated `customer` role | Disabled payment placeholder endpoint retained for compatibility. | `server/routes.ts:5929` |
| POST | `/api/orders/:id/payment-method` | Authenticated `customer` role | Customer sets payment method for confirmed text orders with pay-later policy validation. | `server/routes.ts:6875` |
| POST | `/api/orders/:id/quote-text-order` | Shop owner or worker with `orders:update` | Shop/worker sets final bill for quick orders and requests customer agreement. | `server/routes.ts:6741` |
| PATCH | `/api/orders/:id/status` | Shop owner or worker with `orders:update` | Updates shop order lifecycle state and pushes notifications/SMS for key transitions. | `server/routes.ts:7323` |
| POST | `/api/orders/:id/submit-payment-reference` | Authenticated user (customer ownership enforced) | Customer submits manual payment proof for shop verification. | `server/routes.ts:6627` |
| GET | `/api/orders/:id/timeline` | Customer owner OR shop owner/worker with `orders:read` | Returns order timeline events; supports customer self-view and shop/worker permissioned view. | `server/routes.ts:7239` |
| POST | `/api/orders/:orderId/return` | Authenticated `customer` role | Creates a return request for delivered orders and notifies both customer and shop. | `server/routes.ts:7430` |
| GET | `/api/orders/customer` | Authenticated `customer` role | Returns customer order history with optional status filters and hydrated order detail. | `server/routes.ts:5940` |
| GET | `/api/orders/shop` | Shop owner or worker with `orders:read` | Returns shop/worker order feed with optional status filtering and customer enrichment. | `server/routes.ts:6379` |
| GET | `/api/orders/shop/recent` | Shop owner or worker with `orders:read` | Returns the most recent shop orders optimized for operational dashboards. | `server/routes.ts:6336` |
| POST | `/api/orders/text` | Authenticated `customer` role | Creates text/open-order request where the shop later quotes final bill and availability. | `server/routes.ts:5856` |
| GET | `/api/recommendations/buy-again` | Authenticated `customer` role | Builds personalized repeat-purchase/rebook recommendations from recent successful orders/bookings. | `server/routes.ts:4634` |
| POST | `/api/returns/:id/approve` | Shop owner or worker with `returns:manage` | Approves return request, triggers refund processing, and notifies customer. | `server/routes.ts:7495` |
| GET | `/api/returns/shop` | Shop owner or worker with `returns:manage` | Returns return-request queue for shop/worker return-management workflows. | `server/routes.ts:7401` |
| GET | `/api/shops/orders/active` | Shop owner or worker with `orders:read` | Returns active-order board grouped into lanes (new/packing/ready) for shop operations screens. | `server/routes.ts:6210` |
| GET | `/api/shops/pay-later/whitelist` | Shop owner or worker with `orders:read` | Returns pay-later enablement state, whitelist members, and outstanding dues for a shop context. | `server/routes.ts:6057` |
| POST | `/api/shops/pay-later/whitelist` | Shop owner or worker with `orders:update` | Adds customer to shop pay-later whitelist by id or phone and returns updated roster. | `server/routes.ts:6095` |
| DELETE | `/api/shops/pay-later/whitelist/:customerId` | Shop owner or worker with `orders:update` | Removes customer from shop pay-later whitelist and returns updated roster. | `server/routes.ts:6162` |

### Promotions (8)

| Method | Endpoint | Access | Explanation | Source |
|---|---|---|---|---|
| POST | `/api/promotions` | Shop owner or worker with `promotions:manage` | Creates shop promotion campaigns with date-window derivation and optional product scoping. | `server/routes/promotions.ts:285` |
| DELETE | `/api/promotions/:id` | Shop owner or worker with `promotions:manage` | Deletes a shop promotion and broadcasts invalidation to subscribers. | `server/routes/promotions.ts:694` |
| PATCH | `/api/promotions/:id` | Shop owner or worker with `promotions:manage` | Partially updates promotion metadata, values, schedule, and product scope. | `server/routes/promotions.ts:467` |
| POST | `/api/promotions/:id/apply` | Authenticated `customer` role | Applies promotion redemption by incrementing usage count after validity checks. | `server/routes/promotions.ts:1006` |
| PATCH | `/api/promotions/:id/status` | Shop owner or worker with `promotions:manage` | Toggles promotion active state for shop-owned campaigns. | `server/routes/promotions.ts:606` |
| GET | `/api/promotions/active/:shopId` | Authenticated user | Returns currently active, in-window, usage-eligible promotions for a shop. | `server/routes/promotions.ts:764` |
| GET | `/api/promotions/shop/:id` | Shop owner or worker with `promotions:manage` | Returns all promotions owned by the current shop context. | `server/routes/promotions.ts:376` |
| POST | `/api/promotions/validate` | Authenticated `customer` role | Customer-side validation endpoint that calculates effective discount for eligible cart lines. | `server/routes/promotions.ts:846` |

### Worker & Staff Management (8)

| Method | Endpoint | Access | Explanation | Source |
|---|---|---|---|---|
| GET | `/api/shops/workers` | Authenticated `shop` role | Lists workers linked to the authenticated shop owner. | `server/routes/workers.ts:212` |
| POST | `/api/shops/workers` | Authenticated `shop` role | Creates a worker user account, hashes worker PIN, links worker to shop, and sets responsibilities. | `server/routes/workers.ts:127` |
| DELETE | `/api/shops/workers/:workerUserId` | Authenticated `shop` role | Unlinks and removes worker account from the shop context. | `server/routes/workers.ts:375` |
| GET | `/api/shops/workers/:workerUserId` | Authenticated `shop` role | Returns one worker profile scoped to the authenticated shop. | `server/routes/workers.ts:341` |
| PATCH | `/api/shops/workers/:workerUserId` | Authenticated `shop` role | Updates worker identity/responsibilities, active state, and optionally resets worker PIN. | `server/routes/workers.ts:287` |
| GET | `/api/shops/workers/check-number` | Authenticated `shop` role | Checks whether a proposed 10-digit worker number is available. | `server/routes/workers.ts:242` |
| GET | `/api/shops/workers/responsibilities` | Authenticated `shop` role | Returns canonical worker responsibility list and curated preset bundles. | `server/routes/workers.ts:98` |
| GET | `/api/worker/me` | Authenticated `worker` role | Returns current worker-shop link, active flag, and responsibility list. | `server/routes/workers.ts:83` |

### Realtime, Notifications & Device (7)

| Method | Endpoint | Access | Explanation | Source |
|---|---|---|---|---|
| GET | `/api/events` | Authenticated user | Opens a server-sent events stream for realtime invalidation and notification updates for the logged-in user. | `server/routes.ts:1408` |
| POST | `/api/fcm/register` | Authenticated user | Registers/updates user FCM token metadata for push delivery. | `server/routes.ts:5369` |
| DELETE | `/api/fcm/unregister` | Authenticated user | Unregisters an FCM token, typically on logout/device unlink. | `server/routes.ts:5404` |
| GET | `/api/notifications` | Authenticated user | Returns paginated user notifications. | `server/routes.ts:5276` |
| DELETE | `/api/notifications/:id` | Authenticated user | Deletes one notification for the current user. | `server/routes.ts:5341` |
| PATCH | `/api/notifications/:id/read` | Authenticated user | Marks one notification as read. | `server/routes.ts:5298` |
| PATCH | `/api/notifications/mark-all-read` | Authenticated user | Marks all current user notifications as read in one operation. | `server/routes.ts:5315` |

### Diagnostics & Telemetry (1)

| Method | Endpoint | Access | Explanation | Source |
|---|---|---|---|---|
| POST | `/api/performance-metrics` | Public | Accepts frontend performance metric envelopes for operational telemetry and rejects oversized payload batches. | `server/routes.ts:8096` |

### Admin Console (25)

| Method | Endpoint | Access | Explanation | Source |
|---|---|---|---|---|
| GET | `/api/admin/accounts` | Admin session + permission `manage_admins` | Lists admin accounts with role linkage metadata. | `server/routes/admin.ts:888` |
| POST | `/api/admin/accounts` | Admin session + permission `manage_admins` | Creates new admin account and writes corresponding audit trail. | `server/routes/admin.ts:900` |
| GET | `/api/admin/all-bookings` | Admin session + permission `view_all_bookings` | Returns full raw bookings dataset for admin-level operations. | `server/routes/admin.ts:855` |
| GET | `/api/admin/all-orders` | Admin session + permission `view_all_orders` | Returns full raw order dataset for admin-level operations. | `server/routes/admin.ts:815` |
| GET | `/api/admin/audit-logs` | Admin session + permission `manage_admins` | Returns admin audit log entries ordered by creation time. | `server/routes/admin.ts:992` |
| PATCH | `/api/admin/bookings/:id/resolve` | Authenticated `admin` role | Resolves disputed bookings by setting an admin-selected resolution status after dispute-state validation. | `server/routes.ts:2180` |
| POST | `/api/admin/change-password` | Admin session | Allows logged-in admin to rotate password and clears forced-change flag. | `server/routes/admin.ts:340` |
| GET | `/api/admin/dashboard-stats` | Admin session | Returns platform KPI summary (users, orders, revenue, bookings, pending counts). | `server/routes/admin.ts:688` |
| GET | `/api/admin/disputes` | Authenticated `admin` role | Lists bookings currently marked as `disputed` for admin review and resolution workflows. | `server/routes.ts:2216` |
| GET | `/api/admin/health-status` | Admin session + permission `view_health` | Returns admin health panel data including DB reachability and background job last-run timestamps. | `server/routes/admin.ts:365` |
| POST | `/api/admin/login` | Public (admin credentials required) | Authenticates admin user and opens dedicated admin session with permission payload. | `server/routes/admin.ts:259` |
| POST | `/api/admin/logout` | Admin session (clears if present) | Clears admin session identifier. | `server/routes/admin.ts:308` |
| GET | `/api/admin/logs` | Admin session + permission `view_health` | Returns filtered non-admin application log slices with category/level filters. | `server/routes/admin.ts:383` |
| GET | `/api/admin/me` | Admin session | Returns current admin identity, permissions, and password-change requirement flag. | `server/routes/admin.ts:313` |
| GET | `/api/admin/monitoring/summary` | Admin session + permission `view_health` | Returns aggregated platform monitoring snapshot for admin dashboards. | `server/routes/admin.ts:563` |
| POST | `/api/admin/performance-metrics` | Admin session | Receives admin-panel frontend performance metrics and records them in monitoring pipeline. | `server/routes/admin.ts:526` |
| GET | `/api/admin/platform-users` | Admin session + permission `manage_users` | Returns paginated platform user listing with optional search. | `server/routes/admin.ts:726` |
| DELETE | `/api/admin/platform-users/:userId` | Admin session + permission `manage_users` | Deletes platform user and associated data, then records audit entry. | `server/routes/admin.ts:781` |
| PATCH | `/api/admin/platform-users/:userId/suspend` | Admin session + permission `manage_users` | Suspends or unsuspends a platform user and writes audit trail. | `server/routes/admin.ts:753` |
| DELETE | `/api/admin/reviews/:reviewId` | Admin session + permission `manage_reviews` | Deletes a review and records admin audit entry. | `server/routes/admin.ts:865` |
| GET | `/api/admin/roles` | Admin session + permission `manage_admins` | Lists available admin roles. | `server/routes/admin.ts:927` |
| POST | `/api/admin/roles` | Admin session + permission `manage_admins` | Creates an admin role definition. | `server/routes/admin.ts:937` |
| PUT | `/api/admin/roles/:roleId/permissions` | Admin session + permission `manage_admins` | Replaces role-permission assignment set for the target role. | `server/routes/admin.ts:955` |
| GET | `/api/admin/shops/transactions` | Admin session + permission `view_all_orders` | Returns per-shop paid transaction counts for leaderboard/oversight reporting. | `server/routes/admin.ts:825` |
| GET | `/api/admin/transactions` | Admin session + permission `view_all_orders` | Returns paginated transaction/order records with flexible status/customer/shop search filters. | `server/routes/admin.ts:572` |

## Known aliases and compatibility endpoints

- `GET /api/search` and `GET /api/search/global` share the same global search handler.
- `GET /api/shops/:id` and `GET /api/shops/:shopId` both exist; one is owner/shop-table resolver, one is cached storefront detail path.
- `GET /api/bookings/service/:id` is a legacy alias of `GET /api/services/:id/bookings`.
- `POST /api/bookings/:id/notify-customer-accepted` and `POST /api/bookings/:id/notify-customer-rejected` are legacy email hooks and currently return disabled-email responses.
- `POST /api/bookings/:id/payment` and `POST /api/orders/:id/payment` are compatibility placeholders with payment-disabled responses.
- `GET /api/bookings/test` and `GET /api/orders` come from modular router stubs and are intentionally lightweight.
