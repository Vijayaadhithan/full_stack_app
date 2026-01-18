# DoorStep Project Documentation

This document provides a detailed overview of the DoorStep project, including backend services, frontend architecture, database schema, storage, and operational tooling. It reflects the current codebase behavior and configuration.

---

## 1. Project Overview

DoorStep is a marketplace platform designed to connect service providers and shops with customers in India. It supports service bookings, product ordering, shop management, worker accounts, and an admin console with monitoring and audit capabilities.

### Core Capabilities

- **Product Marketplace**: Browse and order products from verified local shops
- **Service Booking**: Book services from verified providers with availability management
- **Shop Management**: Product inventory, orders, workers, promotions, returns
- **Multi-Role Support**: Customer, Shop Owner, Service Provider, Worker, Admin
- **Real-Time Updates**: SSE + Redis Pub/Sub for live notifications
- **Push Notifications**: Firebase Cloud Messaging (FCM) for mobile and web
- **Background Jobs**: BullMQ for booking expiration, payment reminders, low stock alerts
- **Native Android App**: Kotlin + Jetpack Compose for mobile experience

### Key Features

| Feature | Description |
|---------|-------------|
| Rural-First Auth | Phone + 4-digit PIN with optional Firebase OTP |
| Multi-Language | English (en) and Tamil (ta) support |
| Pay-Later | Credit for trusted customers |
| Text Orders | Open order mode for shops |
| Worker Accounts | Scoped permissions for shop staff |
| E-Receipts | Generated for completed transactions |
| Reviews | For both products and services |
| Promotions | Discount codes with usage limits |
| Returns | Customer return request workflow |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
├──────────────────────┬──────────────────────────────────────────┤
│   React Web App      │   Native Android App                     │
│   (Vite + TanStack)  │   (Kotlin + Jetpack Compose)             │
└──────────────────────┴──────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer                                 │
│   Express.js + TypeScript                                       │
│   - REST Endpoints                                               │
│   - SSE Realtime                                                │
│   - Swagger/OpenAPI                                             │
│   - CSRF + Rate Limiting                                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────┬────────────────────────────────────────┐
│     PostgreSQL         │            Redis                       │
│   - Primary DB         │   - Session Store                      │
│   - Drizzle ORM        │   - Caching                            │
│   - Read Replica       │   - Job Queues (BullMQ)                │
│                        │   - Pub/Sub (Realtime)                 │
└────────────────────────┴────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Background Services                           │
│   - Booking Expiration Job                                      │
│   - Payment Reminder Job                                         │
│   - Low Stock Digest Job                                        │
│   - Push Notification Service                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Setup and Installation

### 3.1 Prerequisites

- Node.js v20 or later
- npm (bundled with Node.js)
- PostgreSQL v14+ recommended
- Redis v6+ (optional for local dev; required in production)
- Git
- Android Studio (for native mobile development)

### 3.2 PostgreSQL Setup

```bash
# macOS (Homebrew)
brew install postgresql

# Ubuntu/Debian
sudo apt update && sudo apt install postgresql postgresql-contrib
```

Create database and user:
```sql
CREATE USER doorstep_user WITH PASSWORD 'your_password';
CREATE DATABASE doorstep_db OWNER doorstep_user;
GRANT ALL PRIVILEGES ON DATABASE doorstep_db TO doorstep_user;
```

### 3.3 Project Setup

```bash
# Clone repository
git clone <repository_url>
cd full_stack_app

# Install dependencies
npm install

# Configure environment
cp .env_example .env
# Edit .env with your configuration

# Run migrations
npm run db:migrate

# Start development servers
npm run dev:server  # Backend on :5000
npm run dev:client  # Frontend on :5173
```

**Optional**: Set `USE_IN_MEMORY_DB=true` to run with in-memory storage (demos/tests only).

---

## 4. Backend

### 4.1 Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20.x |
| Framework | Express.js |
| Language | TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Caching | Redis + ioredis |
| Job Queue | BullMQ |
| Auth | Passport.js (Local + Session) |
| Logging | Pino |
| Security | Helmet, CSRF, Rate Limiting |
| Push Notifications | Firebase Admin SDK |

### 4.2 Project Structure (`/server`)

