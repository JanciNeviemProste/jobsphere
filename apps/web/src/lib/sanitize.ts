/**
 * XSS Sanitization Utilities
 * Uses sanitize-html (CJS) to sanitize user-generated content
 */

import sanitizeHtmlLib from 'sanitize-html'

type SanitizeHtmlOptions = Parameters<typeof sanitizeHtmlLib>[1]

const URL_SCHEMES = ['http', 'https', 'mailto', 'tel', 'callto', 'sms']

function runSanitize(dirty: string, options: SanitizeHtmlOptions): string | null {
  const result = sanitizeHtmlLib(dirty, options).trim()
  return result || null
}

export function sanitizeHtml(dirty: string | null | undefined): string | null {
  if (!dirty || typeof dirty !== 'string') return null

  return runSanitize(dirty, {
    allowedTags: [
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
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'class'],
      '*': ['class'],
    },
    allowedSchemes: URL_SCHEMES,
    allowedSchemesAppliedToAttributes: ['href'],
  })
}

export function sanitizeText(dirty: string | null | undefined): string | null {
  if (!dirty || typeof dirty !== 'string') return null

  return runSanitize(dirty, {
    allowedTags: [],
    allowedAttributes: {},
  })
}

export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null

  const trimmed = url.trim()
  const lowerURL = trimmed.toLowerCase()

  if (
    lowerURL.startsWith('javascript:') ||
    lowerURL.startsWith('data:') ||
    lowerURL.startsWith('vbscript:') ||
    lowerURL.startsWith('file:')
  ) {
    return null
  }

  if (
    !lowerURL.startsWith('http://') &&
    !lowerURL.startsWith('https://') &&
    !lowerURL.startsWith('//') &&
    !lowerURL.startsWith('mailto:') &&
    !lowerURL.startsWith('tel:')
  ) {
    return `https://${trimmed}`
  }

  return trimmed
}

export function sanitizeMarkdown(dirty: string | null | undefined): string | null {
  if (!dirty || typeof dirty !== 'string') return null

  return runSanitize(dirty, {
    allowedTags: [
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
      'img',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'class'],
      img: ['src', 'alt', 'title'],
      '*': ['class'],
    },
    allowedSchemes: URL_SCHEMES,
    allowedSchemesAppliedToAttributes: ['href', 'src'],
  })
}

export function sanitizeJobDescription(dirty: string | null | undefined): string | null {
  if (!dirty || typeof dirty !== 'string') return null

  return runSanitize(dirty, {
    allowedTags: [
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
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: URL_SCHEMES,
    allowedSchemesAppliedToAttributes: ['href'],
  })
}

export function sanitizeCoverLetter(dirty: string | null | undefined): string | null {
  if (!dirty || typeof dirty !== 'string') return null

  return runSanitize(dirty, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u'],
    allowedAttributes: {},
  })
}

export function sanitizeNote(dirty: string | null | undefined): string | null {
  if (!dirty || typeof dirty !== 'string') return null

  return runSanitize(dirty, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li'],
    allowedAttributes: {},
  })
}
