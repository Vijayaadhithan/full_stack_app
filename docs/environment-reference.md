# Environment Variables Reference

This document summarizes environment variables used by the server, client, and scripts. Start from `.env_example` and set only what you need for your environment. Defaults listed here come from code or documented fallbacks.

## Core database

- DATABASE_URL: Primary PostgreSQL connection string. Required unless USE_IN_MEMORY_DB=true.
- DATABASE_REPLICA_URL: Optional read replica; used for read-only queries.
- DB_POOL_SIZE: Primary pool size (default 50).
- DB_READ_POOL_SIZE: Replica pool size (defaults to DB_POOL_SIZE).
- DB_SLOW_THRESHOLD_MS: Log queries slower than this (default 200 ms).
- USE_IN_MEMORY_DB: Use in-memory storage for API data and sessions (ignored under PM2 cluster mode).

## Server

- NODE_ENV: development | test | production.
- PORT: API port (default 5000).
- HOST: Bind address (default 0.0.0.0).
- SERVER_HOST: Alias for HOST.
- CLIENT_DIST_DIR: Custom path for static client assets (defaults to dist/public).

## Sessions and security

- SESSION_SECRET: Session signing secret. Strong value required in production.
- SESSION_STORE: postgres or redis.
- SESSION_TTL_SECONDS: Override session TTL in seconds.
- SESSION_REDIS_PREFIX: Redis key prefix (default sess:).
- SESSION_COOKIE_SAMESITE: lax | strict | none | false.
- SESSION_COOKIE_SECURE: true | false (forced true when SameSite=none unless overridden).
- SESSION_COOKIE_DOMAIN: Cookie domain override.
- SESSION_TABLE_NAME: Override PostgreSQL session table name.
- SESSION_SCHEMA_NAME: Override PostgreSQL schema for sessions.
- SESSION_AUTO_CREATE_TABLE: Set to false to skip auto-creating session table.
- SESSION_PRUNE_INTERVAL_SECONDS: Control session cleanup interval.

## URLs and CORS

- FRONTEND_URL: Primary web app URL.
- APP_BASE_URL: API base URL for redirects and cookie settings.
- ALLOWED_ORIGINS: Comma-separated CORS allowlist.
- STRICT_CORS: true to enforce allowlist even in development.
- NETWORK_CONFIG_PATH: Path to config/network-config.json override.
- API_PROXY_TARGET: Vite dev server proxy target (defaults to APP_BASE_URL or http://localhost:5000).

## Vite dev server

- DEV_SERVER_BIND: Vite server bind address (default 0.0.0.0).
- DEV_SERVER_HOST: Hostname for Vite HMR and Capacitor live reload.
- DEV_SERVER_PORT: Vite dev server port (default 5173).
- DEV_SERVER_HMR_HOST: Hostname for HMR socket.
- DEV_SERVER_HMR_PORT: HMR port.
- DEV_SERVER_HMR_PROTOCOL: ws | wss.

## Redis and rate limiting

- REDIS_URL: Redis connection string. Required in production.
- DISABLE_REDIS: Disable Redis (only safe for local/dev; production will exit).
- DISABLE_RATE_LIMITERS: Disable express-rate-limit (useful for load tests only).

## Admin bootstrap

- ADMIN_EMAIL: Required for admin bootstrap on server startup.
- ADMIN_PASSWORD: Required for admin bootstrap on server startup.

## Script-only overrides

Used by `scripts/setupAdmin.ts` if you run that script directly:

- MASTER_ADMIN_EMAIL
- MASTER_ADMIN_PASSWORD

## Background jobs

- BOOKING_EXPIRATION_CRON: Cron schedule for booking expiration job.
- PAYMENT_REMINDER_CRON: Cron schedule for payment reminders.
- LOW_STOCK_DIGEST_CRON: Cron schedule for low-stock digest.
- CRON_TZ: Timezone for repeatable jobs (default Asia/Kolkata).
- PAYMENT_REMINDER_DAYS: Days before sending payment reminders.
- PAYMENT_DISPUTE_DAYS: Days before marking disputes.
- JOB_LOCK_TTL_MS: Default distributed lock TTL.
- BOOKING_EXPIRATION_LOCK_TTL_MS: Override lock TTL for booking expiration.
- PAYMENT_REMINDER_LOCK_TTL_MS: Override lock TTL for payment reminders.
- LOW_STOCK_DIGEST_LOCK_TTL_MS: Override lock TTL for low-stock digest.
- JOB_LOCK_PREFIX: Redis key prefix for job locks (default locks:jobs).
- JOB_LOCK_FAIL_OPEN: Allow jobs to run when Redis is unavailable (default true in non-production).
- DISABLE_JOB_LOCK: Disable distributed job locks entirely.

## Logging and monitoring

- LOG_LEVEL: Pino log level (default info).
- LOG_FILE_PATH: Log file path (default logs/app.log).
- LOG_TO_STDOUT: true | false (default true).
- LIVE_MONITOR_URL: Override URL for scripts/liveMonitor.js.

## HTTPS (optional)

- HTTPS_ENABLED: true to enable HTTPS server.
- HTTPS_KEY_PATH: Path to TLS key.
- HTTPS_CERT_PATH: Path to TLS certificate.
- HTTPS_PASSPHRASE: Passphrase for the key if needed.
- HTTPS_CA_PATH: Optional CA bundle path.

## Client configuration

- VITE_API_URL: API base URL for the web client.
- VITE_APP_BASE_URL: Fallback API base URL.
- VITE_FALLBACK_API_URL: Secondary fallback API base URL.
- VITE_ENABLE_PERMISSION_DEBUG: Enable verbose permission logging in the client.

## Firebase Phone Auth (optional)

- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID

## Capacitor (optional)

- CAPACITOR_SERVER_URL: Live reload URL for Capacitor dev builds.
