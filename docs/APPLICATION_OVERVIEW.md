# DoorStep TN — Application Overview

## 1. What is DoorStep TN?

**DoorStep TN** (DoorStep Tamil Nadu) is a comprehensive, hyperlocal e-commerce and service booking platform purpose-built for **rural and semi-urban Tamil Nadu**. It is one of India's first platforms to simultaneously tackle local product delivery *and* home-service booking for underserved communities, available as a **React web application**, a **native Android app** (Kotlin/Jetpack Compose), and a full-featured **admin panel**.

The platform enables three core commerce interactions:

| Interaction | Example |
|-------------|---------|
| **Shop → Customer** | Kumar's Grocery delivers rice and soap to Karur village within 10 km |
| **Service Provider → Customer** | A certified plumber in Tiruppur accepts bookings, travels to homes, and collects UPI payment |
| **Platform → All Users** | Anyone can discover nearby shops, compare service providers, read reviews, and place orders — all in Tamil or English |

DoorStep TN is available as:
- **Web App** — React 18 + TypeScript PWA
- **Android App** — Kotlin + Jetpack Compose, Material 3
- **Admin Panel** — Embedded React admin dashboard at `/admin`

---

## 2. The Problem It Solves

### Digital Exclusion in Rural India

Rural Tamil Nadu represents **37+ million people** across districts like Erode, Karur, Salem, Tiruppur, Dharmapuri, and Namakkal who have been systematically excluded from digital commerce for six key reasons:

| Challenge | Details |
|-----------|---------|
| **Language barriers** | Urban platforms are English-first; Tamil speakers face friction at every step |
| **Literacy gaps** | Complex registration flows and password requirements exclude older users and first-time smartphone users |
| **SMS/OTP cost drain** | Prepaid mobile users pay ₹0.25–₹1.00 per OTP — adding up to real money for frequent logins |
| **Connectivity constraints** | Heavy JavaScript SPAs fail on 2G/3G networks common in rural areas |
| **No local delivery** | Amazon, Flipkart, and Meesho don't serve thousands of rural pin codes in Tamil Nadu |
| **Service opacity** | No trusted, reviewable platform to find and hire local electricians, plumbers, tutors, or beauticians |
| **Cash-dominant economy** | Most rural transactions are cash or direct UPI; payment gateway fees are a dealbreaker for small shops |

### What Existing Platforms Miss

| Challenge | Amazon / Flipkart | Urban Company | WhatsApp Ordering | DoorStep TN |
|-----------|------------------|---------------|-------------------|-------------|
| Rural pin code delivery | ❌ Limited/none | ❌ No | ❌ No | ✅ Local shops deliver |
| Service booking | ❌ No | ✅ Metro only | ❌ No | ✅ Full booking system |
| PIN login (no recurring SMS) | ❌ No | ❌ No | ❌ N/A | ✅ PIN after initial OTP |
| Offline-friendly app | ❌ Heavy | ❌ Heavy | ⚠️ Partial | ✅ Native Android |
| Cash / direct UPI payments | ❌ Gateway only | ❌ Gateway only | ⚠️ Unstructured | ✅ Cash, UPI, Pay Later |
| Tamil language support | ⚠️ Partial | ❌ No | ❌ No | ✅ Full Tamil UI |
| Worker sub-accounts for shops | ❌ No | ❌ No | ❌ No | ✅ Scoped permissions |
| Open text ordering | ❌ No | ❌ No | ⚠️ Unstructured | ✅ Structured text orders |
| Review & dispute system | ✅ Amazon-only | ✅ | ❌ No | ✅ |
| Zero commission for shops | ❌ 5–15% | ❌ 20–30% | ✅ | ✅ 0% commission |

---

## 3. Key Features & Unique Selling Propositions (USPs)

### 🔐 Rural-First Authentication

The biggest innovation: **returning users never need OTP again**.

- **Phone + 4-Digit PIN** login for returning users — eliminates recurring SMS charges (~₹0.25–₹1.00/OTP)
- Firebase OTP used **only** on first registration or PIN reset (one-time cost)
- Username/password login also supported for power users
- **Worker sub-accounts**: employees log in with a 10-digit worker number + PIN; no email required
- OTP-based forgot-PIN flow for account recovery

