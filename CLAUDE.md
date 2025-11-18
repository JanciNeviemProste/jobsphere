# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JobSphere is an enterprise-grade Applicant Tracking System (ATS) powered by Anthropic's Claude AI. It's a monorepo built with Next.js 14, featuring AI CV parsing, hybrid job matching, email automation, skills assessments, and Stripe billing.

**Key Technologies:**
- Next.js 14 (App Router) with TypeScript
- Prisma ORM with PostgreSQL (pgvector extension for semantic search)
- NextAuth v5 for authentication
- Turborepo for monorepo management
- TailwindCSS + shadcn/ui for UI
- BullMQ for background job processing
- Claude AI (Anthropic) for CV parsing and candidate matching

## Monorepo Structure

```
apps/
├── web/          # Main Next.js application
├── api/          # Standalone API (if needed)
└── workers/      # Background workers package

packages/
├── db/           # Shared Prisma schema and database client
├── ai/           # AI utilities (CV parsing, embeddings, Claude integration)
├── ui/           # Shared UI components
└── i18n/         # Internationalization utilities
```

## Essential Commands

### Development
```bash
# Install dependencies (use yarn - specified in packageManager)
yarn install

# Start development server (runs on port 3000)
yarn dev

# Run all tests with coverage
yarn test

# Run tests in watch mode (within apps/web)
cd apps/web && yarn test

# Run single test file
cd apps/web && yarn test path/to/test.spec.ts

# Run E2E tests
yarn test:e2e

# Run E2E tests with UI
cd apps/web && yarn test:e2e:ui
```

### Database Operations
```bash
# Generate Prisma client (run after schema changes)
yarn db:push
# OR for migrations
yarn db:migrate

# Open Prisma Studio
cd apps/web && yarn db:studio

# Seed database with test data
yarn db:seed

# Reset database (WARNING: deletes all data)
yarn db:reset
```

### Build & Deploy
```bash
# Type check all packages
yarn typecheck

# Lint all packages
yarn lint

# Format code
yarn format

# Build for production
yarn build

# Build web app only (skips env verification)
cd apps/web && yarn build:skip-verify
```

### Docker Services
```bash
# Start all infrastructure services (PostgreSQL, Redis, ClamAV, etc.)
yarn docker:up

# Stop all services
yarn docker:down

# View logs
yarn docker:logs
```

### Workers & Background Jobs
```bash
# Run BullMQ workers (email sequences, embeddings, assessments)
cd apps/web && yarn workers

# Watch mode for workers
cd apps/web && yarn workers:dev
```

## Architecture Patterns

### Authentication & Authorization

**NextAuth v5 Setup:**
- Configuration: `apps/web/src/lib/auth.ts`
- Supports Credentials (email/password) and Google OAuth
- Session strategy: JWT
- OAuth tokens are encrypted with AES-256-GCM (see `apps/web/src/lib/encryption.ts`)

**Authorization Pattern:**
- Multi-tenant: Users belong to Organizations via `UserOrgRole` junction table
- Roles: `ORG_ADMIN`, `RECRUITER`, `HIRING_MANAGER`, `AGENCY`
- Always verify user's organization membership before operations

**Example:**
```typescript
const session = await auth()
if (!session?.user?.id) throw new UnauthorizedError()

const membership = await prisma.userOrgRole.findFirst({
  where: { userId: session.user.id, orgId }
})
if (!membership) throw new Error('Not a member of this organization')
```

### Server Actions vs API Routes

**Prefer Server Actions for:**
- Form submissions
- Simple CRUD operations
- Operations triggered from Server Components

**Use API Routes for:**
- File uploads (`/api/upload`, `/api/cv/upload`)
- Webhooks (`/api/stripe/webhook`)
- External integrations
- Operations requiring custom headers/streaming

**Server Actions Location:** `apps/web/src/lib/actions/`
- `jobs.ts` - Job CRUD operations
- `applications.ts` - Application management
- `auth.ts` - Auth operations

