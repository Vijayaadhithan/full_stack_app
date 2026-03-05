# DoorStep TN Software Manual

This manual is for engineers inheriting the codebase. It explains:
- how to run and operate the system
- where APIs are defined
- what each backend/frontend/android module is responsible for
- how to safely extend features

Use together with:
- `README.md` (setup/deploy quick path)
- `doorstep-android/README.md` (native Android build/release guide)

## 1. System Overview

DoorStep TN is a multi-role commerce platform:
- customer shopping and service booking
- shop and worker operations
- provider workflows
- admin operations

Main runtime pieces:
- API server: `server/` (Express + TypeScript)
- Web app: `client/src/` (React + Vite)
- Shared contracts/schema: `shared/`
- Native Android app: `doorstep-android/`

## 2. Backend Runtime Manual

## 2.1 Startup Sequence (exact flow)

1. `server/index.ts` loads env + network config.
2. CORS origins are resolved and validated.
3. Express middleware is mounted (security headers, parsers, docs).
4. `registerRoutes(app)` from `server/routes.ts` is invoked.
5. `registerRoutes` calls auth setup and business route registration.
6. Scheduled jobs and BullMQ worker are initialized (`jobQueue`, `jobs/*`).
7. Default admin bootstrap runs (`ensureDefaultAdmin`).
8. Admin routes are mounted under `/api/admin`.
9. Static frontend serving is mounted from `dist/public` unless disabled.
10. Health/readiness endpoints and error handlers are active.

## 2.2 Request Lifecycle

1. Incoming request gets request context/tracing metadata.
2. CORS, security headers, and body parsing apply.
3. Session middleware + Passport auth state resolve user.
4. CSRF validation applies for state-changing API routes.
5. Route-level auth/role/worker-permission middleware runs.
6. Storage layer (`storage` abstraction) performs DB/cache operations.
7. Realtime invalidation/push jobs may be queued.
8. Response is serialized; metrics and logs are recorded.

## 2.3 Backend Source Map (What Each File Does)

### 2.3.1 Core bootstrap (`server/`)

- `server/index.ts`: app bootstrap, middleware, health/readiness, startup/shutdown orchestration.
- `server/routes.ts`: main API domain routes (orders/bookings/products/services/reviews/etc).
- `server/auth.ts`: session config, Passport strategy, auth and profile-creation routes.
- `server/bootstrap.ts`: default admin/permissions bootstrap on startup.
- `server/db.ts`: PostgreSQL clients, pool config, connection testing.
- `server/storage.ts`: `IStorage` interface (contract for all persistence operations).
- `server/pg-storage.ts`: PostgreSQL-backed `IStorage` implementation.
- `server/logger.ts`: pino logger setup + request log context integration.
- `server/requestContext.ts`: AsyncLocalStorage request context (requestId, trace IDs, log context).
- `server/tracing.ts`: trace/correlation parsing + traceparent generation.
- `server/swagger.ts`: OpenAPI generation config for `/api/docs`.
- `server/vite.ts`: optional Vite dev middleware/static serving helpers.
- `server/ist-utils.ts`: India-time utility wrappers used in server logic.
- `server/workerAuth.ts`: shared middleware/helpers for shop-worker permission checks.

### 2.3.2 Route modules (`server/routes/`)

- `server/routes/admin.ts`: admin auth, dashboard, logs, transactions, roles/accounts, moderation tools.
- `server/routes/promotions.ts`: promotion CRUD/validation/apply/status and worker/shop permission checks.
- `server/routes/workers.ts`: shop worker CRUD and worker capability management.
- `server/routes/bookings.ts`: small router namespace (main booking business logic remains in `routes.ts`).
- `server/routes/orders.ts`: small router namespace (main order business logic remains in `routes.ts`).

### 2.3.3 Jobs/queues/realtime

- `server/jobQueue.ts`: BullMQ queue/worker registration and generic job framework.
- `server/queue/connection.ts`: BullMQ Redis connection.
- `server/jobs/bookingExpirationJob.ts`: scheduled booking expiration processing.
- `server/jobs/paymentReminderJob.ts`: payment reminder/dispute window checks.
- `server/jobs/lowStockDigestJob.ts`: low-stock scan and digest dispatch logic.
- `server/jobs/pushNotificationDispatchJob.ts`: queued push-notification dispatch payload handling.
- `server/realtime.ts`: SSE connection management and invalidation broadcasts.

