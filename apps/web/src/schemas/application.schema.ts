import { z } from 'zod'

export const createApplicationSchema = z.object({
  jobId: z.string().cuid(),
  candidateId: z.string().cuid().optional(), // Optional if creating from public
  coverLetter: z.string().min(1).max(5000),
  cvUrl: z.string().url().optional(),
  expectedSalary: z.number().int().positive().optional(),
  availableFrom: z.coerce.date().optional(),
})

export const updateApplicationStatusSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWING', 'INTERVIEWED', 'ACCEPTED', 'REJECTED']),
  notes: z.string().max(5000).optional()
})

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>
export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>