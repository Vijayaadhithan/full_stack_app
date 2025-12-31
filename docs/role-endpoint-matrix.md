# Role Endpoint Matrix

This matrix summarizes common endpoints by role. It is not exhaustive. Use Swagger (`/api/docs`) or `GET /api` (auth required) for the full list.

## Public (no auth)

- GET /api/health
- GET /api/shops
- GET /api/shops/:shopId
- GET /api/shops/:shopId/products/:productId
- GET /api/products
- GET /api/services
- GET /api/services/:id
- GET /api/search/global

## Authenticated (all roles)

- GET /api/user
- POST /api/logout
- GET /api/csrf-token
- GET /api/events (SSE stream)
- GET /api/notifications
- PATCH /api/notifications/:id/read

## Customer

- POST /api/bookings
- GET /api/bookings/customer/requests
- GET /api/bookings/customer/history
- POST /api/orders
- POST /api/orders/text
- GET /api/orders/customer
- POST /api/orders/:orderId/return
- POST /api/promotions/validate
- POST /api/promotions/:id/apply
- POST /api/reviews
- POST /api/products/:productId/reviews
- /api/cart and /api/wishlist (CRUD)

## Provider

- POST /api/services
- PATCH /api/services/:id
- DELETE /api/services/:id
- GET /api/services/provider/:id
- GET /api/bookings/provider/pending
- GET /api/bookings/provider/history
- PATCH /api/bookings/:id/status
- PATCH /api/bookings/:id/provider-complete
- POST /api/services/:id/block-time
- GET /api/services/:id/blocked-slots

## Shop owner

- POST /api/products
- PATCH /api/products/:id
- DELETE /api/products/:id
- GET /api/orders/shop
- GET /api/orders/shop/recent
- GET /api/shops/orders/active
- POST /api/promotions
- PATCH /api/promotions/:id
- PATCH /api/promotions/:id/status
- DELETE /api/promotions/:id
- GET /api/promotions/shop/:id
- GET /api/returns/shop
- POST /api/returns/:id/approve
- /api/shops/workers (CRUD)
- /api/shops/pay-later/whitelist (read/write)

## Worker (permission-based)

Workers inherit shop access but only for responsibilities granted in `shop_workers.responsibilities`.

- orders:read -> GET /api/orders/shop, GET /api/shops/orders/active
- orders:update -> PATCH /api/orders/:id/status, pay-later approvals
- products:write -> POST/PATCH /api/products
- promotions:manage -> POST/PATCH/DELETE /api/promotions
- returns:manage -> GET /api/returns/shop, POST /api/returns/:id/approve

## Admin

Admin endpoints are served under `/api/admin/*` and require an admin session (not a regular user session).

- POST /api/admin/login
- POST /api/admin/logout
- GET /api/admin/health-status
- GET /api/admin/logs
- GET /api/admin/monitoring/summary
- GET /api/admin/platform-users
- PATCH /api/admin/platform-users/:userId/suspend
- DELETE /api/admin/platform-users/:userId
- GET /api/admin/transactions
- GET /api/admin/all-orders
- GET /api/admin/all-bookings
- /api/admin/roles and /api/admin/accounts
- GET /api/admin/audit-logs
