# Indian E-commerce and Service Booking Platform

A comprehensive booking and e-commerce platform tailored for the Indian market, supporting multiple user roles including customers, service providers, and shop owners.

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

## Prerequisites

- Node.js (v20.x or later)
- PostgreSQL database
- Razorpay account for payments

## Setup Instructions

1. Clone the repository:
```bash
git clone <repository-url>
cd <project-directory>
```

2. Copy the environment variables file:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
- Database credentials
- Razorpay API keys
- Session secret
- Other optional configurations

4. Install dependencies:
```bash
npm install
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5000
- API: http://localhost:5000/api

## Environment Variables

Required environment variables are listed in `.env.example`. Make sure to set these before running the application:

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

# Razorpay Configuration
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret

# Frontend Configuration
VITE_API_URL=http://localhost:5000
VITE_RAZORPAY_KEY_ID=your-razorpay-key
```

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

## Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server

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