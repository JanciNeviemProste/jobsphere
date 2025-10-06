import { z } from 'zod'

export const consentSchema = z.object({
  purpose: z.enum(['MARKETING', 'ANALYTICS', 'COOKIES']),
  granted: z.boolean()
})

export const dsarRequestSchema = z.object({
  type: z.enum(['EXPORT', 'DELETE'])
})

export type ConsentInput = z.infer<typeof consentSchema>
export type DSARRequestInput = z.infer<typeof dsarRequestSchema>