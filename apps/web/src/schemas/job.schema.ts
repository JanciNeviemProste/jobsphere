import { z } from 'zod'

// Base job schema without refinements
const baseJobSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(10000),
  location: z.string().min(1).max(200),
  salaryMin: z.number().int().positive().optional(),
  salaryMax: z.number().int().positive().optional(),
  workMode: z.enum(['REMOTE', 'HYBRID', 'ONSITE']).default('HYBRID'),
  type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT']).default('FULL_TIME'),
  seniority: z.enum(['JUNIOR', 'MEDIOR', 'SENIOR', 'LEAD']).default('MEDIOR'),
  status: z.enum(['ACTIVE', 'CLOSED', 'DRAFT']).default('ACTIVE'),
  organizationId: z.string().cuid(),
})

// Create job schema with salary validation
export const createJobSchema = baseJobSchema.refine(
  (data) => !data.salaryMin || !data.salaryMax || data.salaryMin <= data.salaryMax,
  { message: 'Minimum salary must be less than maximum salary' }
)

// Update job schema - partial with optional salary validation
export const updateJobSchema = baseJobSchema.partial().refine(
  (data) => !data.salaryMin || !data.salaryMax || data.salaryMin <= data.salaryMax,
  { message: 'Minimum salary must be less than maximum salary' }
)

export type CreateJobInput = z.infer<typeof createJobSchema>
export type UpdateJobInput = z.infer<typeof updateJobSchema>