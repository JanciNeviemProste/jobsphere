/**
 * The integration suite's database guard.
 *
 * Lives in the unit suite on purpose: the guard's entire job is to stop the
 * integration suite from running, so it cannot be covered by the suite it
 * protects. It needs no database, which is the point.
 *
 * The case that matters most is the Neon one. The developer .env in this repo
 * points at the same instance that serves production, and the integration suite
 * truncates and re-seeds. The old check — `DATABASE_URL?.includes('test')` —
 * passed for a Neon branch with "test" in its name.
 */

import { describe, it, expect } from 'vitest'
import {
  assertTestDatabase,
  UnsafeTestDatabaseError,
} from '../../../tests/integration/helpers/assert-test-database'

const LOCAL = 'postgresql://postgres:postgres@localhost:5433/jobsphere_test'

describe('accepts a local test database', () => {
  it.each([
    ['localhost', LOCAL],
    ['127.0.0.1', 'postgresql://postgres:postgres@127.0.0.1:5433/jobsphere_test'],
    ['default port', 'postgresql://postgres:postgres@localhost/jobsphere_test'],
    ['another _test db', 'postgresql://u:p@localhost:5432/anything_test'],
  ])('%s', (_name, url) => {
    expect(() => assertTestDatabase(url)).not.toThrow()
  })

  it('reports host and database for logging, and nothing else', () => {
    // Deliberately asserting the shape: the connection string carries the
    // password, so the guard must never hand back or print the whole URL.
    const target = assertTestDatabase(LOCAL)
    expect(target).toEqual({ host: 'localhost', database: 'jobsphere_test' })
    expect(JSON.stringify(target)).not.toContain('postgres:postgres')
  })
})

describe('refuses managed and remote databases', () => {
  it.each([
    [
      'a Neon branch named "test" — the exact case the old check let through',
      'postgresql://user:pw@ep-cool-test-123.eu-central-1.aws.neon.tech/neondb?sslmode=require',
    ],
    [
      'a Neon pooler endpoint',
      'postgresql://user:pw@ep-x-pooler.eu-central-1.aws.neon.tech/jobsphere_test',
    ],
    ['Supabase', 'postgresql://user:pw@db.abcdefgh.supabase.co:5432/postgres'],
    ['RDS', 'postgresql://user:pw@prod.abc123.eu-west-1.rds.amazonaws.com:5432/jobsphere_test'],
  ])('%s', (_name, url) => {
    expect(() => assertTestDatabase(url)).toThrow(UnsafeTestDatabaseError)
  })

  it('refuses a non-local host even without a known provider marker', () => {
    expect(() =>
      assertTestDatabase('postgresql://u:p@db.internal.example.com:5432/jobsphere_test'),
    ).toThrow(/non-local host/)
  })

  it('names the offending host in the message, without the credentials', () => {
    let message = ''
    try {
      assertTestDatabase('postgresql://admin:hunter2@ep-test.neon.tech/neondb')
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain('neon.tech')
    expect(message).not.toContain('hunter2')
  })
})

describe('refuses a local database that is not a test database', () => {
  it.each([
    ['the dev database', 'postgresql://jobsphere:pw@localhost:5432/jobsphere'],
    ['plain postgres', 'postgresql://postgres:postgres@localhost:5432/postgres'],
    ['test only as a prefix', 'postgresql://postgres:postgres@localhost:5432/test_jobsphere'],
  ])('%s', (_name, url) => {
    expect(() => assertTestDatabase(url)).toThrow(/_test/)
  })

  it('is not fooled by "test" appearing in the password', () => {
    // `includes('test')` passed this; the parser does not.
    expect(() =>
      assertTestDatabase('postgresql://postgres:test1234@localhost:5432/jobsphere'),
    ).toThrow(UnsafeTestDatabaseError)
  })
})

describe('missing or malformed input', () => {
  it('refuses an unset DATABASE_URL and says how to start one', () => {
    expect(() => assertTestDatabase(undefined)).toThrow(/yarn test:db:up/)
  })

  it('refuses an empty string', () => {
    expect(() => assertTestDatabase('')).toThrow(UnsafeTestDatabaseError)
  })

  it('refuses a value that is not a URL', () => {
    expect(() => assertTestDatabase('host=localhost dbname=jobsphere_test')).toThrow(/valid URL/)
  })
})

describe('the escape hatch is explicit', () => {
  it('allows a remote target only when deliberately opted in', () => {
    const remote = 'postgresql://user:pw@ep-x.neon.tech/scratch'
    expect(() => assertTestDatabase(remote)).toThrow()
    expect(() => assertTestDatabase(remote, { allowRemote: true })).not.toThrow()
  })
})
