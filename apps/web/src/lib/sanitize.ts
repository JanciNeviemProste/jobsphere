/**
 * XSS Sanitization Utilities
 * Uses DOMPurify to sanitize user-generated content
 *
 * SECURITY: Never use regex for HTML sanitization - use DOMPurify instead
 */

import DOMPurify from 'isomorphic-dompurify'

type SanitizeConfig = {
  ALLOWED_TAGS?: string[]
  ALLOWED_ATTR?: string[]
  ALLOW_DATA_ATTR?: boolean
  ALLOWED_URI_REGEXP?: RegExp
}

/**
 * Sanitize HTML content to prevent XSS attacks
 *
 * @param dirty - Untrusted HTML content
 * @param options - DOMPurify configuration options
 * @returns Sanitized HTML safe for rendering
 *
 * @example
 * const safeHTML = sanitizeHtml(userInput)
 * return <div dangerouslySetInnerHTML={{ __html: safeHTML }} />
 */
export function sanitizeHtml(
  dirty: string | null | undefined,
  options?: SanitizeConfig,
): string | null {
  if (!dirty || typeof dirty !== 'string') {
    return null
  }

  // Default configuration: Allow safe HTML tags
  const defaultConfig: SanitizeConfig = {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      's',
      'a',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'code',
      'pre',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ...options,
  }

  const sanitized = DOMPurify.sanitize(dirty, defaultConfig as any)
  // Convert TrustedHTML to string
  const sanitizedString = typeof sanitized === 'string' ? sanitized : String(sanitized)
  return sanitizedString.trim() || null
}

/**
 * Sanitize plain text by removing all HTML tags
 * Use this for fields that should NEVER contain HTML
 *
 * @param dirty - Untrusted text content
 * @returns Plain text with all HTML stripped
 *
 * @example
 * const safeName = sanitizeText(userInput)
 */
export function sanitizeText(dirty: string | null | undefined): string | null {
  if (!dirty || typeof dirty !== 'string') {
    return null
  }

  // Strip all HTML tags
  const sanitized = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  } as any)

  const sanitizedString = typeof sanitized === 'string' ? sanitized : String(sanitized)
  return sanitizedString.trim() || null
}

/**
 * Sanitize URL to prevent javascript: and data: URIs
 *
 * @param url - Untrusted URL
 * @returns Sanitized URL or null if dangerous
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }

  const trimmed = url.trim()

  // Remove javascript: and data: URIs
  const lowerURL = trimmed.toLowerCase()
  if (
    lowerURL.startsWith('javascript:') ||
    lowerURL.startsWith('data:') ||
    lowerURL.startsWith('vbscript:') ||
    lowerURL.startsWith('file:')
  ) {
    return null
  }

  // Only allow http, https, and protocol-relative URLs, mailto, tel
  if (
    !lowerURL.startsWith('http://') &&
    !lowerURL.startsWith('https://') &&
    !lowerURL.startsWith('//') &&
    !lowerURL.startsWith('mailto:') &&
    !lowerURL.startsWith('tel:')
  ) {
    // If no protocol, assume https://
    return `https://${trimmed}`
  }

  return trimmed
}

/**
 * Sanitize markdown content for safe rendering
 * Allows markdown-friendly HTML but prevents XSS
 *
 * @param dirty - Untrusted markdown/HTML content
 * @returns Sanitized markdown-safe HTML
 */
export function sanitizeMarkdown(dirty: string | null | undefined): string | null {
  if (!dirty || typeof dirty !== 'string') {
    return null
  }

  const sanitized = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      's',
      'a',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'code',
      'pre',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'img', // Allow images in markdown
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'title'],
    ALLOW_DATA_ATTR: false,
  } as any)

  const sanitizedString = typeof sanitized === 'string' ? sanitized : String(sanitized)
  return sanitizedString.trim() || null
}

/**
 * Sanitize job description content
 * Allows rich formatting for job postings
 *
 * @param dirty - Untrusted job description HTML
 * @returns Sanitized job description HTML
 */
export function sanitizeJobDescription(dirty: string | null | undefined): string | null {
  if (!dirty || typeof dirty !== 'string') {
    return null
  }

  const sanitized = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'a',
      'ul',
      'ol',
      'li',
      'h2',
      'h3',
      'h4',
      'blockquote',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  } as any)

  const sanitizedString = typeof sanitized === 'string' ? sanitized : String(sanitized)
  return sanitizedString.trim() || null
}

/**
 * Sanitize application cover letter
 * Preserves formatting but prevents XSS
 *
 * @param dirty - Untrusted cover letter content
 * @returns Sanitized cover letter HTML
 */
export function sanitizeCoverLetter(dirty: string | null | undefined): string | null {
  if (!dirty || typeof dirty !== 'string') {
    return null
  }

  const sanitized = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
  } as any)

  const sanitizedString = typeof sanitized === 'string' ? sanitized : String(sanitized)
  return sanitizedString.trim() || null
}

/**
 * Sanitize application notes (internal use by recruiters)
 * Allows basic formatting for internal notes
 *
 * @param dirty - Untrusted note content
 * @returns Sanitized note HTML
 */
export function sanitizeNote(dirty: string | null | undefined): string | null {
  if (!dirty || typeof dirty !== 'string') {
    return null
  }

  const sanitized = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
  } as any)

  const sanitizedString = typeof sanitized === 'string' ? sanitized : String(sanitized)
  return sanitizedString.trim() || null
}
