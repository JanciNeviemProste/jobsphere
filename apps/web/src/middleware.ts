import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { locales } from './i18n'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'sk',
  localeDetection: true,
})

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/employer', '/profile', '/admin', '/settings']
  const isProtectedRoute = protectedRoutes.some((route) => {
    const pathWithoutLocale = pathname.replace(/^\/(en|de|cs|sk|pl)/, '')
    return pathWithoutLocale.startsWith(route)
  })

  if (isProtectedRoute) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      const locale = pathname.split('/')[1] || 'sk'
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

  // Content Security Policy - allow unsafe-eval in dev for Next.js HMR
  const isDev = process.env.NODE_ENV === 'development'
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://browser.sentry-cdn.com https://js.sentry-cdn.com https://accounts.google.com https://vercel.live"
    : "'self' 'unsafe-inline' https://js.stripe.com https://browser.sentry-cdn.com https://js.sentry-cdn.com https://accounts.google.com https://vercel.live"

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://*.stripe.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://api.stripe.com https://api.anthropic.com https://api.openai.com https://api.voyageai.com https://*.sentry.io https://*.ingest.sentry.io https://vitals.vercel-insights.com https://graph.microsoft.com https://login.microsoftonline.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://vercel.live",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
    'block-all-mixed-content',
  ].join('; ')

  response.headers.set('Content-Security-Policy', csp)

  return response
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
