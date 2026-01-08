import NextAuth, { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import { compare } from "bcryptjs"
import { getServerSession } from "next-auth/next"

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
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          console.log('🔐 Auth: Starting authorization...')
          console.log('🔐 Auth: Email provided:', credentials?.email ? 'YES' : 'NO')
          console.log('🔐 Auth: Password provided:', credentials?.password ? 'YES' : 'NO')

          if (!credentials?.email || !credentials?.password) {
            console.log('❌ Auth: Missing credentials')
            return null
          }

          console.log('🔍 Auth: Looking up user:', credentials.email)
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            },
          })

          if (!user) {
            console.log('❌ Auth: User not found:', credentials.email)
            return null
          }

          console.log('✅ Auth: User found:', user.email, 'ID:', user.id)
          console.log('🔐 Auth: User has password:', !!user.password)

          if (!user.password) {
            console.log('❌ Auth: User has no password (OAuth-only account?)')
            return null
          }

          console.log('🔐 Auth: Comparing passwords...')
          const isPasswordValid = await compare(
            credentials.password,
            user.password
          )

          console.log('🔐 Auth: Password valid:', isPasswordValid)

          if (!isPasswordValid) {
            console.log('❌ Auth: Invalid password for:', credentials.email)
            return null
          }

          console.log('✅ Auth: Authorization successful for:', user.email)
          return {
            id: user.id,
            email: user.email!,
            name: user.name,
            image: user.avatar,
          }
        } catch (error) {
          console.error('❌ Auth error:', error)
          console.error('❌ Auth error stack:', error instanceof Error ? error.stack : 'No stack')
          console.error('❌ Auth error details:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error)
          })
          // Return null instead of throwing - NextAuth will show "invalid credentials"
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      try {
        console.log('🔑 JWT Callback: User ID:', user?.id, 'Token ID:', token.id)

        if (user?.id) {
          token.id = user.id
          console.log('🔑 JWT: Setting token.id:', user.id)

          // Load user's organization and role
          console.log('🔍 JWT: Loading user organization...')
          const userOrg = await prisma.userOrgRole.findFirst({
            where: { userId: user.id },
            include: { organization: true }
          })

          console.log('🔍 JWT: User org found:', !!userOrg, 'Role:', userOrg?.role)
          token.role = userOrg?.role || 'candidate'
          token.orgId = userOrg?.orgId || null
          token.orgName = userOrg?.organization?.name || null
        }

        console.log('✅ JWT: Token updated successfully')
        return token
      } catch (error) {
        console.error('❌ JWT Callback error:', error)
        console.error('❌ JWT error stack:', error instanceof Error ? error.stack : 'No stack')
        throw error // Re-throw to let NextAuth handle it
      }
    },
    async session({ session, token }) {
      try {
        console.log('👤 Session Callback: Token ID:', token.id)
        if (session.user) {
          session.user.id = token.id as string
          session.user.role = token.role as string | undefined
          session.user.orgId = token.orgId as string | undefined
          session.user.orgName = token.orgName as string | undefined
          console.log('✅ Session: Updated session for user:', session.user.email)
        }
        return session
      } catch (error) {
        console.error('❌ Session Callback error:', error)
        console.error('❌ Session error stack:', error instanceof Error ? error.stack : 'No stack')
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
