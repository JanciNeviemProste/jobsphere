/**
 * Stripe Webhook Handler
 * Spracúva Stripe events (subscription.created, payment.succeeded, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { prisma } from '@/lib/db'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = headers().get('stripe-signature')!

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

    console.log(`[Stripe Webhook] ${event.type}`)

    // Handle events
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

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
    where: { organizationId },
    create: {
      organizationId,
      stripeCustomerId: session.customer as string,
    },
    update: {
      stripeCustomerId: session.customer as string,
    },
  })

  console.log(`[Stripe] Checkout completed for org ${organizationId}`)
}

/**
 * Handle subscription created/updated
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  // Find organization by customer ID
  const customer = await prisma.orgCustomer.findUnique({
    where: { stripeCustomerId: customerId },
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

  // Upsert subscription
  await prisma.stripeSubscription.upsert({
    where: {
      organizationId_stripeSubscriptionId: {
        organizationId: customer.organizationId,
        stripeSubscriptionId: subscription.id,
      },
    },
    create: {
      organizationId: customer.organizationId,
      stripeSubscriptionId: subscription.id,
      plan,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      plan,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  })

  // Update entitlements based on plan
  await updateEntitlements(customer.organizationId, plan)

  console.log(`[Stripe] Subscription ${subscription.status} for org ${customer.organizationId}`)
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  const customer = await prisma.orgCustomer.findUnique({
    where: { stripeCustomerId: customerId },
  })

  if (!customer) return

  // Update subscription status
  await prisma.stripeSubscription.updateMany({
    where: {
      organizationId: customer.organizationId,
      stripeSubscriptionId: subscription.id,
    },
    data: {
      status: 'canceled',
      canceledAt: new Date(),
    },
  })

  // Revert to free plan entitlements
  await updateEntitlements(customer.organizationId, 'STARTER')

  console.log(`[Stripe] Subscription canceled for org ${customer.organizationId}`)
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log(`[Stripe] Payment succeeded: ${invoice.id}`)

  // TODO: Send receipt email
  // TODO: Update usage limits if needed
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`[Stripe] Payment failed: ${invoice.id}`)

  // TODO: Send payment failure notification
  // TODO: Implement grace period logic
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
      organizationId_feature: {
        organizationId,
        feature: 'MAX_JOBS',
      },
    },
    create: {
      organizationId,
      feature: 'MAX_JOBS',
      limit: planLimits.maxJobs,
    },
    update: {
      limit: planLimits.maxJobs,
    },
  })

  await prisma.entitlement.upsert({
    where: {
      organizationId_feature: {
        organizationId,
        feature: 'MAX_CANDIDATES',
      },
    },
    create: {
      organizationId,
      feature: 'MAX_CANDIDATES',
      limit: planLimits.maxCandidates,
    },
    update: {
      limit: planLimits.maxCandidates,
    },
  })

  await prisma.entitlement.upsert({
    where: {
      organizationId_feature: {
        organizationId,
        feature: 'EMAIL_SEQUENCES',
      },
    },
    create: {
      organizationId,
      feature: 'EMAIL_SEQUENCES',
      enabled: planLimits.emailSequences,
    },
    update: {
      enabled: planLimits.emailSequences,
    },
  })

  await prisma.entitlement.upsert({
    where: {
      organizationId_feature: {
        organizationId,
        feature: 'ASSESSMENTS',
      },
    },
    create: {
      organizationId,
      feature: 'ASSESSMENTS',
      enabled: planLimits.assessments,
    },
    update: {
      enabled: planLimits.assessments,
    },
  })

  await prisma.entitlement.upsert({
    where: {
      organizationId_feature: {
        organizationId,
        feature: 'AI_MATCHING',
      },
    },
    create: {
      organizationId,
      feature: 'AI_MATCHING',
      enabled: planLimits.aiMatching,
    },
    update: {
      enabled: planLimits.aiMatching,
    },
  })
}
