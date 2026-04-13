import NextAuth, { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from './prisma'
import { compare } from 'bcryptjs'
import { getServerSession } from 'next-auth/next'
import { logger } from './logger'

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

/**
 * NextAuth v4 Configuration
 * Downgraded from v5 beta.4 due to constructor bug on Vercel production
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // Refresh token every 1 hour
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null
          }

          const normalizedEmail = credentials.email.toLowerCase()

          const user = await prisma.user.findUnique({
            where: {
              email: normalizedEmail,
            },
          })

          // SECURITY: Prevent timing attacks — always perform bcrypt comparison
          // even when user doesn't exist, to maintain constant response time
          // and prevent email enumeration via response time analysis
          if (!user || !user.password) {
            await compare(
              credentials.password,
              '$2a$12$UGzP4Z0tFYfNO8YM6g3HE.lN0jC.ueAnEglJpgP.its5zuuMhc7Vm',
            )
            return null
          }

          // SECURITY: Check if account is locked
          if (user.lockedUntil && user.lockedUntil > new Date()) {
            const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
            logger.warn(`Account locked. Unlocks in ${minutesLeft} minutes`)
            return null
          }

          // If lock expired, reset failedAttempts
          if (user.lockedUntil && user.lockedUntil <= new Date()) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedAttempts: 0,
                lockedUntil: null,
              },
            })
          }

          const isPasswordValid = await compare(credentials.password, user.password)

          if (!isPasswordValid) {
            // SECURITY: Increment failed attempts
            const newFailedAttempts = user.failedAttempts + 1
            const maxAttempts = 5
            const lockoutMinutes = 15

            if (newFailedAttempts >= maxAttempts) {
              // Lock account for 15 minutes
              const lockedUntil = new Date(Date.now() + lockoutMinutes * 60000)
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  failedAttempts: newFailedAttempts,
                  lockedUntil,
                },
              })
              logger.warn(
                `🔒 Account locked for ${user.email} after ${maxAttempts} failed attempts. Locked until ${lockedUntil.toISOString()}`,
              )
            } else {
              // Just increment counter
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  failedAttempts: newFailedAttempts,
                },
              })
              logger.warn(
                `⚠️  Failed login attempt ${newFailedAttempts}/${maxAttempts} for ${user.email}`,
              )
            }

            return null
          }

          // SECURITY: Email must be verified before login (production only)
          if (!user.emailVerified && process.env.NODE_ENV === 'production') {
            throw new Error('EMAIL_NOT_VERIFIED')
          }

          // SECURITY: Successful login - reset failed attempts and update lastLoginAt
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedAttempts: 0,
              lockedUntil: null,
              lastLoginAt: new Date(),
            },
          })

          return {
            id: user.id,
            email: user.email!,
            name: user.name,
            image: user.avatar,
          }
        } catch (error) {
          // Re-throw known auth errors so NextAuth can expose them to the client
          if (error instanceof Error && error.message === 'EMAIL_NOT_VERIFIED') {
            throw error
          }
          // Re-throw infrastructure errors (DB down, bcrypt crash) so they surface
          // as 500 and get captured by Sentry rather than looking like wrong password
          const msg = error instanceof Error ? error.message : String(error)
          const isInfraError =
            msg.includes('connect') ||
            msg.includes('timeout') ||
            msg.includes('ECONNREFUSED') ||
            msg.includes('prepared statement')
          if (isInfraError) {
            logger.error('❌ Infrastructure error during auth:', error)
            throw error
          }
          logger.error('❌ Auth error:', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      try {
        if (user?.id) {
          token.id = user.id

          // Load user's organization, role and global admin flag
          const [userOrg, dbUser] = await Promise.all([
            prisma.userOrgRole.findFirst({
              where: { userId: user.id },
              include: { organization: true },
            }),
            prisma.user.findUnique({
              where: { id: user.id },
              select: { isGlobalAdmin: true },
            }),
          ])

          token.role = userOrg?.role || 'candidate'
          token.orgId = userOrg?.orgId || null
          token.orgName = userOrg?.organization?.name || null
          token.isGlobalAdmin = dbUser?.isGlobalAdmin ?? false
        }

        return token
      } catch (error) {
        logger.error('❌ JWT Callback error:', error)
        logger.error('❌ JWT error stack:', error instanceof Error ? error.stack : 'No stack')
        throw error // Re-throw to let NextAuth handle it
      }
    },
    async session({ session, token }) {
      try {
        if (session.user) {
          session.user.id = token.id as string
          session.user.role = token.role as string | undefined
          session.user.orgId = token.orgId as string | undefined
          session.user.orgName = token.orgName as string | undefined
          session.user.isGlobalAdmin = token.isGlobalAdmin as boolean | undefined
        }
        return session
      } catch (error) {
        logger.error('❌ Session Callback error:', error)
        logger.error('❌ Session error stack:', error instanceof Error ? error.stack : 'No stack')
        throw error // Re-throw to let NextAuth handle it
      }
    },
  },
}

// Export NextAuth handler (default export for API route)
export default NextAuth(authOptions)

/**
 * Get session in server components
 * Use this instead of the v5 auth() function
 */
export const auth = () => getServerSession(authOptions)

/**
 * Require authentication - throws UnauthorizedError if not authenticated
 * Use this in API routes to ensure user is logged in
 */
export async function requireAuth() {
  const session = await auth()

  if (!session?.user?.id) {
    throw new UnauthorizedError('You must be logged in to access this resource')
  }

  return session
}
