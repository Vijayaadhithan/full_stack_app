-- Enable PostGIS for spatial queries (no-op if already installed)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add precise latitude/longitude columns for all users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10, 7);

-- Helpful index for role-scoped geo searches
CREATE INDEX IF NOT EXISTS idx_users_role_geo
  ON users (role)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_lat_long
  ON users (latitude, longitude);
