/**
 * Environment Variables Validation
 *
 * This file validates all required environment variables at build time.
 * If any required variable is missing, the build will fail with a clear error message.
 *
 * Usage:
 * import { env } from '@/lib/env'
 * console.log(env.NEXT_PUBLIC_APP_URL)
 */

import { z } from 'zod'

// Define schema for environment variables
const envSchema = z.object({
  // ----- PUBLIC (Client-side) -----
  NEXT_PUBLIC_APP_URL: z.string().url().min(1, 'NEXT_PUBLIC_APP_URL is required'),
  NEXT_PUBLIC_API_URL: z.string().url().min(1, 'NEXT_PUBLIC_API_URL is required'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // ----- SERVER ONLY -----
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // ----- OPTIONAL -----
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

// Type-safe environment variables
export type Env = z.infer<typeof envSchema>

/**
 * Validate and parse environment variables
 * @throws {Error} If validation fails
 */
function validateEnv(): Env {
  try {
    return envSchema.parse({
      // Public
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,

      // Server
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      DATABASE_URL: process.env.DATABASE_URL,
      REDIS_URL: process.env.REDIS_URL,

      // Optional
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,

      // System
      NODE_ENV: process.env.NODE_ENV,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map((issue) => {
        return `  ❌ ${issue.path.join('.')}: ${issue.message}`
      })

      throw new Error(
        `\n❌ Invalid environment variables:\n\n${missingVars.join('\n')}\n\n` +
        `📝 Check your .env.local file or Vercel Environment Variables.\n` +
        `📖 See apps/web/.env.example for required variables.\n`
      )
    }
    throw error
  }
}

// Validate on import (fails build if invalid)
export const env = validateEnv()

// Helper to check if we're on client or server
export const isServer = typeof window === 'undefined'
export const isClient = !isServer

/**
 * Get client-safe environment variables (only NEXT_PUBLIC_* vars)
 * Safe to use in client components
 */
export const clientEnv = {
  NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_URL: env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_SENTRY_DSN: env.NEXT_PUBLIC_SENTRY_DSN,
} as const

/**
 * Runtime check for required client variables
 */
if (isClient) {
  if (!clientEnv.NEXT_PUBLIC_APP_URL || !clientEnv.NEXT_PUBLIC_API_URL) {
    console.error('❌ Missing required NEXT_PUBLIC_* environment variables')
  }
}
