import { Job } from 'bullmq'
import { prisma } from '@jobsphere/db'

interface StripeWebhookJobData {
  eventId: string
  eventType: string
  payload: any
}

export async function stripeWebhooksWorker(job: Job<StripeWebhookJobData>) {
  const { eventId, eventType, payload } = job.data

  console.log(`💳 Processing Stripe webhook: ${eventType}`)

  try {
    // Check if event already processed
    const existing = await prisma.providerEvent.findFirst({
      where: {
        provider: 'stripe',
        kind: eventType,
        processed: true,
        payload: { path: ['id'], equals: eventId },
      },
    })

    if (existing) {
      console.log('⏭️  Event already processed')
      return { skipped: true }
    }

    // Store event
    const providerEvent = await prisma.providerEvent.create({
      data: {
        provider: 'stripe',
        kind: eventType,
        payload,
      },
    })

    // Process based on event type
    switch (eventType) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(payload)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(payload)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(payload)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(payload)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(payload)
        break

      default:
        console.log(`ℹ️  Unhandled event type: ${eventType}`)
    }

    // Mark as processed
    await prisma.providerEvent.update({
      where: { id: providerEvent.id },
      data: { processed: true },
    })

    console.log(`✅ Processed Stripe webhook`)
    return { processed: true }
  } catch (error) {
    console.error(`❌ Failed to process Stripe webhook:`, error)

    await prisma.providerEvent.updateMany({
      where: {
        provider: 'stripe',
        payload: { path: ['id'], equals: eventId },
      },
      data: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    throw error
  }
}

async function handleCheckoutCompleted(data: any) {
  const { customer, subscription, metadata } = data

  const orgId = metadata.orgId

  // Create or update customer
  await prisma.orgCustomer.upsert({
    where: { orgId },
    create: {
      orgId,
      providerCustomerId: customer,
    },
    update: {
      providerCustomerId: customer,
    },
  })

  // Subscription will be created via subscription.created event
}

async function handleSubscriptionUpdate(data: any) {
  const { id, customer, items, status, current_period_start, current_period_end, metadata } = data

  // Find organization by customer
  const orgCustomer = await prisma.orgCustomer.findUnique({
    where: { providerCustomerId: customer },
  })

  if (!orgCustomer) {
    throw new Error(`Organization not found for customer ${customer}`)
  }

  // Get product from subscription items
  const productPriceId = items.data[0].price.id
  const price = await prisma.price.findUnique({
    where: { providerPriceId: productPriceId },
  })

  if (!price) {
    throw new Error(`Price not found for ${productPriceId}`)
  }

  // Upsert subscription
  const subscription = await prisma.subscription.upsert({
    where: { providerSubId: id },
    create: {
      orgId: orgCustomer.orgId,
      productId: price.productId,
      providerSubId: id,
      status,
      currentPeriodStart: new Date(current_period_start * 1000),
      currentPeriodEnd: new Date(current_period_end * 1000),
    },
    update: {
      status,
      currentPeriodStart: new Date(current_period_start * 1000),
      currentPeriodEnd: new Date(current_period_end * 1000),
    },
  })

  // Update entitlements based on plan
  const plan = await prisma.plan.findFirst({
    where: { productId: price.productId },
    include: { features: true },
  })

  if (plan) {
    for (const feature of plan.features) {
      await prisma.entitlement.upsert({
        where: {
          orgId_featureKey: {
            orgId: orgCustomer.orgId,
            featureKey: feature.featureKey,
          },
        },
        create: {
          orgId: orgCustomer.orgId,
          featureKey: feature.featureKey,
          limitInt: feature.limitInt,
          remainingInt: feature.limitInt,
        },
        update: {
          limitInt: feature.limitInt,
          remainingInt: feature.limitInt,
        },
      })
    }
  }
}

async function handleSubscriptionDeleted(data: any) {
  const { id } = data

  await prisma.subscription.updateMany({
    where: { providerSubId: id },
    data: {
      status: 'canceled',
      endedAt: new Date(),
    },
  })

  // Downgrade to free plan entitlements
  const subscription = await prisma.subscription.findUnique({
    where: { providerSubId: id },
  })

  if (subscription) {
    await prisma.entitlement.updateMany({
      where: { orgId: subscription.orgId },
      data: { limitInt: 0, remainingInt: 0 },
    })
  }
}

async function handleInvoicePaymentSucceeded(data: any) {
  const { id, customer, amount_paid, currency, hosted_invoice_url, invoice_pdf, subscription } =
    data

  const orgCustomer = await prisma.orgCustomer.findUnique({
    where: { providerCustomerId: customer },
  })

  if (!orgCustomer) return

  const sub = await prisma.subscription.findUnique({
    where: { providerSubId: subscription },
  })

  // Create invoice record
  const invoice = await prisma.invoice.upsert({
    where: { providerInvoiceId: id },
    create: {
      orgId: orgCustomer.orgId,
      subscriptionId: sub?.id,
      providerInvoiceId: id,
      amount: amount_paid,
      currency,
      status: 'paid',
      pdfUrl: invoice_pdf,
      hostedUrl: hosted_invoice_url,
      paidAt: new Date(),
    },
    update: {
      status: 'paid',
      paidAt: new Date(),
    },
  })

  // Create payment record
  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      providerPaymentId: id,
      amount: amount_paid,
      currency,
      status: 'succeeded',
    },
  })
}

async function handleInvoicePaymentFailed(data: any) {
  const { id, customer } = data

  const orgCustomer = await prisma.orgCustomer.findUnique({
    where: { providerCustomerId: customer },
  })

  if (!orgCustomer) return

  await prisma.invoice.updateMany({
    where: { providerInvoiceId: id },
    data: { status: 'uncollectible' },
  })

  // TODO: Send notification to organization
}