| File/Directory | Purpose |
|----------------|---------|
| `index.ts` | Express bootstrap, middleware setup, static assets |
| `routes.ts` | Main API routes (253K+ bytes) |
| `routes/` | Modular routers (admin, bookings, orders, promotions, workers) |
| `auth.ts` | Standard login, rural PIN auth, worker login, OTP reset |
| `workerAuth.ts` | Shop/worker permission enforcement |
| `pg-storage.ts` | PostgreSQL storage layer (134K+ bytes) |
| `realtime.ts` | SSE stream + Redis Pub/Sub fan-out |
| `jobQueue.ts` | BullMQ job registry |
| `jobs/` | Job handlers (booking expiration, payment reminders, low stock) |
| `security/` | CSRF, rate limiting, secret validation |
| `services/` | Caching, session store, job locking |
| `db.ts` | Drizzle connections with optional read replica |

### 4.3 Authentication & Security

| Feature | Implementation |
|---------|---------------|
| Session-based auth | `express-session` with configurable store (postgres/redis) |
| CSRF protection | Token validation via `x-csrf-token` header |
| Rural auth | Phone + PIN flows via `/api/auth/*` |
| Worker login | 10-digit worker number + 4-digit PIN |
| Rate limiting | `express-rate-limit` with optional Redis backing |
| Security headers | Helmet with HSTS in production |

### 4.4 Key API Areas

| Area | Endpoints |
|------|-----------|
| Public Catalog | `GET /api/shops`, `/api/products`, `/api/services` |
| Authentication | `/api/login`, `/api/auth/login-pin`, `/api/auth/worker-login` |
| Orders | `/api/orders`, `/api/orders/text`, `/api/orders/:id/return` |
| Bookings | `/api/bookings`, `/api/bookings/:id/status` |
| Workers | `/api/shops/workers` CRUD + responsibility presets |
| Admin | `/api/admin/*` for platform management |
| Realtime | `/api/events` SSE stream |
| Documentation | `/api/docs` Swagger UI |

### 4.5 Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Booking Expiration | `BOOKING_EXPIRATION_CRON` | Marks stale pending bookings as expired |
| Payment Reminders | `PAYMENT_REMINDER_CRON` | Nudges unpaid bookings, escalates disputes |
| Low Stock Digest | `LOW_STOCK_DIGEST_CRON` | Notifies shop owners about low inventory |

Jobs use Redis-based distributed locks to prevent duplicate execution across instances.

### 4.6 Push Notifications

Firebase Cloud Messaging (FCM) is used for push notifications:
- Order status updates
- Booking confirmations/rejections
- Payment reminders
- Low stock alerts (for shop owners)

Configure with `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable.

### 4.7 Observability

| Feature | Endpoint/Config |
|---------|-----------------|
| Health Check | `GET /api/health` |
| Detailed Health | `GET /api/admin/health-status` (admin only) |
| Logs | Pino → `logs/app.log` |
| Metrics | `/api/admin/monitoring/summary` |
| Request IDs | `x-request-id` header on all responses |

---

## 5. Frontend

### 5.1 Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | React 18 |
| Language | TypeScript |
| Build Tool | Vite |
| Routing | Wouter |
| State Management | TanStack Query |
| UI Components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Forms | React Hook Form + Zod |
| i18n | react-i18next (en, ta) |

### 5.2 Project Structure (`/client/src`)

| Directory | Contents |
|-----------|----------|
| `components/` | 74 reusable UI components |
| `contexts/` | Auth, Cart, Notification contexts |
| `hooks/` | 10 custom React hooks |
| `lib/` | API client, Firebase, utilities |
| `pages/` | 56 page components |
| `pages/admin/` | 13 admin dashboard pages |
| `pages/auth/` | 5 authentication pages |
| `pages/customer/` | 18 customer pages |
| `pages/provider/` | 6 service provider pages |
| `pages/shop/` | 9 shop owner pages |

### 5.3 Key Page Routes

#### Customer Routes
| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/customer/browse-services` | Service catalog |
| `/customer/browse-products` | Product catalog |
| `/customer/browse-shops` | Shop directory |
| `/customer/cart` | Shopping cart |
| `/customer/checkout` | Order checkout |
| `/customer/orders` | Order history |
| `/customer/bookings` | Booking management |
| `/customer/profile` | Profile settings |

