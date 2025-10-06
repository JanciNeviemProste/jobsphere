import { NextResponse } from 'next/server'
import { z } from 'zod'

export class ValidationError extends Error {
  constructor(
    public issues: z.ZodIssue[],
    message = 'Validation failed'
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export async function validateRequest<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  try {
    const body = await request.json()
    return schema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.issues)
    }
    throw error
  }
}

export function handleValidationError(error: ValidationError) {
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