### 2.3.4 Security and validation (`server/security/`)

- `server/security/csrfProtection.ts`: CSRF token middleware and validation.
- `server/security/rateLimiters.ts`: auth/admin/sensitive endpoint rate-limit definitions.
- `server/security/roleAccess.ts`: shared role resolution helpers (`shop/provider/worker/admin`).
- `server/security/sanitizeUser.ts`: sensitive field stripping for user payloads.
- `server/security/secretValidators.ts`: secret strength validation for env credentials.

### 2.3.5 Services and infra adapters (`server/services/`)

- `server/services/cache.service.ts`: cache access wrapper used by business flows.
- `server/services/sessionStore.service.ts`: session store resolver (postgres vs redis).
- `server/services/jobLock.service.ts`: distributed job lock using Redis.
- `server/services/firebase-admin.ts`: Firebase Admin init + OTP token verification.
- `server/services/push-notification.ts`: FCM push notification send helper.

### 2.3.6 Monitoring/utilities

- `server/monitoring/metrics.ts`: request/resource/frontend metric aggregation.
- `server/monitoring/errorReporter.ts`: error capture/report abstraction.
- `server/utils/category.ts`: category normalization.
- `server/utils/geo.ts`: coordinate normalization + haversine helpers.
- `server/utils/geo-sql.ts`: PostGIS/haversine SQL helper generation.
- `server/utils/identity.ts`: username/email/phone normalization.
- `server/utils/zod.ts`: standardized zod validation error response formatter.

### 2.3.7 Type declarations (`server/types/`)

- `server/types/*.d.ts`: ambient typing shims for libraries where needed.

## 2.4 Backend Setup and Operation Commands

```bash
npm install
cp .env_example .env
npm run db:migrate
npm run dev:server
```

Production flow:

```bash
npm ci
npm run build
npm run db:migrate
npm run start
```

## 2.5 Extending Backend Safely

When adding an endpoint:
1. Add/adjust validation schema (zod or shared schema).
2. Add route handler in correct module (`routes.ts` or `routes/*.ts`).
3. Use `storage` methods; avoid raw SQL in route handlers unless needed.
4. Enforce auth/role/worker permissions.
5. Wire cache invalidation/realtime events if data affects live views.
6. Add/update OpenAPI comments if endpoint should appear in docs.
7. Add tests.

## 3. API Manual

## 3.1 API Base and Versioning

- Base path: `/api`
- Supported version alias: `/api/v1/*` (rewritten to current handlers)
- Swagger UI: `/api/docs`

## 3.2 Authentication Model

- Session cookie-based auth.
- CSRF token required for non-GET state-changing methods.
- CSRF token source: `GET /api/csrf-token`.

## 3.3 API Domain Map (Where to look in code)

- Auth and account: `server/auth.ts`
- Core business APIs: `server/routes.ts`
- Promotions: `server/routes/promotions.ts`
- Workers: `server/routes/workers.ts`
- Admin: `server/routes/admin.ts` mounted at `/api/admin`
- Health/docs/runtime: `server/index.ts`

## 3.4 API Inventory (source-discovered static route strings)

This list comes from route definitions in `server/**/*.ts` and is useful for onboarding/search.