### 🛒 Flexible Shopping Modes

Recognising that not all rural shops operate the same way:

- **Standard Catalog Mode** — browse products with images, prices, and stock; add to cart and order
- **Catalog Mode** — display products without stock tracking; browse-only (useful for shops that prefer phone orders for fulfilment)
- **Open Order Mode** — customers type what they need in plain text ("1 kg rice, 2 soaps, 1 toothpaste"); shop quotes a price and delivers
- **Pay Later** — trusted/known customers can defer payment (configurable per shop, per customer whitelist)

### 📍 Hyperlocal Discovery

- **GPS-based nearby search** using the Haversine formula (accurate great-circle distance)
- **City/state/pin code filtering** for services and shops
- **Service location flexibility**: provider travels to customer, or customer visits provider — both flows fully supported
- **Proximity-aware booking queue**: providers see distance between pending bookings, helping them route efficiently

### 📅 Smart Service Booking

- **Time slot management**: Morning/Afternoon/Evening slots with blocked-time support
- **Working hours per day-of-week** configurable per service
- **Recurring blocked slots** (e.g., every Sunday)
- **Duplicate booking prevention**: platform blocks double-booking the same provider/slot
- **Booking status tracking**: `pending → accepted → en_route → awaiting_payment → completed`
- **Dispute resolution**: admin-mediated conflict resolution when payment is disputed

### 💰 Payments Designed for Rural India

- **Cash on delivery/at service** — no payment gateway setup required for shops
- **Direct UPI**: customer pays directly to provider's/shop's UPI ID; no intermediary
- **Payment reference tracking**: customer submits UPI reference; provider/shop confirms
- **Pay Later**: shop-specific trusted-customer deferred payment, tracked by the platform
- **Zero Razorpay/Stripe dependency** — no payment gateway commissions for shops

### 👥 Worker Sub-Accounts

Shops employ cashiers, delivery boys, and managers — all can use the same platform with their own login:

- Shop owners create worker accounts for employees (scoped, fine-grained permissions)
- **10 granular responsibilities**: `products:read/write`, `inventory:adjust`, `orders:read/update`, `returns:manage`, `promotions:manage`, `customers:message`, `bookings:manage`, `analytics:view`
- Worker login via 10-digit number + PIN — no email or smartphone-savvy required
- Workers cannot access sensitive owner data (bank details, UPI, full revenue)

### ⚡ Realtime Updates

- **Server-Sent Events (SSE)** — persistent connection to the server for live updates without polling
- **TanStack Query cache invalidation via SSE** — instant UI refresh when data changes
- **Firebase Cloud Messaging (FCM)** — push notifications on Android even when app is closed
- Instant: order status changes, booking confirmations/rejections, low-stock alerts, payment reminders

### 🎫 Promotions & Discounts

- Percentage or fixed-amount discounts
- Product inclusion and exclusion rules
- Date windows, minimum purchase thresholds, usage limits
- Promo code validation and redemption tracked platform-side
- Customer-facing active-promotion discovery per shop

### 🛡️ Security Architecture

- **CSRF protection** on all state-changing requests
- **Rate limiting** on authentication and sensitive endpoints
- **bcrypt/scrypt password hashing** for all PINs and passwords
- **Redis-backed session store** for performance and reliability
- **User suspension** system — immediately blocks all API access for a suspended user
- **Admin audit logging** — every admin action is recorded with timestamp and actor

---

## 4. User Roles

| Role | Who | Capabilities |
|------|-----|-------------|
| **Customer** | Buyers across rural/urban areas | Browse shops/services, place product orders, create text orders, book services, submit payment, write reviews, join waitlists, request returns |
| **Shop** | Local store owners (groceries, electronics, clothing, etc.) | List products, manage orders, create promotions, manage workers, handle returns, configure pay-later, set delivery areas |
| **Provider** | Service professionals (plumbers, electricians, tutors, beauticians, etc.) | List services, accept/reject/reschedule bookings, manage time slots, track location, reply to reviews |
| **Worker** | Shop employees (cashiers, delivery staff, inventory managers) | Scoped access to shop functions based on assigned `responsibilities`; cannot access sensitive owner data |
| **Admin** | Platform administrators | User management, order/booking oversight, dispute resolution, system health monitoring, role-based admin access control |

