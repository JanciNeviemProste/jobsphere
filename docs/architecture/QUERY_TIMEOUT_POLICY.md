# Query Timeout Policy

## Overview

JobSphere implements a **10-second query timeout** for all database operations to prevent slow queries from hanging and protect against DoS attacks.

## Configuration

### Database Level (Default)

```sql
-- Set via migration: 20260120_add_query_timeouts
ALTER DATABASE jobsphere SET statement_timeout = '10s';
```

### Connection String (Application Level)

```bash
# In DATABASE_URL
DATABASE_URL="postgresql://user:pass@host:5432/db?statement_timeout=10000ms&connection_limit=25"
```

## Timeout Presets

| Preset        | Timeout | Use Case                        | Example                        |
| ------------- | ------- | ------------------------------- | ------------------------------ |
| **FAST**      | 2s      | List views, simple lookups      | `findMany({ take: 20 })`       |
| **NORMAL**    | 10s     | Detail views, filtered lists    | `findMany({ where, include })` |
| **SLOW**      | 30s     | Complex aggregations, reports   | Analytics queries              |
| **VERY_SLOW** | 60s     | Large exports, batch processing | CSV exports                    |
| **NONE**      | ∞       | Admin operations ONLY           | VACUUM, migrations             |

## When to Override Default Timeout

### ✅ Legitimate Use Cases

1. **Complex Analytics**

   ```typescript
   import { withQueryTimeout, QueryTimeoutPresets } from '@/lib/query-timeout'

   const analytics = await withQueryTimeout(QueryTimeoutPresets.SLOW, async () => {
     return await prisma.$queryRaw`
       SELECT DATE(created_at), COUNT(*)
       FROM "Application"
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) DESC
       LIMIT 365
     `
   })
   ```

2. **Large Data Exports**

   ```typescript
   const csvData = await withQueryTimeout(QueryTimeoutPresets.VERY_SLOW, async () => {
     return await prisma.candidate.findMany({
       include: { resumes: true, applications: true },
       take: 10000,
     })
   })
   ```

3. **Admin Operations**

   ```typescript
   import { withoutQueryTimeout } from '@/lib/query-timeout'

   // ONLY for admin/maintenance tasks
   await withoutQueryTimeout(async () => {
     await prisma.$executeRaw`VACUUM ANALYZE "Application";`
   })
   ```

### ❌ DON'T Override For

- **Slow N+1 queries** → Fix with proper `include` or `select`
- **Missing indexes** → Add database indexes
- **Large table scans** → Add WHERE filters
- **Unoptimized queries** → Use EXPLAIN ANALYZE and optimize

## Error Handling

### Detect Timeout Errors

```typescript
import { isQueryTimeoutError, handleQueryTimeout } from '@/lib/query-timeout'

try {
  const data = await complexQuery()
} catch (error) {
  if (isQueryTimeoutError(error)) {
    console.warn('Query timed out, using cached data')
    return getCachedData()
  }
  throw error
}
```

### Graceful Fallback

```typescript
try {
  return await expensiveQuery()
} catch (error) {
  return handleQueryTimeout(error, []) // Returns [] if timeout, otherwise throws
}
```

### Retry with Backoff

```typescript
import { retryQueryOnTimeout } from '@/lib/query-timeout'

const data = await retryQueryOnTimeout(
  async () => await prisma.job.findMany({ include: { applications: true } }),
  3, // max retries
  10000, // base timeout (increases exponentially: 10s, 20s, 40s)
)
```

## Best Practices

### 1. **Optimize First, Override Later**

```typescript
// ❌ BAD: Increase timeout for slow query
const jobs = await withQueryTimeout(30000, async () => {
  return await prisma.job.findMany({
    include: { applications: { include: { candidate: true } } },
  })
})

// ✅ GOOD: Optimize query
const jobs = await prisma.job.findMany({
  select: {
    id: true,
    title: true,
    _count: { select: { applications: true } },
  },
})
```

### 2. **Use Pagination**

```typescript
// ❌ BAD: Load all records
const candidates = await prisma.candidate.findMany()

// ✅ GOOD: Paginate
const candidates = await prisma.candidate.findMany({
  take: 20,
  skip: page * 20,
  orderBy: { createdAt: 'desc' },
})
```

### 3. **Leverage Indexes**

```typescript
// Ensure indexed fields in WHERE clauses
const jobs = await prisma.job.findMany({
  where: {
    publishedAt: { lte: new Date() }, // indexed
    status: 'PUBLISHED', // indexed
  },
})
```

### 4. **Background Jobs for Heavy Operations**

```typescript
// ❌ BAD: Synchronous heavy operation
export async function POST(req: Request) {
  const results = await generateAllReports() // 60s operation
  return Response.json(results)
}

// ✅ GOOD: Background job
import { reportQueue } from '@/lib/queue'

export async function POST(req: Request) {
  const job = await reportQueue.add('generate-reports', { userId })
  return Response.json({ jobId: job.id }, { status: 202 }) // Accepted
}
```

## Monitoring & Debugging

### Check for Timeout Errors in Logs

```bash
# Sentry / Logs
grep "statement timeout" logs/app.log
```

### Identify Slow Queries

```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find queries approaching timeout
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 5000 -- queries averaging >5s
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### EXPLAIN ANALYZE Slow Queries

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM "Job"
WHERE "publishedAt" <= NOW()
ORDER BY "createdAt" DESC
LIMIT 20;
```

Look for:

- **Seq Scan** → Add index
- **High cost** → Simplify query
- **Nested loops** → Check join strategy

## Production Checklist

- [x] Database-level timeout set (10s)
- [x] Connection string includes `statement_timeout` parameter
- [x] Query timeout utilities imported in complex operations
- [ ] Monitoring alerts configured for timeout errors
- [ ] Slow query log enabled in PostgreSQL
- [ ] pg_stat_statements extension installed
- [ ] Regular query performance reviews scheduled

## Common Timeout Scenarios

### Scenario 1: CV Upload with AI Processing

**Problem:** Parsing CV + generating embeddings takes 15-30s
**Solution:** Move to background job (BullMQ)

### Scenario 2: Analytics Dashboard

**Problem:** Complex aggregations timeout
**Solution:** Use materialized views, refresh hourly

### Scenario 3: Bulk Data Export

**Problem:** Exporting 50k candidates times out
**Solution:** Paginate export, stream results

### Scenario 4: Search with Multiple Joins

**Problem:** Job search with 5 includes times out
**Solution:** Reduce includes, use separate queries if needed

## References

- [PostgreSQL Statement Timeout](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-STATEMENT-TIMEOUT)
- [Prisma Connection Pooling](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)

---

**Migration:** `20260120_add_query_timeouts`
**Utilities:** `apps/web/src/lib/query-timeout.ts`
**Author:** Claude Sonnet 4.5 (Senior Technical Architect)
**Date:** 2026-01-20
