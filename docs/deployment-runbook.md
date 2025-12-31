# Deployment Runbook

This runbook walks through a typical production deployment for the DoorStep stack.

## 1. Prerequisites

- Node.js 20.x
- PostgreSQL 14+
- Redis (required in production for caching, queues, rate limiting, realtime)
- PM2 (or a process manager of your choice)
- Optional: Nginx or another reverse proxy

## 2. Environment Checklist

Minimum required variables:

- NODE_ENV=production
- DATABASE_URL=postgresql://...
- SESSION_SECRET=<strong random value>
- ADMIN_EMAIL=<bootstrap admin>
- ADMIN_PASSWORD=<strong random value>
- FRONTEND_URL=https://app.yourdomain.com
- APP_BASE_URL=https://api.yourdomain.com
- ALLOWED_ORIGINS=https://app.yourdomain.com,https://api.yourdomain.com
- REDIS_URL=redis://...
- VITE_API_URL=https://api.yourdomain.com

Optional but recommended:

- LOG_LEVEL, LOG_FILE_PATH
- DATABASE_REPLICA_URL (if you have a read replica)
- HTTPS_ENABLED + TLS paths (if you terminate TLS in Node)

## 3. Build and Migrate

```bash
npm install
npm run db:migrate
npm run build
```

If your database was created outside migrations, run the baseline once:

```bash
npm run db:migrate:baseline
```

## 4. Start the Server

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 5. Reverse Proxy (Optional)

If you terminate TLS with Nginx or a cloud load balancer:

- Ensure the proxy forwards `X-Forwarded-Proto` and `X-Forwarded-For`.
- Express is already configured with `app.set("trust proxy", 1)`.
- Keep `ALLOWED_ORIGINS` in sync with the public domain.

## 6. Health Checks and Validation

- Basic liveness: `GET /api/health`
- Admin health: `GET /api/admin/health-status` (requires admin login)
- Logs: `GET /api/admin/logs` or `tail -f logs/app.log`

## 7. Redis Requirements

Redis powers:

- Rate limiters
- Session storage (if SESSION_STORE=redis)
- BullMQ queues and job locks
- Realtime SSE fan-out

Do not disable Redis in production. The server will exit if `DISABLE_REDIS=true` or `REDIS_URL` is missing.

## 8. Backups

A sample provisioning script (`scripts/provision.sh`) includes a nightly `pg_dump` cron job. Customize it or use your own backup system.

Example restore:

```bash
aws s3 cp s3://<bucket>/db-2024-01-15.sql.gz - | gunzip | psql "$DATABASE_URL"
```

## 9. Rollback Strategy

- Keep deployment tags or versions in git.
- On rollback, checkout the previous tag and rebuild:

```bash
git checkout <tag>
npm install
npm run build
pm2 restart ecosystem.config.js
```

If database migrations are not reversible, plan a safe rollback window or maintain backward-compatible schema changes.

## 10. Scaling Notes

- If you run multiple instances, Redis-backed job locks prevent duplicate scheduled jobs.
- Realtime invalidations are broadcast over Redis Pub/Sub for multi-instance setups.
- Ensure `ALLOWED_ORIGINS` and session cookie settings are consistent across all nodes.
