import { PrismaClient } from '@prisma/client'
import { sanitizeHtml, sanitizeUrl } from './sanitize'
import { logger } from './logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Connection pooling configuration
    // Default pool size from Prisma is 10, which is too low for production
    // Recommended: 20-30 connections for production workloads
    // Set via DATABASE_URL: ?connection_limit=25
    // See: apps/web/src/lib/CONNECTION_POOLING.md
  })

// XSS Sanitization Middleware
// Automatically sanitizes string fields to prevent XSS attacks
prisma.$use(async (params, next) => {
  // Fields that should be sanitized as HTML (can contain limited safe HTML)
  const htmlFields = ['description', 'name', 'companyName', 'coverLetter']

  // Fields that are URLs and should be sanitized against javascript: protocol
  const urlFields = ['website', 'linkedIn', 'github', 'portfolio']

  if (params.action === 'create' || params.action === 'update' || params.action === 'upsert') {
    let data = params.args.data

    if (data && typeof data === 'object') {
      // Sanitize HTML fields
      for (const field of htmlFields) {
        if (field in data && typeof data[field] === 'string') {
          const sanitized = sanitizeHtml(data[field])
          data[field] = sanitized === null ? undefined : sanitized
        }
      }

      // Sanitize URL fields
      for (const field of urlFields) {
        if (field in data && typeof data[field] === 'string') {
          const sanitized = sanitizeUrl(data[field])
          if (sanitized === null) {
            // If dangerous URL, remove the field entirely to prevent storage
            delete data[field]
          } else {
            data[field] = sanitized
          }
        }
      }
    }
  }

  return next(params)
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Graceful shutdown: disconnect Prisma on process termination
// This ensures all connections are properly closed before shutdown
if (process.env.NODE_ENV === 'production') {
  const shutdown = async () => {
    logger.info('Shutting down Prisma Client...')
    await prisma.$disconnect()
    logger.info('Prisma Client disconnected')
    process.exit(0)
  }

  // Handle different shutdown signals
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
  process.on('SIGHUP', shutdown)
}
