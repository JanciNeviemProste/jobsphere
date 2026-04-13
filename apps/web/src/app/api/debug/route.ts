import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const errors: string[] = []
  const ok: string[] = []

  const tests: [string, () => Promise<unknown>][] = [
    ['@/lib/prisma', () => import('@/lib/prisma')],
    ['@/lib/logger', () => import('@/lib/logger')],
    ['@/lib/errors', () => import('@/lib/errors')],
    ['@/lib/rate-limit', () => import('@/lib/rate-limit')],
    ['@/lib/csrf', () => import('@/lib/csrf')],
    ['@/lib/auth', () => import('@/lib/auth')],
    ['@/lib/validation', () => import('@/lib/validation')],
    ['resend', () => import('resend')],
    ['@sendgrid/mail', () => import('@sendgrid/mail')],
    ['@/lib/email', () => import('@/lib/email')],
  ]

  for (const [name, fn] of tests) {
    try {
      await fn()
      ok.push(name)
    } catch (e: any) {
      errors.push(`${name}: ${e.code || ''} ${e.message?.substring(0, 200)}`)
    }
  }

  return NextResponse.json({ ok, errors, node: process.version })
}
