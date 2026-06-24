/**
 * Runtime smoke test for the freelancer-gig flow (phase 3b/3c) against a REAL database.
 *
 *   cd apps/web
 *   DATABASE_URL="postgresql://.../neondb" npx tsx scripts/smoke-gigs.ts
 *
 * Creates its own throwaway org/users/freelancer-profiles/gig under a unique smoke- prefix
 * and cleans them up in a finally block. Does NOT touch existing data.
 *
 * Covered: gig create · two freelancer proposals (PENDING) · accept transaction
 * (accepted ACCEPTED, gig IN_PROGRESS, the other pending proposal auto-REJECTED) ·
 * proposal upsert idempotency on the (gig, freelancer) unique constraint.
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

  const SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const ORG = `smoke-gig-org-${SUFFIX}`
  const ids = {
    employer: `smoke-gig-emp-${SUFFIX}`,
    fl1: `smoke-gig-fl1-${SUFFIX}`,
    fl2: `smoke-gig-fl2-${SUFFIX}`,
  }
  let gigId = ''

  async function cleanup() {
    try {
      await prisma.gigProposal.deleteMany({ where: { gig: { orgId: ORG } } })
      await prisma.gig.deleteMany({ where: { orgId: ORG } })
      await prisma.freelancerProfile.deleteMany({ where: { userId: { in: [ids.fl1, ids.fl2] } } })
      await prisma.userOrgRole.deleteMany({ where: { orgId: ORG } })
      await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } })
      await prisma.organization.deleteMany({ where: { id: ORG } })
    } catch (err) {
      console.error('⚠️  cleanup error (manual cleanup of smoke-gig- rows may be needed):', err)
    }
  }

  try {
    console.log(`\n🔬 Gig smoke test (org ${ORG})\n`)

    console.log('1) DB connectivity')
    await prisma.$queryRaw`SELECT 1`
    check('SELECT 1 succeeds', true)

    // Org + employer (member) + two freelancers with profiles.
    await prisma.organization.create({ data: { id: ORG, name: 'Smoke Gig Org', slug: ORG } })
    await prisma.user.create({
      data: { id: ids.employer, email: `emp-${SUFFIX}@smoke.test`, name: 'Smoke Employer' },
    })
    await prisma.userOrgRole.create({
      data: { userId: ids.employer, orgId: ORG, role: 'ORG_ADMIN' },
    })
    for (const [uid, label] of [
      [ids.fl1, 'Freelancer One'],
      [ids.fl2, 'Freelancer Two'],
    ] as const) {
      await prisma.user.create({
        data: { id: uid, email: `${uid}@smoke.test`, name: label },
      })
      await prisma.freelancerProfile.create({ data: { userId: uid, title: label } })
    }
    const fp1 = await prisma.freelancerProfile.findUniqueOrThrow({ where: { userId: ids.fl1 } })
    const fp2 = await prisma.freelancerProfile.findUniqueOrThrow({ where: { userId: ids.fl2 } })

    // 2. Create a gig (employer path) ---------------------------------------
    console.log('2) Gig create')
    const gig = await prisma.gig.create({
      data: {
        orgId: ORG,
        createdBy: ids.employer,
        title: 'Smoke Gig — logo',
        description: 'z'.repeat(40),
        budget: 800,
        durationDays: 14,
        currency: 'EUR',
      },
    })
    gigId = gig.id
    check('gig created with status OPEN', gig.status === 'OPEN')

    // 3. Two proposals (PENDING) --------------------------------------------
    console.log('3) Proposals')
    const p1 = await prisma.gigProposal.create({
      data: { gigId, freelancerId: fp1.id, proposedRate: 700, proposedDurationDays: 10 },
    })
    const p2 = await prisma.gigProposal.create({
      data: { gigId, freelancerId: fp2.id, proposedRate: 650, proposedDurationDays: 12 },
    })
    check('both proposals PENDING', p1.status === 'PENDING' && p2.status === 'PENDING')

    // upsert idempotency on (gig, freelancer) unique constraint
    const p1Again = await prisma.gigProposal.upsert({
      where: { gigId_freelancerId: { gigId, freelancerId: fp1.id } },
      create: { gigId, freelancerId: fp1.id, proposedRate: 1, message: 'should not create' },
      update: { proposedRate: 720, message: 'updated' },
    })
    const proposalCount = await prisma.gigProposal.count({ where: { gigId } })
    check('upsert updates, no duplicate (still 2 proposals)', proposalCount === 2)
    check('upsert applied new rate', p1Again.proposedRate === 720 && p1Again.id === p1.id)

    // 4. Accept transaction (mirrors PATCH route) ---------------------------
    console.log('4) Accept transaction')
    await prisma.$transaction([
      prisma.gigProposal.update({ where: { id: p1.id }, data: { status: 'ACCEPTED' } }),
      prisma.gigProposal.updateMany({
        where: { gigId, id: { not: p1.id }, status: 'PENDING' },
        data: { status: 'REJECTED' },
      }),
      prisma.gig.update({ where: { id: gigId }, data: { status: 'IN_PROGRESS' } }),
    ])
    const acceptedGig = await prisma.gig.findUniqueOrThrow({ where: { id: gigId } })
    const accepted = await prisma.gigProposal.findUniqueOrThrow({ where: { id: p1.id } })
    const rejected = await prisma.gigProposal.findUniqueOrThrow({ where: { id: p2.id } })
    check('gig → IN_PROGRESS', acceptedGig.status === 'IN_PROGRESS')
    check('accepted proposal → ACCEPTED', accepted.status === 'ACCEPTED')
    check('other proposal auto → REJECTED', rejected.status === 'REJECTED')

    // 5. Relations / counts read back ---------------------------------------
    console.log('5) Relations')
    const withCount = await prisma.gig.findUniqueOrThrow({
      where: { id: gigId },
      include: {
        _count: { select: { proposals: true } },
        organization: { select: { name: true } },
      },
    })
    check('proposal _count = 2', withCount._count.proposals === 2)
    check('organization relation resolves', withCount.organization.name === 'Smoke Gig Org')
  } catch (err) {
    failures += 1
    console.error('\n❌ Smoke run threw:', err)
  } finally {
    await cleanup()
    await prisma.$disconnect()
  }

  console.log(
    `\n${failures === 0 ? '✅ ALL GIG SMOKE CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}\n`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

void run()

// Mark as a module so top-level declarations don't collide with other scripts/*.ts.
export {}
