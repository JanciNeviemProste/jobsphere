/**
 * XSS Sanitization Utilities
 *
 * Provides functions to sanitize user input and prevent XSS attacks
 */

/**
 * Sanitizes HTML content by removing dangerous tags and attributes
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string with dangerous elements removed
 */
export function sanitizeHtml(html: string | null | undefined): string | null {
  if (!html) return null

  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Remove event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '')

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '')

  // Remove data: protocol (can be used for XSS)
  sanitized = sanitized.replace(/data:text\/html/gi, '')

  // Remove style attributes that could contain expression()
  sanitized = sanitized.replace(/style\s*=\s*["'][^"']*expression\([^"']*\)["']/gi, '')

  return sanitized.trim()
}

/**
 * Validates and sanitizes URLs to prevent XSS attacks via javascript: protocol
 *
 * @param url - The URL string to validate
 * @returns Sanitized URL or null if invalid
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url || url === '') return null

  const trimmed = url.trim()

  // List of dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:']

  // Check if URL starts with any dangerous protocol
  const lowerUrl = trimmed.toLowerCase()
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return null // Reject dangerous URLs
    }
  }

  // Only allow http, https, and protocol-relative URLs
  if (
    !lowerUrl.startsWith('http://') &&
    !lowerUrl.startsWith('https://') &&
    !lowerUrl.startsWith('//')
  ) {
    // If no protocol, assume https://
    return `https://${trimmed}`
  }

  return trimmed
}

/**
 * Sanitizes plain text by removing any HTML tags
 *
 * @param text - The text to sanitize
 * @returns Plain text with HTML tags removed
 */
export function sanitizeText(text: string | null | undefined): string | null {
  if (!text) return null

  // Remove all HTML tags
  return text.replace(/<[^>]*>/g, '').trim()
}
