/**
 * Reusable email bodies, scoped to the organisation.
 *
 * Every message to a candidate outside a sequence was typed from scratch. That
 * is part of why rejections went out with no reason at all: writing one each time
 * is work, and skipping it is free. A template makes the considered version the
 * cheap option.
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

export const runtime = 'nodejs'

export const TEMPLATE_CATEGORIES = ['GENERAL', 'REJECTION', 'INTERVIEW_INVITE', 'OFFER'] as const

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  category: z.enum(TEMPLATE_CATEGORIES).default('GENERAL'),
})

export const GET = withRateLimit(
  async (request: Request) => {
    try {
      const { orgId } = await requireAuth(request as NextRequest)
      const { searchParams } = new URL(request.url)
      const category = searchParams.get('category')

      // `deletedAt: null` written out: EmailTemplate is not one of the five
      // models the soft-delete middleware in lib/prisma.ts covers.
      const templates = await prisma.emailTemplate.findMany({
        where: {
          orgId,
          deletedAt: null,
          ...(category && (TEMPLATE_CATEGORIES as readonly string[]).includes(category)
            ? { category }
            : {}),
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        take: 200,
      })

      return NextResponse.json({ templates })
    } catch (error) {
      return handleApiError(error)
    }
  },
  { preset: 'api', byUser: true },
)

export const POST = withCsrfProtection(
  withRateLimit(
    async (request: Request) => {
      try {
        const { userId, orgId } = await requireAuth(request as NextRequest)
        const data = createTemplateSchema.parse(await request.json())
        const name = data.name.trim()

        const existing = await prisma.emailTemplate.findUnique({
          where: { orgId_name: { orgId, name } },
        })
        if (existing) {
          // Including the soft-deleted ones: the unique index does not know about
          // deletedAt, so reusing the name of a deleted template would fail at the
          // database with a 500 instead of a sentence.
          return NextResponse.json(
            {
              error: existing.deletedAt
                ? 'A deleted template still holds that name. Choose another.'
                : 'A template with that name already exists',
            },
            { status: 409 },
          )
        }

        const template = await prisma.emailTemplate.create({
          data: {
            orgId,
            createdBy: userId,
            name,
            subject: data.subject,
            body: data.body,
            category: data.category,
          },
        })

        logger.info('Email template created', { orgId, templateId: template.id })

        return NextResponse.json({ template }, { status: 201 })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)