---

## 5. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend Web** | React 18, TypeScript, TanStack Query, Wouter, Radix UI, Tailwind CSS | Web application SPA with modern component library |
| **Backend** | Node.js, Express.js, TypeScript | REST API server (~8,000+ LOC) |
| **Database** | PostgreSQL with primary/replica topology | Persistent data storage with read scaling |
| **ORM** | Drizzle ORM + Zod validation | Type-safe DB queries with schema-driven validation |
| **Caching** | Redis | Session store, API response cache, real-time invalidation pub/sub |
| **Job Queue** | BullMQ (via Redis) | Booking expiry jobs, payment reminder scheduling |
| **Push Notifications** | Firebase Cloud Messaging (FCM) | Android push notifications |
| **Phone Verification** | Firebase Admin SDK OTP | Phone number verification for rural registration |
| **Android App** | Kotlin, Jetpack Compose, Material 3 | Native Android application |
| **Bundler** | Vite | Fast frontend build tooling |
| **Logging** | Pino | Structured JSON logging with log levels and categories |
| **SSE Transport** | Native Node.js HTTP | Server-Sent Events for realtime updates |

---

## 6. Advantages Over Competitors

### vs. Amazon / Flipkart

| Dimension | Amazon/Flipkart | DoorStep TN |
|-----------|----------------|-------------|
| Rural delivery | ❌ Not available in many TN villages | ✅ Local shops deliver within 10–20 km |
| Commission | 5–15% per sale | 0% — shops keep 100% |
| Service booking | ❌ Not available | ✅ Full booking system |
| Payment options | Gateway only | Cash, direct UPI, pay-later |
| Tamil support | ⚠️ Partial | ✅ Full |
| Registration barrier | Email + password required | Phone + PIN (no email needed) |

### vs. Urban Company / UrbanClap

| Dimension | Urban Company | DoorStep TN |
|-----------|--------------|-------------|
| Geography | Tier-1 cities only | Rural Tamil Nadu focus |
| Authentication | OTP every login | PIN after first OTP |
| Product shopping | ❌ Services only | ✅ Products + services |
| Commission | 20–30% of service fee | 0% |
| Open text ordering | ❌ No | ✅ Yes |
| Payment gateway | Mandatory | Optional (cash/UPI supported) |

### vs. WhatsApp-Based Ordering

WhatsApp groups are the current "technology" for most rural shop orders. DoorStep TN replaces chaos with structure:

- **Structured orders** with tracking, status updates, and cancellation policies — vs. untracked chat messages
- **Service booking** with conflict detection and time management
- **Review system** for trust and accountability across providers
- **Admin oversight** and a formal dispute resolution process
- **Inventory management** and automated low-stock alerts
- **Promotions** with usage tracking and validation

### vs. Dunzo / Swiggy Instamart / Zepto

These "quick commerce" platforms focus on urban 10–30 minute delivery from dark stores:
- DoorStep TN serves **existing local shops** — no dark-store capital investment
- Works with **cash and UPI** — no payment gateway mandate
- Covers **service providers** in addition to products
- Serves areas where Dunzo/Zepto have **no coverage**

---

## 7. Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                          Clients                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  React Web   │  │ Android App  │  │    Admin Panel       │ │
│  │  (SPA/PWA)   │  │ (Kotlin/     │  │  (React, embedded)   │ │
│  │              │  │  Compose)    │  │                      │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────────┘ │
└─────────┼─────────────────┼─────────────────┼────────────────-┘
          │  HTTPS + Cookie │                  │
          ▼                 ▼                  ▼
