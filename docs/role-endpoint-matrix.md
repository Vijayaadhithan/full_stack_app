# Role Endpoint Matrix

This matrix highlights commonly used endpoints by role.

Canonical exhaustive reference:
- `docs/api-endpoints-reference.md` (166 runtime `/api/*` endpoints, code-verified on February 22, 2026)

## Public (no session required)

- GET `/api/health`
- GET `/api/health/ready`
- GET `/api/csrf-token`
- GET `/api/shops`
- GET `/api/products`
- GET `/api/services`
- GET `/api/search/global`
- POST `/api/register`
- POST `/api/login`
- POST `/api/auth/check-user`
- POST `/api/auth/login-pin`

## Authenticated (all signed-in users)

- GET `/api/user`
- POST `/api/logout`
- GET `/api/events`
- GET `/api/notifications`
- PATCH `/api/notifications/:id/read`
- PATCH `/api/notifications/mark-all-read`
- POST `/api/fcm/register`
- DELETE `/api/fcm/unregister`

## Customer

- POST `/api/bookings`
- GET `/api/bookings/customer/requests`
- GET `/api/bookings/customer/history`
- PATCH `/api/bookings/:id/customer-complete`
- POST `/api/orders`
- POST `/api/orders/text`
- GET `/api/orders/customer`
- POST `/api/orders/:id/submit-payment-reference`
- POST `/api/orders/:id/agree-final-bill`
- POST `/api/orders/:id/payment-method`
- POST `/api/orders/:id/cancel`
- POST `/api/orders/:orderId/return`
- GET `/api/cart`, POST `/api/cart`, DELETE `/api/cart/:productId`
- GET `/api/wishlist`, POST `/api/wishlist`, DELETE `/api/wishlist/:productId`
- POST `/api/reviews`
- PATCH `/api/reviews/:id`
- POST `/api/product-reviews`
- PATCH `/api/product-reviews/:id`
- POST `/api/promotions/validate`
- POST `/api/promotions/:id/apply`

## Service Provider

- POST `/api/services`
- PATCH `/api/services/:id`
- DELETE `/api/services/:id`
- PATCH `/api/provider/availability`
- GET `/api/services/provider/:id`
- GET `/api/bookings/provider/pending`
- GET `/api/bookings/provider`
- GET `/api/bookings/provider/history`
- PATCH `/api/bookings/:id/status`
- PATCH `/api/bookings/:id/en-route`
- PATCH `/api/bookings/:id/provider-complete`
- POST `/api/services/:id/block-time`
- DELETE `/api/services/:serviceId/blocked-slots/:slotId`

## Shop Owner

- POST/PATCH/DELETE `/api/products`
- PATCH `/api/products/bulk-update`
- GET `/api/orders/shop`
- GET `/api/orders/shop/recent`
- GET `/api/shops/orders/active`
- PATCH `/api/orders/:id/status`
- POST `/api/orders/:id/confirm-payment`
- POST `/api/orders/:id/quote-text-order`
- POST `/api/orders/:id/approve-pay-later`
- GET `/api/returns/shop`
- POST `/api/returns/:id/approve`
- POST/PATCH/DELETE `/api/promotions`
- GET `/api/promotions/shop/:id`
- GET/POST/DELETE `/api/shops/pay-later/whitelist`
- GET/POST/PATCH/DELETE `/api/shops/workers`

## Worker (permission-scoped)

Workers use shop context and are constrained by responsibilities in `shop_workers.responsibilities`.

- `orders:read` -> GET `/api/orders/shop`, GET `/api/shops/orders/active`, GET `/api/orders/:id/timeline`
- `orders:update` -> PATCH `/api/orders/:id/status`, POST `/api/orders/:id/confirm-payment`, POST `/api/orders/:id/quote-text-order`, POST `/api/orders/:id/approve-pay-later`
- `products:write` -> POST `/api/products`, PATCH `/api/products/:id`, PATCH `/api/products/bulk-update`
- `promotions:manage` -> POST/PATCH/DELETE `/api/promotions`, GET `/api/promotions/shop/:id`
- `returns:manage` -> GET `/api/returns/shop`, POST `/api/returns/:id/approve`

## Admin Console

Admin routes are mounted under `/api/admin/*` and use a dedicated admin session.

- POST `/api/admin/login`
- POST `/api/admin/logout`
- GET `/api/admin/me`
- POST `/api/admin/change-password`
- GET `/api/admin/health-status`
- GET `/api/admin/logs`
- GET `/api/admin/monitoring/summary`
- GET `/api/admin/dashboard-stats`
- GET `/api/admin/platform-users`
- PATCH `/api/admin/platform-users/:userId/suspend`
- DELETE `/api/admin/platform-users/:userId`
- GET `/api/admin/transactions`
- GET `/api/admin/all-orders`
- GET `/api/admin/all-bookings`
- GET/POST `/api/admin/roles`
- GET/POST `/api/admin/accounts`
- PUT `/api/admin/roles/:roleId/permissions`
- GET `/api/admin/audit-logs`
