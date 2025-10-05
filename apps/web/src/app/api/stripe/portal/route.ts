/**
 * Stripe Customer Portal
 * Redirect to Stripe billing portal for subscription management
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

    // Get organization
    const orgMember = await prisma.orgMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!orgMember) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    // Get customer
    const customer = await prisma.orgCustomer.findUnique({
      where: { organizationId: orgMember.organizationId },
    })

    if (!customer?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 400 }
      )
    }

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/employer/settings`,
    })

    return NextResponse.json({
      url: portalSession.url,
    })
  } catch (error) {
    console.error('Portal session error:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
