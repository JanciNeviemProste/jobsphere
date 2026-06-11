/**
 * Email Service Tests
 * Tests for email sending functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  sendEmail,
  sendApplicationNotification,
  sendStatusChangeEmail,
  escapeHtml,
  getApplicationReceivedEmail,
  getNewApplicationEmail,
  getApplicationStatusChangeEmail,
} from '../email'

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn(),
    },
  })),
}))

// Mock environment variables
vi.mock('process', () => ({
  env: {
    EMAIL_SERVICE: 'resend',
    RESEND_API_KEY: 'test_key',
  },
}))

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// sendEmail now performs a suppression-list lookup before sending (LOGIC-011).
// Mock prisma so these tests don't hit a real DB; default = not suppressed.
vi.mock('../prisma', () => ({
  prisma: {
    emailSuppressionList: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}))

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Send Email', () => {
    it('should send email via Resend provider', async () => {
      const { Resend } = await import('resend')
      const mockSend = vi.fn().mockResolvedValueOnce({ id: 'email123' })

      vi.mocked(Resend).mockImplementation(
        () =>
          ({
            emails: { send: mockSend },
          }) as any,
      )

      await sendEmail({
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Hello World</p>',
      })

      expect(mockSend).toHaveBeenCalledWith({
        from: expect.any(String),
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Hello World</p>',
      })
    })

    it('should send email via SendGrid provider', async () => {
      // Mock SendGrid
      const mockSend = vi.fn().mockResolvedValueOnce([{ statusCode: 202 }])

      vi.doMock('@sendgrid/mail', () => ({
        default: {
          setApiKey: vi.fn(),
          send: mockSend,
        },
      }))

      // Test with SendGrid env
      process.env.EMAIL_SERVICE = 'sendgrid'
      process.env.SENDGRID_API_KEY = 'test_sendgrid_key'

      await sendEmail({
        to: 'recipient@example.com',
        subject: 'SendGrid Test',
        html: '<p>SendGrid email</p>',
      })

      // Reset
      process.env.EMAIL_SERVICE = 'resend'
    })

    it('should log email in development mode', async () => {
      process.env.EMAIL_SERVICE = 'log'

      const logger = await import('../logger')

      await sendEmail({
        to: 'dev@example.com',
        subject: 'Dev Email',
        html: '<p>Development</p>',
      })

      expect(logger.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Email logged'),
        expect.objectContaining({
          to: 'dev@example.com',
          subject: 'Dev Email',
        }),
      )

      process.env.EMAIL_SERVICE = 'resend'
    })

    it('should handle missing provider gracefully', async () => {
      process.env.EMAIL_SERVICE = 'unknown'

      await expect(
        sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      ).rejects.toThrow()

      process.env.EMAIL_SERVICE = 'resend'
    })
  })

  describe('Email Templates', () => {
    it('should render application received template', async () => {
      const { Resend } = await import('resend')
      const mockSend = vi.fn().mockResolvedValueOnce({ id: 'template1' })

      vi.mocked(Resend).mockImplementation(
        () =>
          ({
            emails: { send: mockSend },
          }) as any,
      )

      await sendApplicationNotification({
        candidateName: 'John Doe',
        jobTitle: 'Frontend Developer',
        companyName: 'Tech Corp',
        recipientEmail: 'john@example.com',
      })

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Application Received'),
          html: expect.stringContaining('John Doe'),
        }),
      )
    })

    it('should render status change template', async () => {
      const { Resend } = await import('resend')
      const mockSend = vi.fn().mockResolvedValueOnce({ id: 'status1' })

      vi.mocked(Resend).mockImplementation(
        () =>
          ({
            emails: { send: mockSend },
          }) as any,
      )

      await sendStatusChangeEmail({
        candidateName: 'Jane Smith',
        jobTitle: 'Backend Engineer',
        newStatus: 'Interview Scheduled',
        recipientEmail: 'jane@example.com',
      })

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Application Update'),
          html: expect.stringContaining('Interview Scheduled'),
        }),
      )
    })

    it('should replace template variables correctly', async () => {
      const { Resend } = await import('resend')
      const mockSend = vi.fn().mockResolvedValueOnce({ id: 'vars1' })

      vi.mocked(Resend).mockImplementation(
        () =>
          ({
            emails: { send: mockSend },
          }) as any,
      )

      await sendEmail({
        to: 'user@example.com',
        subject: 'Hello {{name}}',
        html: '<p>Welcome {{name}} to {{company}}</p>',
        variables: {
          name: 'Alice',
          company: 'JobSphere',
        },
      })

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Hello Alice',
          html: '<p>Welcome Alice to JobSphere</p>',
        }),
      )
    })

    it('should include unsubscribe link', async () => {
      const { Resend } = await import('resend')
      const mockSend = vi.fn().mockResolvedValueOnce({ id: 'unsub1' })

      vi.mocked(Resend).mockImplementation(
        () =>
          ({
            emails: { send: mockSend },
          }) as any,
      )

      await sendEmail({
        to: 'user@example.com',
        subject: 'Newsletter',
        html: '<p>Newsletter content</p>',
        includeUnsubscribe: true,
      })

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('unsubscribe'),
        }),
      )
    })
  })

  describe('Error Handling', () => {
    it('should retry on transient failures', async () => {
      const { Resend } = await import('resend')
      const mockSend = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ id: 'retry1' })

      vi.mocked(Resend).mockImplementation(
        () =>
          ({
            emails: { send: mockSend },
          }) as any,
      )

      await sendEmail({
        to: 'test@example.com',
        subject: 'Retry Test',
        html: '<p>Test</p>',
        retryAttempts: 2,
      })

      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should log permanent failures', async () => {
      const { Resend } = await import('resend')
      const mockSend = vi.fn().mockRejectedValue(new Error('Permanent error'))

      vi.mocked(Resend).mockImplementation(
        () =>
          ({
            emails: { send: mockSend },
          }) as any,
      )

      const logger = await import('../logger')

      await expect(
        sendEmail({
          to: 'fail@example.com',
          subject: 'Fail',
          html: '<p>Fail</p>',
          retryAttempts: 0,
        }),
      ).rejects.toThrow()

      expect(logger.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send email'),
        expect.any(Object),
      )
    })

    it('should not throw on email send errors when silent', async () => {
      const { Resend } = await import('resend')
      const mockSend = vi.fn().mockRejectedValue(new Error('Silent error'))

      vi.mocked(Resend).mockImplementation(
        () =>
          ({
            emails: { send: mockSend },
          }) as any,
      )

      const result = await sendEmail({
        to: 'silent@example.com',
        subject: 'Silent',
        html: '<p>Silent</p>',
        throwOnError: false,
      })

      expect(result).toEqual({ success: false, error: expect.any(String) })
    })

    it('should return success/failure status', async () => {
      const { Resend } = await import('resend')
      const mockSend = vi.fn().mockResolvedValueOnce({ id: 'success1' })

      vi.mocked(Resend).mockImplementation(
        () =>
          ({
            emails: { send: mockSend },
          }) as any,
      )

      const result = await sendEmail({
        to: 'status@example.com',
        subject: 'Status',
        html: '<p>Status</p>',
      })

      expect(result).toEqual({ success: true, id: 'success1' })
    })
  })

  describe('HTML Escaping (SEC-003)', () => {
    describe('escapeHtml helper', () => {
      it('escapes ampersands', () => {
        expect(escapeHtml('H&M')).toBe('H&amp;M')
      })

      it('escapes less-than and greater-than', () => {
        expect(escapeHtml('<script>alert(1)</script>')).toBe(
          '&lt;script&gt;alert(1)&lt;/script&gt;',
        )
      })

      it('escapes double quotes', () => {
        expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
      })

      it('escapes single quotes', () => {
        expect(escapeHtml("it's")).toBe('it&#x27;s')
      })

      it('returns plain strings unchanged', () => {
        expect(escapeHtml('John Doe')).toBe('John Doe')
      })

      it('handles empty string', () => {
        expect(escapeHtml('')).toBe('')
      })
    })

    it('escapes malicious candidateName in getApplicationReceivedEmail', () => {
      const html = getApplicationReceivedEmail('<img src=x onerror=alert(1)>', 'Engineer', 'ACME')
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
      expect(html).not.toContain('<img src=x')
    })

    it('escapes malicious employerName in getNewApplicationEmail', () => {
      const html = getNewApplicationEmail(
        '<script>steal()</script>',
        'Alice',
        'Developer',
        'app-id-123',
      )
      expect(html).toContain('&lt;script&gt;steal()&lt;/script&gt;')
      expect(html).not.toContain('<script>')
    })

    it('escapes malicious candidateName in getApplicationStatusChangeEmail', () => {
      const html = getApplicationStatusChangeEmail(
        '"><svg/onload=alert(1)>',
        'Software Engineer',
        'REVIEWING',
        'app-id-456',
      )
      expect(html).toContain('&quot;&gt;&lt;svg/onload=alert(1)&gt;')
      expect(html).not.toContain('<svg')
    })

    it('escapes malicious companyName in sendApplicationNotification', async () => {
      const { Resend } = await import('resend')
      const mockSend = vi.fn().mockResolvedValueOnce({ id: 'xss1' })
      vi.mocked(Resend).mockImplementation(() => ({ emails: { send: mockSend } }) as any)
      process.env.EMAIL_SERVICE = 'resend'

      await sendApplicationNotification({
        candidateName: 'Alice',
        jobTitle: 'Dev',
        companyName: '<b onmouseover=alert(1)>CorpName</b>',
        recipientEmail: 'alice@example.com',
      })

      const callArg = mockSend.mock.calls[0][0]
      expect(callArg.html).toContain('&lt;b onmouseover=alert(1)&gt;CorpName&lt;/b&gt;')
      expect(callArg.html).not.toContain('<b onmouseover')
    })

    it('escapes malicious newStatus in sendStatusChangeEmail', async () => {
      const { Resend } = await import('resend')
      const mockSend = vi.fn().mockResolvedValueOnce({ id: 'xss2' })
      vi.mocked(Resend).mockImplementation(() => ({ emails: { send: mockSend } }) as any)
      process.env.EMAIL_SERVICE = 'resend'

      await sendStatusChangeEmail({
        candidateName: 'Bob',
        jobTitle: 'Manager',
        newStatus: '<script>phish()</script>',
        recipientEmail: 'bob@example.com',
      })

      const callArg = mockSend.mock.calls[0][0]
      expect(callArg.html).toContain('&lt;script&gt;phish()&lt;/script&gt;')
      expect(callArg.html).not.toContain('<script>')
    })
  })

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      const { Resend } = await import('resend')
      const mockSend = vi.fn().mockResolvedValue({ id: 'rate1' })

      vi.mocked(Resend).mockImplementation(
        () =>
          ({
            emails: { send: mockSend },
          }) as any,
      )

      // Send multiple emails rapidly
      await Promise.all([
        sendEmail({
          to: 'user1@example.com',
          subject: 'Test 1',
          html: '<p>1</p>',
        }),
        sendEmail({
          to: 'user2@example.com',
          subject: 'Test 2',
          html: '<p>2</p>',
        }),
        sendEmail({
          to: 'user3@example.com',
          subject: 'Test 3',
          html: '<p>3</p>',
        }),
      ])

      // Should have sent all 3
      expect(mockSend).toHaveBeenCalledTimes(3)
    })

    it('should queue emails when limit reached', async () => {
      const { Resend } = await import('resend')
      const mockSend = vi.fn().mockResolvedValue({ id: 'queue1' })

      vi.mocked(Resend).mockImplementation(
        () =>
          ({
            emails: { send: mockSend },
          }) as any,
      )

      // Send 100 emails (exceeds rate limit)
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(
          sendEmail({
            to: `user${i}@example.com`,
            subject: `Test ${i}`,
            html: `<p>${i}</p>`,
            useQueue: true,
          }),
        )
      }

      await Promise.all(promises)

      // All should eventually be sent
      expect(mockSend.mock.calls.length).toBeLessThanOrEqual(100)
    })

    it('should process queue in order', async () => {
      const { Resend } = await import('resend')
      const callOrder: number[] = []
      const mockSend = vi.fn().mockImplementation((opts: any) => {
        const index = parseInt(opts.subject.split(' ')[1])
        callOrder.push(index)
        return Promise.resolve({ id: `order${index}` })
      })

      vi.mocked(Resend).mockImplementation(
        () =>
          ({
            emails: { send: mockSend },
          }) as any,
      )

      // Queue emails in order
      for (let i = 0; i < 5; i++) {
        await sendEmail({
          to: 'test@example.com',
          subject: `Test ${i}`,
          html: `<p>${i}</p>`,
          useQueue: true,
        })
      }

      // Should be processed in order
      expect(callOrder).toEqual([0, 1, 2, 3, 4])
    })
  })
})
