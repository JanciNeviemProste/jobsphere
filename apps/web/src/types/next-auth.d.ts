// This import is load-bearing: it makes the file a module, so the `declare module`
// blocks below perform TypeScript *module augmentation* of next-auth instead of
// declaring brand-new ambient modules that would shadow the real types.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import NextAuth, { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string
      image?: string
      role?: string
      orgId?: string
      orgName?: string
      isGlobalAdmin?: boolean
      // PR7 dual-role: full membership list + active context + personal roles
      orgs?: { orgId: string; orgName: string | null; role: string }[]
      activeOrgId?: string | null
      isCandidate?: boolean
      isFreelancer?: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role?: string
    orgId?: string | null
    orgName?: string | null
    isGlobalAdmin?: boolean
    // PR7 dual-role: full membership list + active context + personal roles
    orgs?: { orgId: string; orgName: string | null; role: string }[]
    activeOrgId?: string | null
    isCandidate?: boolean
    isFreelancer?: boolean
    // AUTH-001 session revocation
    sessionEpoch?: number
    epochCheckedAt?: number
    invalid?: boolean
  }
}