#### Shop Routes
| Route | Description |
|-------|-------------|
| `/shop/dashboard` | Shop home |
| `/shop/products` | Inventory management |
| `/shop/orders` | Order processing |
| `/shop/workers` | Worker accounts |
| `/shop/promotions` | Discount codes |
| `/shop/returns` | Return requests |

#### Provider Routes
| Route | Description |
|-------|-------------|
| `/provider/dashboard` | Provider home |
| `/provider/services` | Service management |
| `/provider/bookings` | Booking management |
| `/provider/calendar` | Schedule view |

#### Admin Routes
| Route | Description |
|-------|-------------|
| `/admin/login` | Admin authentication |
| `/admin/dashboard` | Admin home |
| `/admin/users` | User management |
| `/admin/monitoring` | Health metrics |
| `/admin/logs` | Audit logs |

### 5.4 Realtime Updates

The frontend connects to `/api/events` via SSE for:
- Notification updates
- Order status changes
- Booking status changes
- Cart/inventory changes

```typescript
// Realtime hook usage
const eventSource = new EventSource('/api/events');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'invalidate') {
    queryClient.invalidateQueries({ queryKey: data.queryKey });
  }
};
```

---

## 6. Mobile Application

### 6.1 Native Android App

Located in `doorstep-android/`, the native Android app provides a full mobile experience.

| Component | Technology |
|-----------|------------|
| Language | Kotlin |
| UI | Jetpack Compose + Material 3 |
| Architecture | MVVM + Clean Architecture |
| Networking | Retrofit + OkHttp + Moshi |
| Local Storage | Room Database + DataStore |
| DI | Hilt (Dagger) |
| Auth | Firebase Phone Auth |
| Push | Firebase Cloud Messaging |

### 6.2 Project Structure

```
doorstep-android/app/src/main/java/com/doorstep/tn/
├── DoorStepApp.kt          # Application class
├── MainActivity.kt         # Single activity
├── core/                   # Core utilities
├── auth/                   # Authentication feature
├── customer/               # Customer feature
├── shop/                   # Shop owner feature
├── provider/               # Provider feature
└── common/                 # Shared components
```

### 6.3 Build & Run

```bash
cd doorstep-android

# Build debug APK
./gradlew assembleDebug

# Install on device
./gradlew installDebug
```

### 6.4 API Configuration

- **Production**: `https://doorsteptn.in`
- **Development**: `http://10.0.2.2:5000` (Android emulator localhost)

---

## 7. Database Schema

### 7.1 Core Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts (all roles) |
| `shops` | Shop profiles |
| `providers` | Service provider profiles |
| `shop_workers` | Worker-shop relationships with permissions |
| `services` | Service offerings |
| `products` | Shop products |
| `orders` | Customer orders |
| `order_items` | Order line items |
| `bookings` | Service bookings |
| `cart` | Shopping cart items |
| `wishlist` | Customer wishlist |
| `reviews` | Service reviews |
| `product_reviews` | Product reviews |
| `returns` | Return requests |
| `promotions` | Discount codes |
| `notifications` | User notifications |

### 7.2 Admin Tables

| Table | Description |
|-------|-------------|
| `admin_users` | Admin console accounts |
| `admin_roles` | Admin role definitions |
| `admin_permissions` | Permission assignments |
| `admin_audit_logs` | Audit trail |

### 7.3 Worker Permissions

Workers can have the following responsibilities:
- `products:read` / `products:write` - Product management
- `inventory:adjust` - Stock level modifications
- `orders:read` / `orders:update` - Order management
- `returns:manage` - Return handling
- `promotions:manage` - Promotion management
- `customers:message` - Customer communication
- `bookings:manage` - Booking management
- `analytics:view` - Analytics access

See `shared/schema.ts` for complete schema definitions (1236 lines, 135+ types).

---

## 8. Configuration Reference

### 8.1 Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session signing secret (strong random value) |
| `ADMIN_EMAIL` | Bootstrap admin email |
| `ADMIN_PASSWORD` | Bootstrap admin password |
| `VITE_API_URL` | API URL for frontend |

