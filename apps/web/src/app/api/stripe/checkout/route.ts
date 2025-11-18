/**
 * Stripe Checkout Session API
 * Creates checkout session for subscription purchase
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan } = await request.json()

    if (!['STARTER', 'PROFESSIONAL', 'ENTERPRISE'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // Get organization
    const userOrgRole = await prisma.orgMember.findFirst({
      where: { userId: session.user.id },
      include: { organization: true },
    })

    if (!userOrgRole) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    // Get or create Stripe customer
    let customer = await prisma.orgCustomer.findUnique({
      where: { orgId: userOrgRole.orgId },
    })

    let stripeCustomerId: string

    if (customer?.stripeCustomerId) {
      stripeCustomerId = customer.stripeCustomerId
    } else {
      // Create Stripe customer
      const stripeCustomer = await stripe.customers.create({
        email: session.user.email!,
        metadata: {
          organizationId: userOrgRole.orgId,
          organizationName: userOrgRole.organization.name,
        },
      })

      stripeCustomerId = stripeCustomer.id

      // Save to DB
      await prisma.orgCustomer.upsert({
        where: { orgId: userOrgRole.orgId },
        create: {
          orgId: userOrgRole.orgId,
          stripeCustomerId: stripeCustomerId,
        },
        update: {
          stripeCustomerId: stripeCustomerId,
        },
      })
    }

    // Determine price ID
    let priceId: string

    if (plan === 'PROFESSIONAL') {
      priceId = process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY!
    } else if (plan === 'ENTERPRISE') {
      priceId = process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY!
    } else {
      return NextResponse.json(
        { error: 'Starter plan is free' },
        { status: 400 }
      )
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: {
        organizationId: userOrgRole.orgId,
        plan,
      },
    })

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    })
  } catch (error) {
    console.error('Checkout session error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