```text
DELETE /api/admin/platform-users/:userId
DELETE /api/admin/reviews/:reviewId
DELETE /api/cart/:productId
DELETE /api/fcm/unregister
DELETE /api/notifications/:id
DELETE /api/products/:id
DELETE /api/promotions/:id
DELETE /api/services/:id
DELETE /api/services/:serviceId/blocked-slots/:slotId
DELETE /api/shops/pay-later/whitelist/:customerId
DELETE /api/shops/workers/:workerUserId
DELETE /api/wishlist/:productId
GET *
GET /
GET /api
GET /api/admin/accounts
GET /api/admin/all-bookings
GET /api/admin/all-orders
GET /api/admin/audit-logs
GET /api/admin/dashboard-stats
GET /api/admin/disputes
GET /api/admin/health-status
GET /api/admin/logs
GET /api/admin/me
GET /api/admin/monitoring/summary
GET /api/admin/platform-users
GET /api/admin/roles
GET /api/admin/shops/transactions
GET /api/admin/transactions
GET /api/auth/profiles
GET /api/bookings
GET /api/bookings/customer
GET /api/bookings/customer/history
GET /api/bookings/customer/requests
GET /api/bookings/provider
GET /api/bookings/provider/:id
GET /api/bookings/provider/history
GET /api/bookings/provider/pending
GET /api/bookings/service/:id
GET /api/bookings/test
GET /api/cart
GET /api/csrf-token
GET /api/events
GET /api/health
GET /api/health/ready
GET /api/health/system
GET /api/notifications
GET /api/orders/
GET /api/orders/:id
GET /api/orders/:id/timeline
GET /api/orders/customer
GET /api/orders/shop
GET /api/orders/shop/recent
GET /api/product-reviews/customer
GET /api/products
GET /api/products/:id
GET /api/products/shop/:id
GET /api/promotions/active/:shopId
GET /api/promotions/shop/:id
GET /api/recommendations/buy-again
GET /api/returns/shop
GET /api/reviews/customer
GET /api/reviews/product/:id
GET /api/reviews/provider/:id
GET /api/reviews/service/:id
GET /api/reviews/shop/:id
GET /api/search
GET /api/search/global
GET /api/search/nearby
GET /api/services
GET /api/services/:id
GET /api/services/:id/blocked-slots
GET /api/services/:id/bookings
GET /api/services/provider/:id
GET /api/shops
GET /api/shops/:id
GET /api/shops/:shopId
GET /api/shops/:shopId/products/:productId
GET /api/shops/current
GET /api/shops/dashboard-stats
GET /api/shops/orders/active
GET /api/shops/pay-later/whitelist
GET /api/shops/workers
GET /api/shops/workers/:workerUserId
GET /api/shops/workers/check-number
GET /api/shops/workers/responsibilities
GET /api/user
GET /api/users/:id
GET /api/wishlist
GET /api/worker/me
PATCH /api/admin/bookings/:id/resolve
PATCH /api/admin/platform-users/:userId/suspend
PATCH /api/bookings/:id
PATCH /api/bookings/:id/customer-complete
PATCH /api/bookings/:id/en-route
PATCH /api/bookings/:id/provider-complete
PATCH /api/bookings/:id/status
PATCH /api/bookings/:id/update-reference
PATCH /api/notifications/:id/read
PATCH /api/notifications/mark-all-read
PATCH /api/orders/:id/status
PATCH /api/product-reviews/:id
PATCH /api/products/:id
PATCH /api/products/bulk-update
PATCH /api/promotions/:id
PATCH /api/promotions/:id/status
PATCH /api/provider/availability
PATCH /api/reviews/:id
PATCH /api/services/:id
PATCH /api/shops/workers/:workerUserId
PATCH /api/users/:id
POST /api/admin/accounts
POST /api/admin/change-password
POST /api/admin/login
POST /api/admin/logout
POST /api/admin/performance-metrics
POST /api/admin/roles
POST /api/auth/check-user
POST /api/auth/check-username
POST /api/auth/create-provider
POST /api/auth/create-shop
POST /api/auth/forgot-password-otp
POST /api/auth/login-pin
POST /api/auth/reset-password
POST /api/auth/reset-pin
POST /api/auth/rural-register
POST /api/auth/verify-reset-otp
POST /api/auth/worker-login
POST /api/bookings
POST /api/bookings/:id/confirm
POST /api/bookings/:id/notify-customer-accepted
POST /api/bookings/:id/notify-customer-rejected
POST /api/bookings/:id/payment
POST /api/bookings/:id/report-dispute
POST /api/bookings/process-expired
POST /api/cart
POST /api/delete-account
POST /api/fcm/register
POST /api/login
POST /api/logout
POST /api/orders
POST /api/orders/:id/agree-final-bill
POST /api/orders/:id/approve-pay-later
POST /api/orders/:id/cancel
POST /api/orders/:id/confirm-payment
POST /api/orders/:id/payment
POST /api/orders/:id/payment-method
POST /api/orders/:id/quote-text-order
POST /api/orders/:id/submit-payment-reference
POST /api/orders/:orderId/return
POST /api/orders/text
POST /api/performance-metrics
POST /api/product-reviews
POST /api/product-reviews/:id/reply
POST /api/products
POST /api/products/quick-add
POST /api/profile/location
POST /api/promotions
POST /api/promotions/:id/apply
POST /api/promotions/validate
POST /api/register
POST /api/returns/:id/approve
POST /api/reviews
POST /api/reviews/:id/reply
POST /api/services
POST /api/services/:id/block-time
POST /api/shops/pay-later/whitelist
POST /api/shops/workers
POST /api/waitlist
POST /api/wishlist
PUT /api/admin/roles/:roleId/permissions
```

