import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * Verify Resend webhook signature using Svix headers.
 * If RESEND_WEBHOOK_SECRET is not set, logs a warning and allows the request (dev backward compatibility).
 */
function verifyResendSignature(body: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.warn('RESEND_WEBHOOK_SECRET not set - skipping webhook signature verification')
    return true // Allow in dev
  }

  const svixId = headers.get('svix-id')
  const svixTimestamp = headers.get('svix-timestamp')
  const svixSignature = headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false
  }

  const signedContent = `${svixId}.${svixTimestamp}.${body}`
  const secretBytes = Buffer.from(secret.split('_').pop() || secret, 'base64')
  const signature = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64')

  const expectedSignatures = svixSignature.split(' ')
  return expectedSignatures.some((sig) => {
    const sigValue = sig.split(',').pop() || sig
    return sigValue === signature
  })
}

export async function POST(req: NextRequest) {
  try {
    // Read raw body for signature verification before parsing JSON
    const rawBody = await req.text()

    // Verify Resend webhook signature (Svix headers)
    if (!verifyResendSignature(rawBody, req.headers)) {
      logger.warn('Email webhook signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)

    // Resend webhook format
    if (body.type) {
      return handleResendWebhook(body)
    }

    // SendGrid webhook format
    // TODO: Add SendGrid signature verification (Event Webhook Verification Key)
    if (Array.isArray(body)) {
      return handleSendGridWebhook(body)
    }

    return NextResponse.json({ error: 'Unknown webhook format' }, { status: 400 })
  } catch (error) {
    logger.error('Email webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function handleResendWebhook(event: any) {
  const { type, data } = event

  const kindMap: Record<string, string> = {
    'email.delivered': 'SENT',
    'email.opened': 'OPENED',
    'email.clicked': 'CLICKED',
    'email.bounced': 'BOUNCED',
    'email.complained': 'COMPLAINED',
  }

  const kind = kindMap[type]
  if (!kind) return NextResponse.json({ received: true })

  const emailId = data.headers?.['X-Email-ID'] || data.tags?.emailId

  if (emailId) {
    const run = await prisma.emailSequenceRun.findFirst({
      where: { id: emailId },
    })

    if (run) {
      // Fetch the latest event separately since events is not a direct relation on EmailSequenceRun
      const events = await prisma.emailSequenceEvent.findMany({
        where: { runId: run.id },
        orderBy: { at: 'desc' },
        take: 1,
      })

      const lastEvent = events[0]

      if (lastEvent) {
        await prisma.emailSequenceEvent.create({
          data: {
            runId: run.id,
            stepId: lastEvent.stepId,
            kind,
            metadata: data,
          },
        })
      }
    }
  }

  return NextResponse.json({ received: true })
}

async function handleSendGridWebhook(events: any[]) {
  for (const event of events) {
    const kind = event.event?.toUpperCase()
    const emailId = event.emailId || event['X-Email-ID']

    if (emailId && kind) {
      const run = await prisma.emailSequenceRun.findFirst({
        where: { id: emailId },
      })

      if (run) {
        // Fetch the latest event separately since events is not a direct relation on EmailSequenceRun
        const events = await prisma.emailSequenceEvent.findMany({
          where: { runId: run.id },
          orderBy: { at: 'desc' },
          take: 1,
        })

        const lastEvent = events[0]

        if (lastEvent) {
          await prisma.emailSequenceEvent.create({
            data: {
              runId: run.id,
              stepId: lastEvent.stepId,
              kind,
              metadata: event,
            },
          })
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
