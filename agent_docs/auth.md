# Auth & Multi-tenancy

JobSphere uses **NextAuth v4.24.7** (JWT sessions). Detail lives here so `CLAUDE.md` stays small.

## NextAuth config — `apps/web/src/lib/auth.ts`

- Exports: `authOptions` (NextAuthOptions), `auth()` (wraps `getServerSession(authOptions)`), `requireAuth()` (throws `UnauthorizedError`), `UnauthorizedError`. Default export is the NextAuth handler.
- Session strategy: **JWT**, `maxAge` 24h, `updateAge` 1h.
- Providers: **Credentials** (email/password, bcrypt, account lockout 5 attempts → 15 min) always on; **Google** only if `GOOGLE_CLIENT_ID`+`GOOGLE_CLIENT_SECRET`; **Apple** only if `APPLE_ID`+`APPLE_SECRET`.
- Adapter: `PrismaAdapter(prisma)` (`@next-auth/prisma-adapter` 1.0.7).
- JWT/session callbacks populate `orgId`, `role`, `orgName`, `isGlobalAdmin` from `UserOrgRole`.
- **Session revocation (AUTH-001):** every ~60s the callback compares the DB `User.sessionEpoch` to the value pinned in the token; bump `sessionEpoch` to force re-login everywhere.

## Getting the session (server)

```ts
import { auth } from '@/lib/auth'
const session = await auth()
if (!session?.user?.id) throw new UnauthorizedError()
```

Catch-all route `apps/web/src/app/api/auth/[...nextauth]/route.ts` exports `{ NextAuthHandler as GET, NextAuthHandler as POST }`, `runtime = 'nodejs'`, `dynamic = 'force-dynamic'` (Node runtime required for bcryptjs + Prisma).

## Multi-tenant authorization — `apps/web/src/lib/api-helpers.ts`

A `User` belongs to N `Organization`s via the **`UserOrgRole`** junction. Roles: `ORG_ADMIN`, `RECRUITER`, `HIRING_MANAGER`, `AGENCY`.

- `requireOrgAuth(request?) → AuthContext` — `auth()` + first `UserOrgRole` for the user; throws `ForbiddenError` if no membership. Returns `{ userId, orgId, role, email }`.
- `requireRole(allowedRoles) → AuthContext` — `requireOrgAuth()` then a role check.

Canonical membership check (e.g. `apps/web/src/lib/actions/jobs.ts`):

```ts
const session = await auth()
if (!session?.user?.id) throw new Error('Unauthorized')
const membership = await prisma.userOrgRole.findFirst({
  where: { userId: session.user.id, orgId: formData.orgId },
})
if (!membership) throw new Error('Not a member of this organization')
```

**Rule:** never trust an `orgId` (or `[id]` route param) from the client without a matching `UserOrgRole`. Every org-scoped query filters by `orgId` — see `@agent_docs/data-model.md`.

## Personal sentinel org — `apps/web/src/lib/identity.ts`

Job-seekers (Users with **no** `UserOrgRole`) keep their profile + CVs in a sentinel org, so employer queries (scoped to their own `orgId`) never see them.

- `PERSONAL_ORG_SLUG = '__personal_profiles__'`
- `ensurePersonalOrg(): Promise<string>` — idempotent upsert by slug (race-safe on the unique constraint; narrowed catch to P2002).
- `getPersonalCandidateForUser(userId, tx?)` — resolves/creates the user's `Candidate` in the personal org (matches recruiter-imported candidates by email and links them).

## OAuth token encryption — `apps/web/src/lib/encryption.ts`

AES-256-GCM. `ENCRYPTION_KEY` = 64-hex chars (32 bytes). Exports `encrypt`/`decrypt` (format `iv:authTag:ciphertext`), `encryptJSON`/`decryptJSON`, `isEncrypted`, `generateEncryptionKey`.

## Email-verification bypass

`PREVIEW_SKIP_EMAIL_VERIFICATION === 'true'` lets unverified users log in **only** when `NODE_ENV === 'production'` AND `user.emailVerified === false`. Default unset → verification required. Currently **set in production** (no email provider wired yet — a follow-up).
