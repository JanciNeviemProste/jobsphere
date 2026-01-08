/**
 * NextAuth v4 API Route
 *
 * Downgraded from v5 beta.4 to fix "aQ is not a constructor" error
 * that occurred on Vercel production builds.
 *
 * v4 uses default export pattern instead of named exports.
 */
import NextAuthHandler from "@/lib/auth"

// NextAuth v4 export pattern
export { NextAuthHandler as GET, NextAuthHandler as POST }

// Force Node.js runtime (bcryptjs and Prisma require Node.js APIs)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
