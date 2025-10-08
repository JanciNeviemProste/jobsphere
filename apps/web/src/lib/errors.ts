import { NextResponse } from 'next/server'
import { z } from 'zod'
import { UnauthorizedError, ForbiddenError, NotFoundError } from './api-helpers'
import { ValidationError } from './validation'

/**
 * Generic application error with status code and optional error code
 */
export class AppError extends Error {
  public code?: string

  constructor(message: string, public statusCode: number = 500, code?: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

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

/**
 * Format error as a response object (without NextResponse wrapper)
 * Useful when you need to construct the response manually
 */
export function errorResponse(error: unknown): { error: string; statusCode: number } {
  console.error('Error:', error)

  if (error instanceof UnauthorizedError) {
    return { error: error.message, statusCode: 401 }
  }

  if (error instanceof ForbiddenError) {
    return { error: error.message, statusCode: 403 }
  }

  if (error instanceof NotFoundError) {
    return { error: error.message, statusCode: 404 }
  }

  if (error instanceof ValidationError) {
    return { error: 'Validation failed', statusCode: 400 }
  }

  if (error instanceof z.ZodError) {
    return { error: 'Validation failed', statusCode: 400 }
  }

  if (error instanceof Error && error.message) {
    // Check for known Prisma errors
    if (error.message.includes('Unique constraint')) {
      return { error: 'Resource already exists', statusCode: 409 }
    }
  }

  // Generic error - don't leak details
  return { error: 'Internal server error', statusCode: 500 }
}
