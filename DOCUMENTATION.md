# DoorStep Project Documentation

This document provides a detailed overview of the DoorStep project, including backend services, frontend architecture, database schema, storage, and operational tooling. It reflects the current codebase behavior and configuration.

## 1. Project Overview

DoorStep is a marketplace platform designed to connect service providers and shops with customers in India. It supports service bookings, product ordering, shop management, worker accounts, and an admin console with monitoring and audit capabilities.

Core capabilities:

- Public catalog browsing for services, products, and shops
- Auth flows for customers, shop owners, providers, and workers
- Admin console with role/permission controls and live monitoring
- Real-time UI updates via SSE + Redis Pub/Sub
- Background jobs using BullMQ (booking expiration, payment reminders, low stock digest)

## 2. Setup and Installation

### 2.1 Prerequisites

- Node.js (v20 or later)
- npm (bundled with Node.js)
- PostgreSQL (v14+ recommended)
- Redis (optional for local dev; required in production for caching, rate limiting, job queues, and realtime)
- Git

### 2.2 PostgreSQL Setup

1. Install PostgreSQL:
   - macOS (Homebrew): `brew install postgresql`
   - Ubuntu/Debian: `sudo apt update && sudo apt install postgresql postgresql-contrib`
   - Windows: Download the installer from the [official PostgreSQL website](https://www.postgresql.org/download/windows/).

2. Create a database and user:

```sql
CREATE USER indianbudget_user WITH PASSWORD 'your_password';
CREATE DATABASE indianbudget_db OWNER indianbudget_user;
GRANT ALL PRIVILEGES ON DATABASE indianbudget_db TO indianbudget_user;
```

### 2.3 Project Setup

1. Clone the repository:

```bash
git clone <repository_url>
cd <project-directory>
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment variables:
   - Copy `.env_example` to `.env` and update values for your environment.
   - Minimum required: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `VITE_API_URL`.

4. Run migrations:

```bash
npm run db:migrate
```

If your database already has the production schema, baseline migrations once:

```bash
npm run db:migrate:baseline
```

5. Start the application:

```bash
npm run dev:server
# in another terminal
npm run dev:client
```

Optional: set `USE_IN_MEMORY_DB=true` to run the API with in-memory storage (useful for demos/tests, not production).

## 3. Backend

### 3.1 Technology Stack

- Node.js + Express (TypeScript)
- PostgreSQL + Drizzle ORM
- Authentication: Passport Local + express-session
- Caching/queues: Redis, BullMQ
- Observability: Pino logs, metrics capture, Swagger

### 3.2 Project Structure (`/server`)

- `index.ts`: Express bootstrap, CORS, CSRF, Swagger, static assets, scheduled jobs, error handling
- `routes.ts`: Primary API routes (auth, services, bookings, products, orders, reviews, notifications, admin integrations)
- `routes/`: Modular routers (admin, promotions, workers, orders, bookings)
- `auth.ts`: Standard login/register plus rural PIN auth, worker login, OTP-based PIN reset
- `workerAuth.ts`: Shop/worker permission enforcement and shop context resolution
- `realtime.ts`: SSE stream + Redis Pub/Sub fan-out
- `jobQueue.ts` + `jobs/*`: BullMQ job registry (booking expiration, payment reminders, low stock digest)
- `monitoring/*`: Request/CPU/latency metrics aggregation
- `security/*`: CSRF protection, secret validation, rate limiting
- `services/*`: Caching, session store, job locking helpers
- `db.ts`: Drizzle connections with optional read replica

### 3.3 Authentication & Security

- **Session-based auth**: `express-session` with configurable store (`SESSION_STORE=redis|postgres`).
- **CSRF protection**: `GET /api/csrf-token` issues tokens; client adds `x-csrf-token` for state-changing requests.
- **Rural auth**: phone + PIN flows via `/api/auth/*` (OTP verification is client-side when Firebase is enabled).
- **Worker login**: `/api/auth/worker-login` uses worker number + PIN.
- **Rate limiting**: `express-rate-limit` with optional Redis backing; disable with `DISABLE_RATE_LIMITERS=true` for load tests.
- **Secrets validation**: `SESSION_SECRET` and `ADMIN_PASSWORD` are validated for strength in production.

### 3.4 Key API Areas

- **Public catalog**: `GET /api/shops`, `GET /api/products`, `GET /api/services`, `GET /api/search/global`.
- **Auth**: `/api/register`, `/api/login`, `/api/logout`, `/api/user`, `/api/auth/*` for PIN/OTP flows.
- **Orders**: standard orders, text orders (`/api/orders/text`), pay-later approvals, order timelines, returns.
- **Bookings**: availability blocking, provider/customer history, payment confirmation flows.
- **Workers**: `/api/shops/workers` CRUD + responsibility presets.
- **Admin**: `/api/admin/*` for login, monitoring, logs, users, orders, roles, audit logs.
- **Realtime**: `/api/events` SSE stream for cache invalidation.
- **Swagger**: `/api/docs` (OpenAPI UI generated from route annotations).

### 3.5 Background Jobs

- **Booking expiration** (`BOOKING_EXPIRATION_CRON`): marks stale pending bookings as expired.
- **Payment reminders** (`PAYMENT_REMINDER_CRON`): nudges unpaid bookings and escalates disputes.
- **Low stock digest** (`LOW_STOCK_DIGEST_CRON`): notifies shop owners about low inventory.

Jobs run via BullMQ; distributed locks rely on Redis (`JOB_LOCK_*`), and can be disabled with `DISABLE_JOB_LOCK=true` if needed.

### 3.6 Observability

- **Logs**: Pino writes JSON logs to `logs/app.log` (configurable via `LOG_FILE_PATH`).
- **Health**: `GET /api/health` (public), `/api/admin/health-status` (admin).
- **Monitoring**: `/api/admin/monitoring/summary` aggregates request/error/CPU metrics.
- **Request IDs**: responses include `x-request-id` for traceability.

## 4. Frontend

### 4.1 Technology Stack

- React + TypeScript
- Vite
- Wouter routing
- TanStack Query
- shadcn/ui + Tailwind CSS
- React Hook Form + Zod validation

### 4.2 Project Structure (`/client`)

- `src/App.tsx`: routes (customer, provider, shop, worker, admin)
- `src/pages/`: feature pages for each role
- `src/hooks/`: auth, admin, realtime, and performance hooks
- `src/lib/queryClient.ts`: API client + CSRF handling
- `src/lib/firebase.ts`: optional Firebase OTP integration

### 4.3 Key UI Flows

- **Auth**: AuthPage (standard login/register), RuralAuthFlow (phone + PIN), WorkerLoginPage
- **Customer**: browse services/products/shops, cart, orders, bookings, profile
- **Provider**: services, bookings, reviews, earnings
- **Shop**: inventory, orders, promotions, workers, reviews, dashboard stats
- **Admin**: dashboard, monitoring, users, orders, bookings, role management

### 4.4 Realtime Updates

`use-realtime-updates` connects to `/api/events` to invalidate React Query caches on notifications, orders, cart, etc.

### 4.5 Performance Metrics

Frontend timing metrics are captured via `use-client-performance-metrics` and posted to `/api/performance-metrics`.

## 5. Shared Code (`/shared`)

- `schema.ts`: Drizzle tables + Zod schemas
- `api-contract.ts`: Zodios-compatible response contracts for key endpoints
- `config.ts`: feature flags, platform fee settings, filter configuration
- `monitoring.ts` / `performance.ts`: monitoring and performance metric schemas

## 6. Database Schema (Highlights)

- **Core entities**: `users`, `shops`, `providers`, `services`, `products`, `orders`, `bookings`
- **Commerce**: `order_items`, `returns`, `promotions`, `reviews`, `product_reviews`
- **Notifications**: `notifications`
- **Workers**: `shop_workers`
- **Admin**: `admin_users`, `admin_roles`, `admin_permissions`, `admin_role_permissions`, `admin_audit_logs`
- **OTP**: `phone_otp_tokens`

Refer to `shared/schema.ts` for exact fields and types.

## 7. Storage, Sessions, and Caching

- **Storage layer**: `storage.ts` chooses in-memory vs PostgreSQL based on `USE_IN_MEMORY_DB` and environment.
- **Session store**: PostgreSQL by default; Redis when `SESSION_STORE=redis` and `REDIS_URL` is set.
- **Caching**:
  - `server/cache.ts` powers rate limiters and requires Redis in production.
  - `server/services/cache.service.ts` provides data caching with local fallback.
- **Realtime**: Redis Pub/Sub is used to broadcast invalidations across instances.

## 8. Mobile / Capacitor

- Capacitor config lives in `capacitor.config.ts` and supports live reload via `DEV_SERVER_HOST` or `CAPACITOR_SERVER_URL`.
- Build output is `dist/public`, which is bundled into the Android project via `npx cap sync android`.
- Firebase OTP is optional and used by the Forgot PIN UI; configure `VITE_FIREBASE_*` to enable.
- Push notifications are wired on the client (Capacitor plugins) but backend delivery is not implemented yet.

## 9. Deployment & Ops

- Build with `npm run build` and run with PM2 (`pm2 start ecosystem.config.js`).
- Redis is required in production for caching, rate limiting, queues, and realtime.
- HTTPS can be enabled by setting `HTTPS_ENABLED=true` with certificate paths.
- `scripts/provision.sh` provides a sample provisioning flow (review and adapt to your infra).

## 10. Backup and Restore

`scripts/provision.sh` includes a nightly `pg_dump` cron job example that uploads to object storage. To restore:

```bash
aws s3 cp s3://<bucket>/db-2024-01-15.sql.gz - | gunzip | psql "$DATABASE_URL"
```

Adjust bucket names and credentials to match your environment.

## 11. Performance & Security Enhancements

- **Redis-backed caching** with graceful fallback in development.
- **Rate limiting** on auth and admin endpoints, backed by Redis when available.
- **Helmet** security headers with HSTS enabled in production.
- **CSRF** protection for cookie-based sessions.
- **Request context** with `x-request-id` for trace correlation.
- **Optional read replica** via `DATABASE_REPLICA_URL` for query offloading.

## 12. Additional References

- `docs/environment-reference.md` - detailed environment variable descriptions
- `docs/api-quickstart.md` - curl examples for auth, CSRF, and core flows
- `docs/role-endpoint-matrix.md` - role-based endpoint overview
- `docs/deployment-runbook.md` - production deployment checklist
