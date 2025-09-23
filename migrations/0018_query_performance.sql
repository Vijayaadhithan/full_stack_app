-- Enable extensions required for advanced indexing
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Product lookup optimizations
CREATE INDEX IF NOT EXISTS idx_products_shop_active ON products (shop_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_products_category_lower_active ON products ((LOWER(category))) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_tags_gin ON products USING GIN (tags);

-- Service lookup optimizations for similar query patterns
CREATE INDEX IF NOT EXISTS idx_services_provider_active ON services (provider_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_services_category_lower_active ON services ((LOWER(category))) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_services_name_trgm ON services USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_services_description_trgm ON services USING GIN (description gin_trgm_ops);

-- Location filters for shops
CREATE INDEX IF NOT EXISTS idx_users_role_city ON users (role, address_city);
CREATE INDEX IF NOT EXISTS idx_users_role_state ON users (role, address_state);
