CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_address_city ON services(address_city);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);