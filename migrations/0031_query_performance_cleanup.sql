-- Query performance and index hygiene improvements
-- 1) Add missing indexes for hot query paths.
-- 2) Remove redundant duplicate indexes that increase write amplification.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- OTP lookup and expiry cleanup
CREATE INDEX IF NOT EXISTS idx_phone_otp_lookup
  ON phone_otp_tokens (phone, purpose, is_used, otp_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_phone_otp_expires_at
  ON phone_otp_tokens (expires_at);

-- Waitlist lookups/position queries
CREATE INDEX IF NOT EXISTS idx_waitlist_service_position
  ON waitlist (service_id, id);

-- Cart membership checks in add/update flows
CREATE INDEX IF NOT EXISTS idx_cart_customer_product
  ON cart (customer_id, product_id);

-- Service/product geo-adjacent address filters
CREATE INDEX IF NOT EXISTS idx_shops_city_state
  ON shops (shop_address_city, shop_address_state);
CREATE INDEX IF NOT EXISTS idx_users_city_state
  ON users (address_city, address_state);

-- Global search support for shops
CREATE INDEX IF NOT EXISTS idx_shops_name_trgm
  ON shops USING GIN (shop_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shops_description_trgm
  ON shops USING GIN (description gin_trgm_ops);

-- Redundant duplicate indexes (safe no-op if absent)
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_phone;
DROP INDEX IF EXISTS idx_services_category;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_returns_order_id;
DROP INDEX IF EXISTS idx_order_items_order_id;
DROP INDEX IF EXISTS idx_order_items_product_id;
