import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

// Re-export Prisma types
export * from '@prisma/client'

// Create singleton instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Utility functions
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12)
}

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}

// RLS context setters
export const setRLSContext = async (
  userId?: string,
  orgId?: string,
  role?: string
): Promise<void> => {
  const queries = []

  if (userId) {
    queries.push(prisma.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}'`))
  }
  if (orgId) {
    queries.push(prisma.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${orgId}'`))
  }
  if (role) {
    queries.push(prisma.$executeRawUnsafe(`SET LOCAL app.current_user_role = '${role}'`))
  }

  await Promise.all(queries)
}

// Transaction with RLS
export const transactionWithRLS = async <T>(
  fn: (tx: PrismaClient) => Promise<T>,
  context?: { userId?: string; orgId?: string; role?: string }
): Promise<T> => {
  return prisma.$transaction(async (tx) => {
    if (context) {
      await setRLSContext(context.userId, context.orgId, context.role)
    }
    return fn(tx as PrismaClient)
  })
}