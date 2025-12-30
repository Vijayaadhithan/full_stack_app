-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add location geometry column to users table (4326 is SRID for WGS 84 - lat/lng)
ALTER TABLE users ADD COLUMN IF NOT EXISTS location geometry(Point, 4326);

-- Add location geometry column to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS location geometry(Point, 4326);

-- Create GIST indexes for fast spatial queries
CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_shops_location ON shops USING GIST (location);

-- Populate users location from existing latitude/longitude
UPDATE users 
SET location = ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Populate shops location from existing shop_location_lat/_lng
UPDATE shops 
SET location = ST_SetSRID(ST_MakePoint(shop_location_lng::float8, shop_location_lat::float8), 4326)
WHERE shop_location_lat IS NOT NULL AND shop_location_lng IS NOT NULL;
