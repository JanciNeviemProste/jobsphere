/**
 * Interactive-transaction timeouts.
 *
 * Prisma's default is `{ maxWait: 2_000, timeout: 5_000 }`. The database's own
 * `statement_timeout` is 10s (20260120_add_query_timeouts), so on the default the
 * two are in the wrong order: Prisma gives up first and reports
 * `P2028 Transaction already closed`, which says nothing about which statement was
 * slow or why. Postgres should be the arbiter, because only Postgres can say
 * "this query exceeded statement_timeout".
 *
 * That mismatch does not matter for short CRUD — a signup or a job create that
 * takes five seconds is broken regardless, and failing fast there is a feature.
 * It matters for the transactions that legitimately do bulk work.
 *
 * Deliberately not applied everywhere: most of the ~28 `$transaction` call sites
 * in this app write a handful of rows, and raising their ceiling would only delay
 * the moment a stuck one lets go of its connection.
 */

/**
 * For transactions that delete or rewrite across many tables at once.
 *
 * Both current users are erasure paths, and both were on the 5s default:
 *
 *   - GdprService.eraseUserData — one user's entire footprint (candidates,
 *     documents, resumes, applications, consents, audit logs, saved jobs,
 *     notifications, DSAR records)
 *   - the retention cron — up to RETENTION_CANDIDATE_BATCH (default 500)
 *     candidates in a single transaction, each cascading across the same tables
 *
 * The retention one could not have worked at any realistic batch size: it would
 * hit P2028, the surrounding catch would log "erasure phase failed", and the
 * Article 17 deletions would silently never happen.
 *
 * `timeout` sits above the 10s statement_timeout so Postgres reports first.
 * `maxWait` is the ceiling on acquiring a connection from the pool, not on the
 * work itself.
 */
export const BULK_TX_OPTIONS = { maxWait: 10_000, timeout: 120_000 } as const

/**
 * For a transaction that carries `SET LOCAL` and runs a vector query.
 *
 * Semantic search is a sequential scan plus a full sort until the HNSW indexes
 * exist in production (remediation/pgvector-hnsw-runbook.md), so several seconds
 * is legitimate rather than a symptom.
 */
export const VECTOR_TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const
