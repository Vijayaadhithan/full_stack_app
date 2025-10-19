-- Additional indexes for high-cardinality query filters
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_phone_idx ON users(phone);

CREATE INDEX IF NOT EXISTS services_provider_id_idx ON services(provider_id);
CREATE INDEX IF NOT EXISTS services_category_idx ON services(category);

CREATE INDEX IF NOT EXISTS products_shop_id_idx ON products(shop_id);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);

CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_shop_id_idx ON orders(shop_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_order_date_idx ON orders(order_date);

CREATE INDEX IF NOT EXISTS bookings_customer_id_idx ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS bookings_service_id_idx ON bookings(service_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);
CREATE INDEX IF NOT EXISTS bookings_booking_date_idx ON bookings(booking_date);
