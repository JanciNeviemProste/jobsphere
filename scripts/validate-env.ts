#!/usr/bin/env node
/**
 * Environment Variable Validation Script
 *
 * Validates all required environment variables for production deployment
 * Run this before deploying to ensure all critical configuration is present
 *
 * Usage:
 *   node scripts/validate-env.ts
 *   yarn validate:env
 */

import { z } from 'zod'
import * as dotenv from 'dotenv'

// Load environment variables from .env file (if running locally)
dotenv.config()

// Define environment variable schema
const envSchema = z.object({
  // Database (CRITICAL)
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid URL')
    .refine(
      (url) => url.includes('statement_timeout'),
      'DATABASE_URL must include statement_timeout parameter (e.g., ?statement_timeout=10000ms)',
    )
    .refine(
      (url) => url.includes('connection_limit') || url.includes('pool_timeout'),
      'DATABASE_URL should include connection_limit parameter (e.g., ?connection_limit=25)',
    )
    .describe('PostgreSQL connection string with timeout and pooling parameters'),

  // Authentication (CRITICAL)
  NEXTAUTH_URL: z
    .string()
    .url('NEXTAUTH_URL must be a valid URL')
    .describe('Base URL of the application (e.g., https://yourdomain.com)'),

  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters for security')
    .describe('Secret for signing JWT tokens (generate with: openssl rand -base64 32)'),

  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be exactly 64 hex characters')
    .regex(/^[0-9a-f]{64}$/, 'ENCRYPTION_KEY must be 64 hexadecimal characters')
    .describe(
      '256-bit AES encryption key (generate with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))")',
    ),

  // Redis / Rate Limiting (CRITICAL)
  KV_REST_API_URL: z
    .string()
    .url('KV_REST_API_URL must be a valid URL')
    .describe('Upstash Redis REST API URL'),

  KV_REST_API_TOKEN: z
    .string()
    .min(20, 'KV_REST_API_TOKEN must be a valid token')
    .describe('Upstash Redis REST API token'),

  // AI Services (REQUIRED)
  ANTHROPIC_API_KEY: z
    .string()
    .startsWith('sk-ant-', 'ANTHROPIC_API_KEY must start with sk-ant-')
    .min(40, 'ANTHROPIC_API_KEY appears to be invalid')
    .describe('Claude AI API key from Anthropic'),

  OPENAI_API_KEY: z
    .string()
    .startsWith('sk-', 'OPENAI_API_KEY must start with sk-')
    .min(40, 'OPENAI_API_KEY appears to be invalid')
    .describe('OpenAI API key for embeddings'),

  // Email (REQUIRED)
  RESEND_API_KEY: z
    .string()
    .startsWith('re_', 'RESEND_API_KEY must start with re_')
    .min(20, 'RESEND_API_KEY appears to be invalid')
    .describe('Resend email service API key'),

  EMAIL_FROM: z
    .string()
    .email('EMAIL_FROM must be a valid email address or in format "Name <email@domain.com>"')
    .or(z.string().regex(/^.+<.+@.+>$/, 'EMAIL_FROM must be in format "Name <email@domain.com>"'))
    .describe('Default sender email address'),

  // Node Environment (INFORMATIONAL)
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .optional()
    .default('development')
    .describe('Node environment'),
})

// Optional environment variables (warnings only)
const optionalEnvSchema = z.object({
  // OAuth (optional but recommended)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Monitoring (optional but recommended)
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // File Upload (optional)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Stripe (optional - for billing)
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),

  // Email alternatives (optional)
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_SERVICE: z.enum(['resend', 'sendgrid', 'log']).optional(),

  // Background Jobs (optional - defaults to same Redis)
  REDIS_URL: z.string().url().optional(),

  // Security (optional)
  ENABLE_OCR: z.enum(['true', 'false']).optional(),
  ENABLE_ANTIVIRUS: z.enum(['true', 'false']).optional(),
  CLAMAV_HOST: z.string().optional(),
  CLAMAV_PORT: z.string().optional(),
})

interface ValidationResult {
  success: boolean
  errors: Array<{
    field: string
    message: string
    severity: 'error' | 'warning'
  }>
  warnings: Array<{
    field: string
    message: string
  }>
}

