# DoorStep TN - Indian E-commerce and Service Booking Platform

All-in-one marketplace where customers can shop for products, book services, manage orders, and interact with shops or workers in real time.

## 🌟 Highlights

- **Web App**: React + TypeScript + Vite + TanStack Query
- **Native Android App**: Kotlin + Jetpack Compose + Material 3
- **Backend**: Express + TypeScript + PostgreSQL + Drizzle ORM
- **Realtime**: Server-Sent Events (SSE) + Redis Pub/Sub
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Background Jobs**: BullMQ with Redis
- **Rural-First Auth**: Phone + 4-digit PIN with optional Firebase OTP

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Technology Stack](#technology-stack)
4. [Features](#features)
5. [Authentication](#authentication)
6. [Running the Application](#running-the-application)
7. [Environment Variables](#environment-variables)
8. [API Documentation](#api-documentation)
9. [Mobile Apps](#mobile-apps)
10. [Background Jobs](#background-jobs)
11. [Production Deployment](#production-deployment)
12. [Testing](#testing)
13. [Additional Documentation](#additional-documentation)

---

## Quick Start

### Prerequisites

- Node.js v20+
- PostgreSQL v14+
- Redis (optional for local dev; required in production)
- Git

### Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd full_stack_app

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env_example .env
# Edit .env with your DATABASE_URL, SESSION_SECRET, etc.

# 4. Run database migrations
npm run db:migrate

# 5. Start development servers
npm run dev:server   # Backend on http://localhost:5000
npm run dev:client   # Frontend on http://localhost:5173
```

---

## Project Structure

```
full_stack_app/
├── client/                    # React web application
│   ├── src/
│   │   ├── components/        # 74 reusable UI components
│   │   ├── contexts/          # Auth, Cart, Notification contexts
│   │   ├── hooks/             # 10 custom React hooks
│   │   ├── lib/               # API client, Firebase, utilities
│   │   ├── pages/             # 56 page components
│   │   │   ├── admin/         # 13 admin dashboard pages
│   │   │   ├── auth/          # 5 authentication pages
│   │   │   ├── customer/      # 18 customer pages
│   │   │   ├── provider/      # 6 service provider pages
│   │   │   └── shop/          # 9 shop owner pages
│   │   └── App.tsx            # Root component with routing
│   └── index.html
├── server/                    # Express backend
│   ├── index.ts               # Server bootstrap
│   ├── routes.ts              # Main API routes
│   ├── routes/                # Modular route handlers
│   ├── auth.ts                # Authentication logic
│   ├── pg-storage.ts          # PostgreSQL storage layer
│   ├── realtime.ts            # SSE + Redis Pub/Sub
│   ├── jobQueue.ts            # BullMQ job queue
│   ├── jobs/                  # Background job handlers
│   ├── security/              # CSRF, rate limiting, secrets
│   └── services/              # Caching, session store
├── shared/                    # Shared code
│   ├── schema.ts              # Drizzle schema (1236 lines, 135 types)
│   ├── api-contract.ts        # API response types
│   └── config.ts              # Feature flags
├── doorstep-android/          # Native Android app (Kotlin)
├── migrations/                # Drizzle migrations (69 files)
├── docs/                      # Additional documentation
├── tests/                     # Test suites
└── scripts/                   # Utility scripts
```

---

## Technology Stack

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js 20.x | Runtime environment |
| Express.js | HTTP server framework |
| TypeScript | Type-safe development |
| PostgreSQL 14+ | Primary database |
| Drizzle ORM | Database ORM and migrations |
| Redis | Caching, sessions, job queues, realtime |
| BullMQ | Background job processing |
| Passport.js | Authentication |
| Pino | Structured logging |
| Helmet | Security headers |

### Frontend (Web)
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type-safe development |
| Vite | Build tool and dev server |
| TanStack Query | Server state management |
| Tailwind CSS | Styling |
| shadcn/ui | UI component library |
| Wouter | Routing |
| Framer Motion | Animations |

### Mobile (Native Android)
| Technology | Purpose |
|------------|---------|
| Kotlin | Primary language |
| Jetpack Compose | Modern UI toolkit |
| Material 3 | Design system |
| Retrofit + OkHttp | Networking |
| Room Database | Local storage |
| Hilt | Dependency injection |
| Firebase | Phone auth & push notifications |

---

## Features

### For Customers
- 🛒 Browse and order products from local shops
- 📅 Book services from verified providers
- 🛍️ Cart and wishlist management
- 📦 Order tracking with realtime updates
- 💳 Multiple payment methods (UPI, Cash, Pay-Later)
- ⭐ Reviews for products and services
- 🔔 Push notifications for order/booking updates
- 📍 Location-based filtering

### For Shop Owners
- 📊 Dashboard with sales analytics
- 📦 Product inventory management
- 📋 Order processing (Kanban-style board)
- 👥 Worker sub-accounts with permissions
- 🏷️ Promotions and discount codes
- 📝 Text-based orders (Open Order mode)
- 🔄 Return/refund handling
- 💸 Pay-later customer whitelist

### For Service Providers
- 📅 Service and booking management
- 🕐 Availability scheduling and time blocking
- 📍 Service location options (customer or provider location)
- ⭐ Review management
- 💰 Earnings tracking
- 🔔 Realtime booking notifications

### For Workers
- 🔐 Scoped access based on permissions
- 📱 Mobile-friendly interface
- 📦 Order and inventory management
- 📊 Analytics view (if permitted)

### For Admins
- 📊 Platform monitoring dashboard
- 👥 User management (suspend/verify/delete)
- 📋 Order and booking oversight
- 🔐 Role-based access control
- 📝 Audit logs
- ⚙️ Platform settings

---

## Authentication

### Flows Supported

| Flow | Endpoint | Use Case |
|------|----------|----------|
| Standard Login | `POST /api/login` | Email/username + password |
| Rural PIN Auth | `POST /api/auth/login-pin` | Phone + 4-digit PIN |
| Worker Login | `POST /api/auth/worker-login` | 10-digit worker number + PIN |
| Admin Login | `POST /api/admin/login` | Admin console access |

### CSRF Protection
All non-GET requests require CSRF token:
```bash
# Get token
curl http://localhost:5000/api/csrf-token

# Use in requests
curl -H "x-csrf-token: <token>" -X POST ...
```

---

## Running the Application

### Development

```bash
# Start backend (port 5000)
npm run dev:server

# Start frontend (port 5173) in another terminal
npm run dev:client
```

### Available URLs

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Web application |
| http://localhost:5173/admin/login | Admin console |
| http://localhost:5173/worker-login | Worker login |
| http://localhost:5000/api | API endpoints |
| http://localhost:5000/api/docs | Swagger UI |
| http://localhost:5000/api/health | Liveness check |
| http://localhost:5000/api/health/ready | Readiness check (DB + Redis + BullMQ) |

### LAN / Device Testing

```bash
# 1. Find your LAN IP
ifconfig | grep "inet "  # macOS/Linux

# 2. Update .env
HOST=0.0.0.0
DEV_SERVER_HOST=<your-lan-ip>
FRONTEND_URL=http://<your-lan-ip>:5173
APP_BASE_URL=http://<your-lan-ip>:5000
ALLOWED_ORIGINS=http://<your-lan-ip>:5173

# 3. Restart servers
```

---

## Environment Variables

### Required
```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
SESSION_SECRET=ChangeMeToAStrongSecret
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=ChangeMeToAStrongPassword
VITE_API_URL=http://localhost:5000
```

### Optional
| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | - | Redis connection (required in production) |
| `DATABASE_REPLICA_URL` | - | Read replica for query offloading |
| `SESSION_STORE` | postgres | Session store: `redis` or `postgres` |
| `LOG_LEVEL` | info | Logging level |
| `DISABLE_RATE_LIMITERS` | false | Disable for load testing |

See `.env_example` and `docs/environment-reference.md` for the full list.

---

## API Documentation

### Public Endpoints (No Auth)
```bash
# Liveness check
curl http://localhost:5000/api/health

# Readiness check
curl http://localhost:5000/api/health/ready

# Browse products
curl http://localhost:5000/api/products

# Browse services
curl http://localhost:5000/api/services

# Browse shops
curl http://localhost:5000/api/shops

# Global search
curl "http://localhost:5000/api/search/global?q=phone"
```

### OpenAPI/Swagger
Visit http://localhost:5000/api/docs for interactive API documentation.

---

## Mobile Apps

### Native Android App

Located in `doorstep-android/`, built with:
- **Kotlin** + **Jetpack Compose**
- **MVVM** + Clean Architecture
- **Firebase** Phone Auth and Push Notifications
- **Room** Database for offline caching

```bash
cd doorstep-android

# Build debug APK
./gradlew assembleDebug

# Install on device
./gradlew installDebug
```

**API Endpoints:**
- Production: `https://doorsteptn.in`
- Development: `http://10.0.2.2:5000` (Android emulator)

### Push Notifications

Firebase Cloud Messaging (FCM) is configured for:
- Order status updates
- Booking confirmations
- Low stock alerts
- Payment reminders

Configure in `.env`:
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
FIREBASE_SERVICE_ACCOUNT_JSON=...
```

---

## Background Jobs

Using BullMQ with Redis:

| Job | Schedule | Description |
|-----|----------|-------------|
| Booking Expiration | Hourly | Expires stale pending bookings |
| Payment Reminders | Daily | Nudges unpaid orders/bookings |
| Low Stock Digest | Daily | Alerts shop owners about low inventory |

Configure schedules in `.env`:
```env
BOOKING_EXPIRATION_CRON=0 * * * *
PAYMENT_REMINDER_CRON=0 9 * * *
LOW_STOCK_DIGEST_CRON=0 8 * * *
CRON_TZ=Asia/Kolkata
```

---

## Production Deployment

### Build

```bash
npm run build
```

### Deploy with PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

PM2 production settings for graceful shutdown/readiness are already included in
`ecosystem.config.js` (`kill_timeout`, `listen_timeout`, restart backoff, and readiness/shutdown env defaults).

### Required Production Config

```env
NODE_ENV=production
DATABASE_URL=<production-postgres-url>
REDIS_URL=<production-redis-url>
SESSION_SECRET=<strong-random-secret>
FRONTEND_URL=https://yourdomain.com
APP_BASE_URL=https://api.yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
```

See `docs/deployment-runbook.md` for the full checklist.
Systemd and Kubernetes probe templates are available under `deploy/systemd/` and `deploy/k8s/`.

---

## Testing

```bash
# Type check
npm run check

# Run tests
npm run test

# Run with coverage
npm run test:coverage

# Generate test report
npm run test:report
```

### Load Testing

```bash
# Install k6
brew install k6  # macOS

# Run load test
k6 run load-test.js
```

---

## Additional Documentation

| Document | Description |
|----------|-------------|
| [`DOCUMENTATION.md`](DOCUMENTATION.md) | Detailed project documentation |
| [`COMPREHENSIVE_DOCUMENTATION.md`](COMPREHENSIVE_DOCUMENTATION.md) | Complete technical reference |
| [`docs/environment-reference.md`](docs/environment-reference.md) | All environment variables |
| [`docs/api-quickstart.md`](docs/api-quickstart.md) | cURL examples for API testing |
| [`docs/role-endpoint-matrix.md`](docs/role-endpoint-matrix.md) | Role-based endpoint access |
| [`docs/deployment-runbook.md`](docs/deployment-runbook.md) | Production deployment guide |
| [`docs/mobile-and-cloud-setup.md`](docs/mobile-and-cloud-setup.md) | Android and Firebase setup |
| [`docs/remote-access.md`](docs/remote-access.md) | LAN and public access options |
| [`doorstep-android/README.md`](doorstep-android/README.md) | Native Android app guide |

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev:server` | Start backend development server |
| `npm run dev:client` | Start frontend development server |
| `npm run build` | Build for production |
| `npm run start` | Run production server |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:migrate:baseline` | Baseline existing schema |
| `npm run check` | TypeScript type check |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run test` | Run test suite |
| `npm run test:coverage` | Run tests with coverage |
| `npm run monitor` | Poll health endpoint |

---

## License

MIT
