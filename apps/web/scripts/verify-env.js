#!/usr/bin/env node
/**
 * Environment Variables Verification Script
 *
 * Run this before deployment to ensure all required env vars are set.
 * Usage: node scripts/verify-env.js
 *
 * Exit codes:
 * 0 - All required vars present
 * 1 - Missing required vars
 */

const requiredEnvVars = {
  // Public (client-side)
  public: [
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_API_URL',
  ],
  // Server-only
  server: [
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'DATABASE_URL',
    'REDIS_URL',
  ],
  // Optional (warnings only)
  optional: [
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_POSTHOG_KEY',
    'NEXT_PUBLIC_SENTRY_DSN',
  ],
}

const errors = []
const warnings = []

console.log('🔍 Verifying environment variables...\n')

// Check required public vars
console.log('📢 Public variables (NEXT_PUBLIC_*):')
requiredEnvVars.public.forEach((varName) => {
  if (process.env[varName]) {
    console.log(`  ✅ ${varName}`)
  } else {
    errors.push(varName)
    console.log(`  ❌ ${varName} - MISSING`)
  }
})

// Check required server vars
console.log('\n🔒 Server variables:')
requiredEnvVars.server.forEach((varName) => {
  if (process.env[varName]) {
    console.log(`  ✅ ${varName}`)
  } else {
    errors.push(varName)
    console.log(`  ❌ ${varName} - MISSING`)
  }
})

// Check optional vars
console.log('\n💡 Optional variables:')
requiredEnvVars.optional.forEach((varName) => {
  if (process.env[varName]) {
    console.log(`  ✅ ${varName}`)
  } else {
    warnings.push(varName)
    console.log(`  ⚠️  ${varName} - NOT SET (optional)`)
  }
})

// Validation results
console.log('\n' + '='.repeat(60))

if (errors.length > 0) {
  console.error('\n❌ VALIDATION FAILED\n')
  console.error('Missing required environment variables:')
  errors.forEach((varName) => {
    console.error(`  - ${varName}`)
  })
  console.error('\n📝 To fix:')
  console.error('1. Copy apps/web/.env.example to apps/web/.env.local')
  console.error('2. Fill in the missing values')
  console.error('3. For Vercel: Add them in Project Settings → Environment Variables\n')
  process.exit(1)
}

if (warnings.length > 0) {
  console.warn('\n⚠️  Optional variables not set:')
  warnings.forEach((varName) => {
    console.warn(`  - ${varName}`)
  })
  console.warn('\nThese are optional but recommended for production.\n')
}

console.log('\n✅ All required environment variables are set!\n')
process.exit(0)