### Data Access Layer

**Prisma Client:**
- Singleton instance: `apps/web/src/lib/prisma.ts`
- Always use this imported instance (do not create new clients)
- Schema location: `packages/db/prisma/schema.prisma`

**Key Models:**
- `User` - Authentication and user profiles
- `Organization` - Companies/Employers
- `UserOrgRole` - Organization memberships with roles
- `Job` - Job postings (fields: title, description, workMode, type, seniority, location, salaryMin/Max)
- `Application` - Job applications with status tracking
- `Candidate` - Candidate profiles with parsed CV data
- `MatchScore` - AI-powered job-candidate matching scores (uses vector similarity)
- `EmailSequence` - Automated email campaigns
- `Assessment` - Skills testing for candidates

### CV Parsing Pipeline

**Multi-Stage Fallback Architecture** (see `apps/web/src/lib/cv-parser-pipeline.ts`):

1. **Stage 0: Security Checks**
   - File size validation (max 10MB)
   - MIME type verification (prevents spoofing)
   - VBA macro detection in DOCX files
   - ClamAV antivirus scanning (if enabled)

2. **Stage 1: Node.js Parser** (~100ms)
   - PDF: `pdf-parse` library
   - DOCX: `mammoth` library
   - Success if extracted text > 50 chars

3. **Stage 2: OCR Fallback** (~2-3s per page)
   - Python service with Tesseract
   - Supports: EN, DE, SK, CS, PL
   - Endpoint: Docker container `python-parser`

4. **Stage 3: Metadata Fallback**
   - Extracts filename, file metadata
   - Returns graceful degradation response

**AI Extraction:**
- After text extraction, Claude AI parses structured data
- Fields: name, email, phone, skills, experience, education
- Located in: `packages/ai/`

**Configuration:**
```bash
ENABLE_OCR=true
OCR_TIMEOUT=30000
ENABLE_ANTIVIRUS=true
CLAMAV_HOST=clamav
CLAMAV_PORT=3310
```

### Rate Limiting & Security

**Rate Limiting** (`apps/web/src/lib/rate-limit.ts`):
- Uses Redis (Upstash) with sliding window algorithm
- Presets:
  - `auth`: 5 req/min (login, signup)
  - `api`: 100 req/min (authenticated APIs)
  - `public`: 200 req/min (public endpoints)
  - `strict`: 10 req/15min (sensitive operations)
  - `upload`: 10 req/5min (file uploads)

**Wrap API routes:**
```typescript
import { withRateLimit } from '@/lib/rate-limit'

export const POST = withRateLimit(
  async (req) => { /* handler */ },
  { preset: 'upload', byUser: true }
)
```

**Security Features:**
- AES-256-GCM encryption for OAuth tokens (`apps/web/src/lib/encryption.ts`)
- CSRF protection (`apps/web/src/lib/csrf.ts`)
- Audit logging (`apps/web/src/lib/audit-log.ts`)
- Zod validation on all inputs (`apps/web/src/lib/validation.ts`)
- Security headers configured in `next.config.js`

### Background Jobs (BullMQ)

**Workers Location:** `apps/web/src/workers/`
- `email-sequence.worker.ts` - Automated drip campaigns
- `embedding.worker.ts` - Generate vector embeddings for jobs/candidates
- `assessment-grading.worker.ts` - Auto-grade skills assessments

**Queue System:**
- Uses Redis for job storage
- Configured in `apps/web/src/lib/queue.ts`
- Start workers: `yarn workers`

**Adding a new job:**
```typescript
import { emailQueue } from '@/lib/queue'

await emailQueue.add('send-email', {
  to: 'user@example.com',
  template: 'application-received',
  data: { candidateName, jobTitle }
})
```

### Internationalization (i18n)

