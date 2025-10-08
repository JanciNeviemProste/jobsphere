import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { withRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { validateRequest } from '@/lib/validation'

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
})

export const POST = withRateLimit(
  async (req: Request) => {
    try {
      // Validate request body
      const data = await validateRequest(req, signupSchema)

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      })

      if (existingUser) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 400 }
        )
      }

      // Hash password
      const hashedPassword = await hash(data.password, 12)

      // Create user
      const user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: hashedPassword,
        },
      })

      return NextResponse.json(
        {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        },
        { status: 201 }
      )
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', issues: error.issues },
          { status: 400 }
        )
      }

      console.error('Signup error:', error)
      return NextResponse.json(
        { error: 'An error occurred during signup' },
        { status: 500 }
      )
    }
  },
  { preset: 'strict' } // 10 requests per 15 minutes
)
