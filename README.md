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

# Razorpay Configuration (optional for payment features)
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
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
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5000
- API: http://localhost:5000/api

### Development Guidelines

1. The frontend React application is in the `client/` directory
2. Backend Express application is in the `server/` directory
3. Shared types and schemas are in the `shared/` directory
4. Database migrations are managed using Drizzle ORM

### Available Scripts

- `npm run dev`: Start development server (runs both frontend and backend)
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint on the project
- `npm run format`: Format files using Prettier

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

## Features

### Customer Features
- Browse and book services
- Shop for products from various vendors
- Track orders and bookings
- Review and rate services/products
- Multi-language support (English, Hindi, Tamil)
- Integrated payment system (Razorpay)

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
- Payment Gateway: Razorpay

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.