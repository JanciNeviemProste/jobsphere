/**
 * GDPR DSAR (Data Subject Access Request) API - TEMPORARILY DISABLED
 * TODO: Re-enable after fixing Prisma client GDPR models generation
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Service Temporarily Unavailable',
      message:
        'GDPR DSAR functionality is currently unavailable. This feature will be enabled in a future update.',
      code: 'FEATURE_DISABLED',
    },
    { status: 503 },
  )
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Service Temporarily Unavailable',
      message:
        'GDPR DSAR functionality is currently unavailable. This feature will be enabled in a future update.',
      code: 'FEATURE_DISABLED',
    },
    { status: 503 },
  )
}
