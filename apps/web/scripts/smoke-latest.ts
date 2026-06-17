/**
 * Runtime smoke test for the highest-risk remediation logic, against a REAL database.
 *
 * Unit tests mock Prisma; this exercises the actual DB. Run it the moment you have a
 * throwaway Postgres (with pgvector) to turn "never run live" into proven:
 *
 *   cd apps/web
 *   DATABASE_URL="postgresql://.../jobsphere_smoke" npx tsx scripts/smoke-latest.ts
 *
 * It creates its own throwaway org/users/candidates under a unique smoke- prefix and
 * cleans them up in a finally block. It does NOT touch existing data. Exit code = number
 * of failed checks (0 = all green).
 *
 * Covered: DB connectivity · identity resolver (create+link, idempotent) · GDPR Art.17
 * erasure (hard-delete path AND author-tombstone anonymize path).
 */

// env.ts validates at import time, so set safe dummies for everything EXCEPT the real
// DATABASE_URL the caller provides. The dynamic imports inside run() happen afterwards.
// (NODE_ENV is intentionally left as-is — its type is read-only and env.ts defaults it.)
process.env.NEXTAUTH_SECRET ||= 'smoke-smoke-smoke-smoke-smoke-smoke'
process.env.NEXTAUTH_URL ||= 'http://localhost:3000'
process.env.ENCRYPTION_KEY ||= '0'.repeat(64)
process.env.REDIS_URL ||= 'redis://localhost:6379'
process.env.OPENROUTER_API_KEY ||= 'smoke'
process.env.ANTHROPIC_API_KEY ||= 'smoke'
process.env.OPENAI_API_KEY ||= 'smoke'
process.env.NEXT_PUBLIC_APP_URL ||= 'http://localhost:3000'
process.env.NEXT_PUBLIC_API_URL ||= 'http://localhost:3000/api'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    console.log(`  ✅ ${name}`)
  } else {
    failures += 1
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Set DATABASE_URL to a throwaway Postgres (with pgvector) and re-run.')
    process.exit(2)
  }

  const { prisma } = await import('@/lib/prisma')
  const { getOrCreateCandidateForUser, getCandidateIdsForUser } = await import('@/lib/identity')
  const { GdprService } = await import('@/services/gdpr.service')

  const SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const ORG = `smoke-org-${SUFFIX}`
  const ids = {
    resolver: `smoke-user-resolver-${SUFFIX}`,
    hardDelete: `smoke-user-harddel-${SUFFIX}`,
    anonymize: `smoke-user-anon-${SUFFIX}`,
    recruiter: `smoke-user-recruiter-${SUFFIX}`,
  }

  async function cleanup() {
    // FK-safe teardown of everything this script created, scoped to the smoke org/users.
    try {
      await prisma.applicationActivity.deleteMany({ where: { application: { orgId: ORG } } })
      await prisma.application.deleteMany({ where: { orgId: ORG } })
      await prisma.matchScore.deleteMany({ where: { orgId: ORG } })
      await prisma.candidateContact.deleteMany({ where: { candidate: { orgId: ORG } } })
      await prisma.candidateDocument.deleteMany({ where: { candidate: { orgId: ORG } } })
      await prisma.candidate.deleteMany({ where: { orgId: ORG } })
      await prisma.job.deleteMany({ where: { orgId: ORG } })
      await prisma.userOrgRole.deleteMany({ where: { orgId: ORG } })
      await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } })
      await prisma.organization.deleteMany({ where: { id: ORG } })
    } catch (err) {
      console.error('⚠️  cleanup error (manual cleanup of smoke- rows may be needed):', err)
    }
  }

  try {
    console.log(`\n🔬 Smoke test (org ${ORG})\n`)

    // 1. Connectivity --------------------------------------------------------
    console.log('1) DB connectivity')
    await prisma.$queryRaw`SELECT 1`
    check('SELECT 1 succeeds', true)

    // Base org + a recruiter to author jobs.
    await prisma.organization.create({ data: { id: ORG, name: 'Smoke Org', slug: ORG } })
    await prisma.user.create({
      data: { id: ids.recruiter, email: `recruiter-${SUFFIX}@smoke.test`, name: 'Smoke Recruiter' },
    })

    // 2. Identity resolver ---------------------------------------------------
    console.log('2) Identity resolver')
    await prisma.user.create({
      data: { id: ids.resolver, email: `resolver-${SUFFIX}@smoke.test`, name: 'Resolver User' },
    })
    const c1 = await getOrCreateCandidateForUser(ids.resolver, ORG)
    check('creates + links a candidate', c1.userId === ids.resolver && c1.orgId === ORG)
    const contact = await prisma.candidateContact.findFirst({
      where: { candidateId: c1.id, isPrimary: true },
    })
    check('seeds primary contact from user', contact?.email === `resolver-${SUFFIX}@smoke.test`)
    const c2 = await getOrCreateCandidateForUser(ids.resolver, ORG)
    check('idempotent (same candidate on 2nd call)', c2.id === c1.id)
    const resolverIds = await getCandidateIdsForUser(ids.resolver)
    check('getCandidateIdsForUser returns the linked id', resolverIds.includes(c1.id))

    // 3. GDPR erasure — hard-delete path (no authored jobs) ------------------
    console.log('3) GDPR Art.17 — hard-delete path')
    await prisma.user.create({
      data: { id: ids.hardDelete, email: `harddel-${SUFFIX}@smoke.test`, name: 'HardDel User' },
    })
    const hdCand = await getOrCreateCandidateForUser(ids.hardDelete, ORG)
    const job = await prisma.job.create({
      data: {
        title: 'Smoke Job',
        description: 'x'.repeat(60),
        orgId: ORG,
        createdBy: ids.recruiter,
        locale: 'en',
        status: 'PUBLISHED',
        employmentType: 'FULL_TIME',
      },
    })
    await prisma.application.create({
      data: { jobId: job.id, candidateId: hdCand.id, orgId: ORG, stage: 'NEW' },
    })
    await GdprService.eraseUserData(ids.hardDelete)
    const hdUser = await prisma.user.findUnique({ where: { id: ids.hardDelete } })
    check('user row hard-deleted', hdUser === null)
    const hdCandLeft = await prisma.candidate.count({ where: { id: hdCand.id } })
    check('candidate rows erased', hdCandLeft === 0)
    const hdAppLeft = await prisma.application.count({ where: { candidateId: hdCand.id } })
    check('applications erased', hdAppLeft === 0)

    // 4. GDPR erasure — anonymize path (user authored a job) -----------------
    console.log('4) GDPR Art.17 — author-tombstone (anonymize) path')
    await prisma.user.create({
      data: {
        id: ids.anonymize,
        email: `anon-${SUFFIX}@smoke.test`,
        name: 'Anon User',
        lastLoginIp: '203.0.113.7',
        lastLoginAt: new Date(),
        emailVerified: new Date(),
      },
    })
    const anonCand = await getOrCreateCandidateForUser(ids.anonymize, ORG)
    await prisma.job.create({
      data: {
        title: 'Authored Job',
        description: 'y'.repeat(60),
        orgId: ORG,
        createdBy: ids.anonymize, // authored → cannot hard-delete → must anonymize
        locale: 'en',
        status: 'PUBLISHED',
        employmentType: 'FULL_TIME',
      },
    })
    await GdprService.eraseUserData(ids.anonymize)
    const anon = await prisma.user.findUnique({ where: { id: ids.anonymize } })
    check('tombstone user kept (FK to authored job intact)', anon !== null)
    check('email anonymized', !!anon && anon.email.startsWith(`erased-${ids.anonymize}`))
    check(
      'PII nulled (name/ip/loginAt/verified)',
      !!anon &&
        anon.name === null &&
        anon.lastLoginIp === null &&
        anon.lastLoginAt === null &&
        anon.emailVerified === null,
    )
    check('password + totp cleared', !!anon && anon.password === null && anon.totpSecret === null)
    check('sessionEpoch incremented (sessions revoked)', !!anon && anon.sessionEpoch >= 1)
    check('deletedAt set', !!anon && anon.deletedAt !== null)
    const anonCandLeft = await prisma.candidate.count({ where: { id: anonCand.id } })
    check('candidate PII erased on anonymize', anonCandLeft === 0)
  } catch (err) {
    failures += 1
    console.error('\n❌ Smoke run threw:', err)
  } finally {
    await cleanup()
    await prisma.$disconnect()
  }

  console.log(
    `\n${failures === 0 ? '✅ ALL SMOKE CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}\n`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

void run()
