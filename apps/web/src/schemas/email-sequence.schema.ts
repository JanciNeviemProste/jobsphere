import { z } from 'zod'
import { idSchema } from './common.schema'

export const emailStepSchema = z.object({
  order: z.number().int().min(0).max(100),
  dayOffset: z.number().int().min(0).max(365),
  subject: z.string().min(1).max(200),
  bodyTemplate: z.string().min(1).max(50000),
  conditions: z.record(z.any()).optional(),
  abVariant: z.enum(['A', 'B', 'C']).optional()
})

export const createSequenceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  active: z.boolean().default(false),
  steps: z.array(emailStepSchema).min(1).max(10)
})

export const updateSequenceSchema = createSequenceSchema.partial()

export type EmailStepInput = z.infer<typeof emailStepSchema>
export type CreateSequenceInput = z.infer<typeof createSequenceSchema>
export type UpdateSequenceInput = z.infer<typeof updateSequenceSchema>