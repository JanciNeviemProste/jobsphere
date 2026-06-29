/**
 * CV file URL allowlist (SSRF guard — review finding F1).
 *
 * The authenticated CV download route fetches `CandidateDocument.uri` server-side
 * and streams the bytes back to the caller. The uri originates from the CV upload
 * flow, but `/api/cv/parse` accepts a client-provided `fileUrl` — without this
 * guard an authenticated user could persist an arbitrary URL (e.g. cloud-metadata
 * `http://169.254.169.254/...`, `http://localhost:*`) as the uri and exfiltrate
 * internal responses through the download route.
 *
 * Only URLs we actually produce are allowed:
 *   - Vercel Blob (`https://<store>.public.blob.vercel-storage.com/...`)
 *   - same-origin local-storage paths (`/uploads/...`, dev fallback)
 */
const BLOB_HOST = 'blob.vercel-storage.com'

export function isAllowedCvUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false

  // Local/dev storage provider returns a same-origin relative path.
  if (url.startsWith('/uploads/')) return true

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false

  const host = parsed.hostname.toLowerCase()
  return host === BLOB_HOST || host.endsWith(`.${BLOB_HOST}`)
}

/**
 * True when the URL is a Vercel Blob URL (public or private store host).
 * Used by the download route to decide between the authenticated SDK read
 * (private blobs) and a plain fetch (legacy public blobs).
 */
export function isVercelBlobUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === BLOB_HOST || host.endsWith(`.${BLOB_HOST}`)
  } catch {
    return false
  }
}
