import { describe, it, expect, vi, beforeEach } from 'vitest'

// Security wrappers are pass-through in unit tests.
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: unknown) => h }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (h: unknown) => h }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('@vercel/blob', () => ({
  put: vi.fn(async () => ({ url: 'https://store.public.blob.vercel-storage.com/logos/x.png' })),
}))

import { POST } from '../route'
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

// Lightweight file/request stubs — the handler only reads name/type/size and
// forwards the file to the mocked put().
const makeFile = (over: Partial<{ name: string; type: string; size: number }> = {}) => ({
  name: 'logo.png',
  type: 'image/png',
  size: 1024,
  ...over,
})

const makeReq = (file: unknown) =>
  ({ formData: async () => ({ get: (k: string) => (k === 'file' ? file : null) }) }) as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/api/upload/logo — auth boundary', () => {
  it('returns 401 when unauthenticated', async () => {
    asMock(auth).mockResolvedValue(null)
    const res = await POST(makeReq(makeFile()))
    expect(res.status).toBe(401)
    expect(put).not.toHaveBeenCalled()
  })
})

describe('/api/upload/logo — validation', () => {
  beforeEach(() => asMock(auth).mockResolvedValue({ user: { id: 'u1' } }))

  it('returns 400 when no file is provided', async () => {
    const res = await POST(makeReq(null))
    expect(res.status).toBe(400)
    expect(put).not.toHaveBeenCalled()
  })

  it('rejects a non-image MIME type', async () => {
    const res = await POST(makeReq(makeFile({ type: 'application/pdf' })))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('invalid_type')
    expect(put).not.toHaveBeenCalled()
  })

  it('rejects a file larger than 5MB', async () => {
    const res = await POST(makeReq(makeFile({ size: 6 * 1024 * 1024 })))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('too_large')
    expect(put).not.toHaveBeenCalled()
  })

  it('accepts a valid image and returns the blob url', async () => {
    const res = await POST(makeReq(makeFile({ type: 'image/webp' })))
    expect(res.status).toBe(200)
    expect((await res.json()).url).toContain('.public.blob.vercel-storage.com/')
    expect(put).toHaveBeenCalledOnce()
  })
})
