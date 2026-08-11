/**
 * Update or retire a single email template.
 *
 * Delete is soft. A template's name is unique per organisation and nothing
 * records which messages were sent from it, so a hard delete would free the name
 * for reuse and quietly make any future audit of "what did we send them"
 * ambiguous between two different templates that shared it.
 */

import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/errors'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'
import { TEMPLATE_CATEGORIES } from '../route'

export const runtime = 'nodejs'

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subject: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(20000).optional(),
  category: z.enum(TEMPLATE_CATEGORIES).optional(),
})

function templateId(context?: { params?: Record<string, string> }): string | null {
  return context?.params?.id ?? null
}

export const GET = withRateLimit(
  async (request: Request, context?: { params?: Record<string, string> }) => {
    try {
      const id = templateId(context)
      if (!id) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

      const { orgId } = await requireAuth(request as NextRequest)

      const template = await prisma.emailTemplate.findFirst({
        where: { id, orgId, deletedAt: null },
      })
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }

      return NextResponse.json({ template })
    } catch (error) {
      return handleApiError(error)
    }
  },
  { preset: 'api', byUser: true },
)

export const PATCH = withCsrfProtection(
  withRateLimit(
    async (request: Request, context?: { params?: Record<string, string> }) => {
      try {
        const id = templateId(context)
        if (!id) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

        const { orgId } = await requireAuth(request as NextRequest)
        const data = updateTemplateSchema.parse(await request.json())

        const template = await prisma.emailTemplate.findFirst({
          where: { id, orgId, deletedAt: null },
        })
        if (!template) {
          return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        if (data.name && data.name.trim() !== template.name) {
          const clash = await prisma.emailTemplate.findUnique({
            where: { orgId_name: { orgId, name: data.name.trim() } },
          })
          if (clash) {
            return NextResponse.json(
              { error: 'Another template already has that name' },
              { status: 409 },
            )
          }
        }

        const updated = await prisma.emailTemplate.update({
          where: { id },
          data: {
            ...(data.name !== undefined && { name: data.name.trim() }),
            ...(data.subject !== undefined && { subject: data.subject }),
            ...(data.body !== undefined && { body: data.body }),
            ...(data.category !== undefined && { category: data.category }),
          },
        })

        logger.info('Email template updated', { orgId, templateId: id })

        return NextResponse.json({ template: updated })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)

export const DELETE = withCsrfProtection(
  withRateLimit(
    async (request: Request, context?: { params?: Record<string, string> }) => {
      try {
        const id = templateId(context)
        if (!id) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

        const { orgId } = await requireAuth(request as NextRequest)

        const template = await prisma.emailTemplate.findFirst({
          where: { id, orgId, deletedAt: null },
        })
        if (!template) {
          return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        await prisma.emailTemplate.update({
          where: { id },
          data: { deletedAt: new Date() },
        })

        logger.info('Email template deleted', { orgId, templateId: id })

        return NextResponse.json({ success: true })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)
