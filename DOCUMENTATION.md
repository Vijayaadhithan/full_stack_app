# DoorStep Project Documentation

This document provides a detailed overview of the DoorStep project, including its backend, frontend, database schema, storage mechanisms, and potential for future expansion.

## 1. Project Overview

DoorStep is a platform designed to connect service providers and shops with customers in India. It facilitates booking services, purchasing products, managing profiles, and handling payments.

## 2. Setup and Installation

This section guides you through setting up the project environment.

### 2.1. Prerequisites

- Node.js (v18 or later recommended)
- npm (usually comes with Node.js)
- PostgreSQL (v14 or later recommended)
- Git

### 2.2. PostgreSQL Setup

1.  **Install PostgreSQL:**
    - **macOS (using Homebrew):** `brew install postgresql`
    - **Ubuntu/Debian:** `sudo apt update && sudo apt install postgresql postgresql-contrib`
    - **Windows:** Download the installer from the [official PostgreSQL website](https://www.postgresql.org/download/windows/).
    - Ensure the PostgreSQL server is running after installation.

2.  **Create Database and User:**
    Connect to PostgreSQL using `psql` or a GUI tool (like pgAdmin).

    ```sql
    -- Create a dedicated user (replace 'your_password' with a strong password)
    CREATE USER indianbudget_user WITH PASSWORD 'your_password';

    -- Create the database
    CREATE DATABASE indianbudget_db OWNER indianbudget_user;

    -- Grant privileges to the user
    GRANT ALL PRIVILEGES ON DATABASE indianbudget_db TO indianbudget_user;
    ```

### 2.3. Project Setup

1.  **Clone the Repository:**

    ```bash
    git clone <repository_url>
    cd DoorStep
    ```

2.  **Install Dependencies:**

    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    - Copy the example environment file (if one exists, e.g., `.env.example`) to `.env`.
    - Update the `.env` file in the `/server` directory with your database credentials:
      ```
      DATABASE_URL="postgresql://indianbudget_user:your_password@localhost:5432/indianbudget_db"
      # Add other necessary variables like SESSION_SECRET, RAZORPAY_KEY_ID, etc.
      ```

4.  **Run Database Migrations:**
    The project uses Drizzle ORM. Apply the migrations to set up the database schema:

    ```bash
    npm run db:migrate
    ```

    When you modify the schema, generate a new SQL migration first:

    ```bash
    npm run db:generate
    ```

    Review the generated file in `migrations/` and then apply it with `npm run db:migrate`.

    If your database already has the production schema (for example, you previously relied on `drizzle-kit push`), run the baseline script once to record the current state before applying new migrations:

    ```bash
    npm run db:migrate:baseline
    ```

5.  **Start the Application:**
    - **Development Mode (Client + Server with Hot Reloading):**
      ```bash
      npm run dev:server
      # in another terminal
      npm run dev:client
      ```
    - **Production Build (Separate Steps):**
      ```bash
      # Build client
      cd client && npm run build
      cd ..
      # Start server
      cd server && npm start # Or node index.js
      ```

## 3. Backend

### 2.1. Technology Stack

- **Framework:** Node.js with Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Authentication:** Passport.js (Local Strategy) with express-session
- **File Uploads:** Multer
- **Environment Variables:** `dotenv`

### 2.2. Project Structure (`/server`)

- `index.ts`: Main entry point for the server. Sets up Express, CORS, JSON parsing, file uploads (Multer), static file serving, scheduled tasks (booking expiration), Vite integration (for development), and error handling.
- `routes.ts`: Defines all API endpoints. Organizes routes for users, services, bookings, products, orders, reviews, notifications, returns, promotions, and file uploads. It coordinates with various services, including those in the `services/` directory.
- `routes/`: Contains modular route handlers (e.g., `promotions.ts`, `shops.ts`).
- `db.ts`: Configures the PostgreSQL database connection using `postgres` and initializes Drizzle ORM.
- `auth.ts`: Sets up Passport.js for authentication, including local strategy, password hashing (scrypt), session management, and login/register/logout routes.
- `storage.ts`: Acts as a data access layer, abstracting database operations using Drizzle ORM. Contains functions to interact with various tables (users, services, bookings, etc.).
- `vite.ts`: Handles integration with Vite for development mode.
- `ist-utils.ts`: Provides utility functions for handling Indian Standard Time (IST). This includes converting JavaScript dates to IST strings for database storage, getting the current date and time in IST, converting database timestamp strings back to IST Date objects, calculating expiration dates in IST, and converting arrays of dates to IST. These functions are crucial for ensuring consistent date and time handling across server operations, especially for features like booking expirations and logging.
- `pg-storage.ts`: Implements the `IStorage` interface using PostgreSQL as the backend, managed with Drizzle ORM. It handles various data operations such as fetching users by email or Google ID, deleting users and their associated data (services, bookings, products, orders, reviews, notifications), updating product reviews, and processing refunds. It leverages utility functions from `ist-utils.ts` for correct IST date handling in database interactions. It is also used by `connect-pg-simple` for session storage.
- `services/`: Contains business logic services that are used by the routes.

### 2.3. Key Features & API Endpoints

- **Authentication & Password Reset:**
  - `POST /api/register`: User registration.
  - `POST /api/login`: User login.
  - `POST /api/logout`: User logout.
  - `GET /api/user`: Get current authenticated user details.
  - `POST /api/forgot-password`: Initiates the password reset process by sending a reset link/token to the user's email.
  - `POST /api/reset-password`: Allows users to set a new password using a valid reset token.
- **Users:**
  - `GET /api/users/:id`: Get user details.
  - `PATCH /api/users/:id`: Update user details (including profile, shop profile, address).
- **Services (Providers):**
  - `POST /api/services`: Create a new service.
  - `GET /api/services`: Get list of services (potentially with filtering).
  - `GET /api/services/:id`: Get details of a specific service.
  - `PATCH /api/services/:id`: Update a service.
  - `DELETE /api/services/:id`: Delete a service (soft delete).
  - `GET /api/services/provider`: Get services listed by the current provider.
  - `POST /api/services/:id/block-time`: Block a time slot for a service.
  - `GET /api/services/:id/blocked-slots`: Get blocked time slots for a service.
  - `DELETE /api/services/:serviceId/blocked-slots/:slotId`: Unblock a time slot.
- **Bookings:**
  - `POST /api/bookings`: Create a new booking request.
  - `GET /api/bookings/provider/pending`: Get pending booking requests for a provider.
  - `GET /api/bookings/customer/requests`: Get booking requests made by a customer.
  - `GET /api/bookings/provider/history`: Get booking history for a provider.
  - `GET /api/bookings/customer/history`: Get booking history for a customer.
  - `GET /api/bookings/:id`: Get details of a specific booking.
  - `PATCH /api/bookings/:id`: Update booking status (accept, reject, cancel, etc.).
- **Products (Shops):**
  - `POST /api/products`: Create a new product.
  - `GET /api/products`: Get list of products.
  - `GET /api/products/:id`: Get details of a specific product.
  - `PATCH /api/products/:id`: Update a product.
  - `DELETE /api/products/:id`: Delete a product (soft delete).
  - `GET /api/products/shop`: Get products listed by the current shop.
- **Orders (Shops):**
  - `POST /api/orders`: Create a new order.
  - `GET /api/orders/shop`: Get orders received by the current shop.
  - `GET /api/orders/customer`: Get orders placed by the current customer.
  - `GET /api/orders/:id`: Get details of a specific order.
  - `PATCH /api/orders/:id`: Update order status.
- **Reviews:**
  - `POST /api/reviews`: Submit a review for a service.
  - `POST /api/products/:productId/reviews`: Submit a review for a product.
  - `GET /api/services/:id/reviews`: Get reviews for a service.
  - `GET /api/products/:id/reviews`: Get reviews for a product.
- **Notifications:**
  - `GET /api/notifications`: Get notifications for the current user.
  - `PATCH /api/notifications/:id/read`: Mark a notification as read.
- **File Uploads:**
  - `POST /api/upload`: Upload a file (e.g., profile picture, product image).
  - `/uploads/*`: Serves uploaded files statically.
- **Promotions (Shops):** (Managed via `routes/promotions.ts`)
  - Endpoints for creating, managing, and applying promotions.
- **Shop Management:** (Managed via `routes/shops.ts`)
  - Endpoints for managing shop profiles and related data.

### 2.4. Scheduled Tasks

- **Booking Expiration:** A task runs periodically (every 24 hours and at startup) to check for pending booking requests that have passed their `expiresAt` timestamp and updates their status to `expired`.

## 3. Frontend

### 3.1. Technology Stack

- **Framework:** React
- **Language:** TypeScript
- **Build Tool:** Vite
- **Routing:** Wouter
- **UI Library:** shadcn/ui (includes Radix UI primitives and Tailwind CSS)
- **State Management/Data Fetching:** React Query (`@tanstack/react-query`)
- **Forms:** React Hook Form (`react-hook-form`) with Zod for validation (`@hookform/resolvers/zod`)
- **Date Handling:** `date-fns`, `date-fns-tz`
- **Styling:** Tailwind CSS
- **Animation:** Framer Motion

### 3.2. Project Structure (`/client`)

- `index.html`: Main HTML entry point.
- `src/`: Contains the main source code.
  - `main.tsx`: Initializes the React application, sets up React Query, Auth context, Language context, and renders the main `App` component.
  - `App.tsx`: Defines the main application structure and routing using Wouter.
  - `components/`: Reusable UI components (e.g., `layout/`, `ui/`, `service-availability-calendar.tsx`).
  - `contexts/`: React contexts (e.g., `auth-context.tsx`, `language-context.tsx`).
  - `hooks/`: Custom React hooks (e.g., `use-auth.ts`, `use-toast.ts`).
  - `lib/`: Utility functions and libraries (e.g., `queryClient.ts` for API requests, `utils.ts`).
  - `pages/`: Page components corresponding to different routes (e.g., `auth/`, `customer/`, `provider/`, `shop/`).
- `public/`: Static assets.
- `tailwind.config.js`, `postcss.config.js`: Configuration for Tailwind CSS.
- `vite.config.ts`: Configuration for Vite.

### 3.3. Key Features & UI Structure

- **Authentication:** Login, Registration pages.
- **Dashboard Layout:** A common layout (`DashboardLayout`) for authenticated users, likely including navigation.
- **Customer Pages:**
  - Booking services (`book-service.tsx`): Displays service details, allows selecting date/time using a calendar and time slots, handles booking creation and payment initiation.
  - Viewing booking history.
  - Managing profile.
  - Browsing products/shops.
  - Placing orders.
  - Viewing order history.
- **Provider Pages:**
  - Dashboard (`dashboard.tsx`): Overview of pending bookings, recent activity, service management links.
  - Managing services (create, edit, view).
  - Viewing booking requests and history.
  - Managing availability (working hours, breaks, blocked slots via `ServiceAvailabilityCalendar`).
  - Managing profile.
- **Shop Pages:**
  - Dashboard: Overview of orders, products, reviews.
  - Managing products (create, edit, view).
  - Managing orders.
  - Managing profile (`profile.tsx`): Editing shop details, bank info, working hours, policies, address.
- **Shared Components:** Calendar, Dialogs, Forms, Buttons, Cards, Badges, etc. (leveraging shadcn/ui).

## 4. Shared Code (`/shared`)

- `schema.ts`: Defines the database table structures using Drizzle ORM (`pgTable`) and generates Zod schemas (`createInsertSchema`) for data validation on both frontend and backend. Includes types for `UserRole`, `PaymentMethod`, `ShopProfile`, `WorkingHours`, `BreakTime`, etc.
- `date-utils.ts`: Utility functions for handling dates, likely focusing on formatting for Indian display (`formatIndianDisplay`) and potentially timezone conversions.
- `updateProductSchema.ts`: Defines a Zod schema (`updateProductSchema`) for validating partial updates to product information. It ensures that at least one field is provided when updating a product, preventing empty update requests.

## 5. Database Schema

Defined in `/shared/schema.ts` using Drizzle ORM. Key tables include:

- `users`: Stores user information (customers, providers, shops, admins), including profile details, address, roles, and potentially shop/provider-specific fields.
- `services`: Details about services offered by providers, including pricing, duration, availability settings (working hours, breaks, buffer time, max bookings), location type, and soft deletion flag.
- `bookings`: Records booking requests, linking customers and services, storing date/time, status, payment details, expiration time, and location.
- `booking_history`: Tracks changes in booking statuses.
- `products`: Information about products sold by shops, including pricing, stock, category, images, specifications, and soft deletion flag.
- `orders`: Records customer orders from shops, including status, total amount, shipping details, payment info, and return status.
- `order_items`: Line items for each order.
- `reviews`: Customer reviews for services.
- `product_reviews`: Customer reviews for products.
- `promotions`: Discount codes and promotions offered by shops.
- `notifications`: System/user notifications related to bookings, orders, etc.
- `returns`: Tracks product return requests.
- `blocked_time_slots`: Records specific time slots blocked by providers for their services.
- `sessions`: Stores user session data for authentication.
- (Other tables like `cart`, `wishlist`, `waitlist`, `service_availability` might exist or be planned).

## 6. Storage

- **Database:** PostgreSQL is the primary data store, managed via Drizzle ORM.
- **Session Storage:** User sessions are stored in the PostgreSQL database (`sessions` table). This is managed using `connect-pg-simple` which integrates with Express sessions, and the `PostgresStorage` class (defined in `pg-storage.ts`) provides the underlying store mechanism.
- **File Storage:** Uploaded files (images, etc.) are stored on the server's local filesystem in the `/uploads` directory (configured via Multer in `server/index.ts`).

## 8. Android Expansion Strategy

The existing RESTful API provides a solid foundation for developing a native Android application.

### 8.1. API Consumption

1.  **API Client:** Use a robust networking library like **Retrofit** (recommended) or Volley to handle API requests and responses efficiently. Define interfaces for API endpoints based on the backend routes.
2.  **Data Models:** Create Kotlin/Java data classes (POJOs/POKOs) that mirror the JSON structures returned by the API. Libraries like Gson or Moshi can be used with Retrofit for automatic JSON parsing.
3.  **Authentication:**
    - **Recommendation:** Implement **JWT (JSON Web Tokens)** on the backend (`server/auth.ts`) as a more standard approach for mobile APIs compared to session cookies. The flow would be:
      - App sends credentials to `POST /api/login`.
      - Server validates and returns a JWT.
      - App securely stores the JWT (e.g., using Android's EncryptedSharedPreferences).
      - App includes the JWT in the `Authorization: Bearer <token>` header for subsequent requests.
      - Implement token refresh logic.
    - **Alternative (Session Cookies):** If sticking with sessions, the app needs to manage the session cookie received from the login response and include it in all subsequent requests. This can be more complex to manage securely on mobile.
4.  **API Stability & Versioning:** Ensure backend APIs are stable. Introduce API versioning (e.g., `/api/v1/...`) in `server/routes.ts` to allow backend evolution without breaking the mobile app.

### 8.2. Native Implementation (Kotlin/Java)

1.  **Language:** **Kotlin** is the preferred language for modern Android development due to its conciseness and safety features. Java is also an option.
2.  **Architecture:** Adopt a standard Android architecture pattern like **MVVM (Model-View-ViewModel)** or MVI (Model-View-Intent) using Android Jetpack components (ViewModel, LiveData/StateFlow, Room for local caching if needed).
3.  **UI Development:**
    - **Jetpack Compose:** Recommended for building modern, declarative UIs in Kotlin. It allows for faster development and easier maintenance compared to the traditional XML-based view system.
    - **XML Layouts:** Still a viable option, especially if integrating with existing XML-based codebases.
4.  **Key Feature Implementation:**
    - Replicate core user flows (authentication, browsing, booking, ordering, profile management) using native UI components.
    - Utilize the API client (Retrofit) to fetch and send data to the backend.
    - Implement background tasks for data synchronization or offline support if necessary.
5.  **Push Notifications:**
    - Integrate **Firebase Cloud Messaging (FCM)** into the Android app.
    - Modify the backend to send push notifications via FCM upon relevant events (e.g., new booking, order status change) by interacting with the FCM API, potentially triggered from within the existing notification logic.

### 8.3. Design Consistency

- **Adapt, Don't Just Copy:** While aiming for a consistent brand feel, directly replicating the web UI (shadcn/ui, Tailwind) on Android is often not ideal. Native Android apps have different navigation patterns and UI conventions.
- **Material Design:** Leverage **Material Design 3** components and guidelines, which provide a robust system for building high-quality Android UIs. Adapt Material components to match the project's color scheme, typography, and overall brand identity.
- **Component Mapping:** Identify core UI elements from the web (Cards, Buttons, Forms, Dialogs, Calendar) and find their closest equivalents in Material Design or build custom Compose components that mimic the _style_ and _functionality_ but adhere to Android best practices.
- **Navigation:** Use Android Jetpack's Navigation component for handling screen transitions and back stack management, following standard Android patterns (e.g., bottom navigation bars, drawers).
- **Responsiveness:** Design layouts that adapt to different screen sizes and orientations on Android devices.

By combining the existing API with native Android development best practices and adapting the design thoughtfully, a high-quality and consistent mobile experience can be achieved.

## 9. Database Backup and Restore

Nightly backups of the PostgreSQL database are scheduled by `scripts/provision.sh`. A cron job runs `pg_dump` at 03:00 UTC and
uploads the compressed dump to the object storage bucket specified by the `BACKUP_BUCKET` environment variable.

### Restoring from a Backup

1. Download the desired dump from object storage.
2. Decompress and feed the output into `psql`.

```bash
aws s3 cp s3://<bucket>/db-2024-01-15.sql.gz - | gunzip | psql "$DATABASE_URL"
```

The command recreates the database state captured at the time of the dump.

## 10. Performance & Security Enhancements

### 10.1 Redis Backed Caching
- Set `REDIS_URL` in `.env` (e.g. `redis://localhost:6379`).
- The `server/cache.ts` helper now prioritises Redis and falls back to the in-memory cache if Redis is unreachable.
- Cached collections (services/products by category) automatically hydrate from Redis and respect the configured TTL. Use the exported `invalidateCache` or `flushCache` helpers when adding new high-traffic lookups.

### 10.2 Rate Limiting
- `express-rate-limit` guards login, registration, password resets, Google OAuth flows, and admin login attempts. Limits can be tuned in `server/security/rateLimiters.ts`.
- All sensitive routes emit standard error messages to avoid leaking account existence and use proxy headers from Nginx for accurate per-IP throttling.

### 10.3 Hardened HTTP Headers
- `helmet` is enabled globally in `server/index.ts`. The configuration denies framing, disables legacy Flash/xdomain requests, and enables HSTS automatically when `NODE_ENV=production`.
- Additional headers (CSP, XSS protection) can be layered on per route if you serve mixed frontend assets.

### 10.4 Load Balancing with Nginx
- An example configuration lives in `deploy/nginx-load-balancer.conf` and forwards traffic to multiple Express instances while propagating proxy metadata.
- Place the file in `/etc/nginx/conf.d/` (or equivalent), update upstream server addresses, and reload Nginx: `sudo nginx -t && sudo systemctl reload nginx`.
- When terminating TLS at Nginx, ensure `app.set("trust proxy", 1)` remains set so Express and the rate limiting middleware honour the correct client IP.

### 10.5 Request Context & Correlation IDs
- Every request now executes inside an `AsyncLocalStorage` context (`server/requestContext.ts`) that captures the method, path, user identity, and a generated `x-request-id`.
- Pino log mixins automatically include the current request context so distributed traces can be stitched together without manually passing IDs around.
- Use `runWithRequestContext`/`updateRequestContext` if you need to enrich the context inside background tasks, and read the current metadata via `getRequestMetadata`.

### 10.6 PostgreSQL Read Replicas
- `server/db.ts` accepts an optional `DATABASE_REPLICA_URL`. When present, all `db.select()` calls run against the replica while writes/trans­actions stay on the primary.
- Set `DB_READ_POOL_SIZE` to tune the replica pool size independently from `DB_POOL_SIZE`. Use `DB_SLOW_THRESHOLD_MS` to control when slow queries are promoted to warnings.
- Code that must observe primary writes immediately (bootstrap scripts, consistency-sensitive flows) can wrap logic with `runWithPrimaryReads(() => ...)` to temporarily pin reads to the primary connection.
