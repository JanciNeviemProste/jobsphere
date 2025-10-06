import { NextResponse } from 'next/server'
import { z } from 'zod'
import { UnauthorizedError, ForbiddenError, NotFoundError } from './api-helpers'
import { ValidationError } from './validation'

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error)

  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: error.message },
      { status: 401 }
    )
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: error.message },
      { status: 403 }
    )
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: error.message },
      { status: 404 }
    )
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        issues: error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      },
      { status: 400 }
    )
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', issues: error.issues },
      { status: 400 }
    )
  }

  if (error instanceof Error && error.message) {
    // Check for known Prisma errors
    if (error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Resource already exists' },
        { status: 409 }
      )
    }
  }

  // Generic error - don't leak details
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}
