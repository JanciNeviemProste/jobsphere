import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const results: Record<string, string> = { node: process.version }

  // Test require() — this is what causes ERR_REQUIRE_ESM
  const pkgs = [
    'zod',
    '@prisma/client',
    '@upstash/redis',
    'next-auth',
    'bcryptjs',
    'ioredis',
    'pdf-parse',
    'mammoth',
    'file-type',
    'execa',
    'isomorphic-dompurify',
    'resend',
    '@sendgrid/mail',
    '@vercel/blob',
    'bullmq',
    'openai',
    'superjson',
    'web-vitals',
    'next-intl',
    'framer-motion',
    'react-markdown',
    'stripe',
  ]

  for (const pkg of pkgs) {
    try {
      require(pkg)
      results[pkg] = 'OK'
    } catch (e: any) {
      results[pkg] = `${e.code || 'ERROR'}: ${(e.message || '').substring(0, 300)}`
    }
  }

  return NextResponse.json(results)
}