function validateEnvironment(): ValidationResult {
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: [],
  }

  // Validate required environment variables
  const envValidation = envSchema.safeParse(process.env)

  if (!envValidation.success) {
    result.success = false
    const errors = envValidation.error.errors

    for (const error of errors) {
      const field = error.path.join('.')
      const message = error.message
      result.errors.push({ field, message, severity: 'error' })
    }
  }

  // Check optional environment variables (warnings only)
  const optionalValidation = optionalEnvSchema.safeParse(process.env)

  if (!optionalValidation.success) {
    const errors = optionalValidation.error.errors

    for (const error of errors) {
      const field = error.path.join('.')
      const message = error.message
      result.warnings.push({ field, message })
    }
  }

  // Additional validations
  if (process.env.NODE_ENV === 'production') {
    // Warn about missing OAuth
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      result.warnings.push({
        field: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET',
        message: 'Google OAuth not configured - users can only use email/password login',
      })
    }

    // Warn about missing Sentry
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
      result.warnings.push({
        field: 'NEXT_PUBLIC_SENTRY_DSN',
        message: 'Sentry error tracking not configured - production errors will not be tracked',
      })
    }

    // Warn about missing Stripe
    if (!process.env.STRIPE_SECRET_KEY) {
      result.warnings.push({
        field: 'STRIPE_SECRET_KEY',
        message: 'Stripe billing not configured - subscription features will not work',
      })
    }

    // Warn if using log-only email
    if (process.env.EMAIL_SERVICE === 'log') {
      result.errors.push({
        field: 'EMAIL_SERVICE',
        message: 'EMAIL_SERVICE is set to "log" - emails will not be sent in production!',
        severity: 'error',
      })
      result.success = false
    }

    // Validate DATABASE_URL parameters more strictly
    if (process.env.DATABASE_URL) {
      const url = new URL(process.env.DATABASE_URL)
      const params = url.searchParams

      // Check statement_timeout value
      const timeout = params.get('statement_timeout')
      if (timeout) {
        const timeoutMs = parseInt(timeout.replace('ms', ''))
        if (timeoutMs > 30000) {
          result.warnings.push({
            field: 'DATABASE_URL',
            message: `statement_timeout is ${timeoutMs}ms (${timeoutMs / 1000}s) - recommended: 10000ms (10s)`,
          })
        }
      }

      // Check connection_limit value
      const connLimit = params.get('connection_limit')
      if (connLimit) {
        const limit = parseInt(connLimit)
        if (limit < 20) {
          result.warnings.push({
            field: 'DATABASE_URL',
            message: `connection_limit is ${limit} - recommended minimum: 20-25 for production`,
          })
        }
        if (limit > 100) {
          result.warnings.push({
            field: 'DATABASE_URL',
            message: `connection_limit is ${limit} - very high, ensure PostgreSQL max_connections supports this`,
          })
        }
      }
    }
  }

  return result
}

function printResults(result: ValidationResult): void {
  console.log('\n🔍 Environment Variable Validation\n')
  console.log('━'.repeat(60))

  if (result.success && result.errors.length === 0) {
    console.log('\n✅ All required environment variables are valid!\n')
  } else {
    console.log('\n❌ Environment validation failed!\n')
  }

  // Print errors
  if (result.errors.length > 0) {
    console.log('🔴 ERRORS (must fix before deploying):\n')
    for (const error of result.errors) {
      console.log(`   ${error.field}:`)
      console.log(`   └─ ${error.message}\n`)
    }
  }

  // Print warnings
  if (result.warnings.length > 0) {
    console.log('⚠️  WARNINGS (optional but recommended):\n')
    for (const warning of result.warnings) {
      console.log(`   ${warning.field}:`)
      console.log(`   └─ ${warning.message}\n`)
    }
  }

  // Print summary
  console.log('━'.repeat(60))
  console.log('\n📊 Summary:\n')
  console.log(`   Errors: ${result.errors.length}`)
  console.log(`   Warnings: ${result.warnings.length}`)
  console.log(`   Status: ${result.success ? '✅ PASS' : '❌ FAIL'}\n`)

  if (!result.success) {
    console.log('⚠️  Fix all errors before deploying to production!\n')
    console.log('📖 See .env.example for reference configuration\n')
  } else if (result.warnings.length > 0) {
    console.log('ℹ️  Consider addressing warnings for optimal production setup\n')
  }
}

// Main execution
function main(): void {
  try {
    const result = validateEnvironment()
    printResults(result)

    // Exit with error code if validation failed
    if (!result.success) {
      process.exit(1)
    }

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Unexpected error during validation:\n')
    console.error(error)
    process.exit(1)
  }
}

// Run validation if executed directly
if (require.main === module) {
  main()
}

// Export for use in other scripts
export { validateEnvironment, ValidationResult }
