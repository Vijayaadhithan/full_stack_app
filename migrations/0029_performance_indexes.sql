-- Performance optimization indexes
-- Additional indexes for frequently queried columns not yet covered

-- Notifications: frequently queried by user with ordering
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Notifications: unread count queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id)
  WHERE is_read = false;

-- Order status updates: timeline queries
CREATE INDEX IF NOT EXISTS idx_order_status_updates_order_timestamp
  ON order_status_updates (order_id, timestamp DESC);

-- Booking history: timeline queries  
CREATE INDEX IF NOT EXISTS idx_booking_history_booking_changed
  ON booking_history (booking_id, changed_at DESC);

-- Waitlist: position queries
CREATE INDEX IF NOT EXISTS idx_waitlist_service_customer
  ON waitlist (service_id, customer_id);

-- Returns: shop queries via order join
CREATE INDEX IF NOT EXISTS idx_returns_status
  ON returns (status);

-- Products: composite index for filtered listings
CREATE INDEX IF NOT EXISTS idx_products_shop_available_deleted
  ON products (shop_id, is_available)
  WHERE is_deleted = false;

-- Services: availability filtering
CREATE INDEX IF NOT EXISTS idx_services_available_now
  ON services (is_available_now)
  WHERE is_deleted = false AND is_available_now = true;

-- Users: verification status queries
CREATE INDEX IF NOT EXISTS idx_users_verification_status
  ON users (verification_status);

-- Shops: location-based queries (if PostGIS column exists)
CREATE INDEX IF NOT EXISTS idx_shops_location_gist
  ON shops USING GIST (location)
  WHERE location IS NOT NULL;

-- Users: location-based queries (if PostGIS column exists)  
CREATE INDEX IF NOT EXISTS idx_users_location_gist
  ON users USING GIST (location)
  WHERE location IS NOT NULL;

-- Services: provider with availability
CREATE INDEX IF NOT EXISTS idx_services_provider_available
  ON services (provider_id, is_available)
  WHERE is_deleted = false;
