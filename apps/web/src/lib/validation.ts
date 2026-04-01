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

export const jobSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().min(50, 'Description must be at least 50 characters'),
    orgId: z.string().min(1),
    locale: z.string().min(1),
    createdBy: z.string().optional(),
    type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERNSHIP']).optional(),
    seniority: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']).optional(),
    workMode: z.enum(['REMOTE', 'ONSITE', 'HYBRID']).optional(),
    salaryMin: z.number().min(0).nullable().optional(),
    salaryMax: z.number().min(0).nullable().optional(),
    currency: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.salaryMin != null && data.salaryMax != null) {
        return data.salaryMin <= data.salaryMax
      }
      return true
    },
    { message: 'Minimum salary must be less than or equal to maximum salary' },
  )

export const applicationSchema = z.object({
  jobId: z.string().min(1),
  candidateId: z.string().min(1),
  coverLetter: z.string().min(1),
  email: z.string().email().trim().optional(),
  phoneNumber: z
    .string()
    .min(5)
    .regex(/^[+\d\s()\-]+$/, 'Invalid phone number format')
    .optional(),
  linkedin: z.string().url().optional(),
})

export const cvUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/msword',
  ]),
  fileSize: z.number().max(10 * 1024 * 1024, 'File must be under 10MB'),
  locale: z.string().optional(),
  uploadedBy: z.string().optional(),
})

export const userSignupSchema = z.object({
  email: z.string().email(),
  password: strongPasswordSchema,
  name: z.string().min(1),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
