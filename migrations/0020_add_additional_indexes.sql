-- Additional indexes for frequently queried columns

-- Users lookup optimizations
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);

-- Service search filters
CREATE INDEX IF NOT EXISTS idx_services_address_state_active ON services (address_state) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_services_address_postal_code_active ON services (address_postal_code) WHERE is_deleted = false;

-- Booking retrieval patterns
CREATE INDEX IF NOT EXISTS idx_bookings_customer_status ON bookings (customer_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_service_status ON bookings (service_id, status);

-- Order retrieval patterns
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders (customer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON orders (shop_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_shop_payment_status ON orders (shop_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);

-- Review lookups
CREATE INDEX IF NOT EXISTS idx_reviews_service_id ON reviews (service_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON reviews (customer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer ON product_reviews (customer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_order ON product_reviews (order_id);

-- Shopping cart and wishlist operations
CREATE INDEX IF NOT EXISTS idx_cart_customer_product ON cart (customer_id, product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_customer_product ON wishlist (customer_id, product_id);

-- Waitlist and scheduling helpers
CREATE INDEX IF NOT EXISTS idx_waitlist_service ON waitlist (service_id);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_service_date ON blocked_time_slots (service_id, date);

-- Order fulfillment helpers
CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);
