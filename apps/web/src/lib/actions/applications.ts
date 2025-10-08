'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createApplication(formData: {
  jobId: string
  coverLetter: string
  cvUrl?: string
  expectedSalary?: string
  availableFrom?: string
}) {
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
      cvUrl: formData.cvUrl || null,
      expectedSalary: formData.expectedSalary ? parseInt(formData.expectedSalary) : null,
      availableFrom: formData.availableFrom ? new Date(formData.availableFrom) : null,
      status: 'PENDING',
    },
  })

  // Create application event
  await prisma.applicationEvent.create({
    data: {
      applicationId: application.id,
      type: 'APPLIED',
      title: 'Application Submitted',
      description: 'Your application has been successfully submitted',
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/employer/applicants')

  return application
}

export async function updateApplicationStatus(
  applicationId: string,
  status: string,
  notes?: string
) {
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
  const membership = await prisma.orgMember.findFirst({
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
      status: status as any,
      ...(notes && { notes }),
    },
  })

  // Create event for status change
  if (status !== application.status) {
    const eventTitles: Record<string, string> = {
      REVIEWING: 'Application Under Review',
      INTERVIEWED: 'Interview Scheduled',
      ACCEPTED: 'Application Accepted',
      REJECTED: 'Application Rejected',
    }

    await prisma.applicationEvent.create({
      data: {
        applicationId: application.id,
        type: 'STATUS_CHANGED',
        title: eventTitles[status] || 'Status Updated',
        description: `Application status changed to ${status}`,
      },
    })
  }

  revalidatePath('/dashboard')
  revalidatePath('/employer/applicants')
  revalidatePath(`/dashboard/applications/${applicationId}`)

  return updatedApplication
}

export async function deleteApplication(applicationId: string) {
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

export async function addApplicationNote(applicationId: string, note: string) {
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
  const membership = await prisma.orgMember.findFirst({
    where: {
      userId: session.user.id,
      orgId: application.job.orgId,
    },
  })

  if (!membership) {
    throw new Error('Forbidden')
  }

  const event = await prisma.applicationEvent.create({
    data: {
      applicationId: application.id,
      type: 'NOTE_ADDED',
      title: 'Note Added',
      description: note,
    },
  })

  revalidatePath(`/employer/applicants/${applicationId}`)
  revalidatePath(`/dashboard/applications/${applicationId}`)

  return event
}
