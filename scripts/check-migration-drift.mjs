#!/usr/bin/env node
/**
 * Migration drift gate.
 *
 * `prisma migrate deploy` succeeding proves only that the migration files run
 * without erroring against an empty database. It says nothing about whether the
 * result matches schema.prisma — and in this repo it did not, for a long time,
 * because schema changes reach production through `db push` (see deploy.yml) and
 * the migration files were never updated to match.
 *
 * What that cost: a database built from the migration history was missing three
 * whole tables (FreelancerProfile, Gig, GigProposal), Candidate.userId, and
 * User.sessionEpoch, so the application died with P2022 on its first query.
 * Disaster recovery, a fresh environment and Neon preview branches would all have
 * produced exactly that database.
 *
 * This script closes the loop: it asks Prisma to diff the migration history
 * against the schema and requires the answer to equal the known, documented
 * residual in packages/db/prisma/expected-drift.sql — not merely to be small.
 *
 * Requires a scratch Postgres to replay migrations into:
 *   SHADOW_DATABASE_URL=postgresql://…/prisma_shadow node scripts/check-migration-drift.mjs
 *
 * Exit code: 0 = only expected drift, 1 = unexpected drift (or Prisma failed).
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRISMA_DIR = join(ROOT, 'packages', 'db', 'prisma')
const SCHEMA = join(PRISMA_DIR, 'schema.prisma')
const MIGRATIONS = join(PRISMA_DIR, 'migrations')
const EXPECTED = join(PRISMA_DIR, 'expected-drift.sql')

const shadowUrl = process.env.SHADOW_DATABASE_URL
if (!shadowUrl) {
  console.error(
    'drift: SHADOW_DATABASE_URL is not set.\n' +
      '  Prisma has to replay the migration history somewhere to compare it, and it\n' +
      '  WIPES that database — so it must not be your dev or test database.\n' +
      '  Locally:  yarn test:db:up  then\n' +
      '  $env:SHADOW_DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/prisma_shadow"',
  )
  process.exit(1)
}

/**
 * Strips everything that is not a SQL statement: blank lines, the Prisma CLI's
 * "Update available" banner, and yarn's own wrapper output. Without this the
 * comparison breaks every time a new Prisma release ships.
 */
function normalize(sql) {
  const lines = []
  let inBanner = false

  for (const raw of sql.split(/\r?\n/)) {
    const line = raw.trimEnd()
    // The version-nag box is drawn with box-drawing characters.
    if (/^[┌│└]/.test(line.trim())) {
      inBanner = true
      continue
    }
    if (inBanner && line.trim() === '') {
      inBanner = false
      continue
    }
    if (inBanner) continue

    if (line.trim() === '') continue
    if (line.startsWith('$ ')) continue // yarn echoing the command
    if (/^yarn run v/.test(line)) continue
    if (/^Done in /.test(line)) continue
    if (/^info /.test(line)) continue

    lines.push(line)
  }

  return lines.join('\n')
}

/** Comment lines exist to explain the expected file; they are not SQL. */
function stripComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter(
      (l) =>
        !/^\s*--(?!\s*(DropIndex|CreateIndex|AlterTable|CreateTable|AddForeignKey|CreateExtension|DropTable|DropColumn))/.test(
          l,
        ),
    )
    .join('\n')
}

let raw
try {
  raw = execFileSync(
    'npx',
    [
      'prisma',
      'migrate',
      'diff',
      '--from-migrations',
      MIGRATIONS,
      '--to-schema-datamodel',
      SCHEMA,
      '--shadow-database-url',
      shadowUrl,
      '--script',
    ],
    { encoding: 'utf8', shell: process.platform === 'win32' },
  )
} catch (error) {
  console.error(
    'drift: prisma migrate diff failed.\n' + (error.stdout || '') + (error.stderr || ''),
  )
  process.exit(1)
}

const actual = normalize(raw)
const expected = normalize(stripComments(readFileSync(EXPECTED, 'utf8')))

if (actual === expected) {
  console.log(
    'drift: OK — migrations reproduce schema.prisma (modulo the documented HNSW residual).',
  )
  process.exit(0)
}

console.error('drift: FAILED — the migration history no longer reproduces schema.prisma.\n')
console.error('Expected (packages/db/prisma/expected-drift.sql):')
console.error(expected || '  (nothing)')
console.error('\nActual:')
console.error(actual || '  (nothing)')
console.error(
  '\nThis almost always means a schema change was pushed with `db push` without a\n' +
    'matching migration. Generate one:\n' +
    '  npx prisma migrate diff --from-migrations packages/db/prisma/migrations \\\n' +
    '    --to-schema-datamodel packages/db/prisma/schema.prisma \\\n' +
    '    --shadow-database-url "$SHADOW_DATABASE_URL" --script\n' +
    'and save it as packages/db/prisma/migrations/<date>_<name>/migration.sql.\n' +
    'If production already has the change, reconcile it there with\n' +
    '  prisma migrate resolve --applied <migration_name>\n' +
    'instead of running the migration.',
)
process.exit(1)
