/**
 * Application Service
 * Centralized business logic for job application management
 */

import { prisma } from '@/lib/prisma'
import {
  Prisma,
  PrismaClient
} from '@prisma/client'
import { createAuditLog } from '@/lib/audit-log'
import { checkEntitlement, consumeEntitlement } from '@/lib/entitlements'
import { AppError } from '@/lib/errors'
import { sendEmail } from '@/lib/email'

// Application stage as string literal (matches Prisma schema)
type ApplicationStage = 'NEW' | 'SCREENING' | 'PHONE' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'WITHDRAWN'

export interface CreateApplicationInput {
  jobId: string
  candidateId: string
  orgId: string
  cvUrl?: string
  coverLetter?: string
  phone?: string
  email: string
  firstName: string
  lastName: string
  metadata?: Record<string, unknown>
}

export interface UpdateApplicationInput {
  stage?: ApplicationStage
  notes?: string
  tags?: string[]
}

export interface ApplicationSearchParams {
  jobId?: string
  candidateId?: string
  stage?: ApplicationStage
  search?: string
  limit?: number
  offset?: number
}

export class ApplicationService {
  /**
   * Create a new application
   */
  static async createApplication(
    input: CreateApplicationInput
  ) {
    // Check if already applied
    const existingApplication = await prisma.application.findFirst({
      where: {
        jobId: input.jobId,
        candidateId: input.candidateId,
      },
    })

    if (existingApplication) {
      throw new AppError(
        'You have already applied for this position',
        400
      )
    }

    // Get job details
    const job = await prisma.job.findUnique({
      where: { id: input.jobId },
      include: { organization: true },
    })

    if (!job) {
      throw new AppError('Job not found', 404)
    }

    if (job.status !== 'PUBLISHED') {
      throw new AppError('This position is no longer accepting applications', 400)
    }

    // Check organization's candidate limit
    const canAddCandidate = await checkEntitlement(
      job.orgId,
      'MAX_CANDIDATES'
    )

    if (!canAddCandidate) {
      throw new AppError(
        'Candidate limit reached for this organization',
        403
      )
    }

    const application = await prisma.$transaction(async (tx) => {
      // Create application
      const newApplication = await tx.application.create({
        data: {
          jobId: input.jobId,
          candidateId: input.candidateId,
          orgId: input.orgId,
          stage: 'NEW',
          coverLetter: input.coverLetter || '',
        },
        include: {
          job: true,
          candidate: {
            include: {
              contacts: true,
            },
          },
        },
      })

      // Consume entitlement
      await consumeEntitlement(
        job.orgId,
        'MAX_CANDIDATES',
        1,
        tx as unknown as PrismaClient
      )

      // Create audit log
      await createAuditLog({
        userId: 'SYSTEM',
        orgId: job.orgId,
        action: 'CREATE',
        resource: 'APPLICATION',
        resourceId: newApplication.id,
        metadata: {
          jobId: input.jobId,
          candidateName: `${input.firstName} ${input.lastName}`,
        },
      })

      return newApplication
    })

    // Send notification email to recruiter (async)
    this.sendNewApplicationNotification(application).catch(console.error)

    return application
  }