## 3.5 API Testing Workflow

1. Get CSRF token + cookie.
2. Login/register.
3. Reuse cookie jar for authenticated requests.
4. For write requests include `x-csrf-token`.
5. For admin APIs use `/api/admin/login` then `/api/admin/*` routes.

## 4. Frontend Software Manual

## 4.1 Frontend Boot Flow

- `client/src/main.tsx`: React root + global `ErrorBoundary`.
- `client/src/App.tsx`: provider composition and route switch.
- Route-level code splitting via `React.lazy` and `Suspense`.

Provider stack in `App.tsx`:
1. `QueryClientProvider`
2. `LanguageProvider`
3. `AuthProvider`
4. `UserProvider`
5. `AdminProvider`

## 4.2 Frontend Routing and Pages

Routes are defined in `client/src/App.tsx`.
Page files are under `client/src/pages/`.

### 4.2.1 Top-level pages

- `auth-page.tsx`: entry auth screen
- `home-page.tsx`: public landing
- `home-page-below-fold.tsx`: lower section/home split content
- `not-found.tsx`: fallback route
- `privacy-policy.tsx`, `terms-of-service.tsx`, `account-deletion.tsx`: legal pages
- `notification-redirect.tsx`: push/deep-link redirect handler

### 4.2.2 Auth pages (`client/src/pages/auth/`)

- `RuralAuthFlow.tsx`: phone/PIN-first auth flow
- `WorkerLoginPage.tsx`: worker login
- `ForgotPassword.tsx`: reset flow UI
- `RegisterFlow.tsx`: registration path
- `translations.ts`: auth text resources

### 4.2.3 Customer pages (`client/src/pages/customer/`)

- `dashboard.tsx`: customer home dashboard
- `browse-products.tsx`, `product-details.tsx`
- `browse-services.tsx`, `service-details.tsx`, `service-provider.tsx`, `book-service.tsx`
- `browse-shops.tsx`, `shop-details.tsx`, `quick-order.tsx`
- `cart.tsx`, `wishlist.tsx`
- `orders.tsx`, `order-details.tsx`
- `bookings.tsx`
- `profile.tsx`
- `MyReviews.tsx`
- `components/ProductReviewDialog.tsx`

### 4.2.4 Shop pages (`client/src/pages/shop/`)

- `dashboard.tsx`
- `products.tsx`, `components/ProductFormDialog.tsx`
- `orders.tsx`
- `inventory.tsx`
- `ShopPromotions.tsx`
- `reviews.tsx`
- `workers.tsx`
- `profile.tsx`

### 4.2.5 Provider pages (`client/src/pages/provider/`)

- `dashboard.tsx`
- `services.tsx`
- `bookings.tsx`
- `reviews.tsx`
- `earnings.tsx`
- `profile.tsx`

### 4.2.6 Admin pages (`client/src/pages/admin/`)

- `AdminLogin.tsx`
- `AdminLayout.tsx`
- `AdminDashboard.tsx`
- `AdminPlatformUserManagement.tsx`
- `AdminOrders.tsx`
- `AdminBookings.tsx`
- `AdminShopAnalytics.tsx`
- `AdminHealth.tsx`
- `AdminMonitoring.tsx`
- `AdminAccountManagement.tsx`
- `AdminChangePassword.tsx`
- `disputes.tsx`
- `admin-utils.ts`

