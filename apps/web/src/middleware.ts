import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { locales } from './i18n'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'sk',
  localeDetection: true,
})

/**
 * Generate a cryptographically random nonce for Content-Security-Policy.
 * Uses the Web Crypto API which is available in the Edge runtime and Node.js 16+.
 */
function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  // btoa is available in Edge; for Node.js environments Buffer works too
  return Buffer.from(array).toString('base64')
}

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
    const locale = pathname.split('/')[1] || 'sk'
    if (!token) {
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
    }
    // /admin je vyhradený len pre globálnych adminov
    const pathWithoutLocale = pathname.replace(/^\/(en|de|cs|sk|pl)/, '')
    if (pathWithoutLocale.startsWith('/admin') && !token.isGlobalAdmin) {
      return NextResponse.redirect(new URL(`/${locale}/login?error=forbidden`, request.url))
    }
  }

  // Generate a per-request nonce for CSP.
  // Next.js 14 App Router reads the `x-nonce` request header and automatically
  // injects it into its own bootstrap <script> tags when a CSP with a nonce is
  // present on the response — see https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
  const nonce = generateNonce()

  // Inject the nonce into the request so Server Components can read it via
  // `headers().get('x-nonce')` and pass it to any <Script nonce={nonce}> elements.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  // Apply internationalization middleware with the mutated request headers
  const response = intlMiddleware(
    new NextRequest(request.url, { headers: requestHeaders, method: request.method }),
  )

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

  // Content Security Policy
  // - Development: permissive script-src so Next.js HMR / fast-refresh work.
  // - Production: nonce-based script-src with 'strict-dynamic'.
  //   'unsafe-inline' is intentionally OMITTED in production — browsers that
  //   understand nonces/strict-dynamic will ignore it anyway, so there is no
  //   need to include it.  Older browsers that don't support nonces would fall
  //   back to 'unsafe-inline', but we explicitly do not want that fallback.
  const isDev = process.env.NODE_ENV === 'development'
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://browser.sentry-cdn.com https://js.sentry-cdn.com https://accounts.google.com https://vercel.live"
    : `'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com https://browser.sentry-cdn.com https://js.sentry-cdn.com https://accounts.google.com https://vercel.live`

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
