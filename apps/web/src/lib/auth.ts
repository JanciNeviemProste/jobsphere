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
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string,
          },
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
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
    error: "/auth/error",
  },
  providers,
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.id = user.id

        // Load user's organization and role
        const userOrg = await prisma.userOrgRole.findFirst({
          where: { userId: user.id },
          include: { organization: true }
        })

        token.role = userOrg?.role || 'candidate'
        token.orgId = userOrg?.orgId || null
        token.orgName = userOrg?.organization?.name || null
      }

      // Refresh role/org on session update
      if (trigger === 'update' && token.id) {
        const userOrg = await prisma.userOrgRole.findFirst({
          where: { userId: token.id as string },
          include: { organization: true }
        })

        token.role = userOrg?.role || 'candidate'
        token.orgId = userOrg?.orgId || null
        token.orgName = userOrg?.organization?.name || null
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string | undefined
        session.user.orgId = token.orgId as string | undefined
        session.user.orgName = token.orgName as string | undefined
      }
      return session
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
