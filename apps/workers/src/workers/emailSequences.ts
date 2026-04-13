import { Job } from 'bullmq'
import { prisma } from '@jobsphere/db'

interface EmailSequenceJobData {
  runId: string
}

/**
 * Send email via configured provider
 */
async function sendEmail(data: { to: string; subject: string; html: string }): Promise<void> {
  const emailService = process.env.EMAIL_SERVICE || 'resend'

  if (emailService === 'log') {
    console.log('📧 [DEV] Email would be sent:', data.subject, 'to:', data.to)
    return
  }

  if (emailService === 'resend') {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn('RESEND_API_KEY not set, email not sent')
      return
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'JobSphere <noreply@jobsphere.app>',
        to: data.to,
        subject: data.subject,
        html: data.html,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Resend API error: ${error}`)
    }
  } else if (emailService === 'sendgrid') {
    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) {
      console.warn('SENDGRID_API_KEY not set, email not sent')
      return
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: data.to }] }],
        from: {
          email: process.env.EMAIL_FROM || 'noreply@jobsphere.app',
          name: 'JobSphere',
        },
        subject: data.subject,
        content: [{ type: 'text/html', value: data.html }],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`SendGrid API error: ${error}`)
    }
  }
}

export async function emailSequencesWorker(job: Job<EmailSequenceJobData>) {
  const { runId } = job.data

  console.log(`📨 Processing email sequence run ${runId}`)

  try {
    const run = await prisma.emailSequenceRun.findUnique({
      where: { id: runId },
      include: {
        sequence: {
          include: { steps: { orderBy: { order: 'asc' } } },
        },
        candidate: {
          include: {
            contacts: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
    })

    if (!run || run.status !== 'ACTIVE') {
      return { skipped: 'Run not active' }
    }

    const now = new Date()
    const settings = run.sequence.settings as any

    // Check quiet hours
    if (settings.quietHours) {
      const hour = now.getHours()
      if (hour >= settings.quietHours.start && hour < settings.quietHours.end) {
        console.log('⏰ Skipping - quiet hours')
        return { skipped: 'Quiet hours' }
      }
    }

    // Get next step to send
    const nextStep = run.sequence.steps.find((step, index) => index === run.currentStep)

    if (!nextStep) {
      // Sequence completed
      await prisma.emailSequenceRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED',
          completedAt: now,
        },
      })
      return { completed: true }
    }

    // Check if it's time to send this step
    const stepDueDate = new Date(run.startedAt)
    stepDueDate.setDate(stepDueDate.getDate() + nextStep.dayOffset)
    stepDueDate.setHours(nextStep.hourOffset, 0, 0, 0)

    if (now < stepDueDate) {
      console.log('⏱️  Step not due yet')
      return { skipped: 'Not due yet', dueAt: stepDueDate }
    }

    // Check conditions
    if (nextStep.conditions) {
      const shouldSkip = await evaluateConditions(nextStep.conditions as any, run.candidate)
      if (shouldSkip) {
        // Skip this step and move to next
        await prisma.emailSequenceRun.update({
          where: { id: runId },
          data: { currentStep: { increment: 1 } },
        })

        await prisma.emailSequenceEvent.create({
          data: {
            runId,
            stepId: nextStep.id,
            kind: 'SKIPPED',
            metadata: { reason: 'Conditions not met' },
          },
        })

        return { skipped: 'Conditions not met' }
      }
    }

    // Merge tags
    const contact = run.candidate.contacts[0]
    const subject = mergeTags(nextStep.subject, {
      candidate: contact,
      sequence: run.sequence,
    })

    const body = mergeTags(nextStep.bodyTemplate, {
      candidate: contact,
      sequence: run.sequence,
      unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe/${runId}`,
    })

    // Send email via email provider
    console.log(`📤 Sending email to ${contact.email}`)
    console.log(`Subject: ${subject}`)

    await sendEmail({
      to: contact.email,
      subject: subject,
      html: body,
    })

    // Record event
    await prisma.emailSequenceEvent.create({
      data: {
        runId,
        stepId: nextStep.id,
        kind: 'SENT',
        metadata: { subject, to: contact.email },
      },
    })

    // Move to next step
    await prisma.emailSequenceRun.update({
      where: { id: runId },
      data: { currentStep: { increment: 1 } },
    })

    console.log(`✅ Email sent successfully`)
    return { sent: true, step: nextStep.name }
  } catch (error) {
    console.error(`❌ Failed to process sequence:`, error)
    throw error
  }
}

async function evaluateConditions(conditions: any, candidate: any): Promise<boolean> {
  // Returns true if conditions indicate we should SKIP this email

  if (!conditions || !Array.isArray(conditions)) {
    return false
  }

  for (const condition of conditions) {
    const conditionType = condition.type || condition.kind

    switch (conditionType) {
      case 'stage_changed': {
        // Skip if application stage changed from expected stage
        const application = await prisma.application.findFirst({
          where: { candidateId: candidate.id },
          orderBy: { updatedAt: 'desc' },
        })

        if (application && condition.expectedStage) {
          if (application.stage !== condition.expectedStage) {
            console.log(`⏭️  Skipping: Application stage changed to ${application.stage}`)
            return true // Skip this step
          }
        }
        break
      }

      case 'replied': {
        // Skip if candidate replied to previous email
        const sinceDate = condition.since
          ? new Date(condition.since)
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days

        const replies = await prisma.emailMessage.count({
          where: {
            thread: {
              entityType: 'CANDIDATE',
              entityId: candidate.id,
            },
            direction: 'INBOUND',
            receivedAt: { gte: sinceDate },
          },
        })

        if (replies > 0) {
          console.log(`⏭️  Skipping: Candidate replied to previous email`)
          return true // Skip this step
        }
        break
      }

      case 'opened': {
        // Skip if previous email was NOT opened (when required)
        const sinceDate = condition.since
          ? new Date(condition.since)
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

        const opened = await prisma.emailEvent.count({
          where: {
            kind: 'OPENED',
            message: {
              thread: {
                entityType: 'CANDIDATE',
                entityId: candidate.id,
              },
            },
            timestamp: { gte: sinceDate },
          },
        })

        if (condition.required && opened === 0) {
          console.log(`⏭️  Skipping: Previous email was not opened`)
          return true // Skip this step
        }
        break
      }

      default:
        console.warn(`Unknown condition type: ${conditionType}`)
    }
  }

  return false // Don't skip - all conditions passed
}

function mergeTags(template: string, data: any): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = path.split('.').reduce((obj: any, key: string) => obj?.[key], data)
    return value || match
  })
}
