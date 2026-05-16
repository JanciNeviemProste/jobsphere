/**
 * Server-only HTML sanitizer for outgoing email bodies.
 * Pure regex — no jsdom/DOMPurify because those don't initialize cleanly in
 * Vercel serverless functions. Acceptable for our threat model because email
 * bodies are composed by authenticated employers and rendered by recipient
 * email clients which strip dangerous content again.
 */
export function sanitizeEmailHtml(input: string): string {
  let html = input

  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  html = html.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
  html = html.replace(/<iframe\b[^>]*\/?>/gi, '')
  html = html.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
  html = html.replace(/<embed\b[^>]*\/?>/gi, '')
  html = html.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')

  html = html.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
  html = html.replace(/\s+on\w+\s*=\s*'[^']*'/gi, '')
  html = html.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')

  html = html.replace(
    /(href|src|action|formaction|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi,
    '$1=$2#$2',
  )
  html = html.replace(/(href|src|action|formaction|xlink:href)\s*=\s*javascript:[^\s>]+/gi, '$1=#')
  html = html.replace(
    /(href|src|action|formaction|xlink:href)\s*=\s*("|')\s*data:[^"']*\2/gi,
    '$1=$2#$2',
  )

  return html
}
