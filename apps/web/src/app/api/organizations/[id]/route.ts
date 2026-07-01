import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sanitizeHtml, sanitizeUrl } from '@/lib/sanitize'
import { logger } from '@/lib/logger'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const updateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  website: z.string().url().optional().or(z.literal('')),
  description: z.string().max(2000).optional().or(z.literal('')),
  industry: z.string().max(100).optional().or(z.literal('')),
  size: z.string().max(50).optional().or(z.literal('')),
  logo: z.string().url().optional().or(z.literal('')),
  videoUrl: z.string().url().optional().or(z.literal('')),
})

export const GET = withRateLimit(
  async (request: Request, context?: { params?: Record<string, string> }) => {
    const params = context?.params as { id: string }
    if (!params?.id) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    try {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Verify membership
      const membership = await prisma.userOrgRole.findFirst({
        where: {
          userId: session.user.id,
          orgId: params.id,
        },
      })

      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const organization = await prisma.organization.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          name: true,
          logo: true,
          videoUrl: true,
          website: true,
          description: true,
          industry: true,
          size: true,
          slug: true,
        },
      })

      if (!organization) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      return NextResponse.json(organization)
    } catch (error) {
      logger.error('Error fetching organization:', error)
      return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 })
    }
  },
  { preset: 'api' },
)

export const PATCH = withCsrfProtection(
  withRateLimit(
    async (request: Request, context?: { params?: Record<string, string> }) => {
      const params = context?.params as { id: string }
      if (!params?.id) {
        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
      }
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify admin role
        const membership = await prisma.userOrgRole.findFirst({
          where: {
            userId: session.user.id,
            orgId: params.id,
            role: 'ORG_ADMIN',
          },
        })

        if (!membership) {
          return NextResponse.json(
            { error: 'Forbidden - Only organization admins can update organization settings' },
            { status: 403 },
          )
        }

        const body = await request.json()
        const validatedData = updateOrgSchema.parse(body)

        // Prepare update data (remove empty strings and sanitize)
        const updateData: any = {}
        if (validatedData.name !== undefined) {
          // Sanitize name to prevent XSS via event handlers
          updateData.name = sanitizeHtml(validatedData.name)
        }
        if (validatedData.website !== undefined) {
          // Sanitize URL to prevent javascript: protocol XSS
          updateData.website = sanitizeUrl(validatedData.website)
        }
        if (validatedData.description !== undefined) {
          // Sanitize HTML to prevent XSS via script tags and event handlers
          updateData.description = sanitizeHtml(validatedData.description)
        }
        if (validatedData.industry !== undefined) {
          updateData.industry = validatedData.industry === '' ? null : validatedData.industry
        }
        if (validatedData.size !== undefined) {
          updateData.size = validatedData.size === '' ? null : validatedData.size
        }
        if (validatedData.logo !== undefined) {
          // Sanitize URL to reject javascript:/data: schemes; empty clears the logo.
          updateData.logo = validatedData.logo === '' ? null : sanitizeUrl(validatedData.logo)
        }
        if (validatedData.videoUrl !== undefined) {
          updateData.videoUrl =
            validatedData.videoUrl === '' ? null : sanitizeUrl(validatedData.videoUrl)
        }

        const updated = await prisma.organization.update({
          where: { id: params.id },
          data: updateData,
          select: {
            id: true,
            name: true,
            logo: true,
            videoUrl: true,
            website: true,
            description: true,
            industry: true,
            size: true,
            slug: true,
          },
        })

        return NextResponse.json(updated)
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Invalid request data', details: error.errors },
            { status: 400 },
          )
        }

        logger.error('Error updating organization:', error)
        return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })
      }
    },
    { preset: 'api' },
  ),
)
