import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import logger from "../logger";
import { DEFAULT_NEARBY_RADIUS_KM } from "./geo";

const EARTH_RADIUS_KM = 6371;

type GeoQueryMode = "auto" | "postgis" | "haversine";

function resolveGeoQueryMode(value: string | undefined): GeoQueryMode {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "auto") {
    return "auto";
  }
  if (normalized === "postgis" || normalized === "spatial") {
    return "postgis";
  }
  if (normalized === "haversine" || normalized === "legacy") {
    return "haversine";
  }
  return "auto";
}

const configuredGeoMode = resolveGeoQueryMode(process.env.GEO_QUERY_MODE);

let postgisAvailable: boolean | null = null;
let postgisProbePromise: Promise<boolean> | null = null;
let loggedPostgisProbe = false;
let loggedProbeFailure = false;

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "t" || normalized === "1";
  }
  return false;
}

function normalizeRadius(radiusKm: number): number {
  return Number.isFinite(radiusKm) && radiusKm > 0
    ? radiusKm
    : DEFAULT_NEARBY_RADIUS_KM;
}

export async function shouldUsePostgis(): Promise<boolean> {
  if (configuredGeoMode === "postgis") return true;
  if (configuredGeoMode === "haversine") return false;

  if (postgisAvailable !== null) {
    return postgisAvailable;
  }
  if (postgisProbePromise) {
    return postgisProbePromise;
  }

  postgisProbePromise = (async () => {
    try {
      const result: any = await db.replica.execute(
        sql`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS has_postgis`,
      );
      const row = Array.isArray(result)
        ? result[0]
        : Array.isArray(result?.rows)
          ? result.rows[0]
          : undefined;
      const enabled = toBoolean(
        row?.has_postgis ?? row?.hasPostgis ?? row?.exists ?? row?.enabled,
      );
      postgisAvailable = enabled;
      if (!loggedPostgisProbe) {
        logger.info(
          { enabled, mode: configuredGeoMode },
          "[GeoSQL] Resolved PostGIS availability",
        );
        loggedPostgisProbe = true;
      }
      return enabled;
    } catch (err) {
      postgisAvailable = false;
      if (!loggedProbeFailure) {
        logger.warn(
          { err },
          "[GeoSQL] PostGIS probe failed; falling back to Haversine distance queries.",
        );
        loggedProbeFailure = true;
      }
      return false;
    } finally {
      postgisProbePromise = null;
    }
  })();

  return postgisProbePromise;
}

function buildPostgisCondition({
  columnLat,
  columnLng,
  lat,
  lng,
  radiusKm,
}: {
  columnLat: SQL | unknown;
  columnLng: SQL | unknown;
  lat: number;
  lng: number;
  radiusKm: number;
}) {
  const normalizedRadiusKm = normalizeRadius(radiusKm);
  const radiusMeters = normalizedRadiusKm * 1000;
  const targetPoint = sql`ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)::geography`;
  const rowPoint = sql`ST_SetSRID(ST_MakePoint((${columnLng})::float8, (${columnLat})::float8), 4326)::geography`;
  const distanceExpr = sql`ST_Distance(${rowPoint}, ${targetPoint}) / 1000.0`;
  const condition = sql`(
    ${columnLat} IS NOT NULL
    AND ${columnLng} IS NOT NULL
    AND ST_DWithin(${rowPoint}, ${targetPoint}, ${radiusMeters})
  )`;
  return { condition, distanceExpr };
}

function buildHaversineCondition({
  columnLat,
  columnLng,
  lat,
  lng,
  radiusKm,
}: {
  columnLat: SQL | unknown;
  columnLng: SQL | unknown;
  lat: number;
  lng: number;
  radiusKm: number;
}) {
  const normalizedRadiusKm = normalizeRadius(radiusKm);
  const latDelta = normalizedRadiusKm / 111.045;
  const cosLatitude = Math.cos((lat * Math.PI) / 180);
  const lngDelta =
    normalizedRadiusKm / (111.045 * Math.max(Math.abs(cosLatitude), 0.01));
  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

  const latRad = sql`radians(${lat})`;
  const lngRad = sql`radians(${lng})`;
  const rowLat = sql`radians(${columnLat}::float8)`;
  const rowLng = sql`radians(${columnLng}::float8)`;
  const distanceExpr = sql`
    ${EARTH_RADIUS_KM} * 2 * asin(
      sqrt(
        power(sin((${rowLat} - ${latRad}) / 2), 2) +
        cos(${latRad}) * cos(${rowLat}) *
        power(sin((${rowLng} - ${lngRad}) / 2), 2)
      )
    )
  `;
  const condition = sql`(
    ${columnLat} IS NOT NULL
    AND ${columnLng} IS NOT NULL
    AND ${columnLat}::float8 BETWEEN ${minLat} AND ${maxLat}
    AND ${columnLng}::float8 BETWEEN ${minLng} AND ${maxLng}
    AND ${distanceExpr} <= ${normalizedRadiusKm}
  )`;
  return { condition, distanceExpr };
}

export function buildGeoDistanceCondition(params: {
  columnLat: SQL | unknown;
  columnLng: SQL | unknown;
  lat: number;
  lng: number;
  radiusKm: number;
  usePostgis: boolean;
}) {
  if (params.usePostgis) {
    return buildPostgisCondition(params);
  }
  return buildHaversineCondition(params);
}

export function __resetGeoSqlForTesting() {
  postgisAvailable = null;
  postgisProbePromise = null;
  loggedPostgisProbe = false;
  loggedProbeFailure = false;
}
