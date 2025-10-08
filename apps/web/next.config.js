import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['@jobsphere/db', '@jobsphere/ui', '@jobsphere/i18n'],

  images: {
    domains: ['localhost', 'jobsphere.com'],
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' https://js.stripe.com https://browser.sentry-cdn.com https://js.sentry-cdn.com",
              "style-src 'self' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://api.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://o4506953367322624.ingest.us.sentry.io https://vitals.vercel-insights.com",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests"
            ].join('; ')
          }
        ]
      }
    ]
  },

  async rewrites() {
    return [
      {
        source: '/api/trpc/:path*',
        destination: 'http://localhost:4000/trpc/:path*',
      },
    ]
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
}

export default withNextIntl(nextConfig)