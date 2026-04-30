import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { withRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { validateRequest, strongPasswordSchema, ValidationError } from '@/lib/validation'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: strongPasswordSchema,
  role: z.enum(['candidate', 'employer']).optional().default('candidate'),
  companyName: z.string().optional(),
})

export const POST = withRateLimit(
  async (req: Request) => {
    try {
      // Validate request body
      const data = await validateRequest(req, signupSchema)
      data.email = data.email.toLowerCase()

      // Validate employer-specific fields
      if (data.role === 'employer' && !data.companyName?.trim()) {
        return NextResponse.json(
          { error: 'Company name is required for employers' },
          { status: 400 },
        )
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      })

      if (existingUser) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 })
      }

      // Hash password
      const hashedPassword = await hash(data.password, 12)

      // Create user and organization in a transaction
      const user = await prisma.$transaction(async (tx) => {
        // Create user (auto-verify email for MVP so credentials login works immediately)
        const newUser = await tx.user.create({
          data: {
            name: data.name,
            email: data.email,
            password: hashedPassword,
            emailVerified: new Date(),
          },
        })

        // If employer, create organization and link user
        if (data.role === 'employer' && data.companyName) {
          // Generate unique slug
          const baseSlug = data.companyName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
          let slug = baseSlug
          let counter = 1

          // Check for slug uniqueness and add counter if needed
          while (await tx.organization.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${counter}`
            counter++
          }

          const organization = await tx.organization.create({
            data: {
              name: data.companyName.trim(),
              slug,
            },
          })

          await tx.userOrgRole.create({
            data: {
              userId: newUser.id,
              orgId: organization.id,
              role: 'ORG_ADMIN',
            },
          })
        }

        return newUser
      })

      return NextResponse.json(
        {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: data.role,
          },
        },
        { status: 201 },
      )
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json(
          {
            error: error.issues[0]?.message || 'Validation failed',
            issues: error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
          { status: 400 },
        )
      }
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', issues: error.issues },
          { status: 400 },
        )
      }

      logger.error('Signup error:', error)
      return NextResponse.json({ error: 'An error occurred during signup' }, { status: 500 })
    }
  },
  { preset: 'strict' }, // 10 requests per 15 minutes
)
