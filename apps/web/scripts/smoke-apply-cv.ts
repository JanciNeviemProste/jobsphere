/**
 * Runtime smoke test for Phase B — attaching a saved profile CV to an application
 * so the employer sees it. Exercises the REAL copyProfileCvToCandidate() against a
 * live DB. Self-cleaning.
 *
 *   cd apps/web
 *   DATABASE_URL="postgresql://.../neondb" npx tsx scripts/smoke-apply-cv.ts
 *
 * Covers: builder→employer shape normalization (position→title, period→startDate,
 * school→institution, year→endDate) · skills copy · source document copy + link.
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
  const { getPersonalCandidateForUser, getOrCreateCandidateForUser } = await import(
    '@/lib/identity'
  )
  const { copyProfileCvToCandidate } = await import('@/app/api/applications/route')

  const SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const ORG = `smoke-apply-org-${SUFFIX}`
  const seeker = `smoke-apply-seeker-${SUFFIX}`
  let personalCandidateId = ''
  let employerCandidateId = ''

  async function cleanup() {
    try {
      await prisma.resume.deleteMany({
        where: { candidate: { id: { in: [personalCandidateId, employerCandidateId] } } },
      })
      await prisma.candidateDocument.deleteMany({
        where: { candidateId: { in: [personalCandidateId, employerCandidateId] } },
      })
      await prisma.candidateContact.deleteMany({
        where: { candidateId: { in: [personalCandidateId, employerCandidateId] } },
      })
      await prisma.candidate.deleteMany({
        where: { id: { in: [personalCandidateId, employerCandidateId] } },
      })
      await prisma.userOrgRole.deleteMany({ where: { orgId: ORG } })
      await prisma.user.deleteMany({ where: { id: seeker } })
      await prisma.organization.deleteMany({ where: { id: ORG } })
    } catch (err) {
      console.error('⚠️  cleanup error (manual cleanup of smoke-apply- rows may be needed):', err)
    }
  }

  try {
    console.log(`\n🔬 Apply-with-CV smoke test (org ${ORG})\n`)

    console.log('1) Setup: employer org + job-seeker + personal CV')
    await prisma.organization.create({ data: { id: ORG, name: 'Smoke Apply Org', slug: ORG } })
    await prisma.user.create({
      data: { id: seeker, email: `${seeker}@smoke.test`, name: 'Smoke Seeker' },
    })
    const personal = await getPersonalCandidateForUser(seeker)
    personalCandidateId = personal.id

    // a builder-shaped profile CV + an uploaded source document
    const doc = await prisma.candidateDocument.create({
      data: {
        candidateId: personalCandidateId,
        type: 'CV',
        filename: 'cv.pdf',
        uri: 'https://example.public.blob.vercel-storage.com/cv.pdf',
        mime: 'application/pdf',
        size: 1234,
      },
    })
    const profileResume = await prisma.resume.create({
      data: {
        candidateId: personalCandidateId,
        sourceDocumentId: doc.id,
        language: 'sk',
        summary: 'Skúsený vývojár',
        personalInfo: { fullName: 'Ján Uchádzač', skills: [{ name: 'TS', level: 'Expert' }] },
        experiences: [
          {
            company: 'ACME',
            position: 'Senior Dev',
            period: '2020 - 2024',
            description: 'práca',
            current: false,
          },
        ],
        education: [{ school: 'UNIZA', degree: 'Ing.', field: 'Informatika', year: '2020' }],
        languages: [{ name: 'Angličtina', proficiency: 'C1' }],
        skills: ['TS', 'React'],
      },
    })
    check('profile CV created', !!profileResume.id)

    console.log('2) Apply: resolve employer candidate + copy CV (real function)')
    const employer = await getOrCreateCandidateForUser(seeker, ORG)
    employerCandidateId = employer.id
    check('employer-org candidate distinct from personal', employer.id !== personalCandidateId)

    await copyProfileCvToCandidate(seeker, employerCandidateId, profileResume.id)

    const copied = await prisma.resume.findFirst({
      where: { candidateId: employerCandidateId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { sourceDocument: true },
    })
    check('employer candidate now has a Resume', !!copied)
    if (copied) {
      const exp = (copied.experiences as any[])[0]
      const edu = (copied.education as any[])[0]
      check('experience normalized: position→title', exp?.title === 'Senior Dev')
      check('experience normalized: period→startDate', exp?.startDate === '2020 - 2024')
      check('education normalized: school→institution', edu?.institution === 'UNIZA')
      check('education normalized: year→endDate', edu?.endDate === '2020')
      check('skills copied', Array.isArray(copied.skills) && copied.skills.includes('React'))
      check('summary copied', copied.summary === 'Skúsený vývojár')
      check(
        'source document copied + linked',
        !!copied.sourceDocumentId && copied.sourceDocument?.uri === doc.uri,
      )
      check(
        'copied document belongs to employer candidate',
        copied.sourceDocument?.candidateId === employerCandidateId,
      )
    }

    console.log('3) Ownership guard: foreign cvId is ignored (no crash, no copy)')
    const before = await prisma.resume.count({ where: { candidateId: employerCandidateId } })
    await copyProfileCvToCandidate(seeker, employerCandidateId, 'cl00000000000000000000000') // non-existent
    const after = await prisma.resume.count({ where: { candidateId: employerCandidateId } })
    check('non-owned/invalid cvId adds nothing', before === after)
  } catch (err) {
    failures += 1
    console.error('\n❌ Smoke run threw:', err)
  } finally {
    await cleanup()
    await prisma.$disconnect()
  }

  console.log(
    `\n${failures === 0 ? '✅ ALL APPLY-CV SMOKE CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}\n`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

void run()

// Mark as a module so top-level declarations don't collide with other scripts/*.ts.
export {}
