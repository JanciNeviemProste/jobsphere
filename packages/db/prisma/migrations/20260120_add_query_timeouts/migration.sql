-- Query Timeout Configuration
-- Prevents slow queries from hanging and protects against DoS attacks
-- statement_timeout: Maximum execution time for any single statement

-- Set default statement timeout to 10 seconds for all queries
-- This prevents runaway queries from locking database resources.
--
-- The database name is resolved at run time. It used to be hardcoded as
-- `ALTER DATABASE jobsphere`, which fails with 3D000 ("database jobsphere does
-- not exist") anywhere the database is called anything else — CI uses
-- `jobsphere_test`, and Neon assigns its own name. ALTER DATABASE takes no
-- expression for the target, so the name has to go through dynamic SQL.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET statement_timeout = %L', current_database(), '10s');
END
$$;

-- For the current session (takes effect immediately)
SET statement_timeout = '10s';

-- RATIONALE:
-- - 10 seconds is sufficient for 99% of queries
-- - Prevents DoS attacks via intentionally slow queries
-- - Protects against N+1 query problems in development
-- - Allows graceful failure vs hanging connections

-- EXCEPTIONS (queries that may need longer):
-- - CV parsing with embeddings: handled via background jobs (BullMQ)
-- - Large exports: use COPY command or pagination
-- - Analytics aggregations: use materialized views or pre-compute
-- - Database migrations: run with `SET statement_timeout = 0;` if needed

-- MONITORING:
-- Check for queries hitting timeout:
-- SELECT query, calls, total_time, mean_time
-- FROM pg_stat_statements
-- WHERE query LIKE '%ERROR%timeout%'
-- ORDER BY calls DESC;

-- Per-query override (if needed in application code):
-- await prisma.$executeRaw`SET LOCAL statement_timeout = '30s';`
-- await prisma.$queryRaw`SELECT * FROM large_table;`
