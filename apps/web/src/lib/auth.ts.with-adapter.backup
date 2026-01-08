import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import type { Provider } from "next-auth/providers"
import { prisma } from "./prisma"
import { compare } from "bcryptjs"

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

// Build providers array dynamically based on available credentials
const providers: Provider[] = []

// Add Google OAuth provider only if credentials are configured
const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    })
  )
} else {
  console.warn('⚠️ Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local')
}

// Add Credentials provider (email/password login)
providers.push(
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
              email: credentials.email as string,
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
            credentials.password as string,
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
            email: user.email,
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
    })
)

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    // error: "/auth/error", // Removed - NextAuth v5 beta bug with custom error pages
  },
  providers,
  callbacks: {
    async jwt({ token, user, trigger }) {
      try {
        console.log('🔑 JWT Callback: Trigger:', trigger, 'User ID:', user?.id, 'Token ID:', token.id)

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

        // Refresh role/org on session update
        if (trigger === 'update' && token.id) {
          console.log('🔄 JWT: Refreshing session for user:', token.id)
          const userOrg = await prisma.userOrgRole.findFirst({
            where: { userId: token.id as string },
            include: { organization: true }
          })

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
})

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
