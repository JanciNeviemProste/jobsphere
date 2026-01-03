import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Resend webhook format
    if (body.type) {
      return handleResendWebhook(body)
    }

    // SendGrid webhook format
    if (Array.isArray(body)) {
      return handleSendGridWebhook(body)
    }

    return NextResponse.json({ error: 'Unknown webhook format' }, { status: 400 })
  } catch (error) {
    console.error('Email webhook error:', error)
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
    'email.complained': 'COMPLAINED'
  }

  const kind = kindMap[type]
  if (!kind) return NextResponse.json({ received: true })

  const emailId = data.headers?.['X-Email-ID'] || data.tags?.emailId

  if (emailId) {
    const run = await prisma.emailSequenceRun.findFirst({
      where: { id: emailId }
    })

    if (run) {
      // Fetch the latest event separately since events is not a direct relation on EmailSequenceRun
      const events = await prisma.emailSequenceEvent.findMany({
        where: { runId: run.id },
        orderBy: { at: 'desc' },
        take: 1
      })

      const lastEvent = events[0]

      if (lastEvent) {
        await prisma.emailSequenceEvent.create({
          data: {
            runId: run.id,
            stepId: lastEvent.stepId,
            kind,
            metadata: data
          }
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
        where: { id: emailId }
      })

      if (run) {
        // Fetch the latest event separately since events is not a direct relation on EmailSequenceRun
        const events = await prisma.emailSequenceEvent.findMany({
          where: { runId: run.id },
          orderBy: { at: 'desc' },
          take: 1
        })

        const lastEvent = events[0]

        if (lastEvent) {
          await prisma.emailSequenceEvent.create({
            data: {
              runId: run.id,
              stepId: lastEvent.stepId,
              kind,
              metadata: event
            }
          })
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
