/**
 * Refuses to run the integration suite against anything but a local test database.
 *
 * This matters more here than it looks. The suite truncates and re-seeds on every
 * file, and the developer `.env` in this repo points at the same Neon instance
 * that serves production. The previous check was
 * `DATABASE_URL?.includes('test')`, which passes for a Neon branch named
 * "testing", for `.../jobsphere_test` on any host on the internet, and for any
 * connection string that happens to contain the substring anywhere — including in
 * the password.
 *
 * Nor can the check be replaced by trusting env-file precedence: vitest loads
 * `.env`, `.env.local` and `.env.test` through Vite's loadEnv and merges them into
 * process.env, so a key present in `.env` and absent from `.env.test` reaches the
 * tests. The guard has to inspect the value it is actually handed.
 *
 * Kept as its own module so it can be unit tested without a database.
 */

export interface DatabaseTarget {
  host: string
  database: string
}

/** Hosts that can only ever be the developer's own machine. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])

/** Substrings that mark a managed/remote provider, checked against the whole URL. */
const REMOTE_MARKERS = ['neon.tech', 'supabase.co', 'rds.amazonaws.com', 'azure.com', '-pooler']

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeTestDatabaseError'
  }
}

/**
 * Validates a connection string and returns the host/database for logging.
 *
 * Throws rather than calling process.exit: inside a vitest fork, process.exit
 * kills the worker and the runner reports a bare "process exited unexpectedly"
 * with none of the explanation below.
 *
 * Never returns or logs the full URL — it carries the password.
 */
export function assertTestDatabase(
  url: string | undefined,
  { allowRemote = false }: { allowRemote?: boolean } = {},
): DatabaseTarget {
  if (!url) {
    throw new UnsafeTestDatabaseError(
      'DATABASE_URL is not set. The integration suite needs a local test database.\n' +
        'Start one with: yarn test:db:up\n' +
        'Then: $env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/jobsphere_test"',
    )
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new UnsafeTestDatabaseError('DATABASE_URL is not a valid URL.')
  }

  const host = parsed.hostname
  const database = parsed.pathname.replace(/^\//, '')
  const where = `${host}/${database || '(none)'}`

  if (allowRemote) return { host, database }

  const marker = REMOTE_MARKERS.find((m) => url.includes(m))
  if (marker) {
    throw new UnsafeTestDatabaseError(
      `Refusing to run integration tests against a managed database (matched "${marker}").\n` +
        `Target was ${where}. This suite truncates and re-seeds data.\n` +
        'Set ALLOW_REMOTE_TEST_DB=1 only if you are certain the target is disposable.',
    )
  }

  if (!LOCAL_HOSTS.has(host)) {
    throw new UnsafeTestDatabaseError(
      `Refusing to run integration tests against a non-local host.\n` +
        `Target was ${where}; expected localhost or 127.0.0.1.`,
    )
  }

  // Belt and braces: a local Postgres can still hold the developer's real data.
  if (!/_test$/.test(database)) {
    throw new UnsafeTestDatabaseError(
      `Refusing to run integration tests against a database whose name does not end in "_test".\n` +
        `Target was ${where}. Expected something like jobsphere_test.`,
    )
  }

  return { host, database }
}
