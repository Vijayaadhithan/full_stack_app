# Indian E-commerce and Service Booking Platform

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

3. Update the `.env` file with your configuration:

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

2. Initialize the database:

```bash
npx drizzle-kit push:pg
```

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

### LAN / Device Testing

1. Discover your machine's LAN IP (e.g. `ipconfig` on Windows or `ifconfig`/`ip addr` on macOS/Linux).
2. Update the following entries in `.env` so mobile devices can resolve your machine:
   - `HOST=0.0.0.0` to bind the API to every interface.
   - `DEV_SERVER_HOST=<your-LAN-ip>` so Vite HMR and Capacitor know where to reach the dev server.
   - `FRONTEND_URL=http://<your-LAN-ip>:5173` and `APP_BASE_URL=http://<your-LAN-ip>:5000` for redirects and cookies.
   - `ALLOWED_ORIGINS=http://<your-LAN-ip>:5173,http://<your-LAN-ip>:5000` so CORS accepts cross-origin requests.
3. (Optional) Set `CAPACITOR_SERVER_URL=http://<your-LAN-ip>:5173` when running `npx cap run android` for on-device hot reload.
4. Restart `npm run dev:server` and `npm run dev:client`. Other devices on the same network can now open `http://<your-LAN-ip>:5173`.
5. For devices outside your network, tunnel the dev server with a tool such as `ngrok` and add the public URLs to `ALLOWED_ORIGINS`.

#### ngrok walkthrough

1. Install ngrok from https://ngrok.com/download and authenticate (`ngrok config add-authtoken <token>`).
2. Run a production-style build so both API and UI are served on port 5000:
   ```bash
   npm run build
   npm run start
   ```
3. Start the tunnel: `ngrok http 5000` (or `ngrok http --domain your-name.ngrok-free.app 5000` if you have a reserved domain).
4. Copy the `https://<random>.ngrok-free.app` URL and update `.env`:
   - `FRONTEND_URL=<copied-url>`
   - `APP_BASE_URL=<copied-url>`
   - `ALLOWED_ORIGINS=...,<copied-url>` (wildcards like `https://*.ngrok-free.app` are supported)
   - (Optional) `VITE_API_URL=<copied-url>` if the React app should call the tunnel directly
5. Restart the server so new env vars load, then share the ngrok URL with testers on other networks.

> Tip: If you need hot-reload over ngrok, start a second tunnel for `npm run dev:client` and set `DEV_SERVER_HOST`/`VITE_API_URL` to that public hostname.

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
