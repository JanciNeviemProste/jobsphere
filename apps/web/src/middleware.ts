import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { locales } from './i18n'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'en',
  localeDetection: true,
})

// CSRF token generation and validation
function generateCSRFToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function validateCSRFToken(request: NextRequest): boolean {
  const token = request.headers.get('x-csrf-token')
  const cookieToken = request.cookies.get('csrf-token')?.value
  return token === cookieToken
}

// Rate limiting with sliding window
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function rateLimit(ip: string, limit: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || record.resetTime < now) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('/favicon') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next()
  }

  // Apply rate limiting
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip)) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }

  // CSRF protection for mutations
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (!validateCSRFToken(request)) {
      // Generate new CSRF token for GET requests
      const response = NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
      response.cookies.set('csrf-token', generateCSRFToken(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      })
      return response
    }
  }

  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/employer', '/profile']

  // Check if the current path (after locale) is protected
  const isProtectedRoute = protectedRoutes.some(route => {
    // Extract path after locale
    const pathWithoutLocale = pathname.replace(/^\/(en|de|cs|sk|pl)/, '')
    return pathWithoutLocale.startsWith(route)
  })

  if (isProtectedRoute) {
    // In production, you would check for a valid session/token here
    // For now, we'll allow access (auth will be handled by NextAuth)
    // Example with NextAuth:
    // const token = await getToken({ req: request })
    // if (!token) {
    //   const locale = pathname.split('/')[1]
    //   return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
    // }
  }

  // Apply internationalization middleware
  const response = intlMiddleware(request)

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // Set CSRF token cookie for GET requests
  if (request.method === 'GET') {
    const csrfToken = request.cookies.get('csrf-token')?.value || generateCSRFToken()
    response.cookies.set('csrf-token', csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
}