**Supported Locales:** EN, DE, CS, SK, PL
- Library: `next-intl`
- Messages: `apps/web/messages/{locale}.json`
- All routes are under `[locale]` dynamic segment

**Usage in components:**
```typescript
import { useTranslations } from 'next-intl'

const t = useTranslations('JobsPage')
return <h1>{t('title')}</h1>
```

**Server-side:**
```typescript
import { getTranslations } from 'next-intl/server'

const t = await getTranslations('JobsPage')
```

## Common Workflows

### Adding a New API Route

1. Create route file: `apps/web/src/app/api/{endpoint}/route.ts`
2. Apply rate limiting with `withRateLimit`
3. Validate input with Zod schema
4. Check authentication with `await auth()`
5. Verify organization membership if needed
6. Use Prisma client from `@/lib/prisma`
7. Add error handling and logging

### Modifying Database Schema

1. Edit `packages/db/prisma/schema.prisma`
2. Generate migration: `cd packages/db && yarn db:migrate`
3. Or push without migration: `yarn db:push`
4. Regenerate Prisma client: `yarn db:generate`
5. Update TypeScript types if needed
6. Restart dev server to pick up new types

### Testing

**Unit/Integration Tests:**
- Framework: Vitest
- Location: `apps/web/src/lib/__tests__/`
- Coverage target: 80% lines, functions, statements; 75% branches

**E2E Tests:**
- Framework: Playwright
- Location: `apps/web/tests/e2e/`
- Run: `yarn test:e2e`

**Mocking Prisma:**
```typescript
import { mockDeep } from 'vitest-mock-extended'
import { PrismaClient } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: mockDeep<PrismaClient>()
}))
```

## Environment Variables

**Required for Development:**
```bash
DATABASE_URL                # PostgreSQL connection string
NEXTAUTH_URL                # http://localhost:3000
NEXTAUTH_SECRET            # Generate with: openssl rand -base64 32
ENCRYPTION_KEY             # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ANTHROPIC_API_KEY          # Claude AI API key
```

**Optional but Recommended:**
```bash
GOOGLE_CLIENT_ID           # Google OAuth
GOOGLE_CLIENT_SECRET
KV_REST_API_URL           # Upstash Redis for rate limiting
KV_REST_API_TOKEN
RESEND_API_KEY            # Email service (or use EMAIL_SERVICE="log")
STRIPE_SECRET_KEY         # Billing
```

**Docker Environment:**
- Start services: `yarn docker:up`
- Default DATABASE_URL: `postgresql://jobsphere:jobsphere_dev_2024@localhost:5432/jobsphere`
- Default REDIS_URL: `redis://localhost:6379`

## Important Notes

### File Uploads
- Current: Local storage in `public/uploads/cvs/`
- Production: Migrate to Vercel Blob or S3
- Max size: 10MB (configurable via `MAX_FILE_SIZE`)
- Allowed types: PDF, DOC, DOCX

### Semantic Search
- Uses pgvector extension for vector similarity
- Embeddings stored in `Candidate.cvEmbedding` and `Job.embedding` (float array)
- Generate embeddings via `embedding.worker.ts`
- Search implementation: `apps/web/src/lib/semantic-search.ts`

### Email System
- Abstraction layer: `apps/web/src/lib/email.ts`
- Providers: Resend, SendGrid, or log-only (dev)
- Set `EMAIL_SERVICE` env var
- Templates use React components (if using Resend)

### Stripe Integration
- Webhook handler: `apps/web/src/api/stripe/webhook/route.ts`
- Subscription management via `Subscription` model
- Entitlements checked in `apps/web/src/lib/entitlements.ts`

### Error Handling
- Custom errors: `apps/web/src/lib/errors.ts`
- Use `UnauthorizedError`, `ValidationError`, etc.
- Sentry integration for production error tracking

### Code Style
- Strict TypeScript mode enabled
- ESLint + Prettier configured
- Pre-commit hooks via Husky
- Use `yarn format` before committing
