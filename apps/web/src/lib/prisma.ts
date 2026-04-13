import { PrismaClient } from '@prisma/client'
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

// Soft delete middleware
// Automatically filters out soft-deleted records on read operations
prisma.$use(async (params, next) => {
  const modelsWithSoftDelete = ['Job', 'Organization', 'User', 'Candidate', 'Application']
  if (
    modelsWithSoftDelete.includes(params.model ?? '') &&
    ['findFirst', 'findMany', 'count'].includes(params.action)
  ) {
    params.args = params.args || {}
    params.args.where = { deletedAt: null, ...params.args.where }
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