### 8.2 Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | Primary database connection |
| `DATABASE_REPLICA_URL` | - | Read replica (optional) |
| `DB_POOL_SIZE` | 50 | Primary connection pool |
| `USE_IN_MEMORY_DB` | false | In-memory storage for demos |

### 8.3 Session & Security

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_STORE` | postgres | `redis` or `postgres` |
| `SESSION_TTL_SECONDS` | 86400 | Session lifetime |
| `SESSION_COOKIE_SAMESITE` | lax | Cookie SameSite policy |
| `SESSION_COOKIE_SECURE` | auto | Secure cookie in production |

### 8.4 Redis & Caching

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | - | Redis connection string |
| `DISABLE_REDIS` | false | Disable Redis (dev only) |
| `DISABLE_RATE_LIMITERS` | false | Disable rate limiting |

### 8.5 URLs & CORS

| Variable | Description |
|----------|-------------|
| `FRONTEND_URL` | Web app URL |
| `APP_BASE_URL` | API base URL |
| `ALLOWED_ORIGINS` | Comma-separated CORS whitelist |

### 8.6 Firebase (Optional)

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Service account for push notifications |

### 8.7 Background Jobs

| Variable | Default | Description |
|----------|---------|-------------|
| `BOOKING_EXPIRATION_CRON` | `0 * * * *` | Hourly |
| `PAYMENT_REMINDER_CRON` | `0 9 * * *` | Daily at 9 AM |
| `LOW_STOCK_DIGEST_CRON` | `0 8 * * *` | Daily at 8 AM |
| `CRON_TZ` | Asia/Kolkata | Job timezone |

---

## 9. Deployment

### 9.1 Production Build

```bash
# Build both client and server
npm run build

# Output:
# - dist/public/  → Static frontend assets
# - dist/index.js → Compiled server bundle
```

### 9.2 Run with PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

### 9.3 Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure strong `SESSION_SECRET`
- [ ] Set up production `DATABASE_URL` and `REDIS_URL`
- [ ] Configure `FRONTEND_URL`, `APP_BASE_URL`, `ALLOWED_ORIGINS`
- [ ] Set up HTTPS (reverse proxy or Node.js)
- [ ] Configure Firebase for push notifications
- [ ] Set up database backup strategy
- [ ] Configure log rotation
- [ ] Set up health monitoring

### 9.4 Health Monitoring

```bash
# Basic health check
curl http://localhost:5000/api/health

# Continuous monitoring script
npm run monitor
```

---

## 10. Testing

### 10.1 Running Tests

```bash
# Type check
npm run check

# Run test suite
npm run test

# With coverage
npm run test:coverage

# Generate report
npm run test:report
```

### 10.2 Load Testing

```bash
# Install k6
brew install k6  # macOS

# Start server with test config
SESSION_SECRET='TestSecret123!' \
USE_IN_MEMORY_DB=true \
DISABLE_RATE_LIMITERS=true \
npm run start

# Run load test
k6 run load-test.js
```

---

## 11. Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev:server` | Start backend dev server |
| `npm run dev:client` | Start frontend dev server |
| `npm run build` | Build for production |
| `npm run start` | Run production server |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply migrations |
| `npm run db:migrate:baseline` | Baseline existing schema |
| `npm run check` | TypeScript type check |
| `npm run lint` | Run ESLint |
| `npm run format` | Prettier formatting |
| `npm run test` | Run tests |
| `npm run test:coverage` | Test with coverage |
| `npm run monitor` | Poll health endpoint |

---

## 12. Additional Documentation

| Document | Description |
|----------|-------------|
| `docs/environment-reference.md` | Complete environment variables |
| `docs/api-quickstart.md` | cURL examples for API testing |
| `docs/role-endpoint-matrix.md` | Role-based endpoint access |
| `docs/deployment-runbook.md` | Production deployment guide |
| `docs/mobile-and-cloud-setup.md` | Android and Firebase setup |
| `docs/remote-access.md` | LAN and public access options |
| `docs/performance-tuning.md` | Performance optimization |
| `docs/FIREBASE_SETUP.md` | Firebase configuration |
| `doorstep-android/README.md` | Native Android app guide |