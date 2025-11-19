# Indian E-commerce and Service Booking Platform

All-in-one marketplace where customers can shop for products, book service providers, manage orders, and interact with shops or workers in real time. The repository bundles:

- **Customer web app** (React + TanStack Query + Vite)
- **Shop / Provider dashboards** with role-based access control
- **Express/Node API** backed by PostgreSQL & Drizzle ORM
- **Real-time notifications + background jobs** (bookings, orders, returns)

Use this README to get up and running quickly, understand the environment variables, and learn where to find production health information. For mobile and Firebase/Android specifics, see the companion guide: [`docs/mobile-and-cloud-setup.md`](docs/mobile-and-cloud-setup.md).

## Table of contents

1. [Local development setup](#local-development-setup)
2. [Running & testing](#running-the-application)
3. [Observability & troubleshooting](#observability--troubleshooting)
4. [Environment variables](#environment-variables)
5. [Production deployment](#production-deployment)
6. [Role overview](#role-overview)
7. [Useful scripts](#available-scripts)

## Local Development Setup

### Prerequisites

1. Node.js (v20.x or later)

```bash
# On Windows/Mac, download from https://nodejs.org
# On Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. PostgreSQL database

```bash
# On Windows, download from https://www.postgresql.org/download/windows/
# On Mac
brew install postgresql
# On Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib
```

### Environment Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd <project-directory>
```

2. Create and configure your `.env` file:

```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration (see [Environment variables](#environment-variables) for full list):

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
PGDATABASE=dbname
PGHOST=localhost
PGPORT=5432
PGUSER=user
PGPASSWORD=password

# Server Configuration
PORT=5000
NODE_ENV=development
SESSION_SECRET=your-session-secret

```

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

### Running the Application

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

### Checking public catalog endpoints

The core catalog routes (services, products, and shops) are now public, so you can test them without logging in. With the API running on `http://localhost:5000`, run the following from any terminal:

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

The Vite client now lets anonymous visitors open the catalog screens directly. Once both dev servers are running (`npm run dev:server` and `npm run dev:client`), open these URLs in your browser:

- `http://localhost:5173/customer/browse-services`
- `http://localhost:5173/customer/browse-products`
- `http://localhost:5173/customer/browse-shops`
- `http://localhost:5173/customer/shops/<id>` – replace `<id>` with a shop id from `/api/shops`
- `http://localhost:5173/customer/shops/<shopId>/products/<productId>` – ids from the products API
- `http://localhost:5173/customer/service-details/<serviceId>` and `/customer/service-provider/<serviceId>` – ids from `/api/services`

If you browse anonymously, cart/wishlist buttons will still redirect you to sign in because those actions call protected routes, but the read-only data now renders without authentication.

### LAN / Device Testing

1. Discover your machine's LAN IP (e.g. `ipconfig` on Windows or `ifconfig`/`ip addr` on macOS/Linux).
2. Update the following entries in `.env` so mobile devices can resolve your machine:
   - `HOST=0.0.0.0` to bind the API to every interface.
   - `DEV_SERVER_HOST=<your-LAN-ip>` so Vite HMR and Capacitor know where to reach the dev server.
   - `FRONTEND_URL=http://<your-LAN-ip>:5173` and `APP_BASE_URL=http://<your-LAN-ip>:5000` for redirects and cookies.
   - `ALLOWED_ORIGINS=http://<your-LAN-ip>:5173,http://<your-LAN-ip>:5000` so CORS accepts cross-origin requests.
3. (Optional) Set `CAPACITOR_SERVER_URL=http://<your-LAN-ip>:5173` when running `npx cap run android` for on-device hot reload.
4. Restart `npm run dev:server` and `npm run dev:client`. Other devices on the same network can now open `http://<your-LAN-ip>:5173`.
5. When you need to share the app outside your LAN, expose ports 5000 and 5173 via your router (port forwarding) or deploy the stack to a VPS. In that scenario, point `FRONTEND_URL`, `APP_BASE_URL`, and `VITE_API_URL` at the publicly reachable hostname and list it in `ALLOWED_ORIGINS`. The development server now relaxes CORS by default; set `STRICT_CORS=true` in `.env` if you want to re-enable the allowlist even during local development.

### Network configuration file (optional)

If you prefer not to touch `.env` for every network change, copy
`config/network-config.example.json` to `config/network-config.json` and edit
the hosts/ports. The backend and Vite dev server will read that file on boot
and merge the values with the environment variables. You can also set
`NETWORK_CONFIG_PATH` to point to a different JSON file per environment.

> Need to reach the app from outside your LAN? See `docs/remote-access.md`
> for port-forwarding vs Cloudflare Tunnel steps.

## Running tests

```bash
npm run check   # type check / lint
npm run test    # run the Node test suite (uses in-memory storage by default)
```

`npm run test` now logs per-route timings (see below) which helps correlate failing tests or slow suites with specific API calls.

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

The script enforces the success criteria documented in the prompt (`http_req_failed < 1%`, GET p95 < 500 ms). Review the console report or the `logs/app.log` entries for any failures, then re-enable rate limiting once the test is complete.

## Observability & Troubleshooting

- **Structured logs** go to `logs/app.log` (via Pino). Look for entries such as `Fetched customer orders` or `Fetched shop orders` to inspect query vs hydration time.
- **Slow requests**: debug entries include `prepMs`, `hydrateMs`, and `totalMs`. If `prepMs` spikes, investigate DB/index usage; if `hydrateMs` spikes, optimize batching in `hydrateOrders` / `hydrateCustomerBookings`.
- **Performance metrics**: `/api/performance-metrics` accepts browser-reported timings; review logs for outliers.
- **Live metrics**: when deployed with PM2, use `pm2 status`, `pm2 logs server`, or the built-in monitoring dashboard to watch request/minute, latency, and error rate. A persistent 5%+ error rate usually signals misconfigured OAuth or SMTP credentials.
- **Traceability**: every response now carries an `x-request-id` header and logs include the same identifier so you can correlate client failures with backend traces.
- **Common symptoms**
  - Long tail latencies (> 5 s) with low CPU → likely waiting on the database or external email/OAuth providers (enable `DEBUG_TIMING=true` if you add custom timers).
  - 400 errors on `/api/upload` → ensure the request uses `multipart/form-data` and is under the 5 MB image limit.
  - OAuth failures → confirm Google Cloud credentials match the origins listed in `.env`.

## Environment variables

Add these to `.env` (prefix with `VITE_` for client-side usage when noted):

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_REPLICA_URL` | Optional PostgreSQL read replica used for `SELECT` queries |
| `DB_POOL_SIZE` / `DB_READ_POOL_SIZE` | Connection pool sizes for primary/read pools |
| `DB_SLOW_THRESHOLD_MS` | Millisecond threshold before a query is logged as slow |
| `SESSION_SECRET` | Session encryption secret for Express |
| `PORT`, `HOST` | API bind port/host |
| `FRONTEND_URL`, `APP_BASE_URL` | URLs used for redirects/session cookies |
| `ALLOWED_ORIGINS` | Comma-separated list for CORS (set `STRICT_CORS=true` to enforce even in dev) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `FRONTEND_URL` / `APP_BASE_URL` | Must be HTTPS in production for secure cookies |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Nodemailer SMTP configuration for transactional email |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Bootstrap admin account (required in production) |
| `REDIS_URL`, `DISABLE_REDIS` | Enable the shared Redis cache or force in-memory caching |
| `DISABLE_RATE_LIMITERS` | Set to `true` only during load tests to bypass login/signup rate limits |
| `CAPACITOR_*` | Mobile bridge options; see [`docs/mobile-and-cloud-setup.md`](docs/mobile-and-cloud-setup.md) |

Refer to `config/network-config.json` if you prefer JSON-based overrides for local/LAN testing.

## Production Deployment
1. Build both the client and API bundles:

   ```bash
   npm run build
   ```

2. Install [PM2](https://pm2.keymetrics.io/) globally if you have not already:

   ```bash
   npm install --global pm2
   ```

3. Start the compiled server with the provided `ecosystem.config.js` definition:

   ```bash
   pm2 start ecosystem.config.js
   ```

4. (Optional) Enable PM2 startup scripts so the API restarts automatically when the host reboots:

   ```bash
   pm2 startup
   pm2 save
   ```

You can inspect runtime health with `pm2 status` and tail structured logs with `pm2 logs server`.
### Google OAuth Login Flow

1. The React app links users to `http://localhost:5000/auth/google`
   (replace the domain with your API) when they click **Login with Google**.
2. The Express backend route `/auth/google` redirects the user to Google.
3. After approval, Google sends the user back to
   `/auth/google/callback` on the backend.
4. The backend creates a session cookie and then redirects the user to
   your frontend domain (e.g., `http://localhost:5173/customer`) based on their
   role.

In the Google Cloud Console, configure your OAuth client with:

- **Authorized JavaScript origins**
  - `https://your-production-frontend.com`
  - `http://localhost:5173`
- **Authorized redirect URIs**
  - `https://your-production-api.com/auth/google/callback`
  - `http://localhost:5000/auth/google/callback`
- **Authorized Admin URIs**
  - `http://localhost:5173/admin/login`

### Simple admin login sample

Email: admin@example.com
Password: admin12345
To customize in .env: set ADMIN_EMAIL and ADMIN_PASSWORD before starting the server.

## Role overview

| Role | Capabilities |
| --- | --- |
| **Customer** | Browse/order products, book services, manage cart & wishlist, track bookings/orders |
| **Shop owner** | Manage inventory, workers, orders, returns, promotions |
| **Worker** | Scoped to assigned shop with permission-based access (orders, inventory, analytics) |
| **Service provider** | Manage services/bookings, respond to customer requests |
| **Admin** | Platform-wide controls; seeded via `ensureDefaultAdmin` on boot |

### Development Guidelines

1. The frontend React application is in the `client/` directory
2. Backend Express application is in the `server/` directory
3. Shared types and schemas are in the `shared/` directory
4. Database migrations are managed using Drizzle ORM

### Available Scripts

- `npm run dev:server` – start the backend API
- `npm run dev:client` – start the frontend development server
- `npm run build` – build for production
- `npm run start` – run the compiled server
- `npm run lint` – run ESLint on the project
- `npm run format` – format files using Prettier

### Troubleshooting

1. If you encounter database connection issues:
   - Verify PostgreSQL is running
   - Check database credentials in `.env`
   - Ensure the database exists

2. Orders fail with "insufficient stock"
   - The transactional order flow decrements stock atomically. Verify products have enough inventory and no other order depleted stock concurrently.

3. Google login fails locally
   - Make sure `GOOGLE_CLIENT_ID/SECRET` match your Google Cloud project and that `http://localhost:5000/auth/google/callback` is in the redirect list.

Need focused instructions for Android builds, Firebase push notifications, or email/OAuth? See [`docs/mobile-and-cloud-setup.md`](docs/mobile-and-cloud-setup.md).

2. If the server won't start:
   - Check if port 5000 is available
   - Verify all environment variables are set
   - Check for any error messages in the console

3. Common Issues:
   - "Module not found": Run `npm install` again
   - "Database connection failed": Check PostgreSQL service status
   - "Port already in use": Kill the process using port 5000 or change PORT in `.env`

### Testing

1. To run tests:

```bash
npm test
```

2. To run specific test suites:

```bash
npm test -- --grep "test-name"
```

3. To generate a coverage report and save logs:

```bash
npm run test:report
```
The results will be written to `reports/test.log` and coverage HTML will be available in the `coverage` directory.

Start development:

- `npm run dev:server` – run the backend API
- `npm run dev:client` – run the React frontend

- `npm run build` – build for production
- `npm run start` – run the compiled server
- `pm2 start ecosystem.config.js` – run the server in cluster mode using PM2
- `npm run lint` – run ESLint
- `npm run format` – run Prettier
- `npm test` – execute unit tests

### Running with PM2

Build the project and start the server in cluster mode:

```bash
npm run build
pm2 start ecosystem.config.js
```
## Features

### Customer Features

- Browse and book services
- Shop for products from various vendors
- Track orders and bookings
- Review and rate services/products
- Multi-language support (English, Hindi, Tamil)

### Service Provider Features

- Service listing and management
- Booking management
- Real-time availability updates
- Customer review management
- Analytics dashboard

### Shop Owner Features

1. Product Management
   - Add, edit, delete products
   - Inventory management
   - Set pricing and discounts
   - Image upload support

2. Order Management
   - Process customer orders
   - Update order status
   - Handle returns and refunds
   - Real-time notifications

3. Promotions & Analytics
   - Create promotional offers
   - Track sales performance
   - Monitor inventory levels
   - View customer reviews

## Project Structure

```
├── client/              # Frontend React application
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── lib/        # Utility functions
│   │   └── pages/      # Page components
├── server/             # Backend Express application
├── shared/             # Shared types and schemas
└── README.md
```

## User Roles

1. Customers
   - Register/login
   - Browse services and products
   - Make bookings and purchases
   - Track orders
   - Write reviews

2. Service Providers
   - Manage service listings
   - Handle bookings
   - Respond to reviews
   - Track earnings

3. Shop Owners
   - Manage product catalog
   - Process orders
   - Handle inventory
   - Create promotions

## Tech Stack

- Frontend: React.js with TypeScript
- Backend: Express.js
- Database: PostgreSQL
- ORM: Drizzle
- UI Components: shadcn/ui
- State Management: TanStack Query
- Routing: wouter
- Forms: react-hook-form

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
