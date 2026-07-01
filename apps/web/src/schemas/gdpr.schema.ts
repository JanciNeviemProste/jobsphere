import { z } from 'zod'

export const consentSchema = z.object({
  // DATA_IMPORT (L64) gates ingesting data from external sources (Profesia scraper).
  purpose: z.enum(['MARKETING', 'ANALYTICS', 'COOKIES', 'DATA_IMPORT']),
  granted: z.boolean(),
})

export const dsarRequestSchema = z.object({
  type: z.enum(['EXPORT', 'DELETE']),
})

export type ConsentInput = z.infer<typeof consentSchema>
export type DSARRequestInput = z.infer<typeof dsarRequestSchema>
