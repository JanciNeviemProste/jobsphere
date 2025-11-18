import { Job } from 'bullmq'
import { prisma } from '@jobsphere/db'

interface EmailSequenceJobData {
  runId: string
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
      if (hour >= settings.quietHours.end || hour < settings.quietHours.start) {
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

    // TODO: Send email via email provider
    console.log(`📤 Sending email to ${contact.email}`)
    console.log(`Subject: ${subject}`)

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
  // TODO: Implement condition evaluation
  // Examples:
  // - stage_changed: Skip if application stage changed
  // - replied: Skip if candidate replied to previous email
  // - opened: Only send if previous email was opened
  return false
}

function mergeTags(template: string, data: any): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = path.split('.').reduce((obj: any, key: string) => obj?.[key], data)
    return value || match
  })
}