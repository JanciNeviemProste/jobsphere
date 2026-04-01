import { vi } from 'vitest'

const sgMail = {
  setApiKey: vi.fn(),
  send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
}

export default sgMail