  /**
   * Update application status
   */
  static async updateApplicationStatus(
    applicationId: string,
    input: UpdateApplicationInput,
    userId: string
  ) {
    const existingApplication = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true },
    })

    if (!existingApplication) {
      throw new AppError('Application not found', 404)
    }

    const updatedApplication = await prisma.$transaction(async (tx) => {
      const application = await tx.application.update({
        where: { id: applicationId },
        data: {
          ...(input.stage && { stage: input.stage }),
          ...(input.tags && { tags: input.tags }),
        },
        include: {
          candidate: {
            include: {
              contacts: true,
            },
          },
          job: true,
        },
      })

      // Create audit log
      await createAuditLog({
        userId,
        orgId: existingApplication.job.orgId,
        action: 'UPDATE',
        resource: 'APPLICATION',
        resourceId: applicationId,
        metadata: input as Prisma.InputJsonValue,
      })

      // If stage changed to interview or offer, create notification
      if (input.stage && ['INTERVIEW', 'OFFER', 'HIRED'].includes(input.stage)) {
        await this.createStatusChangeNotification(application, input.stage)
      }

      return application
    })

    return updatedApplication
  }

  /**
   * Bulk update application statuses
   */
  static async bulkUpdateStage(
    applicationIds: string[],
    stage: ApplicationStage,
    userId: string
  ): Promise<number> {
    const result = await prisma.$transaction(async (tx) => {
      // Get organization ID for audit
      const applications = await tx.application.findMany({
        where: { id: { in: applicationIds } },
        include: { job: true },
      })

      if (applications.length === 0) {
        throw new AppError('No applications found', 404)
      }

      const orgId = applications[0].job.orgId

      // Update all applications
      const updateResult = await tx.application.updateMany({
        where: { id: { in: applicationIds } },
        data: { stage },
      })

      // Create audit log
      await createAuditLog({
        userId,
        orgId,
        action: 'BULK_UPDATE',
        resource: 'APPLICATION',
        resourceId: 'BULK',
        metadata: {
          applicationIds,
          stage,
          count: updateResult.count,
        },
      })

      return updateResult.count
    })

    return result
  }

  /**
   * Search applications
   */
  static async searchApplications(
    params: ApplicationSearchParams
  ) {
    const {
      jobId,
      candidateId,
      stage,
      search,
      limit = 50,
      offset = 0,
    } = params

    const where: Prisma.ApplicationWhereInput = {
      ...(jobId && { jobId }),
      ...(candidateId && { candidateId }),
      ...(stage && { stage }),
      ...(search && {
        OR: [
          {
            candidate: {
              contacts: {
                some: {
                  OR: [
                    { fullName: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
        ],
      }),
    } as Prisma.ApplicationWhereInput

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          candidate: {
            include: {
              contacts: true,
            },
          },
          job: {
            include: {
              organization: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.application.count({ where }),
    ])

    return { applications, total }
  }

  /**
   * Get application with full details
   */
  static async getApplicationById(
    applicationId: string
  ) {
    return prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: {
          include: {
            contacts: true,
          },
        },
        job: {
          include: {
            organization: true,
          },
        },
        activities: true,
      },
    })
  }

  /**
   * Delete application (soft delete)
   */
  static async deleteApplication(
    applicationId: string,
    userId: string
  ) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true },
    })

    if (!application) {
      throw new AppError('Application not found', 404)
    }

    const deletedApplication = await prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({
        where: { id: applicationId },
        data: { stage: 'WITHDRAWN' },
      })

      await createAuditLog({
        userId,
        orgId: application.job.orgId,
        action: 'DELETE',
        resource: 'APPLICATION',
        resourceId: applicationId,
        metadata: { stage: 'WITHDRAWN' },
      })

      return updated
    })

    return deletedApplication
  }

  /**
   * Send notification about new application
   */
  private static async sendNewApplicationNotification(
    application: {
      id: string
      job?: any
      candidate?: {
        contacts?: Array<{
          fullName?: string | null
          email?: string | null
        }>
      }
    }
  ): Promise<void> {
    try {
      const { sendEmail } = await import('@/lib/email')

      // Get organization admin email
      const orgAdmin = await prisma.userOrgRole.findFirst({
        where: {
          orgId: application.job?.orgId,
          role: 'ORG_ADMIN',
        },
        include: {
          user: { select: { email: true, name: true } },
        },
      })

      if (!orgAdmin?.user?.email) {
        console.warn('No admin email found for organization')
        return
      }

      const candidateName = application.candidate?.contacts?.[0]?.fullName || 'A candidate'
      const jobTitle = application.job?.title || 'a position'
      const appUrl = `${process.env.NEXT_PUBLIC_APP_URL}/employer/applications/${application.id}`

      await sendEmail({
        to: orgAdmin.user.email,
        subject: `New Application for ${jobTitle}`,
        html: `
          <h2>New Application Received</h2>
          <p>Hi ${orgAdmin.user.name || 'there'},</p>
          <p><strong>${candidateName}</strong> has applied for <strong>${jobTitle}</strong>.</p>
          <p><a href="${appUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px;">View Application</a></p>
          <hr />
          <p style="color: #666; font-size: 12px;">JobSphere ATS - Modern recruitment platform</p>
        `,
      })
    } catch (error) {
      console.error('Failed to send new application notification:', error)
      // Don't fail the request if email fails
    }
  }

  /**
   * Create notification for status change
   */
  private static async createStatusChangeNotification(
    application: {
      id: string
      candidate?: {
        contacts?: Array<{
          email?: string | null
          fullName?: string | null
        }>
      }
      job?: any
    },
    newStage: ApplicationStage
  ): Promise<void> {
    try {
      const { sendEmail } = await import('@/lib/email')

      const candidateEmail = application.candidate?.contacts?.[0]?.email
      if (!candidateEmail) {
        console.warn('No candidate email found for notification')
        return
      }

      const candidateName = application.candidate?.contacts?.[0]?.fullName || 'there'
      const jobTitle = application.job?.title || 'the position'

      let subject = ''
      let message = ''

      if (newStage === 'INTERVIEW') {
        subject = `Interview Invitation - ${jobTitle}`
        message = `
          <h2>You're Invited for an Interview!</h2>
          <p>Hi ${candidateName},</p>
          <p>Great news! We'd like to invite you for an interview for the <strong>${jobTitle}</strong> position.</p>
          <p>The hiring team will reach out to you soon with more details about the interview schedule.</p>
          <p>Good luck!</p>
        `
      } else if (newStage === 'OFFER' || newStage === 'HIRED') {
        subject = `Job Offer - ${jobTitle}`
        message = `
          <h2>Congratulations! Job Offer</h2>
          <p>Hi ${candidateName},</p>
          <p>We're excited to offer you the <strong>${jobTitle}</strong> position!</p>
          <p>A member of our team will contact you shortly with the offer details.</p>
          <p>Congratulations on this achievement!</p>
        `
      } else {
        return // Only send for INTERVIEW, OFFER, and HIRED stages
      }

      await sendEmail({
        to: candidateEmail,
        subject,
        html: `
          ${message}
          <hr />
          <p style="color: #666; font-size: 12px;">JobSphere ATS - Modern recruitment platform</p>
        `,
      })
    } catch (error) {
      console.error('Failed to send status change notification:', error)
      // Don't fail the request if email fails
    }
  }

  /**
   * Get application statistics for a job
   */
  static async getApplicationStats(jobId: string): Promise<{
    total: number
    byStage: Record<string, number>
    todayCount: number
    weekCount: number
  }> {
    const now = new Date()
    const startOfDay = new Date(now.setHours(0, 0, 0, 0))
    const startOfWeek = new Date(now.setDate(now.getDate() - 7))

    const [byStage, todayCount, weekCount] = await Promise.all([
      prisma.application.groupBy({
        by: ['stage'],
        where: { jobId },
        _count: { stage: true },
      }),
      prisma.application.count({
        where: {
          jobId,
          createdAt: { gte: startOfDay },
        },
      }),
      prisma.application.count({
        where: {
          jobId,
          createdAt: { gte: startOfWeek },
        },
      }),
    ])

    const stageCounts = byStage.reduce((acc, item) => {
      acc[item.stage] = item._count.stage
      return acc
    }, {} as Record<string, number>)

    const total = Object.values(stageCounts).reduce(
      (sum, count) => sum + count,
      0
    )

    return {
      total,
      byStage: stageCounts,
      todayCount,
      weekCount,
    }
  }
}