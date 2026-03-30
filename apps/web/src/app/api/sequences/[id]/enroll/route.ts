import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addEmailSequenceJob } from '@/lib/queue'
import { withRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const enrollSchema = z.object({
  candidateId: z.string().uuid(),
  jobId: z.string().uuid().optional(),
})

export const POST = withRateLimit(
  async (req: NextRequest, context?: { params?: Record<string, string> }) => {
    try {
      const params = context?.params
      if (!params?.id) {
        return NextResponse.json({ error: 'Missing sequence ID' }, { status: 400 })
      }

      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const body = await req.json()
      const validation = enrollSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request data', details: validation.error.issues },
          { status: 400 },
        )
      }

      const { candidateId, jobId } = validation.data

      // Get user's organizations
      const userOrgs = await prisma.userOrgRole.findMany({
        where: { userId: session.user.id },
        select: { orgId: true },
      })

      const orgIds = userOrgs.map((o: { orgId: string }) => o.orgId)

      // Verify sequence exists and user has access
      const sequence = await prisma.emailSequence.findFirst({
        where: {
          id: params.id,
          orgId: { in: orgIds },
          active: true,
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      })

      if (!sequence) {
        return NextResponse.json({ error: 'Sequence not found or inactive' }, { status: 404 })
      }

      if (!sequence.steps || sequence.steps.length === 0) {
        return NextResponse.json({ error: 'Sequence has no steps' }, { status: 400 })
      }

      // Check if already enrolled
      const existing = await prisma.emailSequenceRun.findFirst({
        where: {
          sequenceId: params.id,
          candidateId,
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
      })

      if (existing) {
        return NextResponse.json(
          { error: 'Candidate is already enrolled in this sequence' },
          { status: 409 },
        )
      }

      // Create sequence run
      const run = await prisma.emailSequenceRun.create({
        data: {
          sequenceId: params.id,
          candidateId,
          status: 'ACTIVE',
        },
      })

      // Queue first email with first step (with A/B testing support)
      const firstStepCandidates = sequence.steps.filter((s: any) => s.order === 1)
      let selectedFirstStep = firstStepCandidates[0]

      // A/B Testing: Select variant if multiple steps with order 1 exist
      if (firstStepCandidates.length > 1) {
        const variants = firstStepCandidates.filter((s: any) => s.abGroup)

        if (variants.length > 1) {
          // Random selection with equal distribution
          const randomIndex = Math.floor(Math.random() * variants.length)
          selectedFirstStep = variants[randomIndex]

          logger.info('A/B test variant selected for enrollment', {
            runId: run.id,
            selectedVariant: selectedFirstStep.abGroup,
            totalVariants: variants.length,
          })
        }
      }

      await addEmailSequenceJob({
        enrollmentId: run.id,
        stepId: selectedFirstStep.id,
      })

      return NextResponse.json({
        success: true,
        runId: run.id,
        message: 'Candidate enrolled successfully',
      })
    } catch (error) {
      logger.error('Failed to enroll candidate in email sequence:', error)

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.issues },
          { status: 400 },
        )
      }

      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  },
  { preset: 'api', byUser: true },
)
