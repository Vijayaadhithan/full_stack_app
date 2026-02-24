-- Spatial index acceleration for geo-distance filters and sorting.
-- This migration is safe on instances without PostGIS: it skips spatial DDL.

-- Fallback B-tree indexes used by Haversine bounding-box filters.
CREATE INDEX IF NOT EXISTS idx_users_lat_lng
  ON users (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shops_location_lat_lng
  ON shops (shop_location_lat, shop_location_lng)
  WHERE shop_location_lat IS NOT NULL AND shop_location_lng IS NOT NULL;

DO $$
DECLARE
  postgis_available boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_available_extensions
    WHERE name = 'postgis'
  )
  INTO postgis_available;

  IF NOT postgis_available THEN
    RAISE NOTICE 'PostGIS is not available on this PostgreSQL instance; skipping spatial indexes.';
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS postgis;

  EXECUTE $sql$
    CREATE INDEX IF NOT EXISTS idx_users_geo_geog
      ON users
      USING GIST (
        (ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)::geography)
      )
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
  $sql$;

  EXECUTE $sql$
    CREATE INDEX IF NOT EXISTS idx_shops_geo_geog
      ON shops
      USING GIST (
        (ST_SetSRID(ST_MakePoint(shop_location_lng::float8, shop_location_lat::float8), 4326)::geography)
      )
      WHERE shop_location_lat IS NOT NULL AND shop_location_lng IS NOT NULL
  $sql$;
END $$;