┌───────────────────────────────────────────────────────────────┐
│                   Express.js API Server (Node.js)             │
│                        (~166 endpoints)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │   Auth   │ │  Routes  │ │  Admin   │ │ Worker/Promotions │ │
│  │  Module  │ │ (routes  │ │  Router  │ │    Routers        │ │
│  │(auth.ts) │ │ .ts)     │ │(admin.ts)│ │ (workers.ts,      │ │
│  │          │ │          │ │          │ │  promotions.ts)   │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
│                        │                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Storage Layer (Drizzle ORM)                 │  │
│  │              (pg-storage.ts — ~4,000 LOC)               │  │
│  └─────────────────────┬───────────────────────────────────┘  │
└────────────────────────┼──────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │    Redis     │  │    BullMQ    │
│  Primary +   │  │  Cache +     │  │  Job Queue   │
│  Replica     │  │  Sessions +  │  │  (Booking    │
│              │  │  Pub/Sub     │  │   expiry,    │
└──────────────┘  └──────────────┘  │  reminders)  │
                                    └──────────────┘
                  ┌──────────────┐  ┌──────────────┐
                  │   Firebase   │  │   Pino       │
                  │ FCM + Admin  │  │  Structured  │
                  │   SDK (OTP)  │  │   Logging    │
                  └──────────────┘  └──────────────┘
```

---

## 8. Database Schema Summary

The platform uses **23+ tables**:

| Table | Purpose |
|-------|---------|
| `users` | All user accounts (customer, shop, provider, worker) with embedded `shopProfile` JSONB |
| `shops` | Dedicated shop profile table (normalized shop data: hours, delivery, catalog mode) |
| `providers` | Provider-specific data: bio, availability, specializations |
| `services` | Service listings with pricing, category, duration, working hours |
| `products` | Product listings with images, stock, MRP, categories, tags |
| `orders` | Product purchase orders with status, payment, and delivery tracking |
| `order_items` | Line items within orders (productId, quantity, price snapshot) |
| `bookings` | Service booking records with status, time slot, and payment reference |
| `reviews` | Service reviews (customer → service, linked to booking) |
| `product_reviews` | Product reviews (customer → product, linked to order) |
| `notifications` | In-app notification records with read status |
| `fcm_tokens` | Firebase Cloud Messaging device tokens per user |
| `promotions` | Discount campaigns with code, type, value, date window, product scope |
| `returns` | Return/refund requests with approval workflow |
| `blocked_time_slots` | Provider-defined unavailable time ranges (with recurring support) |
| `shop_workers` | Worker-to-shop assignments with scoped `responsibilities` JSONB |
| `cart_items` | Active shopping cart contents per customer |
| `wishlists` | Customer product wishlists |
| `waitlist` | Service waitlist registrations per customer |
| `admin_users` | Admin accounts (separate auth system from platform users) |
| `admin_roles` | Admin role definitions (e.g., "Super Admin", "Support") |
| `admin_permissions` | Granular permission definitions (e.g., `manage_users`, `view_health`) |
| `admin_role_permissions` | Many-to-many: role → permission mappings |
| `admin_audit_logs` | Immutable admin action audit trail with actor, action, timestamp |

---

## 9. Deployment & Infrastructure

- **Process Manager**: PM2 (`ecosystem.config.js`) for Node.js cluster mode
- **Database**: PostgreSQL with primary + replica topology for read scaling
- **Session Store**: Redis (production) / in-memory (development)
- **CDN**: Static assets served via Vite build + Express static middleware
- **Environment**: `.env` configures DB URLs, Redis, Firebase credentials, session secrets
- **Migrations**: Drizzle Kit-managed SQL migrations under `migrations/`
- **CI/CD**: GitHub Actions (`.github/`)
- **Load Testing**: k6-compatible `load-test.js` and `load-test-benchmark.js` scripts, plus `npm run load:regression` helper for p95/p99/failure assertions
- **Security Checks**: `npm run security:checklist` generates a pass/fail security matrix in `output/security/`

---

## 10. Coverage Confirmation

This overview covers all requested dimensions:

- What the application is (`Section 1`)
- What problem it solves (`Section 2`)
- How it is different from similar apps (`Sections 3 and 6`)
- Advantages compared to alternatives (`Section 6`, with competitor comparisons)

Related deep-dive and API references:

- `docs/API_ENDPOINTS_REFERENCE.md` (complete endpoint guide)
- `docs/api-endpoints-reference.md` (code-verified endpoint matrix with source mapping)
- `docs/application-strategy-analysis.md` (long-form product and strategy analysis)

---

*DoorStep TN — Bringing digital commerce to every doorstep in Tamil Nadu.*

*Version 2.0 · February 2026*
