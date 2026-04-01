# JobSphere Production Runbook

**Last Updated:** 2026-01-20
**Version:** 1.0
**Maintainer:** Engineering Team

## Table of Contents

1. [Emergency Contacts](#emergency-contacts)
2. [System Architecture Overview](#system-architecture-overview)
3. [Common Incidents & Solutions](#common-incidents--solutions)
4. [Monitoring & Alerts](#monitoring--alerts)
5. [Deployment Procedures](#deployment-procedures)
6. [Database Operations](#database-operations)
7. [Rollback Procedures](#rollback-procedures)
8. [Performance Troubleshooting](#performance-troubleshooting)

---

## Emergency Contacts

### On-Call Rotation

- **Primary On-Call:** TBD
- **Secondary On-Call:** TBD
- **Engineering Manager:** TBD

### Escalation Path

1. **Level 1:** On-call engineer (respond within 15 minutes)
2. **Level 2:** Engineering Manager (critical incidents)
3. **Level 3:** CTO (security breaches, data loss)

### Critical Stakeholders

- **Product Manager:** TBD
- **CTO:** TBD
- **Customer Support Lead:** TBD

### Communication Channels

- **Incident Slack Channel:** #incidents-production
- **Status Page:** TBD
- **Customer Communication:** TBD

---

## System Architecture Overview

### Infrastructure

- **Hosting:** Vercel (Next.js App)
- **Database:** PostgreSQL with pgvector (Vercel Postgres or self-hosted)
- **Cache/Rate Limiting:** Redis (Upstash KV)
- **Email Service:** Resend
- **File Storage:** Local (migrate to Vercel Blob or S3)
- **Background Jobs:** BullMQ with Redis

### Key Services

- **Web Application:** apps/web (Next.js 14)
- **Database:** PostgreSQL 15+ with pgvector extension
- **Workers:** Email sequences, embeddings, assessment grading
- **AI Services:** Claude AI (Anthropic), OpenAI (embeddings)

### Connection Limits

- **Database Pool:** 25 connections per instance
- **Query Timeout:** 10 seconds (statement_timeout)
- **Rate Limits:** See `apps/web/src/lib/rate-limit.ts`

---

## Common Incidents & Solutions

### 1. Connection Pool Exhaustion

**Symptoms:**

- Errors: "Can't reach database server", "Connection timeout"
- Slow response times across all endpoints
- 500 errors in Sentry

**Detection:**

```bash
# Check current pool usage
cd apps/web
node -e "require('./src/lib/connection-pool-monitor').logConnectionMetrics()"
```

**Expected Output:**

```
Connection Pool Metrics: {
  active: 12,
  idle: 8,
  waiting: 0,
  available: 5,
  utilizationPercent: '80%',
  status: 'healthy'
}
```

**Diagnosis:**

```bash
# Check for long-running queries
node -e "require('./src/lib/connection-pool-monitor').getLongRunningQueries().then(console.log)"
```

**Solution:**

**Option 1: Immediate (if utilization > 90%)**

```bash
# Scale up connection limit temporarily
vercel env add DATABASE_URL "postgresql://...?connection_limit=50&statement_timeout=10000ms" --target production
vercel --prod
```

**Option 2: Kill Long-Running Query (USE WITH CAUTION)**

```typescript
// Identify PID from getLongRunningQueries()
const { killConnection } = require('./apps/web/src/lib/connection-pool-monitor')
await killConnection(12345) // Replace with actual PID
```

**Option 3: Optimize Slow Queries**

- Review queries taking > 5 seconds
- Add database indexes
- Refactor N+1 queries

**Prevention:**

- Monitor pool utilization every 5 minutes
- Set alerts for utilization > 70%
- Review slow query logs weekly

---

### 2. Query Timeout Errors

**Symptoms:**

- Errors: "statement timeout", "canceling statement due to statement timeout"
- Operations fail after exactly 10 seconds
- Logged in Sentry with timeout context

**Detection:**

```bash
# Check Sentry for timeout errors
# Filter: error.message contains "statement timeout"
```

**Diagnosis:**

```sql
-- Find slow queries in PostgreSQL
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

**Solution:**

**Option 1: Optimize Query (PREFERRED)**

```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_name ON "Table" ("column");

-- Use EXPLAIN ANALYZE to identify bottlenecks
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM "Job" WHERE "publishedAt" <= NOW() LIMIT 20;
```

**Option 2: Increase Timeout for Specific Operation**

```typescript
import { withQueryTimeout, QueryTimeoutPresets } from '@/lib/query-timeout'

// For legitimate slow operations (analytics, exports)
const result = await withQueryTimeout(QueryTimeoutPresets.SLOW, async () => {
  return await prisma.job.findMany({
    include: { applications: { include: { candidate: true } } },
  })
})
```

**Option 3: Move to Background Job**

```typescript
// For operations > 30 seconds, use BullMQ
import { reportQueue } from '@/lib/queue'

await reportQueue.add('generate-report', { userId, reportType })
return Response.json({ jobId: job.id, status: 'processing' }, { status: 202 })
```

**Prevention:**

- Run EXPLAIN ANALYZE on all complex queries before deploying
- Add indexes for frequently filtered columns
- Use pagination for large datasets
- Monitor query performance metrics

---

### 3. Rate Limit Circuit Breaker Open

**Symptoms:**

- Log message: "Circuit breaker OPEN - Redis unavailable"
- Rate limiting using in-memory fallback (50% conservative limit)
- Increased 429 responses

**Detection:**

```bash
# Check Redis health
redis-cli -u $KV_REST_API_URL ping
```

**Diagnosis:**

```bash
# Check circuit breaker status in logs
grep "Circuit breaker" logs/production.log

# Check Redis connection
curl $KV_REST_API_URL/ping
```

**Solution:**

**Option 1: Verify Redis Service**

- Check Upstash KV dashboard
- Verify KV_REST_API_URL and KV_REST_API_TOKEN are correct
- Check network connectivity

**Option 2: Restart Application (if Redis is healthy)**

```bash
vercel --prod # Redeploy to reset circuit breaker
```

**Option 3: Temporary Override (EMERGENCY ONLY)**

```bash
# Disable rate limiting temporarily (max 30 minutes)
vercel env add DISABLE_RATE_LIMIT "true" --target production
vercel --prod

# IMPORTANT: Remove after incident resolved
vercel env rm DISABLE_RATE_LIMIT --target production
vercel --prod
```

**Prevention:**

- Monitor Redis uptime
- Set up alerts for Redis connection failures
- Test Redis failover scenario monthly

---

### 4. XSS Attack Detected

**Symptoms:**

- Suspicious HTML patterns in database (e.g., `<script>`, `javascript:`, `onerror=`)
- User reports unusual behavior on pages
- DOMPurify sanitization logs showing removed content

**Detection:**

```sql
-- Search for suspicious patterns in key fields
SELECT id, email, description
FROM "User"
WHERE description LIKE '%<script%'
   OR description LIKE '%javascript:%'
   OR description LIKE '%onerror=%'
LIMIT 10;
```

**Diagnosis:**

```bash
# Review audit logs for suspicious activity
# Check apps/web/src/lib/audit-log.ts records
```

**Solution:**

**Option 1: Automatic Protection (Already in Place)**

- DOMPurify middleware automatically sanitizes on create/update
- See `apps/web/src/lib/prisma.ts` XSS middleware
- No manual action needed if middleware is working

**Option 2: Retroactive Cleanup (if old data exists)**

```typescript
// Run sanitization script on existing data
import { sanitizeHtml } from '@/lib/sanitize'

const users = await prisma.user.findMany({
  where: { description: { contains: '<' } },
})

for (const user of users) {
  const sanitized = sanitizeHtml(user.description)
  if (sanitized !== user.description) {
    await prisma.user.update({
      where: { id: user.id },
      data: { description: sanitized },
    })
    console.log(`Sanitized user ${user.id}`)
  }
}
```

**Option 3: Block Malicious User**

```sql
-- If specific user is attacking
UPDATE "User" SET "lockedUntil" = NOW() + INTERVAL '24 hours' WHERE email = 'attacker@example.com';
```

**Prevention:**

- Review audit logs weekly for suspicious patterns
- Run security scans monthly (OWASP ZAP)
- Keep DOMPurify updated
- Test XSS protection with test payloads

---

### 5. Account Lockout Issues

**Symptoms:**

- User reports: "Cannot log in"
- Error in logs: "Account locked for user@example.com"
- failedAttempts = 5, lockedUntil > NOW()

**Detection:**

```sql
-- Check locked accounts
SELECT id, email, failedAttempts, lockedUntil
FROM "User"
WHERE lockedUntil > NOW()
ORDER BY lockedUntil DESC;
```

**Diagnosis:**

```sql
-- Check specific user
SELECT id, email, failedAttempts, lockedUntil, lastLoginAt
FROM "User"
WHERE email = 'user@example.com';
```

**Solution:**

**Option 1: Wait for Auto-Unlock (PREFERRED)**

- Lockout duration: 15 minutes
- Auto-unlocks when lockedUntil < NOW()
- No manual intervention needed

**Option 2: Manual Unlock (if legitimate user)**

```sql
-- Reset lockout for specific user
UPDATE "User"
SET "failedAttempts" = 0, "lockedUntil" = NULL
WHERE email = 'user@example.com';
```

**Option 3: Reset Password (if user forgot password)**

```typescript
// Send password reset email
import { sendPasswordResetEmail } from '@/lib/email'

await sendPasswordResetEmail({
  to: 'user@example.com',
  resetToken: generatedToken,
})
```

**Prevention:**

- Educate users about password requirements
- Implement "forgot password" flow prominently
- Monitor lockout rates (alert if > 10 users/hour)
- Consider CAPTCHA after 2 failed attempts

---

### 6. Slow Vector Search Performance

**Symptoms:**

- Job search taking > 2 seconds
- CV matching timing out
- High database CPU usage

**Detection:**

```sql
-- Check HNSW index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('Job', 'ResumeSection')
  AND indexname LIKE '%hnsw%';
```

**Diagnosis:**

```sql
-- Test vector search performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM "ResumeSection"
WHERE "embeddingVector" IS NOT NULL
ORDER BY "embeddingVector" <=> '[0.1,0.2,...]'::vector
LIMIT 10;

-- Should use "Index Scan using resume_section_embedding_hnsw_idx"
```

**Solution:**

**Option 1: Verify HNSW Index**

```sql
-- Check if index is valid
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE indexname LIKE '%hnsw%';

-- If idx_scan = 0, index not being used
```

**Option 2: Rebuild HNSW Index (if corrupted)**

```sql
-- Reindex concurrently (no downtime)
REINDEX INDEX CONCURRENTLY job_embedding_hnsw_idx;
REINDEX INDEX CONCURRENTLY resume_section_embedding_hnsw_idx;
```

**Option 3: Tune HNSW Parameters**

```sql
-- Increase search quality (may be slower)
SET hnsw.ef_search = 200; -- Default: 100
```

**Prevention:**

- Monitor vector search query times
- Run REINDEX monthly on vector indexes
- Ensure embeddings are normalized
- See `apps/web/src/lib/VECTOR_SEARCH_PERFORMANCE.md`

---

### 7. Email Delivery Failures

**Symptoms:**

- Users not receiving emails
- Errors: "Failed to send email", Resend API errors
- Email sequences stalled

**Detection:**

```bash
# Check Resend dashboard
# https://resend.com/emails

# Check email queue
redis-cli -u $REDIS_URL llen "bull:email:waiting"
```

**Diagnosis:**

```typescript
// Check recent email logs
import { prisma } from '@/lib/prisma'

const recentEmails = await prisma.emailLog.findMany({
  where: { status: 'FAILED' },
  orderBy: { createdAt: 'desc' },
  take: 10,
})
```

**Solution:**

**Option 1: Verify Resend API Key**

```bash
# Test Resend connection
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"test@yourdomain.com","to":"test@example.com","subject":"Test","html":"Test"}'
```

**Option 2: Retry Failed Emails**

```typescript
// Retry email sequence job
import { emailQueue } from '@/lib/queue'

await emailQueue.add('retry-failed', { sequenceId: 'xxx' })
```

**Option 3: Switch to Backup Email Service**

```bash
# If Resend is down, switch to SendGrid
vercel env add EMAIL_SERVICE "sendgrid" --target production
vercel env add SENDGRID_API_KEY "SG.xxx" --target production
vercel --prod
```

**Prevention:**

- Monitor email delivery rates (alert if < 95%)
- Set up webhook for email bounces
- Maintain backup email service credentials
- Test email deliverability weekly

---

## Monitoring & Alerts

### Sentry Error Tracking

**Setup:**

```bash
# Configure Sentry
vercel env add NEXT_PUBLIC_SENTRY_DSN "https://...@sentry.io/..." --target production
vercel env add SENTRY_AUTH_TOKEN "..." --target production
```

**Critical Alerts:**

- Error rate > 1% for 5 minutes
- Any CRITICAL errors (database connection, auth failures)
- Query timeout errors > 10/minute
- Rate limit rejections > 50/minute

### Connection Pool Monitoring

**Scheduled Job** (every 5 minutes):

```typescript
// Add to cron job or monitoring service
import { monitorConnectionPool } from '@/lib/connection-pool-monitor'

setInterval(
  async () => {
    await monitorConnectionPool()
  },
  5 * 60 * 1000,
)
```

**Alerts:**

- Utilization > 70%: WARNING
- Utilization > 85%: CRITICAL
- Available connections < 10: CRITICAL
- Long-running queries > 5: WARNING

### Uptime Monitoring

**Services:**

- **UptimeRobot:** Monitor https://yourdomain.com/api/health every 5 minutes
- **Pingdom:** Monitor from multiple regions
- **Vercel Analytics:** Built-in monitoring

**Health Check Endpoint:**

```typescript
// apps/web/src/app/api/health/route.ts
export async function GET() {
  // Check database connection
  await prisma.$queryRaw`SELECT 1`

  // Check Redis connection
  await redis.ping()

  return Response.json({ status: 'healthy' })
}
```

### Custom Metrics

**Track:**

- API response times (p50, p95, p99)
- Database query times
- Background job processing times
- Email delivery rates
- Vector search performance

---

## Deployment Procedures

### Pre-Deployment Checklist

**Code Quality:**

- [ ] TypeScript compilation passes (`yarn typecheck`)
- [ ] All unit tests pass (`yarn test`)
- [ ] E2E tests pass (`yarn test:e2e`)
- [ ] Bundle size acceptable (`yarn build`)

**Database:**

- [ ] Migrations tested on staging
- [ ] Database backup created
- [ ] Rollback plan documented

**Security:**

- [ ] Security scan passed (OWASP ZAP)
- [ ] Environment variables validated
- [ ] Secrets rotated if needed

**Performance:**

- [ ] Load testing completed (if major changes)
- [ ] Query performance verified
- [ ] Connection pool monitoring active

### Deployment Steps

**1. Announce Maintenance Window (if needed)**

```bash
# Post to status page
# Notify customers via email
# Set maintenance banner in app
```

**2. Create Database Backup**

```bash
# PostgreSQL backup
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# Upload to S3 or secure storage
```

**3. Run Database Migrations**

```bash
# On staging first
cd packages/db
npx prisma migrate deploy

# Verify migrations applied
npx prisma migrate status
```

**4. Deploy to Production**

```bash
# Vercel deployment
git push origin main

# Or manual deployment
vercel --prod

# Verify deployment
curl https://yourdomain.com/api/health
```

**5. Post-Deployment Verification**

```bash
# Check error rates in Sentry
# Monitor connection pool utilization
# Verify background jobs processing
# Test critical user flows
```

**6. Monitor for 30 Minutes**

- Watch error rates
- Check performance metrics
- Verify no regressions
- Be ready to rollback if needed

---

## Database Operations

### Running Migrations

**Development:**

```bash
cd packages/db
npx prisma migrate dev --name migration_name
```

**Production:**

```bash
# Always test on staging first!
cd packages/db
npx prisma migrate deploy
```

**Verify Migration Status:**

```bash
npx prisma migrate status
```

### Creating Database Backup

**Full Backup:**

```bash
pg_dump -h $DB_HOST -U $DB_USER -F c -b -v -f backup.dump $DB_NAME
```

**Backup Specific Tables:**

```bash
pg_dump -h $DB_HOST -U $DB_USER -t "User" -t "Organization" $DB_NAME > users_orgs.sql
```

### Restoring from Backup

**Full Restore:**

```bash
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -v backup.dump
```

**SQL Restore:**

```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup.sql
```

### Database Performance Tuning

**Enable Query Statistics:**

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

**Find Slow Queries:**

```sql
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

**Check Table Sizes:**

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Rollback Procedures

### Application Rollback

**Vercel Rollback (Instant):**

```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel rollback

# Or rollback to specific deployment
vercel rollback <deployment-url>
```

**Verification:**

```bash
# Check deployed version
curl https://yourdomain.com/api/health

# Verify functionality
# Run smoke tests
```

### Database Rollback

**Option 1: Restore from Backup**

```bash
# Stop application first to prevent new writes
vercel env add MAINTENANCE_MODE "true" --target production

# Restore database
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME backup.dump

# Resume application
vercel env rm MAINTENANCE_MODE --target production
```

**Option 2: Revert Migrations**

```bash
# CAUTION: May cause data loss
cd packages/db

# Mark migration as not applied
npx prisma migrate resolve --rolled-back migration_name

# Run down migration (if exists)
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < down_migration.sql
```

### Rollback Decision Tree

**When to Rollback:**

- Critical security vulnerability introduced
- Data corruption detected
- Error rate > 5% for 10 minutes
- Core functionality broken (login, job posting, applications)
- Database migration failed partially

**When NOT to Rollback:**

- Minor UI bugs (can be fixed forward)
- Non-critical feature broken
- Single user reports issue
- Cosmetic issues
- Performance degradation < 20%

---

## Performance Troubleshooting

### High API Response Times

**Check 1: Database Connection Pool**

```typescript
const metrics = await getConnectionPoolMetrics()
console.log(metrics)
// If utilization > 80%, increase pool size
```

**Check 2: Slow Queries**

```sql
-- Find queries taking > 1 second
SELECT * FROM pg_stat_activity
WHERE state = 'active' AND (now() - query_start) > interval '1 second';
```

**Check 3: N+1 Queries**

```typescript
// Enable Prisma query logging
// Check logs for repeated similar queries
// Fix with proper includes/selects
```

**Check 4: Rate Limiting**

```bash
# Check if users hitting rate limits
grep "429" logs/production.log | wc -l
```

### High Database CPU

**Check 1: Missing Indexes**

```sql
-- Find table scans
SELECT schemaname, tablename, seq_scan, seq_tup_read
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_tup_read DESC
LIMIT 10;
```

**Check 2: Long-Running Queries**

```typescript
const longQueries = await getLongRunningQueries(5)
console.log(longQueries)
// Kill or optimize problematic queries
```

**Check 3: Lock Contention**

```sql
SELECT * FROM pg_locks WHERE NOT granted;
```

### High Memory Usage

**Check 1: Connection Pool Leaks**

```typescript
// Monitor connection count over time
// Should stabilize, not grow indefinitely
```

**Check 2: Large Query Results**

```typescript
// Use pagination instead of fetching all records
// Limit includes to necessary relations only
```

**Check 3: Worker Memory Leaks**

```bash
# Restart workers periodically
pm2 restart email-worker
pm2 restart embedding-worker
```

---

## Appendix: Useful Commands

### Database Queries

```sql
-- Current connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'jobsphere';

-- Kill query by PID
SELECT pg_terminate_backend(12345);

-- Check database size
SELECT pg_size_pretty(pg_database_size('jobsphere'));

-- Vacuum analyze (maintenance)
VACUUM ANALYZE;
```

### Redis Commands

```bash
# Check Redis memory usage
redis-cli -u $REDIS_URL INFO memory

# Clear rate limit for user
redis-cli -u $REDIS_URL DEL "rate-limit:user:123"

# Check queue length
redis-cli -u $REDIS_URL LLEN "bull:email:waiting"
```

### Vercel Commands

```bash
# List deployments
vercel ls

# View logs
vercel logs

# Environment variables
vercel env ls
vercel env add KEY value --target production
vercel env rm KEY --target production
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-20
**Next Review Date:** 2026-02-20
**Maintained By:** Engineering Team
