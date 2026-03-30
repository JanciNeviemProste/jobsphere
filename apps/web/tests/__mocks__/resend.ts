import { vi } from 'vitest'

export const Resend = vi.fn().mockImplementation(() => ({
  emails: {
    send: vi.fn().mockResolvedValue({ id: 'mock-email-id' }),
  },
}))
