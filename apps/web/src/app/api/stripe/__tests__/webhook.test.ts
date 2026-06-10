/**
 * Stripe Webhook Handler Tests
 *
 * Covers LOGIC-001 (only real Subscription fields are written),
 * LOGIC-008/009 (DB-driven plan mapping + providerSubId-keyed upsert) and
 * LOGIC-015 (atomic idempotency claim — no double-apply on duplicate delivery).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// --- Stripe: stub constructEvent so we feed crafted events deterministically ---
// vi.hoisted lets the mock factory (hoisted above imports) reference this fn.
const { constructEvent } = vi.hoisted(() => ({ constructEvent: vi.fn() }))
vi.mock('stripe', () => {
  return {
    default: class StripeMock {
      webhooks = { constructEvent }
      constructor() {}
    },
  }
})

// --- next/headers: provide the stripe-signature header ---
vi.mock('next/headers', () => ({
  headers: () => ({ get: (k: string) => (k === 'stripe-signature' ? 'sig_test' : null) }),
}))

// --- rate limit: pass-through wrapper so the handler runs directly ---
vi.mock('@/lib/rate-limit', () => ({
  withRateLimit: (handler: any) => handler,
}))

// --- logger: silence ---
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// --- email (dynamically imported by some handlers) ---
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))

// --- prisma ---
vi.mock('@/lib/prisma', () => ({
  prisma: {
    providerEvent: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    orgCustomer: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    price: {
      findFirst: vi.fn(),
    },
    subscription: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    entitlement: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    userOrgRole: {
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { POST } from '../webhook/route'

const ORG_ID = 'org-123'

function makeRequest() {
  return {
    text: async () => '{}',
    headers: { get: () => 'sig_test' },
  } as any
}

function subscriptionEvent(type: string, overrides: Record<string, any> = {}) {
  return {
    id: 'evt_sub_1',
    type,
    data: {
      object: {
        id: 'sub_abc',
        customer: 'cus_abc',
        status: 'active',
        current_period_start: 1_700_000_000,
        current_period_end: 1_702_592_000,
        cancel_at: null,
        canceled_at: null,
        ended_at: null,
        trial_start: null,
        trial_end: null,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: 'price_pro' } }] },
        ...overrides,
      },
    },
  }
}

describe('Stripe webhook — subscription sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default happy-path stubs.
    vi.mocked(prisma.providerEvent.upsert).mockResolvedValue({} as any)
    // First (winning) claim flips false->true.
    vi.mocked(prisma.providerEvent.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.providerEvent.update).mockResolvedValue({} as any)

    vi.mocked(prisma.orgCustomer.findUnique).mockResolvedValue({
      id: 'oc-1',
      orgId: ORG_ID,
      providerCustomerId: 'cus_abc',
    } as any)

    // Price -> Product -> Plan (DB-driven plan mapping, LOGIC-008).
    vi.mocked(prisma.price.findFirst).mockResolvedValue({
      id: 'price-row',
      productId: 'prod-1',
      providerPriceId: 'price_pro',
      product: {
        id: 'prod-1',
        name: 'Professional Plan',
        plans: [{ key: 'professional' }],
      },
    } as any)

    vi.mocked(prisma.subscription.upsert).mockResolvedValue({} as any)
    vi.mocked(prisma.subscription.updateMany).mockResolvedValue({ count: 1 } as any)

    // updateEntitlements reads existing entitlements then upserts.
    vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.entitlement.upsert).mockResolvedValue({} as any)
  })

  it('subscription.created upserts a Subscription keyed on providerSubId with ONLY real fields', async () => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created'))

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    expect(prisma.subscription.upsert).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(prisma.subscription.upsert).mock.calls[0][0] as any

    // Keyed on the unique providerSubId (LOGIC-009).
    expect(arg.where).toEqual({ providerSubId: 'sub_abc' })

    // Only real Subscription columns — no `plan`, no `cancelAtPeriodEnd` (LOGIC-001).
    const writtenKeys = Object.keys(arg.update)
    expect(writtenKeys).not.toContain('plan')
    expect(writtenKeys).not.toContain('cancelAtPeriodEnd')

    expect(arg.update.orgId).toBe(ORG_ID)
    expect(arg.update.productId).toBe('prod-1')
    expect(arg.update.status).toBe('active') // lowercase Stripe vocabulary
    // Unix seconds -> Date conversion.
    expect(arg.update.currentPeriodStart).toEqual(new Date(1_700_000_000 * 1000))
    expect(arg.update.currentPeriodEnd).toEqual(new Date(1_702_592_000 * 1000))
    // Plan key persisted in metadata (no `plan` column exists).
    expect(arg.update.metadata).toMatchObject({ planKey: 'PROFESSIONAL' })
  })

  it('links entitlements based on the DB-resolved plan', async () => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.updated'))

    await POST(makeRequest())

    // updateEntitlements upserts the MAX_JOBS entitlement with PROFESSIONAL limit (50).
    const maxJobsCall = vi
      .mocked(prisma.entitlement.upsert)
      .mock.calls.find((c: any) => c[0].where.orgId_featureKey.featureKey === 'MAX_JOBS')

    expect(maxJobsCall).toBeDefined()
    expect((maxJobsCall![0] as any).create.limitInt).toBe(50)
  })

  it('is idempotent — a duplicate delivery (claim count 0) does not re-apply', async () => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created'))
    // Simulate the row already claimed by a concurrent/previous delivery.
    vi.mocked(prisma.providerEvent.updateMany).mockResolvedValueOnce({ count: 0 } as any)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(body).toMatchObject({ received: true, duplicate: true })
    expect(prisma.subscription.upsert).not.toHaveBeenCalled()
    expect(prisma.entitlement.upsert).not.toHaveBeenCalled()
  })

  it('customer.subscription.deleted cancels ONLY the matching providerSubId and sets timestamps', async () => {
    constructEvent.mockReturnValue(
      subscriptionEvent('customer.subscription.deleted', {
        status: 'canceled',
        canceled_at: 1_702_000_000,
        ended_at: 1_702_000_500,
      }),
    )

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    expect(prisma.subscription.updateMany).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(prisma.subscription.updateMany).mock.calls[0][0] as any

    // Scoped to the specific subscription, NOT every sub of the org (LOGIC-009).
    expect(arg.where).toEqual({ providerSubId: 'sub_abc' })
    expect(arg.data.status).toBe('canceled')
    expect(arg.data.canceledAt).toEqual(new Date(1_702_000_000 * 1000))
    expect(arg.data.endedAt).toEqual(new Date(1_702_000_500 * 1000))
  })

  it('returns 500 and releases the claim when the local Product mapping is missing', async () => {
    constructEvent.mockReturnValue(subscriptionEvent('customer.subscription.created'))
    vi.mocked(prisma.price.findFirst).mockResolvedValue(null)

    const res = await POST(makeRequest())
    expect(res.status).toBe(500)

    // Claim released (processed reset to false) so Stripe can retry.
    const releaseCall = vi
      .mocked(prisma.providerEvent.updateMany)
      .mock.calls.find((c: any) => c[0].data?.processed === false)
    expect(releaseCall).toBeDefined()
  })
})
