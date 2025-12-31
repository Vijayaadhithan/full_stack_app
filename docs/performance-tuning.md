# Performance Tuning Guide

This guide documents the performance configuration options and monitoring practices for the application.

## Database Connection Pool

### Current Configuration

| Environment Variable | Default | Current Value | Description |
|---------------------|---------|---------------|-------------|
| `DB_POOL_SIZE` | 50 | 50 | Primary database connection pool size |
| `DB_READ_POOL_SIZE` | Same as DB_POOL_SIZE | 50 | Replica database pool size for read operations |
| `DB_SLOW_THRESHOLD_MS` | 200 | 200 | Queries slower than this are logged as warnings |

### Tuning Guidelines

**For different user tiers:**

| Concurrent Users | Recommended DB_POOL_SIZE | RAM Required |
|-----------------|--------------------------|--------------|
| 100 | 20-30 | 512MB |
| 500 | 30-50 | 1GB |
| 1000 | 50-75 | 2GB |
| 5000 | 75-100 | 4GB+ |

**Formula:** `DB_POOL_SIZE = (concurrent_users / 10) + overhead`

> ⚠️ Each connection uses ~5-10MB RAM on the PostgreSQL server side.

## Redis Cache Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `REDIS_URL` | - | Redis connection URL |
| `DISABLE_REDIS` | false | Disable Redis (uses in-memory fallback) |

> ⚠️ In production, Redis **must** be enabled. The application will exit if `REDIS_URL` is missing in production mode.

## Checking for OOM (Out of Memory) Errors

### Node.js Process Monitoring

1. **Check PM2 logs** (if using PM2):
```bash
pm2 logs --lines 1000 | grep -i "heap\|memory\|oom\|killed\|fatal"
```

2. **Check system logs**:
```bash
# Linux
dmesg | grep -i "killed process\|out of memory\|oom"
journalctl -u your-app-service | grep -i "memory\|heap\|oom"

# macOS
log show --predicate 'eventMessage contains "memory"' --last 1h
```

3. **Monitor Node.js heap**:
```bash
# Add to your app or use the monitoring endpoint
curl http://localhost:5000/api/admin/monitoring/system
```

### Common OOM Patterns to Look For

```
# Node.js heap exhaustion
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed

# Linux OOM Killer
Out of memory: Kill process [PID] (node) score [score] or sacrifice child
Killed process [PID] (node) total-vm:XXXkB, anon-rss:XXXkB

# PostgreSQL connection exhaustion
FATAL: remaining connection slots are reserved for non-replication superuser connections
FATAL: too many connections for role
```

### Preventive Configuration

```bash
# Increase Node.js heap size (in package.json script or env)
NODE_OPTIONS="--max-old-space-size=4096"

# Configure PostgreSQL connection limits in .env
DB_POOL_SIZE=50
DB_READ_POOL_SIZE=50
```

## Database Indexes

The application includes 50+ indexes covering:
- User lookups (email, phone, role)
- Product/Service filtering (category, shop_id, provider_id)
- Order/Booking queries (customer_id, status, date)
- Cart/Wishlist operations (customer_id, product_id)
- Full-text search (GIN indexes on search vectors)
- Geographic queries (lat/long for nearby searches)

See migrations `0001_dashing_klaw.sql` through `0020_add_additional_indexes.sql` for complete index definitions.

## Load Testing

Run load tests with different user tiers:

```bash
# 100 users
k6 run ./load-test-benchmark.js -e SCENARIO=tier_100

# 500 users  
k6 run ./load-test-benchmark.js -e SCENARIO=tier_500

# 1000 users
k6 run ./load-test-benchmark.js -e SCENARIO=tier_1000

# 5000 users
k6 run ./load-test-benchmark.js -e SCENARIO=tier_5000

# All tiers sequentially
k6 run ./load-test-benchmark.js -e SCENARIO=all_tiers
```

Output includes:
- Request latency (p50, p75, p90, p95, p99)
- Throughput (requests/second)
- Error rates
- Memory and CPU usage (when monitoring endpoint is accessible)
