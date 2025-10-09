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

// Application status as string literal (matches Prisma schema)
type ApplicationStatus = 'PENDING' | 'REVIEWING' | 'INTERVIEWED' | 'ACCEPTED' | 'REJECTED'

export interface CreateApplicationInput {
  jobId: string
  candidateId: string
  cvUrl?: string
  coverLetter?: string
  phone?: string
  email: string
  firstName: string
  lastName: string
  metadata?: Record<string, unknown>
}

export interface UpdateApplicationInput {
  status?: ApplicationStatus
  notes?: string
  tags?: string[]
}

export interface ApplicationSearchParams {
  jobId?: string
  candidateId?: string
  status?: ApplicationStatus
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

    if (job.status !== 'ACTIVE') {
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
          status: 'PENDING',
          cvUrl: input.cvUrl,
          coverLetter: input.coverLetter || '',
        },
        include: {
          job: true,
          candidate: true,
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
          ...(input.status && { status: input.status }),
          ...(input.notes && { notes: input.notes }),
        },
        include: {
          candidate: true,
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

      // If status changed to interview or offer, create notification
      if (input.status && ['INTERVIEWED', 'ACCEPTED'].includes(input.status)) {
        await this.createStatusChangeNotification(application, input.status)
      }

      return application
    })

    return updatedApplication
  }

  /**
   * Bulk update application statuses
   */
  static async bulkUpdateStatus(
    applicationIds: string[],
    status: ApplicationStatus,
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
        data: { status },
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
          status,
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
      status,
      search,
      limit = 50,
      offset = 0,
    } = params

    const where: Prisma.ApplicationWhereInput = {
      ...(jobId && { jobId }),
      ...(candidateId && { candidateId }),
      ...(status && { status }),
      ...(search && {
        OR: [
          {
            candidate: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      }),
    } as Prisma.ApplicationWhereInput

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          candidate: true,
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
        candidate: true,
        job: {
          include: {
            organization: true,
          },
        },
        events: true,
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
        data: { status: 'WITHDRAWN' },
      })

      await createAuditLog({
        userId,
        orgId: application.job.orgId,
        action: 'DELETE',
        resource: 'APPLICATION',
        resourceId: applicationId,
        metadata: { status: 'WITHDRAWN' },
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
        name?: string | null
        email?: string
      }
    }
  ): Promise<void> {
    try {
      const { sendEmail } = await import('@/lib/email')

      // Get organization admin email
      const orgAdmin = await prisma.orgMember.findFirst({
        where: {
          orgId: application.job?.orgId,
          role: 'ADMIN',
        },
        include: {
          user: { select: { email: true, name: true } },
        },
      })

      if (!orgAdmin?.user?.email) {
        console.warn('No admin email found for organization')
        return
      }

      const candidateName = application.candidate?.name || 'A candidate'
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
      candidate?: { email?: string; name?: string | null }
      job?: any
    },
    newStatus: ApplicationStatus
  ): Promise<void> {
    try {
      const { sendEmail } = await import('@/lib/email')

      if (!application.candidate?.email) {
        console.warn('No candidate email found for notification')
        return
      }

      const candidateName = application.candidate?.name || 'there'
      const jobTitle = application.job?.title || 'the position'

      let subject = ''
      let message = ''

      if (newStatus === 'INTERVIEWED') {
        subject = `Interview Invitation - ${jobTitle}`
        message = `
          <h2>You're Invited for an Interview!</h2>
          <p>Hi ${candidateName},</p>
          <p>Great news! We'd like to invite you for an interview for the <strong>${jobTitle}</strong> position.</p>
          <p>The hiring team will reach out to you soon with more details about the interview schedule.</p>
          <p>Good luck!</p>
        `
      } else if (newStatus === 'ACCEPTED') {
        subject = `Job Offer - ${jobTitle}`
        message = `
          <h2>Congratulations! Job Offer</h2>
          <p>Hi ${candidateName},</p>
          <p>We're excited to offer you the <strong>${jobTitle}</strong> position!</p>
          <p>A member of our team will contact you shortly with the offer details.</p>
          <p>Congratulations on this achievement!</p>
        `
      } else {
        return // Only send for INTERVIEWED and ACCEPTED statuses
      }

      await sendEmail({
        to: application.candidate.email,
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
    byStatus: Record<string, number>
    todayCount: number
    weekCount: number
  }> {
    const now = new Date()
    const startOfDay = new Date(now.setHours(0, 0, 0, 0))
    const startOfWeek = new Date(now.setDate(now.getDate() - 7))

    const [byStatus, todayCount, weekCount] = await Promise.all([
      prisma.application.groupBy({
        by: ['status'],
        where: { jobId },
        _count: { status: true },
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

    const statusCounts = byStatus.reduce((acc, item) => {
      acc[item.status] = item._count.status
      return acc
    }, {} as Record<string, number>)

    const total = Object.values(statusCounts).reduce(
      (sum, count) => sum + count,
      0
    )

    return {
      total,
      byStatus: statusCounts,
      todayCount,
      weekCount,
    }
  }
}