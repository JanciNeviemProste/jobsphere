'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import type { Application, ApplicationActivity } from '@prisma/client'

export async function createApplication(formData: {
  jobId: string
  coverLetter: string
  cvUrl?: string
  expectedSalary?: string
  availableFrom?: string
}): Promise<Application> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  // Check if already applied
  const existingApplication = await prisma.application.findFirst({
    where: {
      jobId: formData.jobId,
      candidateId: session.user.id,
    },
  })

  if (existingApplication) {
    throw new Error('You have already applied to this job')
  }

  const application = await prisma.application.create({
    data: {
      jobId: formData.jobId,
      candidateId: session.user.id,
      coverLetter: formData.coverLetter,
      stage: 'NEW',
      orgId: (await prisma.job.findUnique({
        where: { id: formData.jobId },
        select: { orgId: true },
      }))!.orgId,
    },
  })

  // Create application activity
  await prisma.applicationActivity.create({
    data: {
      applicationId: application.id,
      type: 'APPLIED',
      description: 'Application submitted successfully',
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/employer/applicants')

  return application
}

export async function updateApplicationStatus(
  applicationId: string,
  status: string,
  notes?: string,
): Promise<Application> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true },
  })

  if (!application) {
    throw new Error('Application not found')
  }

  // Verify user is member of organization
  const membership = await prisma.userOrgRole.findFirst({
    where: {
      userId: session.user.id,
      orgId: application.job.orgId,
    },
  })

  if (!membership) {
    throw new Error('Forbidden')
  }

  const updatedApplication = await prisma.application.update({
    where: { id: applicationId },
    data: {
      stage: status as any,
      ...(notes && { notes: notes }),
    },
  })

  // Create activity for status change
  if (status !== application.stage) {
    const eventDescriptions: Record<string, string> = {
      SCREENING: 'Application is being screened',
      PHONE_SCREEN: 'Phone screen scheduled',
      INTERVIEW: 'Interview scheduled',
      OFFER: 'Offer extended',
      HIRED: 'Candidate hired',
      REJECTED: 'Application rejected',
    }

    await prisma.applicationActivity.create({
      data: {
        applicationId: application.id,
        type: 'STAGE_CHANGED',
        description: eventDescriptions[status] || `Stage changed to ${status}`,
        performedBy: session.user.id,
      },
    })

    // Auto-enrollment for email sequences on status change
    if (status === 'INTERVIEWED' || status === 'ACCEPTED') {
      try {
        // Find email sequence for this stage
        const sequence = await prisma.emailSequence.findFirst({
          where: {
            orgId: application.job.orgId,
            active: true,
            name: { contains: status, mode: 'insensitive' },
          },
          include: {
            steps: {
              orderBy: { order: 'asc' },
            },
          },
        })

        if (sequence && sequence.steps.length > 0) {
          // Create email sequence run
          const run = await prisma.emailSequenceRun.create({
            data: {
              sequenceId: sequence.id,
              candidateId: application.candidateId,
              status: 'ACTIVE',
            },
          })

          // A/B Testing: Select variant for first step if multiple exist
          const firstStepCandidates = sequence.steps.filter((s: any) => s.order === 1)
          let selectedFirstStep = firstStepCandidates[0]

          if (firstStepCandidates.length > 1) {
            const variants = firstStepCandidates.filter((s: any) => s.abGroup)

            if (variants.length > 1) {
              // Random selection with equal distribution
              const randomIndex = Math.floor(Math.random() * variants.length)
              selectedFirstStep = variants[randomIndex]

              logger.info('A/B test variant selected for auto-enrollment', {
                runId: run.id,
                selectedVariant: selectedFirstStep.abGroup,
                totalVariants: variants.length,
              })
            }
          }

          // Queue first email
          const { addEmailSequenceJob } = await import('@/lib/queue')
          await addEmailSequenceJob({
            enrollmentId: run.id,
            stepId: selectedFirstStep.id,
          })

          logger.info('Auto-enrolled candidate into email sequence', {
            candidateId: application.candidateId,
            sequenceId: sequence.id,
          })
        }
      } catch (error) {
        logger.error('Failed to auto-enroll candidate in email sequence', { error })
        // Don't throw - auto-enrollment is nice-to-have, not critical
      }
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/employer/applicants')
  revalidatePath(`/dashboard/applications/${applicationId}`)

  return updatedApplication
}

export async function deleteApplication(applicationId: string): Promise<{ success: true }> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  })

  if (!application) {
    throw new Error('Application not found')
  }

  // Only candidate can delete their own application
  if (application.candidateId !== session.user.id) {
    throw new Error('Forbidden')
  }

  await prisma.application.delete({
    where: { id: applicationId },
  })

  revalidatePath('/dashboard')

  return { success: true }
}

export async function addApplicationNote(
  applicationId: string,
  note: string,
): Promise<ApplicationActivity> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true },
  })

  if (!application) {
    throw new Error('Application not found')
  }

  // Verify user is member of organization
  const membership = await prisma.userOrgRole.findFirst({
    where: {
      userId: session.user.id,
      orgId: application.job.orgId,
    },
  })

  if (!membership) {
    throw new Error('Forbidden')
  }

  const activity = await prisma.applicationActivity.create({
    data: {
      applicationId: application.id,
      type: 'NOTE_ADDED',
      description: note,
      performedBy: session.user.id,
    },
  })

  revalidatePath(`/employer/applicants/${applicationId}`)
  revalidatePath(`/dashboard/applications/${applicationId}`)

  return activity
}
