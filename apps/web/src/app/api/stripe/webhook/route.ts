/**
 * Stripe Webhook Handler
 * Spracúva Stripe events (subscription.created, payment.succeeded, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { prisma } from '@/lib/db'
import { withRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export const POST = withRateLimit(
  async (request: NextRequest) => {
    try {
      const body = await request.text()
      const signature = headers().get('stripe-signature')

      if (!signature) {
        return NextResponse.json(
          { error: 'Missing stripe-signature header' },
          { status: 400 }
        )
      }

      let event: Stripe.Event

      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      } catch (err) {
        console.error('Webhook signature verification failed:', err)
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 400 }
        )
      }

      logger.info(`Stripe webhook received: ${event.type}`, { eventId: event.id })

      // Handle events with proper type safety
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session
          await handleCheckoutCompleted(session)
          break
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription
          await handleSubscriptionUpdate(subscription)
          break
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription
          await handleSubscriptionDeleted(subscription)
          break
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice
          await handlePaymentSucceeded(invoice)
          break
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice
          await handlePaymentFailed(invoice)
          break
        }

        default:
          logger.warn(`Unhandled Stripe event type: ${event.type}`, { eventId: event.id })
      }

      return NextResponse.json({ received: true })
    } catch (error) {
      console.error('Webhook error:', error)
      return NextResponse.json(
        { error: 'Webhook handler failed' },
        { status: 500 }
      )
    }
  },
  { limit: 1000, window: 60 } // High limit for webhooks - 1000 per minute
)

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organizationId

  if (!organizationId) {
    console.error('No organizationId in checkout session metadata')
    return
  }

  // Create or update customer
  await prisma.orgCustomer.upsert({
    where: { orgId: organizationId },
    create: {
      orgId: organizationId,
      providerCustomerId: session.customer as string,
    },
    update: {
      providerCustomerId: session.customer as string,
    },
  })

  logger.info('Stripe checkout completed', { organizationId, sessionId: session.id })
}

/**
 * Handle subscription created/updated
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  // Find organization by customer ID
  const customer = await prisma.orgCustomer.findUnique({
    where: { providerCustomerId: customerId },
  })

  if (!customer) {
    console.error(`Customer not found: ${customerId}`)
    return
  }

  // Get price ID
  const priceId = subscription.items.data[0]?.price.id

  if (!priceId) {
    console.error('No price ID in subscription')
    return
  }

  // Determine plan based on price ID
  let plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' = 'STARTER'

  if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY) {
    plan = 'PROFESSIONAL'
  } else if (priceId === process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY) {
    plan = 'ENTERPRISE'
  }

  // Get product ID from price lookup
  const product = await prisma.product.findFirst({
    where: {
      prices: {
        some: {
          providerPriceId: priceId,
        },
      },
    },
  })

  if (!product) {
    console.error('No product found for price ID:', priceId)
    return
  }

  // Upsert subscription
  await prisma.subscription.upsert({
    where: {
      providerSubId: subscription.id,
    },
    create: {
      orgId: customer.orgId,
      productId: product.id,
      providerSubId: subscription.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
    },
    update: {
      productId: product.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
    },
  })

  // Update entitlements based on plan
  await updateEntitlements(customer.orgId, plan)

  logger.info('Stripe subscription updated', {
    organizationId: customer.orgId,
    subscriptionId: subscription.id,
    status: subscription.status,
    plan
  })
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  const customer = await prisma.orgCustomer.findUnique({
    where: { providerCustomerId: customerId },
  })

  if (!customer) return

  // Update subscription status
  await prisma.subscription.updateMany({
    where: {
      providerSubId: subscription.id,
    },
    data: {
      status: 'canceled',
      canceledAt: new Date(),
    },
  })

  // Revert to free plan entitlements
  await updateEntitlements(customer.orgId, 'STARTER')

  logger.info('Stripe subscription canceled', {
    organizationId: customer.orgId,
    subscriptionId: subscription.id
  })
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  logger.info('Stripe payment succeeded', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    amount: invoice.amount_paid
  })

  try {
    // Get customer details
    const customer = await prisma.orgCustomer.findUnique({
      where: { providerCustomerId: invoice.customer as string },
      include: {
        organization: {
          include: {
            users: {
              where: { role: 'ORG_ADMIN' },
              include: { user: true },
              take: 1,
            },
          },
        },
      },
    })

    if (customer?.organization?.users[0]?.user?.email) {
      const { sendEmail } = await import('@/lib/email')
      const adminEmail = customer.organization.users[0].user.email
      const adminName = customer.organization.users[0].user.name || 'there'
      const amount = (invoice.amount_paid / 100).toFixed(2)
      const currency = invoice.currency?.toUpperCase() || 'USD'

      await sendEmail({
        to: adminEmail,
        subject: `Payment Receipt - JobSphere`,
        html: `
          <h2>Payment Successful</h2>
          <p>Hi ${adminName},</p>
          <p>Thank you for your payment! Your subscription has been renewed.</p>
          <p><strong>Amount Paid:</strong> ${amount} ${currency}</p>
          <p><strong>Invoice Number:</strong> ${invoice.number || invoice.id}</p>
          <p>Your subscription is now active and all features are available.</p>
          <hr />
          <p style="color: #666; font-size: 12px;">JobSphere ATS - Modern recruitment platform</p>
        `,
      })
    }
  } catch (error) {
    logger.error('Failed to send payment receipt', error)
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  logger.warn('Stripe payment failed', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    attemptCount: invoice.attempt_count
  })

  try {
    // Get customer details
    const customer = await prisma.orgCustomer.findUnique({
      where: { providerCustomerId: invoice.customer as string },
      include: {
        organization: {
          include: {
            users: {
              where: { role: 'ORG_ADMIN' },
              include: { user: true },
              take: 1,
            },
            subscriptions: {
              where: { status: { in: ['active', 'past_due'] } },
              orderBy: { currentPeriodEnd: 'desc' },
              take: 1,
            },
          },
        },
      },
    })

    if (!customer) return

    const adminEmail = customer.organization?.users[0]?.user?.email
    const adminName = customer.organization?.users[0]?.user?.name || 'there'

    // Implement grace period: 7 days after first failed payment
    const gracePeriodEnd = new Date()
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7)

    // Update subscription to past_due if first failure
    const subscription = customer.organization?.subscriptions?.[0]
    if (subscription && subscription.status === 'active') {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'past_due' },
      })
    }

    // Send payment failure notification
    if (adminEmail) {
      const { sendEmail } = await import('@/lib/email')
      const updatePaymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/employer/billing`

      await sendEmail({
        to: adminEmail,
        subject: `Payment Failed - Action Required`,
        html: `
          <h2>Payment Failed</h2>
          <p>Hi ${adminName},</p>
          <p>We were unable to process your recent payment for JobSphere.</p>
          <p><strong>What you need to do:</strong></p>
          <ul>
            <li>Update your payment method</li>
            <li>Ensure sufficient funds are available</li>
            <li>Check with your bank if the payment was declined</li>
          </ul>
          <p>You have until <strong>${gracePeriodEnd.toLocaleDateString()}</strong> to update your payment before your account is suspended.</p>
          <p><a href="${updatePaymentUrl}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 5px;">Update Payment Method</a></p>
          <hr />
          <p style="color: #666; font-size: 12px;">JobSphere ATS - Modern recruitment platform</p>
        `,
      })
    }
  } catch (error) {
    logger.error('Failed to handle payment failure', error)
  }
}

/**
 * Update organization entitlements based on plan
 */
