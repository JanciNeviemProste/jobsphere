'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { addEmbeddingJob, addMatchScoreCacheJob } from '@/lib/queue'
import { logger } from '@/lib/logger'
import type { Job } from '@prisma/client'

export async function createJob(formData: {
  title: string
  location: string
  minSalary?: string
  maxSalary?: string
  workMode: string
  type: string
  seniority: string
  description: string
  orgId: string
}): Promise<Job> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  // Verify user is member of organization
  const membership = await prisma.userOrgRole.findFirst({
    where: {
      userId: session.user.id,
      orgId: formData.orgId,
    },
  })

  if (!membership) {
    throw new Error('You are not a member of this organization')
  }

  const job = await prisma.job.create({
    data: {
      title: formData.title,
      city: formData.location || null,
      region: null,
      remote: formData.workMode === 'REMOTE',
      hybrid: formData.workMode === 'HYBRID',
      salaryMin: formData.minSalary ? parseInt(formData.minSalary) : null,
      salaryMax: formData.maxSalary ? parseInt(formData.maxSalary) : null,
      employmentType: formData.type as any,
      seniority: formData.seniority as any,
      description: formData.description,
      orgId: formData.orgId,
      status: 'PUBLISHED',
      createdBy: session.user.id,
    },
  })

  // Async embedding generation (non-blocking)
  addEmbeddingJob({ jobId: job.id }).catch((err) => {
    logger.error('Failed to queue job embedding', { error: err, jobId: job.id })
    // Don't throw - embedding is nice-to-have, not critical
  })

  // Async match score caching for popular jobs (non-blocking)
  addMatchScoreCacheJob({ jobId: job.id }).catch((err) => {
    logger.error('Failed to queue match score caching', { error: err, jobId: job.id })
    // Don't throw - caching is nice-to-have, not critical
  })

  revalidatePath('/employer')
  revalidatePath('/jobs')

  return job
}

export async function updateJobStatus(jobId: string, status: string): Promise<Job> {
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
  const membership = await prisma.userOrgRole.findFirst({
    where: {
      userId: session.user.id,
      orgId: job.orgId,
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

export async function deleteJob(jobId: string): Promise<{ success: true }> {
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
  const membership = await prisma.userOrgRole.findFirst({
    where: {
      userId: session.user.id,
      orgId: job.orgId,
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
