/**
 * LOGIC-011 — suppression guard in sendEmail().
 *
 * Locks in: when the recipient is on the EmailSuppressionList, sendEmail returns
 * a non-throwing suppressed result and NEVER calls the email provider.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { resendSend } = vi.hoisted(() => ({ resendSend: vi.fn() }))
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: resendSend } })),
}))

vi.mock('../unsubscribe', () => ({
  unsubscribeFooterHtml: () => '<p>unsubscribe</p>',
}))

vi.mock('../prisma', () => ({
  prisma: {
    emailSuppressionList: { findUnique: vi.fn() },
  },
}))

import { sendEmail } from '../email'
import { prisma } from '../prisma'

describe('LOGIC-011 — sendEmail suppression guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EMAIL_SERVICE = 'resend'
    process.env.RESEND_API_KEY = 'test_key'
    resendSend.mockResolvedValue({ data: { id: 'sent-1' }, error: null })
  })

  it('skips the provider and returns suppressed for a suppressed recipient', async () => {
    vi.mocked(prisma.emailSuppressionList.findUnique).mockResolvedValue({
      reason: 'UNSUBSCRIBED',
    } as any)

    const result = await sendEmail({
      to: 'blocked@example.com',
      subject: 'Hi',
      html: '<p>Hello</p>',
    })

    expect(prisma.emailSuppressionList.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'blocked@example.com' } }),
    )
    expect(resendSend).not.toHaveBeenCalled()
    expect(result).toMatchObject({ success: true, suppressed: true })
  })

  it('sends normally when the recipient is not suppressed', async () => {
    vi.mocked(prisma.emailSuppressionList.findUnique).mockResolvedValue(null as any)

    const result = await sendEmail({
      to: 'ok@example.com',
      subject: 'Hi',
      html: '<p>Hello</p>',
    })

    expect(resendSend).toHaveBeenCalledTimes(1)
    expect(result.suppressed).toBeUndefined()
    expect(result.success).toBe(true)
  })

  it('lowercases/trims the recipient before the suppression lookup', async () => {
    vi.mocked(prisma.emailSuppressionList.findUnique).mockResolvedValue({
      reason: 'BOUNCED',
    } as any)

    await sendEmail({ to: '  Blocked@Example.com  ', subject: 'Hi', html: '<p>x</p>' })

    expect(prisma.emailSuppressionList.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'blocked@example.com' } }),
    )
    expect(resendSend).not.toHaveBeenCalled()
  })
})