async function updateEntitlements(
  organizationId: string,
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'
) {
  // Define limits per plan
  const limits = {
    STARTER: {
      maxJobs: 5,
      maxCandidates: 50,
      maxTeamMembers: 2,
      emailSequences: false,
      assessments: false,
      aiMatching: false,
    },
    PROFESSIONAL: {
      maxJobs: 50,
      maxCandidates: 500,
      maxTeamMembers: 10,
      emailSequences: true,
      assessments: true,
      aiMatching: true,
    },
    ENTERPRISE: {
      maxJobs: -1, // unlimited
      maxCandidates: -1,
      maxTeamMembers: -1,
      emailSequences: true,
      assessments: true,
      aiMatching: true,
    },
  }

  const planLimits = limits[plan]

  // Upsert entitlements
  await prisma.entitlement.upsert({
    where: {
      orgId_featureKey: {
        orgId: organizationId,
        featureKey: 'MAX_JOBS',
      },
    },
    create: {
      orgId: organizationId,
      featureKey: 'MAX_JOBS',
      limitInt: planLimits.maxJobs === -1 ? null : planLimits.maxJobs,
      remainingInt: planLimits.maxJobs === -1 ? null : planLimits.maxJobs,
    },
    update: {
      limitInt: planLimits.maxJobs === -1 ? null : planLimits.maxJobs,
      remainingInt: planLimits.maxJobs === -1 ? null : planLimits.maxJobs,
    },
  })

  await prisma.entitlement.upsert({
    where: {
      orgId_featureKey: {
        orgId: organizationId,
        featureKey: 'MAX_CANDIDATES',
      },
    },
    create: {
      orgId: organizationId,
      featureKey: 'MAX_CANDIDATES',
      limitInt: planLimits.maxCandidates === -1 ? null : planLimits.maxCandidates,
      remainingInt: planLimits.maxCandidates === -1 ? null : planLimits.maxCandidates,
    },
    update: {
      limitInt: planLimits.maxCandidates === -1 ? null : planLimits.maxCandidates,
      remainingInt: planLimits.maxCandidates === -1 ? null : planLimits.maxCandidates,
    },
  })

  await prisma.entitlement.upsert({
    where: {
      orgId_featureKey: {
        orgId: organizationId,
        featureKey: 'EMAIL_SEQUENCES',
      },
    },
    create: {
      orgId: organizationId,
      featureKey: 'EMAIL_SEQUENCES',
      limitInt: planLimits.emailSequences ? 1 : 0,
    },
    update: {
      limitInt: planLimits.emailSequences ? 1 : 0,
    },
  })

  await prisma.entitlement.upsert({
    where: {
      orgId_featureKey: {
        orgId: organizationId,
        featureKey: 'ASSESSMENTS',
      },
    },
    create: {
      orgId: organizationId,
      featureKey: 'ASSESSMENTS',
      limitInt: planLimits.assessments ? 1 : 0,
    },
    update: {
      limitInt: planLimits.assessments ? 1 : 0,
    },
  })

  await prisma.entitlement.upsert({
    where: {
      orgId_featureKey: {
        orgId: organizationId,
        featureKey: 'AI_MATCHING',
      },
    },
    create: {
      orgId: organizationId,
      featureKey: 'AI_MATCHING',
      limitInt: planLimits.aiMatching ? 1 : 0,
    },
    update: {
      limitInt: planLimits.aiMatching ? 1 : 0,
    },
  })
}
