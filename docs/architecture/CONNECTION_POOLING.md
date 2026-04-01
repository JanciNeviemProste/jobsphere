# Connection Pooling Guide

## Overview

Proper connection pooling prevents database connection exhaustion and ensures optimal performance under load. JobSphere uses Prisma's built-in connection pooling with PostgreSQL.

## Configuration

### Current Setup

**Pool Size:** 25 connections (configured via `connection_limit` in DATABASE_URL)
**Default:** Prisma uses 10 connections if not specified (too low for production)

```bash
# In .env or DATABASE_URL
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=25&statement_timeout=10000ms"
```

### Prisma Client Configuration

**Location:** `apps/web/src/lib/prisma.ts`

```typescript
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  // Pool size configured via DATABASE_URL connection_limit parameter
})
```

## Connection Pool Sizing

### Formula

```
pool_size = (core_count * 2) + effective_spindle_count
```

For typical web application:

- **4 CPU cores:** 8-10 connections (minimum)
- **8 CPU cores:** 16-20 connections (recommended)
- **16 CPU cores:** 30-35 connections (high scale)

### Recommended Sizes

| Environment             | Pool Size | Reasoning                       |
| ----------------------- | --------- | ------------------------------- |
| **Development**         | 10        | Low concurrency, fast iteration |
| **Staging**             | 20        | Production-like testing         |
| **Production (small)**  | 25        | Up to 50 req/s                  |
| **Production (medium)** | 50        | 50-200 req/s                    |
| **Production (large)**  | 100       | 200+ req/s                      |

**JobSphere Default:** 25 (sufficient for 50-100 concurrent requests)

### PostgreSQL Connection Limits

**Check max connections:**

```sql
SHOW max_connections; -- Default: 100
```

**Important:** Ensure pool_size across all app instances < max_connections

**Example:**

- PostgreSQL max_connections: 100
- App instances: 3
- Per-instance pool: 25
- Total used: 75 (leaves 25 for admin/maintenance)

## Connection Lifecycle

### 1. Connection Acquisition

```typescript
// Prisma automatically acquires connection from pool
const user = await prisma.user.findUnique({ where: { id } })
// Connection returned to pool after query
```

### 2. Connection Reuse

- Connections are reused across multiple queries
- No overhead of creating new connection for each query
- Dramatically faster than creating new connections

### 3. Connection Release

- Connections automatically released after query completes
- Long-running transactions hold connections longer
- Use `$disconnect()` only during graceful shutdown

## Best Practices

### 1. **Avoid Long-Running Transactions**

```typescript
// ❌ BAD: Holding connection for 10 seconds
await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUnique({ where: { id } })
  await sleep(10000) // DON'T DO THIS
  await tx.user.update({ where: { id }, data: { lastSeen: new Date() } })
})

// ✅ GOOD: Keep transactions short
const user = await prisma.user.findUnique({ where: { id } })
// Do processing here (connection released)
await prisma.user.update({ where: { id }, data: { lastSeen: new Date() } })
```

### 2. **Use Connection Efficiently**

```typescript
// ❌ BAD: Sequential queries (blocks connection)
const user = await prisma.user.findUnique({ where: { id } })
const posts = await prisma.post.findMany({ where: { authorId: id } })
const comments = await prisma.comment.findMany({ where: { authorId: id } })

// ✅ GOOD: Parallel queries (uses multiple connections)
const [user, posts, comments] = await Promise.all([
  prisma.user.findUnique({ where: { id } }),
  prisma.post.findMany({ where: { authorId: id } }),
  prisma.comment.findMany({ where: { authorId: id } }),
])

// ✅ BETTER: Single query with includes (one connection)
const user = await prisma.user.findUnique({
  where: { id },
  include: { posts: true, comments: true },
})
```

### 3. **Graceful Shutdown**

```typescript
// Implemented in apps/web/src/lib/prisma.ts
process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
```

### 4. **Monitor Pool Usage**

```typescript
// Check active connections
const activeConnections = await prisma.$queryRaw`
  SELECT COUNT(*) as count
  FROM pg_stat_activity
  WHERE datname = current_database()
  AND state = 'active';
`
```

