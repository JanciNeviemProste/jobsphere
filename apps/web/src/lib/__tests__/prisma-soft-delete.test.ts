/**
 * Soft-delete middleware.
 *
 * Every read in the app depends on this one $use hook, and until now nothing
 * pinned it. The two properties below pull in opposite directions, which is
 * exactly why they need pinning together:
 *
 *   1. ordinary reads must not see soft-deleted rows
 *   2. code whose job IS the deleted rows — the GDPR retention phase — must
 *      still be able to ask for them
 *
 * Reading only the first property leads to "fix the spread order so the default
 * always wins", which would turn lib/cron.ts's
 * `deletedAt: { not: null, lte: cutoff }` into `deletedAt: null`, match nothing,
 * and leave the Article 17 erasure job reporting success while erasing nobody.
 *
 * The middleware is exercised through a stub $use rather than a live database:
 * what is under test is the argument rewriting, and a real Postgres would only
 * make the same assertions slower and flakier.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

type MiddlewareParams = {
  model?: string
  action: string
  args?: Record<string, any>
}
type Middleware = (
  params: MiddlewareParams,
  next: (p: MiddlewareParams) => Promise<any>,
) => Promise<any>

const registered: Middleware[] = []

// Capture the middleware the module registers, instead of talking to a database.
vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    $use(fn: Middleware) {
      registered.push(fn)
    }
    $disconnect() {
      return Promise.resolve()
    }
  },
}))

beforeEach(async () => {
  registered.length = 0
  vi.resetModules()
  await import('../prisma')
})

/** Runs the captured middleware and returns the args it forwarded downstream. */
async function run(params: MiddlewareParams): Promise<Record<string, any>> {
  expect(registered.length).toBe(1)
  let forwarded: MiddlewareParams | undefined
  await registered[0](params, async (p) => {
    forwarded = p
    return null
  })
  return forwarded!.args ?? {}
}

const SOFT_DELETE_MODELS = ['Job', 'Organization', 'User', 'Candidate', 'Application']

describe('ordinary reads hide soft-deleted rows', () => {
  const actions = ['findFirst', 'findFirstOrThrow', 'findMany', 'count', 'groupBy', 'aggregate']

  it.each(actions)('%s gets deletedAt: null injected', async (action) => {
    const args = await run({ model: 'Job', action })
    expect(args.where).toEqual({ deletedAt: null })
  })

  it.each(SOFT_DELETE_MODELS)('applies to %s', async (model) => {
    const args = await run({ model, action: 'findMany' })
    expect(args.where).toEqual({ deletedAt: null })
  })

  it("preserves the caller's other conditions", async () => {
    const args = await run({
      model: 'Application',
      action: 'groupBy',
      args: { by: ['stage'], where: { orgId: 'org-1' } },
    })
    expect(args.where).toEqual({ orgId: 'org-1', deletedAt: null })
    expect(args.by).toEqual(['stage'])
  })

  // groupBy/aggregate were missing from the action list. The seven call sites in
  // dashboard/stats, the employer analytics/applicants/pipeline pages and the
  // application/job services therefore counted withdrawn candidates into the
  // totals shown to recruiters.
  it.each(['groupBy', 'aggregate'])(
    '%s is covered — the stage tallies were wrong without it',
    async (action) => {
      const args = await run({ model: 'Application', action })
      expect(args.where).toMatchObject({ deletedAt: null })
    },
  )
})

describe('models and actions outside the policy are left alone', () => {
  it.each(['Assessment', 'EmailSequence', 'MatchScore'])(
    '%s has no deletedAt column and is untouched',
    async (model) => {
      const args = await run({ model, action: 'findMany', args: { where: { orgId: 'o' } } })
      expect(args.where).toEqual({ orgId: 'o' })
    },
  )

  it.each(['create', 'update', 'delete', 'upsert', 'updateMany'])(
    '%s is a write and is not filtered',
    async (action) => {
      const args = await run({ model: 'Job', action, args: { data: { title: 't' } } })
      expect(args.where).toBeUndefined()
    },
  )

  // findUnique's where accepts only unique fields, so Prisma would reject an
  // injected deletedAt. It is excluded on purpose — the mitigation is to use
  // findFirst at the call site, not to widen this list.
  it('findUnique is excluded, because Prisma would reject the injected filter', async () => {
    const args = await run({ model: 'Job', action: 'findUnique', args: { where: { id: 'job-1' } } })
    expect(args.where).toEqual({ id: 'job-1' })
  })
})

describe('the retention escape hatch stays open', () => {
  it('lets an explicit deletedAt override the default', async () => {
    // This is the exact query lib/cron.ts runs to find candidates past their
    // erasure window. If it ever comes back as `deletedAt: null`, GDPR erasure
    // has stopped working and will do so silently.
    const cutoff = new Date('2026-01-01T00:00:00Z')
    const args = await run({
      model: 'Candidate',
      action: 'findMany',
      args: { where: { deletedAt: { not: null, lte: cutoff } } },
    })

    expect(args.where).toEqual({ deletedAt: { not: null, lte: cutoff } })
    expect(args.where.deletedAt).not.toBeNull()
  })

  it('lets a caller ask for deleted rows explicitly', async () => {
    const args = await run({
      model: 'Job',
      action: 'count',
      args: { where: { deletedAt: { not: null } } },
    })
    expect(args.where).toEqual({ deletedAt: { not: null } })
  })
})
