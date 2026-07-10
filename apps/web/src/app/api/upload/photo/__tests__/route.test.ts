import { describe, it, expect, vi, beforeEach } from 'vitest'

// Security wrappers are pass-through in unit tests.
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: unknown) => h }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (h: unknown) => h }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('@vercel/blob', () => ({
  put: vi.fn(async () => ({ url: 'https://store.public.blob.vercel-storage.com/photos/x.png' })),
}))

import { POST } from '../route'
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

const makeFile = (over: Partial<{ name: string; type: string; size: number }> = {}) => ({
  name: 'photo.png',
  type: 'image/png',
  size: 1024,
  ...over,
})

const makeReq = (file: unknown) =>
  ({ formData: async () => ({ get: (k: string) => (k === 'file' ? file : null) }) }) as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/api/upload/photo — auth boundary', () => {
  it('returns 401 when unauthenticated', async () => {
    asMock(auth).mockResolvedValue(null)
    const res = await POST(makeReq(makeFile()))
    expect(res.status).toBe(401)
    expect(put).not.toHaveBeenCalled()
  })

  it('accepts a valid image once authenticated', async () => {
    asMock(auth).mockResolvedValue({ user: { id: 'u1' } })
    const res = await POST(makeReq(makeFile({ type: 'image/webp' })))
    expect(res.status).toBe(200)
    expect(put).toHaveBeenCalledOnce()
  })
})
