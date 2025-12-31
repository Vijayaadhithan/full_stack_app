# API Quickstart

This quickstart shows how to authenticate, call key endpoints, and use CSRF tokens with curl. Examples assume the API is running at http://localhost:5000.

## Base URL and Swagger

- API base URL: http://localhost:5000
- Swagger UI: http://localhost:5000/api/docs
- List available endpoints (requires auth): GET /api

## Sessions and CSRF

The API uses cookie sessions with CSRF protection. For non-GET requests you must include the CSRF token and the session cookie.

Example flow:

```bash
# 1) Fetch CSRF token and capture cookies
CSRF=$(curl -s -c cookies.txt http://localhost:5000/api/csrf-token | jq -r .csrfToken)

# 2) Use the token + cookies for state-changing requests
curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"SuperSecret123!","name":"Demo User","phone":"9876543210","email":"demo@example.com"}' \
  http://localhost:5000/api/register
```

If you do not have `jq`, run the CSRF request and copy the token manually.

## Standard login (username/email/phone + password)

```bash
# Login (username field can also be email or phone)
CSRF=$(curl -s -c cookies.txt http://localhost:5000/api/csrf-token | jq -r .csrfToken)

curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"SuperSecret123!"}' \
  http://localhost:5000/api/login

# Fetch current user
curl -s -b cookies.txt http://localhost:5000/api/user
```

## Rural phone + PIN auth

```bash
# Check if a phone number exists
CSRF=$(curl -s -c cookies.txt http://localhost:5000/api/csrf-token | jq -r .csrfToken)

curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}' \
  http://localhost:5000/api/auth/check-user

# Register with phone + PIN (OTP is handled on the client)
curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","name":"Rural User","pin":"1234","initialRole":"customer"}' \
  http://localhost:5000/api/auth/rural-register

# Login with PIN
curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","pin":"1234"}' \
  http://localhost:5000/api/auth/login-pin
```

## Worker login

```bash
CSRF=$(curl -s -c cookies.txt http://localhost:5000/api/csrf-token | jq -r .csrfToken)

curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"workerNumber":"1234567890","pin":"1234"}' \
  http://localhost:5000/api/auth/worker-login
```

## Public catalog

```bash
curl -s http://localhost:5000/api/shops
curl -s "http://localhost:5000/api/products?searchTerm=phone"
curl -s "http://localhost:5000/api/services?locationCity=Mumbai"
```

## Orders

```bash
CSRF=$(curl -s -c cookies.txt http://localhost:5000/api/csrf-token | jq -r .csrfToken)

# Product order (totals are re-validated server-side)
curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":1,"quantity":1,"price":1999}],"total":1999,"deliveryMethod":"pickup","paymentMethod":"upi"}' \
  http://localhost:5000/api/orders

# Text order
curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"shopId":1,"orderText":"1 kg rice, 2 soap","deliveryMethod":"pickup"}' \
  http://localhost:5000/api/orders/text

# Customer orders
curl -s -b cookies.txt http://localhost:5000/api/orders/customer
```

## Bookings

```bash
CSRF=$(curl -s -c cookies.txt http://localhost:5000/api/csrf-token | jq -r .csrfToken)

# Create a booking (customer)
curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"serviceId":1,"bookingDate":"2025-02-01T10:00:00.000Z","serviceLocation":"provider","timeSlotLabel":"morning"}' \
  http://localhost:5000/api/bookings

# Customer booking history
curl -s -b cookies.txt http://localhost:5000/api/bookings/customer/history

# Provider pending bookings
curl -s -b cookies.txt http://localhost:5000/api/bookings/provider/pending
```

## Returns

```bash
CSRF=$(curl -s -c cookies.txt http://localhost:5000/api/csrf-token | jq -r .csrfToken)

# Create a return request (customer)
curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Damaged item","description":"Box was crushed","status":"requested","orderItemId":10}' \
  http://localhost:5000/api/orders/123/return

# Shop return queue (shop/worker with returns:manage)
curl -s -b cookies.txt http://localhost:5000/api/returns/shop

# Approve a return (shop/worker with returns:manage)
curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  http://localhost:5000/api/returns/55/approve
```

## Promotions

```bash
CSRF=$(curl -s -c cookies.txt http://localhost:5000/api/csrf-token | jq -r .csrfToken)

# Create a promotion (shop/worker with promotions:manage)
curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"name":"February Sale","type":"percentage","value":10,"code":"FEB10","usageLimit":100,"shopId":1,"expiryDays":30}' \
  http://localhost:5000/api/promotions

# Validate a promotion (customer)
curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"code":"FEB10","shopId":1,"cartItems":[{"productId":1,"quantity":2,"price":1999}],"subtotal":3998}' \
  http://localhost:5000/api/promotions/validate
```

## Shop workers

```bash
CSRF=$(curl -s -c cookies.txt http://localhost:5000/api/csrf-token | jq -r .csrfToken)

# List responsibility presets
curl -s -b cookies.txt http://localhost:5000/api/shops/workers/responsibilities

# Create a worker
curl -s -b cookies.txt -c cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"workerNumber":"1234567890","name":"Cashier","pin":"1234","responsibilities":["orders:read"]}' \
  http://localhost:5000/api/shops/workers

# List workers
curl -s -b cookies.txt http://localhost:5000/api/shops/workers
```

## Admin console

```bash
CSRF=$(curl -s -c admin_cookies.txt http://localhost:5000/api/csrf-token | jq -r .csrfToken)

curl -s -b admin_cookies.txt -c admin_cookies.txt \
  -H "x-csrf-token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"ChangeMeToAStrongPassword"}' \
  http://localhost:5000/api/admin/login

# Fetch monitoring summary
curl -s -b admin_cookies.txt http://localhost:5000/api/admin/monitoring/summary
```

## Realtime SSE

```bash
# After logging in, open the SSE stream
curl -N -b cookies.txt http://localhost:5000/api/events
```

## More endpoints

Use the Swagger UI or `GET /api` (requires auth) to discover all routes.