## 4.3 Frontend Source Map (Core non-page modules)

### 4.3.1 Data and API layer (`client/src/lib/`)

- `queryClient.ts`: fetch wrapper, CSRF handling, React Query defaults.
- `apiClient.ts`: typed Zodios client wrapper.
- `api-error.ts`: API error normalization utilities.
- `firebase.ts`: Firebase web auth init and OTP helpers.
- `push-notifications.ts`: web push registration and backend token sync.
- `notification-routing.ts`: click routing behavior.
- `protected-route.tsx`: role-based route guard.
- `role-access.ts`: frontend role helper logic.
- `permissions.ts`, `geo.ts`, `upi.ts`, `time-slots.ts`, category helpers.

### 4.3.2 Hooks (`client/src/hooks/`)

- `use-auth.tsx`: user auth session state + login/logout/register mutations.
- `use-admin.tsx`: admin auth/session state.
- `use-realtime-updates.ts`: SSE subscription and cache invalidation.
- `use-client-performance-metrics.ts` / `use-admin-performance-metrics.ts`: frontend perf telemetry.
- `use-shop-context.ts`, `use-location-filter.ts`, `use-worker-permissions.ts`, `use-mobile.tsx`, `use-toast.ts`.

### 4.3.3 Contexts (`client/src/contexts/`)

- `UserContext.tsx`: multi-profile/app-mode state.
- `language-context.tsx`: language state.
- `notification-context.tsx`: notification state.

### 4.3.4 Components (`client/src/components/`)

- `ui/*`: reusable design-system primitives.
- `layout/*`: dashboard/shop layout shells.
- `navigation/*`: app navigation components.
- `location/*`: map/filter/location UI helpers.
- `PushNotificationManager.tsx`, `PermissionRequester.tsx`: runtime permissions/push setup.
- `ErrorBoundary.tsx`, `RouteErrorBoundary.tsx`: failure boundaries.

## 4.4 Frontend Dev Rules

When adding a new page:
1. create page in correct role folder under `pages/`
2. add route in `App.tsx`
3. gate with `ProtectedRoute` if auth/role restricted
4. use `queryClient`/`apiRequest` for API calls (keeps CSRF/session behavior consistent)

## 5. Android Software Manual (Code Map)

This complements `doorstep-android/README.md`.

## 5.1 Android App Entry Points

- `doorstep-android/app/src/main/java/com/doorstep/tn/DoorStepApp.kt`: app class, Hilt setup, image loader.
- `doorstep-android/app/src/main/java/com/doorstep/tn/MainActivity.kt`: single-activity Compose host, notification intent routing.
- `doorstep-android/app/src/main/java/com/doorstep/tn/navigation/NavHost.kt`: all navigation graph/routes.
- `doorstep-android/app/src/main/java/com/doorstep/tn/DoorStepFirebaseMessagingService.kt`: FCM token/message handling.

## 5.2 Android Package Map

### 5.2.1 Core platform (`core/*`)

- `core/di/*`: Hilt modules (`NetworkModule`, `DatabaseModule`).
- `core/network/*`: Retrofit API interface, request/response models, auth+CSRF interceptor.
- `core/database/*`: Room entities/DAO/database.
- `core/datastore/DataStore.kt`: local preference persistence.
- `core/security/*`: secure storage for session/user/fcm info.
- `core/cache/*`: local memory/cache repository.

### 5.2.2 Auth feature (`auth/*`)

- `auth/data/model/AuthModels.kt`
- `auth/data/repository/AuthRepository.kt`
- `auth/ui/*`: phone/OTP/PIN/profile-setup screens + `AuthViewModel`.

### 5.2.3 Customer feature (`customer/*`)

- `customer/data/model/CustomerModels.kt`
- `customer/data/repository/CustomerRepository.kt`
- `customer/ui/*`: dashboard, products, services, shops, bookings, orders, cart, wishlist, reviews, notifications.

### 5.2.4 Shop feature (`shop/*`)

