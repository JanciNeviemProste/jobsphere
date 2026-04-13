import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const errors: string[] = []
  const ok: string[] = []

  // Test each import individually
  try {
    await import('zod')
    ok.push('zod')
  } catch (e: any) {
    errors.push(`zod: ${e.code || e.message}`)
  }

  try {
    await import('@prisma/client')
    ok.push('@prisma/client')
  } catch (e: any) {
    errors.push(`@prisma/client: ${e.code || e.message}`)
  }

  try {
    await import('@upstash/redis')
    ok.push('@upstash/redis')
  } catch (e: any) {
    errors.push(`@upstash/redis: ${e.code || e.message}`)
  }

  try {
    await import('next-auth')
    ok.push('next-auth')
  } catch (e: any) {
    errors.push(`next-auth: ${e.code || e.message}`)
  }

  try {
    await import('bcryptjs')
    ok.push('bcryptjs')
  } catch (e: any) {
    errors.push(`bcryptjs: ${e.code || e.message}`)
  }

  return NextResponse.json({ ok, errors, node: process.version })
}
