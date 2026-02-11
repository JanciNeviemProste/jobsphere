import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { locales } from './i18n'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'en',
  localeDetection: true,
})

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/employer', '/profile']
  const isProtectedRoute = protectedRoutes.some((route) => {
    const pathWithoutLocale = pathname.replace(/^\/(en|de|cs|sk|pl)/, '')
    return pathWithoutLocale.startsWith(route)
  })

  if (isProtectedRoute) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      const locale = pathname.split('/')[1] || 'en'
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
    }
  }

  // Apply internationalization middleware
  const response = intlMiddleware(request)

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    )
  }

  // Content Security Policy (unified with next.config.js, no unsafe-eval)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.anthropic.com https://api.stripe.com https://api.openai.com https://api.voyageai.com https://graph.microsoft.com https://login.microsoftonline.com https://*.sentry.io https://*.ingest.sentry.io https://vitals.vercel-insights.com",
    "frame-src 'self' https://js.stripe.com https://accounts.google.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

  response.headers.set('Content-Security-Policy', csp)

  return response
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
