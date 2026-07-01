import { describe, it, expect, vi, beforeEach } from 'vitest'

// Security wrappers are pass-through in unit tests.
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: unknown) => h }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (h: unknown) => h }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('@vercel/blob', () => ({
  put: vi.fn(async () => ({ url: 'https://store.public.blob.vercel-storage.com/videos/x.mp4' })),
}))

import { POST } from '../route'
import { auth } from '@/lib/auth'
import { put } from '@vercel/blob'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

const makeFile = (over: Partial<{ name: string; type: string; size: number }> = {}) => ({
  name: 'clip.mp4',
  type: 'video/mp4',
  size: 1024,
  ...over,
})

const makeReq = (file: unknown) =>
  ({ formData: async () => ({ get: (k: string) => (k === 'file' ? file : null) }) }) as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/api/upload/video — auth boundary', () => {
  it('returns 401 when unauthenticated', async () => {
    asMock(auth).mockResolvedValue(null)
    const res = await POST(makeReq(makeFile()))
    expect(res.status).toBe(401)
    expect(put).not.toHaveBeenCalled()
  })
})

describe('/api/upload/video — validation', () => {
  beforeEach(() => asMock(auth).mockResolvedValue({ user: { id: 'u1' } }))

  it('rejects a non-video MIME type', async () => {
    const res = await POST(makeReq(makeFile({ type: 'image/png' })))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('invalid_type')
    expect(put).not.toHaveBeenCalled()
  })

  it('rejects a file larger than 50MB', async () => {
    const res = await POST(makeReq(makeFile({ size: 51 * 1024 * 1024 })))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('too_large')
    expect(put).not.toHaveBeenCalled()
  })

  it('accepts a valid webm video and returns the blob url', async () => {
    const res = await POST(makeReq(makeFile({ type: 'video/webm', name: 'clip.webm' })))
    expect(res.status).toBe(200)
    expect((await res.json()).url).toContain('.public.blob.vercel-storage.com/')
    expect(put).toHaveBeenCalledOnce()
  })
})
