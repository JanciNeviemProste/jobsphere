# Data model & tenant scoping

## Schema — TWO byte-identical files (LOGIC-007)

- `packages/db/prisma/schema.prisma` — **canonical** source.
- `apps/web/prisma/schema.prisma` — copy kept for app-local tooling (generate/migrate).

Both **must stay byte-identical** (enforced by SHA256 parity). Edit one → mirror the other in the same change.

## Prisma client

- Singleton: `apps/web/src/lib/prisma.ts` (`globalThis` pattern, `connection_limit=25`).
- `apps/web/src/lib/db.ts` is just `export { prisma } from './prisma'` (back-compat; prefer `@/lib/prisma` in new code).
- **Soft-delete middleware** auto-adds `deletedAt: null` to reads (`findFirst` / `findMany` / `count`) for `Job`, `Organization`, `User`, `Candidate`, `Application`. Writes set `deletedAt` explicitly.

## Org-scoped vs global models

| Model                         | Scope           | Notes                                                       |
| ----------------------------- | --------------- | ----------------------------------------------------------- |
| `Organization`                | container       | `slug` unique, `deletedAt?`                                 |
| `User`                        | global          | `email` unique, `isGlobalAdmin?`, `sessionEpoch`            |
| `UserOrgRole`                 | org (`orgId`)   | composite PK `(userId, orgId)`, `role`, `permissions`       |
| `Job`                         | org             | `embedding` pgvector                                        |
| `Application`                 | org             | unique `(candidateId, jobId)`                               |
| `Candidate`                   | org (`orgId`)   | `userId?`; the personal candidate lives in the sentinel org |
| `Resume`                      | via `Candidate` | JSON columns below                                          |
| `MatchScore`                  | org             | unique `(jobId, candidateId)`                               |
| `Gig`                         | org             | freelancer marketplace                                      |
| `GigProposal`                 | via `Gig`       | unique `(gigId, freelancerId)`                              |
| `Subscription`                | org             | billing — see `@agent_docs/stripe.md`                       |
| `EmailSequence`, `Assessment` | org             |                                                             |

## Resume JSON columns

`personalInfo` (Json?), `experiences` (Json[]), `education` (Json[]), `skills` (String[]), `languages` (Json[]), `certifications` (Json[]), `projects` (Json[]), plus `anonymized` / `anonymizedData` (GDPR). The **builder shape is canonical**: experiences `{ company, position, period, description, current }`, education `{ school, degree, field, year }`. Mapping lives in `apps/web/src/lib/cv-resume-fields.ts` (`extractedCvToResumeFields`).

## Tenant-isolation rule

Every org-scoped query MUST filter `where: { orgId, deletedAt: null }`; cross-tenant access MUST fail. Real examples:

- `apps/web/src/lib/actions/jobs.ts` — `userOrgRole.findFirst({ userId, orgId })` membership check before create.
- `apps/web/src/lib/entitlements.ts` — `prisma.job.count({ where: { orgId, status: 'PUBLISHED' } })`.
- `apps/web/src/lib/semantic-search.ts` — `searchCandidates` **requires** `organizationId` (throws if missing) and the SQL adds `AND c."orgId" = ${organizationId} AND c."deletedAt" IS NULL` (added after a cross-tenant leak fix — the canonical IDOR to avoid).

## Schema-change process

1. Edit **both** schema files (keep byte-identical). 2. `yarn db:push` (dev, no migration) **or** `yarn db:migrate` (creates a migration) — both via turbo. 3. `yarn db:generate` regenerates the client. 4. Seeds: `packages/db/seed.ts` + `apps/web/prisma/seed.ts`. A single Neon Postgres DB (pgvector) serves both Vercel preview and production.