## Connection Pool Exhaustion

### Symptoms

- `Error: Can't reach database server`
- `Connection timeout`
- Slow response times
- 500 errors

### Causes

1. **Pool size too small** for traffic
2. **Long-running queries** holding connections
3. **Connection leaks** (not releasing connections)
4. **Database overload** (max_connections reached)

### Solutions

#### 1. Increase Pool Size (if connections available)

```bash
# In DATABASE_URL
?connection_limit=50
```

#### 2. Optimize Query Performance

```typescript
// Add indexes for frequent queries
// Use EXPLAIN ANALYZE to identify slow queries
// See: QUERY_TIMEOUT_POLICY.md
```

#### 3. Implement Connection Pool Monitoring

```typescript
// Monitor pool exhaustion
prisma.$on('query', (e) => {
  if (e.duration > 1000) {
    console.warn('Slow query detected:', e.query, e.duration)
  }
})
```

#### 4. Use Read Replicas (Advanced)

```typescript
// Separate read/write connection pools
const readPrisma = new PrismaClient({
  datasources: { db: { url: READ_REPLICA_URL } },
})
const writePrisma = new PrismaClient({
  datasources: { db: { url: PRIMARY_URL } },
})
```

## Serverless Considerations

### Vercel / Netlify / AWS Lambda

**Problem:** Each function invocation creates new Prisma Client
**Solution:** Connection pooling with PgBouncer

```bash
# Use Prisma Data Proxy or PgBouncer
DATABASE_URL="postgresql://user:pass@pgbouncer.example.com:6432/db?connection_limit=10"
```

**Recommended:**

- Use Vercel Postgres (includes connection pooling)
- Use Supabase (includes Supavisor pooler)
- Use AWS RDS Proxy
- Self-host PgBouncer

### Cold Starts

- First request after cold start: ~500ms connection setup
- Subsequent requests: ~5ms (connection reused)
- Keep lambdas warm with scheduled pings if needed

## Monitoring

### Check Pool Metrics

```sql
-- Active connections
SELECT
  COUNT(*),
  state,
  application_name
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state, application_name;

-- Long-running queries
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
ORDER BY duration DESC;

-- Connection pool saturation
SELECT
  (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as active,
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') -
  (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as available;
```

### Sentry Integration

```typescript
import * as Sentry from '@sentry/nextjs'

prisma.$use(async (params, next) => {
  const start = Date.now()
  try {
    return await next(params)
  } catch (error) {
    const duration = Date.now() - start
    if (error.message.includes('connection') || error.message.includes('timeout')) {
      Sentry.captureException(error, {
        tags: {
          query: params.action,
          model: params.model,
          duration,
        },
      })
    }
    throw error
  }
})
```

## Troubleshooting

### Issue: `FATAL: remaining connection slots are reserved`

**Cause:** max_connections reached
**Solution:**

1. Increase PostgreSQL max_connections
2. Reduce pool_size per app instance
3. Add PgBouncer connection pooler

### Issue: `Error: Connection timeout`

**Cause:** Queries taking too long, pool exhausted
**Solution:**

1. Check query performance (EXPLAIN ANALYZE)
2. Add indexes for slow queries
3. Implement query timeouts (see QUERY_TIMEOUT_POLICY.md)

### Issue: `ECONNREFUSED`

**Cause:** Database not reachable
**Solution:**

1. Check DATABASE_URL correctness
2. Verify network connectivity
3. Check database server status

## Production Checklist

- [x] Connection pool size configured (25)
- [x] Connection limit in DATABASE_URL
- [x] Graceful shutdown handler
- [ ] Query performance monitoring
- [ ] Connection pool metrics dashboard
- [ ] Alerts for pool exhaustion
- [ ] Load testing with realistic traffic
- [ ] PgBouncer configured (if serverless)

## References

- [Prisma Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [PostgreSQL Connection Pooling](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [PgBouncer Documentation](https://www.pgbouncer.org/config.html)

---

**Configuration:** `apps/web/src/lib/prisma.ts`
**Environment:** `.env.example`, `.env.test.example`
**Author:** Claude Sonnet 4.5 (Senior Technical Architect)
**Date:** 2026-01-20
