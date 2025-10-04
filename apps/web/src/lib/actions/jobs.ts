'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createJob(formData: {
  title: string
  location: string
  minSalary?: string
  maxSalary?: string
  workMode: string
  type: string
  seniority: string
  description: string
  organizationId: string
}) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  // Verify user is member of organization
  const membership = await prisma.orgMember.findFirst({
    where: {
      userId: session.user.id,
      organizationId: formData.organizationId,
    },
  })

  if (!membership) {
    throw new Error('You are not a member of this organization')
  }

  const job = await prisma.job.create({
    data: {
      title: formData.title,
      location: formData.location,
      salaryMin: formData.minSalary ? parseInt(formData.minSalary) : null,
      salaryMax: formData.maxSalary ? parseInt(formData.maxSalary) : null,
      workMode: formData.workMode as any,
      type: formData.type as any,
      seniority: formData.seniority as any,
      description: formData.description,
      organizationId: formData.organizationId,
      status: 'ACTIVE',
    },
  })

  revalidatePath('/employer')
  revalidatePath('/jobs')

  return job
}

export async function updateJobStatus(jobId: string, status: string) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
  })

  if (!job) {
    throw new Error('Job not found')
  }

  // Verify user is member of organization
  const membership = await prisma.orgMember.findFirst({
    where: {
      userId: session.user.id,
      organizationId: job.organizationId,
    },
  })

  if (!membership) {
    throw new Error('Forbidden')
  }

  const updatedJob = await prisma.job.update({
    where: { id: jobId },
    data: { status: status as any },
  })

  revalidatePath('/employer')
  revalidatePath('/jobs')

  return updatedJob
}

export async function deleteJob(jobId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
  })

  if (!job) {
    throw new Error('Job not found')
  }

  // Verify user is member of organization
  const membership = await prisma.orgMember.findFirst({
    where: {
      userId: session.user.id,
      organizationId: job.organizationId,
    },
  })

  if (!membership) {
    throw new Error('Forbidden')
  }

  await prisma.job.delete({
    where: { id: jobId },
  })

  revalidatePath('/employer')
  revalidatePath('/jobs')

  return { success: true }
}
