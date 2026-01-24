/**
 * Web Vitals Analytics Endpoint - TEMPORARILY DISABLED
 * TODO: Re-enable after fixing Prisma client WebVitalsMetric model generation
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Silently accept and ignore web vitals data for now
  // Return 202 Accepted to avoid client-side errors
  return NextResponse.json(
    {
      success: true,
      message: 'Metrics received (logging disabled temporarily)',
    },
    { status: 202 },
  )
}

export async function GET() {
  return NextResponse.json({
    status: 'disabled',
    message: 'Web Vitals analytics endpoint temporarily disabled',
  })
}
