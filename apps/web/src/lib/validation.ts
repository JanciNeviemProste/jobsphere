import { NextResponse } from 'next/server'
import { z } from 'zod'

export class ValidationError extends Error {
  constructor(
    public issues: z.ZodIssue[],
    message = 'Validation failed',
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export async function validateRequest<T extends z.ZodType>(
  request: Request,
  schema: T,
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
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
    { status: 400 },
  )
}

/**
 * Strong password validation schema
 * Requires:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const strongPasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long')
  .refine(
    (password) => /[A-Z]/.test(password),
    'Password must contain at least one uppercase letter',
  )
  .refine(
    (password) => /[a-z]/.test(password),
    'Password must contain at least one lowercase letter',
  )
  .refine((password) => /[0-9]/.test(password), 'Password must contain at least one number')
  .refine(
    (password) => /[^A-Za-z0-9]/.test(password),
    'Password must contain at least one special character',
  )

export const applicationSchema = z.object({
  jobId: z.string().min(1),
  candidateId: z.string().min(1),
  coverLetter: z.string().min(1),
  email: z.string().email().trim().optional(),
  phoneNumber: z
    .string()
    .min(5)
    .regex(/^[+\d\s()-]+$/, 'Invalid phone number format')
    .optional(),
  linkedin: z.string().url().optional(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
