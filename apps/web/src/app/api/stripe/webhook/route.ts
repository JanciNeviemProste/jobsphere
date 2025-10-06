/**
 * Stripe Webhook Handler
 * Spracúva Stripe events (subscription.created, payment.succeeded, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { prisma } from '@/lib/db'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
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
    where: { orgId: organizationId },
    create: {
      orgId: organizationId,
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
      stripeSubId: subscription.id,
    },
    create: {
      customerId: customer.id,
      stripeSubId: subscription.id,
      productId: priceId,
      planKey: plan,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      planKey: plan,
      productId: priceId,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  })

  // Update entitlements based on plan
  await updateEntitlements(customer.orgId, plan)

  console.log(`[Stripe] Subscription ${subscription.status} for org ${customer.orgId}`)
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
      stripeSubId: subscription.id,
    },
    data: {
      status: 'canceled',
      canceledAt: new Date(),
    },
  })

  // Revert to free plan entitlements
  await updateEntitlements(customer.orgId, 'STARTER')

  console.log(`[Stripe] Subscription canceled for org ${customer.orgId}`)
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
