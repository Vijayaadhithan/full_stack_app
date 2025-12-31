# Indian E-commerce and Service Booking Platform

All-in-one marketplace where customers can shop for products, book services, manage orders, and interact with shops or workers in real time. The repository bundles:

- Customer web app (React + TanStack Query + Vite)
- Shop / provider dashboards plus worker sub-accounts
- Admin console with monitoring, audits, and platform controls
- Express/Node API backed by PostgreSQL + Drizzle ORM
- Real-time updates (SSE + Redis) and background jobs (BullMQ)
- Rural-first auth (phone + PIN) with optional Firebase OTP

Use this README to get up and running quickly. For mobile and Firebase/Android specifics, see [`docs/mobile-and-cloud-setup.md`](docs/mobile-and-cloud-setup.md).

## Table of contents

1. [Local development setup](#local-development-setup)
2. [Running the application](#running-the-application)
3. [Authentication flows](#authentication-flows)
4. [Realtime & observability](#realtime--observability)
5. [Environment variables](#environment-variables)
6. [Additional docs](#additional-docs)
7. [Background jobs](#background-jobs)
8. [Production deployment](#production-deployment)
9. [Role overview](#role-overview)
10. [Useful scripts](#useful-scripts)

## Local Development Setup

### Prerequisites

1. Node.js (v20.x or later)
2. PostgreSQL (v14+ recommended)
3. Redis (optional for local dev; required in production for caching, rate limiting, jobs, and realtime)

### Environment Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd <project-directory>
```

2. Create and configure your `.env` file:

```bash
cp .env_example .env
```

3. Minimum configuration:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
SESSION_SECRET=ChangeMeToAStrongSecret
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=ChangeMeToAStrongPassword
VITE_API_URL=http://localhost:5000
```

`SESSION_SECRET` and `ADMIN_PASSWORD` are validated for strength in production; use long, random values.

### Installation

1. Install project dependencies:

```bash
npm install
```

2. Apply the database migrations:

```bash
npm run db:migrate
```

When you make schema changes run `npm run db:generate`, review the generated SQL in `migrations/`, and then apply it with `npm run db:migrate`.

Hit a `relation "<table>" already exists` error because the database was provisioned separately? Baseline the migration history so Drizzle records the existing schema instead of re-running the bootstrap scripts:

```bash
# 1. Ensure the target database already matches the schema described by migrations/meta/*_snapshot.json
# 2. Record those migrations in drizzle.__drizzle_migrations
npm run db:migrate:baseline

# 3. Re-run migrations to pick up any new changes generated afterwards
npm run db:migrate
```

The baseline script validates that every table in the latest snapshot already exists; it aborts early (without writing anything) if something is missing so you never mark partial schemas as applied by accident.

## Running the Application

1. Start the development server:

```bash
npm run dev:server
```

2. Start the frontend development server in a separate terminal:

```bash
npm run dev:client
```

The application will be available at:

- Frontend: http://localhost:5173
- API: http://localhost:5000/api
- Swagger UI: http://localhost:5000/api/docs
- Admin UI: http://localhost:5173/admin/login
- Worker login: http://localhost:5173/worker-login

Optional: set `USE_IN_MEMORY_DB=true` to run the API with in-memory storage (useful for quick demos/tests; not for production).

### Checking public catalog endpoints

The core catalog routes (services, products, and shops) are public, so you can test them without logging in. With the API running on `http://localhost:5000`, run the following from any terminal:

```bash
# List all shops (public)
curl http://localhost:5000/api/shops | jq '.'

# Fetch a single shop (replace with a real ID from the previous call)
SHOP_ID=1
curl "http://localhost:5000/api/shops/${SHOP_ID}" | jq '.'

# Browse products
curl "http://localhost:5000/api/products?searchTerm=phone" | jq '.items[:3]'

# View specific product details within a shop (IDs must exist)
PRODUCT_ID=5
curl "http://localhost:5000/api/shops/${SHOP_ID}/products/${PRODUCT_ID}" | jq '.'

# Browse services with optional filters
curl "http://localhost:5000/api/services?locationCity=Mumbai" | jq '.[:3]'

# View a specific service
SERVICE_ID=7
curl "http://localhost:5000/api/services/${SERVICE_ID}" | jq '.'
```

You can omit the `jq` pipes if it is not installed; they are only there to pretty-print the JSON.

### Browsing via the frontend

The Vite client lets anonymous visitors open the catalog screens directly. Once both dev servers are running (`npm run dev:server` and `npm run dev:client`), open these URLs in your browser:

- `http://localhost:5173/customer/browse-services`
- `http://localhost:5173/customer/browse-products`
- `http://localhost:5173/customer/browse-shops`
- `http://localhost:5173/customer/shops/<id>` - replace `<id>` with a shop id from `/api/shops`
- `http://localhost:5173/customer/shops/<shopId>/products/<productId>` - ids from the products API
- `http://localhost:5173/customer/shops/<id>/quick-order` - quick text order flow
- `http://localhost:5173/customer/service-details/<serviceId>` and `/customer/service-provider/<serviceId>` - ids from `/api/services`

If you browse anonymously, cart/wishlist buttons will still redirect you to sign in because those actions call protected routes, but the read-only data renders without authentication.

### LAN / Device Testing

1. Discover your machine's LAN IP (e.g. `ipconfig` on Windows or `ifconfig`/`ip addr` on macOS/Linux).
2. Update the following entries in `.env` so mobile devices can resolve your machine:
   - `HOST=0.0.0.0` to bind the API to every interface.
   - `DEV_SERVER_HOST=<your-LAN-ip>` so Vite HMR and Capacitor know where to reach the dev server.
   - `FRONTEND_URL=http://<your-LAN-ip>:5173` and `APP_BASE_URL=http://<your-LAN-ip>:5000` for redirects and cookies.
   - `ALLOWED_ORIGINS=http://<your-LAN-ip>:5173,http://<your-LAN-ip>:5000` so CORS accepts cross-origin requests.
3. (Optional) Set `CAPACITOR_SERVER_URL=http://<your-LAN-ip>:5173` when running `npx cap run android` for on-device hot reload.
4. Restart `npm run dev:server` and `npm run dev:client`. Other devices on the same network can now open `http://<your-LAN-ip>:5173`.
5. When you need to share the app outside your LAN, expose ports 5000 and 5173 via your router (port forwarding) or deploy the stack to a VPS. In that scenario, point `FRONTEND_URL`, `APP_BASE_URL`, and `VITE_API_URL` at the publicly reachable hostname and list it in `ALLOWED_ORIGINS`. The development server relaxes CORS by default; set `STRICT_CORS=true` in `.env` if you want to enforce the allowlist even during local development.

### Network configuration file (optional)

If you prefer not to touch `.env` for every network change, copy
`config/network-config.example.json` to `config/network-config.json` and edit
the hosts/ports. The backend and Vite dev server read that file on boot
and merge the values with the environment variables. You can also set
`NETWORK_CONFIG_PATH` to point to a different JSON file per environment.

> Need to reach the app from outside your LAN? See `docs/remote-access.md`
> for port-forwarding vs Cloudflare Tunnel steps.

## Authentication flows

- **Standard registration/login**: `POST /api/register`, `POST /api/login`, `GET /api/user`, `POST /api/logout` (username/email/phone + password).
- **Rural phone + PIN**: `POST /api/auth/check-user`, `POST /api/auth/rural-register`, `POST /api/auth/login-pin`, `POST /api/auth/reset-pin`.
- **Worker login**: `POST /api/auth/worker-login` (10-digit worker number + 4-digit PIN).
- **Server-managed OTP reset (optional)**: `POST /api/auth/forgot-password-otp`, `POST /api/auth/verify-reset-otp`, `POST /api/auth/reset-password`.
- **CSRF protection**: `GET /api/csrf-token` returns a token; the client auto-sends `x-csrf-token` for non-GET requests.

The frontend Forgot PIN flow uses Firebase Phone Auth via `client/src/lib/firebase.ts`. Rural OTP in `RuralAuthFlow` is currently a UI step; wire in Firebase if you want server-verifiable OTP.

Google OAuth is not currently wired in the backend. The UI button points at `/auth/google`, which you must implement if you want Google sign-in.

## Realtime & Observability

- **Realtime invalidation**: `GET /api/events` opens an EventSource stream and broadcasts cache invalidations (notifications, orders, cart, etc). Redis Pub/Sub fan-out is used when `REDIS_URL` is set.
- **Logs**: structured logs are written to `logs/app.log` by Pino. Configure `LOG_LEVEL`, `LOG_FILE_PATH`, `LOG_TO_STDOUT`.
- **Health**: `GET /api/health` for basic liveness; admin-only health + logs under `/api/admin/health-status` and `/api/admin/logs`.
- **Monitoring**: `GET /api/admin/monitoring/summary` for request/error/resource telemetry; frontend metrics are posted to `/api/performance-metrics`.
- **Request IDs**: every response includes `x-request-id` so you can correlate client errors with log entries.
- **Live monitor script**: `npm run monitor` polls `/api/health` or `LIVE_MONITOR_URL`.

## Environment variables

Start with `.env_example` for the full list. Commonly tuned variables:

**Core**
- `DATABASE_URL`, `DATABASE_REPLICA_URL`
- `DB_POOL_SIZE`, `DB_READ_POOL_SIZE`, `DB_SLOW_THRESHOLD_MS`
- `NODE_ENV`, `PORT`, `HOST`, `USE_IN_MEMORY_DB`

**Security & sessions**
- `SESSION_SECRET`
- `SESSION_STORE` (`redis` or `postgres`)
- `SESSION_TTL_SECONDS`, `SESSION_REDIS_PREFIX`
- `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_DOMAIN`

**URLs & CORS**
- `FRONTEND_URL`, `APP_BASE_URL`
- `ALLOWED_ORIGINS`, `STRICT_CORS`
- `DEV_SERVER_HOST`, `DEV_SERVER_PORT`, `DEV_SERVER_HMR_HOST`, `DEV_SERVER_HMR_PORT`, `DEV_SERVER_HMR_PROTOCOL`
- `NETWORK_CONFIG_PATH`, `API_PROXY_TARGET`

**Redis & realtime**
- `REDIS_URL`, `DISABLE_REDIS`

**Admin**
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`

**Jobs**
- `BOOKING_EXPIRATION_CRON`, `PAYMENT_REMINDER_CRON`, `LOW_STOCK_DIGEST_CRON`, `CRON_TZ`
- `PAYMENT_REMINDER_DAYS`, `PAYMENT_DISPUTE_DAYS`
- `JOB_LOCK_TTL_MS`, `BOOKING_EXPIRATION_LOCK_TTL_MS`, `PAYMENT_REMINDER_LOCK_TTL_MS`, `LOW_STOCK_DIGEST_LOCK_TTL_MS`
- `DISABLE_JOB_LOCK`

**Client**
- `VITE_API_URL`, `VITE_APP_BASE_URL`, `VITE_FALLBACK_API_URL`
- `VITE_FIREBASE_*` (Firebase Phone Auth / OTP)
- `CAPACITOR_SERVER_URL` (Capacitor live reload)

**HTTPS (optional)**
- `HTTPS_ENABLED`, `HTTPS_KEY_PATH`, `HTTPS_CERT_PATH`, `HTTPS_PASSPHRASE`, `HTTPS_CA_PATH`

For a full list with descriptions, see `docs/environment-reference.md`.

## Additional docs

- `docs/environment-reference.md` - detailed environment variable descriptions
- `docs/api-quickstart.md` - curl examples for auth, CSRF, and core flows
- `docs/role-endpoint-matrix.md` - role-based endpoint overview
- `docs/deployment-runbook.md` - production deployment checklist
- `docs/mobile-and-cloud-setup.md` - Android/Capacitor and Firebase setup
- `docs/remote-access.md` - LAN and public access options

## Background jobs

The API schedules repeatable BullMQ jobs (Redis-backed):

- **Booking expiration**: marks stale pending bookings as expired (`BOOKING_EXPIRATION_CRON`).
- **Payment reminders**: nudges unpaid bookings and escalates disputes (`PAYMENT_REMINDER_DAYS`, `PAYMENT_DISPUTE_DAYS`).
- **Low stock digest**: notifies shops about low inventory (`LOW_STOCK_DIGEST_CRON`).

Distributed job locks use Redis (`JOB_LOCK_*`) to avoid duplicates across instances. Set `DISABLE_JOB_LOCK=true` only when you intentionally want every instance to run jobs.

## Production Deployment

1. Build both the client and API bundles:

```bash
npm run build
```

2. Start the compiled server with the provided `ecosystem.config.js` definition:

```bash
npm install --global pm2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

Production notes:
- Redis is required for caching, rate limiting, job queues, and realtime fan-out.
- Set `NODE_ENV=production`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FRONTEND_URL`, `APP_BASE_URL`, `ALLOWED_ORIGINS`, `REDIS_URL`.
- Optional HTTPS termination: set `HTTPS_ENABLED=true` and provide certificate paths.

## Role overview

| Role | Capabilities |
| --- | --- |
| **Customer** | Browse/order products, book services, manage cart & wishlist, track bookings/orders |
| **Shop owner** | Manage inventory, workers, orders, returns, promotions |
| **Worker** | Scoped to assigned shop with permission-based access (orders, inventory, analytics) |
| **Service provider** | Manage services/bookings, respond to customer requests |
| **Admin** | Platform-wide controls; role/permission-driven access; audit logs |

## Useful scripts

- `npm run dev:server` - start the backend API
- `npm run dev:client` - start the frontend development server
- `npm run build` - build for production
- `npm run start` - run the compiled server
- `npm run db:generate` - generate Drizzle migrations
- `npm run db:migrate` - apply migrations
- `npm run db:migrate:baseline` - baseline existing schema
- `npm run check` - type check
- `npm run lint` - run ESLint
- `npm run format` - format files using Prettier
- `npm run test` - run tests
- `npm run test:coverage` - test coverage (c8)
- `npm run test:report` - write test logs & coverage report
- `npm run monitor` - poll `/api/health` on an interval

## Running tests

```bash
npm run check   # type check / lint
npm run test    # run the Node test suite (uses in-memory storage by default)
```

`npm run test` logs per-route timings which helps correlate failing tests or slow suites with specific API calls.

### Load testing with k6

We keep a scripted load test (`load-test.js`) that spins up a verified shop, provider, and customer before hammering the high-traffic endpoints (login, catalog, service detail, customer orders, order placement). To run it locally:

1. Install [k6](https://k6.io/docs/) (e.g. `brew install k6` on macOS).
2. Start the API with the in-memory storage and relaxed guards so the script can seed data quickly:

   ```bash
   SESSION_SECRET='LoadTest#Secret!2025{Example}' \
   USE_IN_MEMORY_DB=true \
   DISABLE_REDIS=true \
   DISABLE_RATE_LIMITERS=true \
   npm run start
   ```

   - `DISABLE_RATE_LIMITERS=true` temporarily disables `express-rate-limit` so the scripted login/registration traffic is not throttled.
   - Leave this flag **unset** in normal development or production.

3. In another terminal, run the test:

   ```bash
   k6 run load-test.js
   ```

   You can override defaults with environment variables:

   - `BASE_URL` (default `http://localhost:5000`)
   - `TEST_CATEGORY` or `PLATFORM_FEE` to align with your seed data
   - `ENABLE_REG_SPIKE=true` to include the optional anonymous registration burst (keep the rate limiters disabled when doing so).

The script enforces the success criteria documented in the prompt (`http_req_failed < 1%`, GET p95 < 500 ms). Review the console report or the `logs/app.log` entries for any failures, then re-enable rate limiting once the test is complete.
