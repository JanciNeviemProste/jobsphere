/**
 * Runtime smoke test for the personal CV profile flow against a REAL database.
 *
 *   cd apps/web
 *   DATABASE_URL="postgresql://.../neondb" npx tsx scripts/smoke-profile-cv.ts
 *
 * Covers: sentinel personal org (idempotent) · personal candidate resolver
 * (create + idempotent) · saving a builder CV as a Resume with JSON round-trip
 * (personalInfo/skills/interests/experiences) · soft-delete. Self-cleaning.
 */

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
    console.error('❌ Set DATABASE_URL and re-run.')
    process.exit(2)
  }

  const { prisma } = await import('@/lib/prisma')
  const { ensurePersonalOrg, getPersonalCandidateForUser } = await import('@/lib/identity')

  const SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const userId = `smoke-cv-user-${SUFFIX}`
  let candidateId = ''
  let resumeId = ''

  async function cleanup() {
    try {
      await prisma.resume.deleteMany({ where: { candidateId } })
      await prisma.candidateContact.deleteMany({ where: { candidateId } })
      await prisma.candidate.deleteMany({ where: { id: candidateId } })
      await prisma.user.deleteMany({ where: { id: userId } })
      // leave the shared sentinel personal org in place
    } catch (err) {
      console.error('⚠️  cleanup error (manual cleanup of smoke-cv- rows may be needed):', err)
    }
  }

  try {
    console.log(`\n🔬 Personal CV smoke test (user ${userId})\n`)

    console.log('1) DB connectivity')
    await prisma.$queryRaw`SELECT 1`
    check('SELECT 1 succeeds', true)

    // a pure job-seeker: User with NO org membership
    await prisma.user.create({
      data: { id: userId, email: `${userId}@smoke.test`, name: 'Smoke Seeker' },
    })

    console.log('2) Sentinel personal org')
    const orgId1 = await ensurePersonalOrg()
    const orgId2 = await ensurePersonalOrg()
    check('ensurePersonalOrg idempotent', !!orgId1 && orgId1 === orgId2)

    console.log('3) Personal candidate resolver')
    const c1 = await getPersonalCandidateForUser(userId)
    candidateId = c1.id
    check('creates personal candidate linked to user', c1.userId === userId && c1.orgId === orgId1)
    const c2 = await getPersonalCandidateForUser(userId)
    check('idempotent (same candidate)', c2.id === c1.id)

    console.log('4) Save builder CV as Resume (JSON round-trip)')
    const personalInfo = {
      fullName: 'Ján Uchádzač',
      email: 'jan@smoke.test',
      phone: '0900',
      location: 'Žilina',
      linkedin: '',
      website: '',
      photo: '',
      interests: ['turistika', 'čítanie'],
      skills: [
        { name: 'TypeScript', level: 'Expert' },
        { name: 'React', level: 'Pokročilý' },
      ],
    }
    const resume = await prisma.resume.create({
      data: {
        candidateId,
        language: 'sk',
        personalInfo,
        experiences: [
          {
            company: 'ACME',
            position: 'Dev',
            period: '2020-2024',
            description: 'x',
            current: false,
          },
        ],
        education: [{ school: 'UNIZA', degree: 'Ing.', field: 'Informatika', year: '2020' }],
        languages: [{ name: 'Angličtina', proficiency: 'C1' }],
        skills: personalInfo.skills.map((s) => s.name),
      },
    })
    resumeId = resume.id

    const read = await prisma.resume.findUniqueOrThrow({ where: { id: resumeId } })
    const pi = read.personalInfo as any
    check('personalInfo persisted', pi.fullName === 'Ján Uchádzač' && pi.location === 'Žilina')
    check(
      'skills String[] persisted (for matching)',
      read.skills.includes('TypeScript') && read.skills.length === 2,
    )
    check(
      'skill levels round-trip via personalInfo.skills',
      Array.isArray(pi.skills) && pi.skills[0].level === 'Expert',
    )
    check('interests round-trip', Array.isArray(pi.interests) && pi.interests.includes('turistika'))
    check(
      'experiences persisted',
      Array.isArray(read.experiences) && (read.experiences as any[])[0].company === 'ACME',
    )

    console.log('5) Soft-delete')
    await prisma.resume.update({ where: { id: resumeId }, data: { deletedAt: new Date() } })
    const active = await prisma.resume.count({ where: { candidateId, deletedAt: null } })
    check('soft-deleted resume excluded from active list', active === 0)
  } catch (err) {
    failures += 1
    console.error('\n❌ Smoke run threw:', err)
  } finally {
    await cleanup()
    await prisma.$disconnect()
  }

  console.log(
    `\n${failures === 0 ? '✅ ALL PROFILE-CV SMOKE CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}\n`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

void run()

// Mark as a module so top-level declarations don't collide with other scripts/*.ts.
export {}