- `shop/data/model/ShopModels.kt`
- `shop/data/repository/ShopRepository.kt`
- `shop/ui/*`: dashboard, products, product edit, orders, inventory, promotions, reviews, workers, profile.

### 5.2.5 Provider feature (`provider/*`)

- `provider/data/model/ProviderModels.kt`
- `provider/data/repository/ProviderRepository.kt`
- `provider/ui/*`: dashboard, services, bookings, reviews, earnings, notifications, profile.

### 5.2.6 Shared/common package (`common/*`)

- `common/ui/*`: reusable Compose widgets and legal screens.
- `common/theme/*`: app theme/colors/typography.
- `common/config/*`: app category/platform config constants.
- `common/localization/Translations.kt`: localization resources.
- `common/util/*`: helper utilities.

## 5.3 Android Build and Config Files

- `doorstep-android/app/build.gradle.kts`: app module config, build types, release validations.
- `doorstep-android/release.env.example`: required release env vars template.
- `doorstep-android/settings.gradle.kts`, `build.gradle.kts`, `gradle/libs.versions.toml`: Gradle project/plugin/dependency versions.
- `doorstep-android/app/src/main/AndroidManifest.xml`: permissions, activity, FCM service declarations.

## 6. Shared Layer (`shared/`) Manual

- `shared/schema.ts`: DB schema + zod shared shapes (single source for entities/roles/types).
- `shared/api-contract.ts`: typed API contracts used by frontend typed client.
- `shared/config.ts`: shared flags and config constants.
- `shared/performance.ts`, `shared/monitoring.ts`, `shared/logging.ts`: shared telemetry/log contracts.
- `shared/date-utils.ts`: common date handling utilities.
- `shared/predefinedImages.ts`: preloaded image mapping metadata.

## 7. Scripts and Deployment Asset Manual

### 7.1 Scripts (`scripts/`)

- `runMigrations.ts`: apply Drizzle migrations.
- `seedMigrationHistory.ts`: baseline migration history in existing DB.
- `setupAdmin.ts`: admin bootstrap helper script.
- `truncateAllData.ts`: destructive DB cleanup helper (dev tooling).
- `run_load_regression.sh`: load regression runner.
- `run_tests_with_report.sh`: coverage + test report wrapper.
- `security_checklist.js`: security checks.
- `liveMonitor.js`: runtime monitor helper.
- `start_cloudflare_tunnel.sh`: local tunnel startup script.
- `provision.sh`: VPS bootstrap script (reference).

### 7.2 Deployment files (`deploy/`)

- `deploy/systemd/doorstep-api.service`: systemd unit template.
- `deploy/nginx-load-balancer.conf`: Nginx reverse proxy/load-balancing template.
- `deploy/k8s/doorstep-api.yaml`: Kubernetes deployment/service baseline.

## 8. Regenerating File/API Inventories

Useful onboarding commands:

```bash
# Backend file inventory
find server -type f | sort

# Frontend file inventory
find client/src -type f | sort

# Android Kotlin inventory
find doorstep-android/app/src/main/java/com/doorstep/tn -type f | sort

# API route inventory from source
find server -type f -name '*.ts' -print0 | xargs -0 perl -0777 -ne \
'while(/(?:app|router|bookingsRouter|ordersRouter)\.(get|post|put|patch|delete)\(\s*["\x27]([^"\x27]+)["\x27]/g){my $m=uc($1); my $p=$2; if($ARGV =~ /server\/routes\/admin\.ts$/){$p="/api/admin$p";} if($ARGV =~ /server\/routes\/bookings\.ts$/){$p="/api/bookings$p";} if($ARGV =~ /server\/routes\/orders\.ts$/){$p="/api/orders$p";} print "$m $p\n";}' | sort -u
```

## 9. New Engineer Onboarding Path (Recommended)

1. Read `README.md` sections: setup + deployment + env.
2. Run app locally (server + client).
3. Read this manual sections 2, 3, and 4.
4. Open Swagger (`/api/docs`) and verify auth/CSRF flow.
5. For mobile work, read `doorstep-android/README.md` + section 5 in this file.
