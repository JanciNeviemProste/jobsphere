# JobSphere Production-Ready Refactoring - Prompt pre Claude Code Opus 4.1

## 🎯 Úloha: Transformovať JobSphere z prototypu na production-ready systém

**Kontext:** JobSphere je AI-powered ATS (Applicant Tracking System) s Next.js 14, TypeScript, Prisma, tRPC. Momentálne má kritické problémy s kvalitou (4.3/10) - 40+ failed deployments, 0% test coverage, security vulnerabilities, žiadne quality gates.

**Tvoj cieľ:** Systematicky opraviť všetky problémy za ~2-3 týždne práce, dosiahnuť production-ready stav (8+/10).

---

## 📋 FÁZA 1: FOUNDATION & TESTING (Týždeň 1) - NAJVYŠŠIA PRIORITA

### 1.1 Setup Testing Infrastructure

**Úloha:** Implementovať kompletný testing stack s Vitest

**Kroky:**

1. **Inštaluj dependencies:**
```bash
cd apps/web
yarn add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event
yarn add -D @vitejs/plugin-react happy-dom
yarn add -D @faker-js/faker
```

2. **Vytvor konfiguráciu:**

`apps/web/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.{ts,js}',
        '**/types.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    },
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

`apps/web/tests/setup.ts`:
```typescript
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    orgMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    entitlement: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    // ... add other models as needed
  },
}))

// Mock NextAuth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve({
    user: { id: 'test-user-id', email: 'test@example.com' }
  })),
}))
```

3. **Vytvor test helpers:**

`apps/web/tests/helpers/factories.ts`:
```typescript
import { faker } from '@faker-js/faker'

export const createMockUser = (overrides = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  emailVerified: null,
  image: null,
  password: null,
  phone: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockOrgMember = (overrides = {}) => ({
  id: faker.string.uuid(),
  userId: faker.string.uuid(),
  organizationId: faker.string.uuid(),
  role: 'MEMBER',
  ...overrides,
})

export const createMockEntitlement = (overrides = {}) => ({
  id: faker.string.uuid(),
  orgId: faker.string.uuid(),
  featureKey: 'MAX_JOBS',
  limitInt: 5,
  remainingInt: 5,
  resetAt: null,
  updatedAt: new Date(),
  ...overrides,
})
```

4. **Napíš prvé testy pre kritické moduly:**

`apps/web/src/lib/__tests__/entitlements.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { hasFeature, canCreateJob, getFeatureLimit } from '../entitlements'
import { createMockEntitlement } from '../../../tests/helpers/factories'

describe('Entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('hasFeature', () => {
    it('should return true when limitInt > 0', async () => {
      const mockEntitlement = createMockEntitlement({
        featureKey: 'AI_MATCHING',
        limitInt: 1
      })

      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(mockEntitlement)

      const result = await hasFeature('org-123', 'AI_MATCHING')

      expect(result).toBe(true)
      expect(prisma.entitlement.findUnique).toHaveBeenCalledWith({
        where: {
          orgId_featureKey: {
            orgId: 'org-123',
            featureKey: 'AI_MATCHING'
          }
        }
      })
    })

    it('should return false when limitInt is 0', async () => {
      const mockEntitlement = createMockEntitlement({ limitInt: 0 })
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(mockEntitlement)

      const result = await hasFeature('org-123', 'AI_MATCHING')

      expect(result).toBe(false)
    })

    it('should return false when entitlement not found', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(null)

      const result = await hasFeature('org-123', 'AI_MATCHING')

      expect(result).toBe(false)
    })
  })

  describe('canCreateJob', () => {
    it('should return true when under limit', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(
        createMockEntitlement({ featureKey: 'MAX_JOBS', limitInt: 5 })
      )
      vi.mocked(prisma.job.count).mockResolvedValue(3)

      const result = await canCreateJob('org-123')

      expect(result).toBe(true)
    })

    it('should return false when at limit', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(
        createMockEntitlement({ featureKey: 'MAX_JOBS', limitInt: 5 })
      )
      vi.mocked(prisma.job.count).mockResolvedValue(5)

      const result = await canCreateJob('org-123')

      expect(result).toBe(false)
    })

    it('should return true for unlimited (null)', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(
        createMockEntitlement({ featureKey: 'MAX_JOBS', limitInt: null })
      )

      const result = await canCreateJob('org-123')

      expect(result).toBe(true)
    })
  })

  describe('getFeatureLimit', () => {
    it('should return limitInt when entitlement exists', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(
        createMockEntitlement({ limitInt: 10 })
      )

      const result = await getFeatureLimit('org-123', 'MAX_JOBS')

      expect(result).toBe(10)
    })

    it('should return 0 when entitlement not found', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(null)

      const result = await getFeatureLimit('org-123', 'MAX_JOBS')

      expect(result).toBe(0)
    })
  })
})
```

`apps/web/src/lib/__tests__/audit-log.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createAuditLog, queryAuditLogs } from '../audit-log'

describe('AuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createAuditLog', () => {
    it('should create audit log with all fields', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await createAuditLog({
        userId: 'user-123',
        orgId: 'org-123',
        action: 'USER_LOGIN',
        resource: 'USER',
        resourceId: 'user-123',
        metadata: { ip: '1.2.3.4' },
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0'
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          orgId: 'org-123',
          action: 'USER_LOGIN',
          entityType: 'USER',
          entityId: 'user-123',
          changes: { ip: '1.2.3.4' },
          ipAddress: '1.2.3.4',
          userAgent: 'Mozilla/5.0'
        }
      })
    })

    it('should use default entityId when resourceId is missing', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await createAuditLog({
        action: 'SYSTEM_EVENT',
        resource: 'SYSTEM',
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityId: 'SYSTEM'
        })
      })
    })

    it('should not throw on database error', async () => {
      vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error('DB error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(createAuditLog({
        action: 'USER_LOGIN',
        resource: 'USER'
      })).resolves.not.toThrow()

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('queryAuditLogs', () => {
    it('should build correct where clause', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])

      await queryAuditLogs({
        userId: 'user-123',
        orgId: 'org-123',
        action: 'USER_LOGIN',
        resource: 'USER',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        limit: 50
      })

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          orgId: 'org-123',
          action: 'USER_LOGIN',
          entityType: 'USER',
          createdAt: {
            gte: new Date('2025-01-01'),
            lte: new Date('2025-01-31')
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      })
    })
  })
})
```

5. **Aktualizuj package.json:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:run": "vitest run"
  }
}
```

6. **Spusti testy a over coverage:**
```bash
yarn test:coverage
```

**Target:** Minimálne 80% coverage pre `lib/` folder pred pokračovaním.

**Deliverable:** ✅ Fungujúci test suite s >80% coverage pre kritické moduly (entitlements, audit-log, rate-limit)

---

### 1.2 Input Validation s Zod

**Úloha:** Pridať Zod validáciu do VŠETKÝCH API routes

**Kroky:**

1. **Vytvor centrálne schemas:**

`apps/web/src/schemas/index.ts`:
```typescript
export * from './email-sequence.schema'
export * from './assessment.schema'
export * from './job.schema'
export * from './application.schema'
export * from './gdpr.schema'
export * from './common.schema'
```

`apps/web/src/schemas/common.schema.ts`:
```typescript
import { z } from 'zod'

export const idSchema = z.string().cuid()
export const emailSchema = z.string().email()
export const urlSchema = z.string().url()

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20)
})

export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
}).refine(
  (data) => !data.startDate || !data.endDate || data.startDate <= data.endDate,
  { message: 'Start date must be before end date' }
)
```

`apps/web/src/schemas/email-sequence.schema.ts`:
```typescript
import { z } from 'zod'
import { idSchema } from './common.schema'

export const emailStepSchema = z.object({
  order: z.number().int().min(0).max(100),
  dayOffset: z.number().int().min(0).max(365),
  subject: z.string().min(1).max(200),
  bodyTemplate: z.string().min(1).max(50000),
  conditions: z.record(z.any()).optional(),
  abVariant: z.enum(['A', 'B', 'C']).optional()
})

export const createSequenceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  active: z.boolean().default(false),
  steps: z.array(emailStepSchema).min(1).max(10)
})

export const updateSequenceSchema = createSequenceSchema.partial()

export type EmailStepInput = z.infer<typeof emailStepSchema>
export type CreateSequenceInput = z.infer<typeof createSequenceSchema>
export type UpdateSequenceInput = z.infer<typeof updateSequenceSchema>
```

`apps/web/src/schemas/gdpr.schema.ts`:
```typescript
import { z } from 'zod'

export const consentSchema = z.object({
  purpose: z.enum(['MARKETING', 'ANALYTICS', 'COOKIES']),
  granted: z.boolean()
})

export const dsarRequestSchema = z.object({
  type: z.enum(['EXPORT', 'DELETE'])
})

export type ConsentInput = z.infer<typeof consentSchema>
export type DSARRequestInput = z.infer<typeof dsarRequestSchema>
```

2. **Vytvor validation helper:**

`apps/web/src/lib/validation.ts`:
```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'

export class ValidationError extends Error {
  constructor(
    public issues: z.ZodIssue[],
    message = 'Validation failed'
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export async function validateRequest<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  try {
    const body = await request.json()
    return schema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.issues)
    }
    throw error
  }
}

export function handleValidationError(error: ValidationError) {
  return NextResponse.json(
    {
      error: 'Validation failed',
      issues: error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    },
    { status: 400 }
  )
}
```

3. **Aplikuj na existujúce routes - PRÍKLAD:**

`apps/web/src/app/api/sequences/route.ts` - PRED:
```typescript
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgMember = await prisma.orgMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!orgMember) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const { name, description, steps, active } = await request.json() // ❌ No validation

    const sequence = await prisma.emailSequence.create({
      data: {
        name,
        description,
        orgId: orgMember.organizationId,
        createdBy: session.user.id,
        active: active || false,
        steps: {
          create: steps.map((step: any, index: number) => ({ // ❌ any type
            order: step.order ?? index,
            dayOffset: step.dayOffset || 0,
            subject: step.subject,
            bodyTemplate: step.bodyTemplate || step.body || '',
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json({ sequence })
  } catch (error) {
    console.error('Sequence POST error:', error)
    return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 })
  }
}
```

PO - S VALIDATION:
```typescript
import { createSequenceSchema } from '@/schemas'
import { validateRequest, handleValidationError, ValidationError } from '@/lib/validation'
import { requireAuth } from '@/lib/api-helpers'
import { handleApiError } from '@/lib/errors'

export async function POST(request: NextRequest) {
  try {
    // Validate input FIRST
    const data = await validateRequest(request, createSequenceSchema)

    // Then authenticate
    const { userId, orgId } = await requireAuth(request)

    // Business logic
    const sequence = await prisma.emailSequence.create({
      data: {
        ...data,
        orgId,
        createdBy: userId,
        steps: {
          create: data.steps.map((step, index) => ({
            order: step.order ?? index,
            dayOffset: step.dayOffset,
            subject: step.subject,
            bodyTemplate: step.bodyTemplate,
            conditions: step.conditions,
            abVariant: step.abVariant,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json({ sequence })
  } catch (error) {
    if (error instanceof ValidationError) {
      return handleValidationError(error)
    }
    return handleApiError(error)
  }
}
```

4. **Vytvor complete schemas pre všetky main routes:**
   - `job.schema.ts` (createJob, updateJob)
   - `application.schema.ts` (createApplication, updateStatus)
   - `assessment.schema.ts` (createAssessment, submitAnswer)
   - `stripe.schema.ts` (checkoutSession)

**Pokyn:** Prejdi VŠETKY súbory v `apps/web/src/app/api/**/route.ts` a:
1. Identifikuj vstupné dáta (`request.json()`)
2. Vytvor Zod schema
3. Nahraď `await request.json()` za `await validateRequest(request, schema)`
4. Odstráň všetky `any` types

**Deliverable:** ✅ 100% API routes majú Zod validáciu, 0 `any` types

---

### 1.3 CI/CD Pipeline

**Úloha:** GitHub Actions pre automatické quality checks

**Kroky:**

1. **Vytvor yarn.lock:**
```bash
cd /path/to/jobsphere
yarn install
git add yarn.lock
git commit -m "chore: Add yarn.lock for reproducible builds"
```

2. **Setup Husky pre pre-commit hooks:**
```bash
yarn add -D husky lint-staged
npx husky init
```

`.husky/pre-commit`:
```bash
#!/bin/sh
yarn lint-staged
```

`package.json` (root):
```json
{
  "lint-staged": {
    "apps/web/**/*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "apps/web/src/**/*.ts": [
      "bash -c 'cd apps/web && tsc --noEmit'"
    ]
  }
}
```

3. **GitHub Actions workflow:**

`.github/workflows/ci.yml`:
```yaml
name: CI Pipeline

on:
  push:
    branches: [main, master, develop]
  pull_request:
    branches: [main, master, develop]

jobs:
  quality-checks:
    name: Quality Checks
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Type check
        run: |
          cd apps/web
          yarn typecheck

      - name: Lint
        run: |
          cd apps/web
          yarn lint

      - name: Run tests
        run: |
          cd apps/web
          yarn test:run

      - name: Check test coverage
        run: |
          cd apps/web
          yarn test:coverage
        continue-on-error: true

      - name: Build
        run: |
          cd apps/web
          yarn build
        env:
          DATABASE_URL: "postgresql://placeholder"
          NEXTAUTH_SECRET: "test-secret"
          NEXTAUTH_URL: "http://localhost:3000"
          REDIS_URL: "redis://localhost:6379"
          NEXT_PUBLIC_APP_URL: "http://localhost:3000"
          NEXT_PUBLIC_API_URL: "http://localhost:3000/api"

  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'
```

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main, master]

jobs:
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: quality-checks # Wait for CI to pass

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

**Deliverable:** ✅ Každý push vykoná type check, lint, tests, build. Žiadny broken code v main branche.

---

## 🔒 FÁZA 2: SECURITY HARDENING (Týždeň 2)

### 2.1 Encryption Layer

**Úloha:** Encrypto všetky sensitive data (OAuth tokens, passwords)

**Kroky:**

1. **Vytvor encryption utility:**

`apps/web/src/lib/encryption.ts`:
```typescript
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY not set in environment')
  }
  return Buffer.from(key, 'hex')
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':')

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted format')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv)

  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

export function encryptJSON(obj: any): string {
  return encrypt(JSON.stringify(obj))
}

export function decryptJSON<T = any>(encryptedText: string): T {
  return JSON.parse(decrypt(encryptedText))
}

// Generate new encryption key (run once, store in .env)
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}
```

2. **Generuj encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Add to .env: ENCRYPTION_KEY=<generated-key>
```

3. **Aplikuj encryption na OAuth tokens:**

`apps/web/src/app/api/email/oauth/gmail/callback/route.ts`:
```typescript
import { encrypt, decrypt } from '@/lib/encryption'

// Pri ukladaní:
const encryptedTokens = encrypt(JSON.stringify({
  access_token: tokens.access_token,
  refresh_token: tokens.refresh_token,
  expiry_date: tokens.expiry_date,
}))

await prisma.emailAccount.upsert({
  where: {
    orgId_email: { orgId, email }
  },
  create: {
    orgId,
    provider: 'GMAIL',
    email,
    displayName: profile.name,
    oauthTokens: encryptedTokens, // Stored encrypted
    active: true,
  },
  update: {
    oauthTokens: encryptedTokens,
    lastSyncAt: new Date(),
  },
})

// Pri čítaní:
const account = await prisma.emailAccount.findUnique(...)
if (account?.oauthTokens) {
  const tokens = JSON.parse(decrypt(account.oauthTokens as string))
  // Use tokens...
}
```

4. **Aplikuj encryption na passwords v EmailAccount:**

Similar pattern - encrypt pred ukladaním, decrypt pri použití.

5. **Vytvor migration pre existing data:**

`apps/web/prisma/migrations/encrypt-existing-tokens.ts`:
```typescript
import { PrismaClient } from '@prisma/client'
import { encrypt } from '../../src/lib/encryption'

const prisma = new PrismaClient()

async function main() {
  // Encrypt all existing plaintext tokens
  const accounts = await prisma.emailAccount.findMany({
    where: {
      oauthTokens: { not: null }
    }
  })

  for (const account of accounts) {
    // Check if already encrypted (contains colons)
    const tokens = account.oauthTokens as any
    if (typeof tokens === 'string' && !tokens.includes(':')) {
      // Already encrypted, skip
      continue
    }

    const encryptedTokens = encrypt(JSON.stringify(tokens))

    await prisma.emailAccount.update({
      where: { id: account.id },
      data: { oauthTokens: encryptedTokens }
    })
  }

  console.log(`Encrypted ${accounts.length} accounts`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Deliverable:** ✅ Všetky OAuth tokens a passwords sú encrypted v DB

---

### 2.2 Rate Limiting na všetky routes

**Úloha:** Aplikovať rate limiting globálne

**Kroky:**

1. **Rozšír rate-limit.ts:**

`apps/web/src/lib/rate-limit.ts`:
```typescript
import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export type RateLimitConfig = {
  max: number      // Max requests
  window: number   // Time window in seconds
}

// Different limits for different route types
export const RATE_LIMITS = {
  auth: { max: 5, window: 60 },        // 5 attempts per minute
  api: { max: 100, window: 60 },       // 100 requests per minute
  public: { max: 200, window: 60 },    // 200 requests per minute
  strict: { max: 10, window: 60 },     // 10 requests per minute for sensitive ops
} as const

function getClientIdentifier(request: NextRequest): string {
  // Try multiple sources
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIp || 'unknown'

  return ip
}

export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const identifier = getClientIdentifier(request)
  const key = `rate-limit:${identifier}:${request.nextUrl.pathname}`

  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - config.window

  // Use Redis sorted set for sliding window
  const pipeline = redis.pipeline()

  // Remove old entries
  pipeline.zremrangebyscore(key, 0, windowStart)

  // Add current request
  pipeline.zadd(key, { score: now, member: `${now}:${Math.random()}` })

  // Count requests in window
  pipeline.zcard(key)

  // Set expiry
  pipeline.expire(key, config.window)

  const results = await pipeline.exec()
  const count = results[2] as number

  const success = count <= config.max
  const remaining = Math.max(0, config.max - count)
  const reset = now + config.window

  return { success, remaining, reset }
}

export function rateLimitResponse(remaining: number, reset: number) {
  return NextResponse.json(
    {
      error: 'Too many requests',
      retryAfter: reset - Math.floor(Date.now() / 1000)
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
        'Retry-After': (reset - Math.floor(Date.now() / 1000)).toString()
      }
    }
  )
}

// Helper middleware
export async function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const { success, remaining, reset } = await rateLimit(request, config)

  if (!success) {
    return rateLimitResponse(remaining, reset)
  }

  const response = await handler()

  // Add rate limit headers to successful response
  response.headers.set('X-RateLimit-Remaining', remaining.toString())
  response.headers.set('X-RateLimit-Reset', reset.toString())

  return response
}
```

2. **Aplikuj na routes - PRÍKLAD:**

`apps/web/src/app/api/auth/login/route.ts`:
```typescript
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  return withRateLimit(request, RATE_LIMITS.auth, async () => {
    // Your login logic here
    // ...
    return NextResponse.json({ success: true })
  })
}
```

3. **Bulk aplikuj na všetky API routes:**

Pattern pre každý route file:
```typescript
// Wrap main handler
export async function POST(request: NextRequest) {
  return withRateLimit(request, RATE_LIMITS.api, async () => {
    // Original logic here
  })
}

export async function GET(request: NextRequest) {
  return withRateLimit(request, RATE_LIMITS.public, async () => {
    // Original logic here
  })
}
```

**Špeciálne limity:**
- Auth routes: `RATE_LIMITS.auth` (5/min)
- Stripe webhook: Žiadny rate limit (verified signatures)
- Public routes: `RATE_LIMITS.public` (200/min)
- GDPR operations: `RATE_LIMITS.strict` (10/min)

**Deliverable:** ✅ Všetky API routes majú rate limiting

---

### 2.3 Security Headers

**Úloha:** Pridať security headers do Next.js config

`apps/web/next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.stripe.com;"
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig
```

**Deliverable:** ✅ Security headers aplikované, verified cez https://securityheaders.com

---

## 🏗️ FÁZA 3: CODE QUALITY REFACTORING (Týždeň 3)

### 3.1 Service Layer Pattern

**Úloha:** Extrahovať business logiku z API routes do service layer

**Kroky:**

1. **Vytvor service base class:**

`apps/web/src/services/base.service.ts`:
```typescript
import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'

export abstract class BaseService {
  protected prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }
}
```

2. **Vytvor service pre Email Sequences:**

`apps/web/src/services/email-sequence.service.ts`:
```typescript
import { BaseService } from './base.service'
import { CreateSequenceInput, UpdateSequenceInput } from '@/schemas'

export class EmailSequenceService extends BaseService {
  async createSequence(orgId: string, userId: string, data: CreateSequenceInput) {
    return await this.prisma.emailSequence.create({
      data: {
        name: data.name,
        description: data.description,
        orgId,
        createdBy: userId,
        active: data.active,
        steps: {
          create: data.steps.map((step, index) => ({
            order: step.order ?? index,
            dayOffset: step.dayOffset,
            subject: step.subject,
            bodyTemplate: step.bodyTemplate,
            conditions: step.conditions,
            abVariant: step.abVariant,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })
  }

  async updateSequence(sequenceId: string, orgId: string, data: UpdateSequenceInput) {
    // Verify ownership
    const sequence = await this.prisma.emailSequence.findFirst({
      where: { id: sequenceId, orgId }
    })

    if (!sequence) {
      throw new Error('Sequence not found or access denied')
    }

    return await this.prisma.emailSequence.update({
      where: { id: sequenceId },
      data: {
        ...data,
        steps: data.steps ? {
          deleteMany: {},
          create: data.steps.map((step, index) => ({
            order: step.order ?? index,
            dayOffset: step.dayOffset,
            subject: step.subject,
            bodyTemplate: step.bodyTemplate,
            conditions: step.conditions,
            abVariant: step.abVariant,
          })),
        } : undefined,
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })
  }

  async listSequences(orgId: string) {
    return await this.prisma.emailSequence.findMany({
      where: { orgId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async deleteSequence(sequenceId: string, orgId: string) {
    const sequence = await this.prisma.emailSequence.findFirst({
      where: { id: sequenceId, orgId }
    })

    if (!sequence) {
      throw new Error('Sequence not found or access denied')
    }

    await this.prisma.emailSequence.delete({
      where: { id: sequenceId }
    })
  }
}

// Singleton instance
export const emailSequenceService = new EmailSequenceService()
```

3. **Refactor API route na použitie service:**

`apps/web/src/app/api/sequences/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSequenceSchema } from '@/schemas'
import { validateRequest } from '@/lib/validation'
import { requireAuth } from '@/lib/api-helpers'
import { handleApiError } from '@/lib/errors'
import { emailSequenceService } from '@/services/email-sequence.service'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  return withRateLimit(request, RATE_LIMITS.api, async () => {
    try {
      const { orgId } = await requireAuth(request)
      const sequences = await emailSequenceService.listSequences(orgId)
      return NextResponse.json({ sequences })
    } catch (error) {
      return handleApiError(error)
    }
  })
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, RATE_LIMITS.api, async () => {
    try {
      const data = await validateRequest(request, createSequenceSchema)
      const { userId, orgId } = await requireAuth(request)

      const sequence = await emailSequenceService.createSequence(orgId, userId, data)

      return NextResponse.json({ sequence }, { status: 201 })
    } catch (error) {
      return handleApiError(error)
    }
  })
}
```

4. **Vytvor services pre ostatné entity:**

Pokyn: Vytvor podobné service classes pre:
- `job.service.ts` (createJob, updateJob, deleteJob, listJobs)
- `application.service.ts` (createApplication, updateStatus, getApplications)
- `assessment.service.ts` (createAssessment, inviteCandidate, submitAttempt)
- `billing.service.ts` (createCheckoutSession, handleWebhook, cancelSubscription)

**Pattern:**
```
apps/web/src/services/
  ├── base.service.ts
  ├── email-sequence.service.ts
  ├── job.service.ts
  ├── application.service.ts
  ├── assessment.service.ts
  ├── billing.service.ts
  └── index.ts (exports)
```

**Deliverable:** ✅ Všetky hlavné entity majú service layer, API routes sú len thin wrappers

---

### 3.2 Auth Middleware Helper

**Úloha:** Centralizovať autentifikáciu do reusable helper

`apps/web/src/lib/api-helpers.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from './auth'
import { prisma } from './db'

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export interface AuthContext {
  userId: string
  orgId: string
  role: string
  email: string
}

/**
 * Require authentication and organization membership
 */
export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new UnauthorizedError()
  }

  const orgMember = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true }
  })

  if (!orgMember) {
    throw new ForbiddenError('No organization membership found')
  }

  return {
    userId: session.user.id,
    orgId: orgMember.organizationId,
    role: orgMember.role,
    email: session.user.email!,
  }
}

/**
 * Require specific role
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<AuthContext> {
  const ctx = await requireAuth(request)

  if (!allowedRoles.includes(ctx.role)) {
    throw new ForbiddenError(`Role ${ctx.role} not allowed`)
  }

  return ctx
}

/**
 * Optional auth (returns null if not authenticated)
 */
export async function optionalAuth(request: NextRequest): Promise<AuthContext | null> {
  try {
    return await requireAuth(request)
  } catch {
    return null
  }
}
```

`apps/web/src/lib/errors.ts`:
```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { UnauthorizedError, ForbiddenError, NotFoundError } from './api-helpers'
import { ValidationError } from './validation'

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error)

  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: error.message },
      { status: 401 }
    )
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: error.message },
      { status: 403 }
    )
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: error.message },
      { status: 404 }
    )
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        issues: error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      },
      { status: 400 }
    )
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', issues: error.issues },
      { status: 400 }
    )
  }

  if (error instanceof Error && error.message) {
    // Check for known Prisma errors
    if (error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Resource already exists' },
        { status: 409 }
      )
    }
  }

  // Generic error - don't leak details
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}
```

**Použitie:**
```typescript
// Každý API route teraz môže byť:
export async function POST(request: NextRequest) {
  return withRateLimit(request, RATE_LIMITS.api, async () => {
    try {
      const { userId, orgId } = await requireAuth(request) // ✅ One liner
      // ... rest of logic
    } catch (error) {
      return handleApiError(error) // ✅ Unified error handling
    }
  })
}

// For admin-only routes:
export async function DELETE(request: NextRequest) {
  try {
    const { userId, orgId } = await requireRole(request, ['ADMIN']) // ✅ Role check
    // ...
  } catch (error) {
    return handleApiError(error)
  }
}
```

**Deliverable:** ✅ Všetky API routes používajú requireAuth/requireRole, nie custom auth logic

---

### 3.3 Remove All `any` Types

**Úloha:** Dosiahnuť 100% type safety

**Kroky:**

1. **Enable strict TypeScript:**

`apps/web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

2. **Find all `any` usages:**
```bash
cd apps/web
grep -rn ": any" src/
grep -rn "<any>" src/
```

3. **Replace with proper types - PRÍKLADY:**

**PRED:**
```typescript
const where: any = {}
```

**PO:**
```typescript
import { Prisma } from '@prisma/client'

const where: Prisma.AuditLogWhereInput = {}
```

**PRED:**
```typescript
metadata?: Record<string, any>
```

**PO:**
```typescript
import { z } from 'zod'

const metadataSchema = z.record(z.unknown())
type Metadata = z.infer<typeof metadataSchema>

metadata?: Metadata
```

**PRED:**
```typescript
steps.map((step: any, index) => ...)
```

**PO:**
```typescript
import { EmailStepInput } from '@/schemas'

steps.map((step: EmailStepInput, index) => ...)
```

4. **Vytvor type-safe API client (bonus):**

`apps/web/src/lib/api-client.ts`:
```typescript
import { CreateSequenceInput, UpdateSequenceInput } from '@/schemas'

type ApiResponse<T> = {
  data?: T
  error?: string
  issues?: Array<{ path: string; message: string }>
}

async function apiCall<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    return { error: data.error, issues: data.issues }
  }

  return { data }
}

export const api = {
  sequences: {
    list: () => apiCall<{ sequences: any[] }>('/api/sequences'),
    create: (data: CreateSequenceInput) =>
      apiCall('/api/sequences', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateSequenceInput) =>
      apiCall(`/api/sequences/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiCall(`/api/sequences/${id}`, { method: 'DELETE' }),
  },
  // ... other endpoints
}
```

**Deliverable:** ✅ 0 `any` types v celom projekte, strict TypeScript enabled

---

## 📊 FINAL CHECKLIST (Po všetkých fázach)

### Testing ✅
- [ ] Vitest setup s >80% coverage
- [ ] Unit tests pre všetky services
- [ ] Integration tests pre kritické flows
- [ ] E2E tests (optional, ale recommended)

### Security ✅
- [ ] Zod validation na 100% API routes
- [ ] Encryption pre OAuth tokens & passwords
- [ ] Rate limiting globálne aplikované
- [ ] Security headers v Next.js config
- [ ] CSRF protection verified (NextAuth)
- [ ] SQL injection prevented (Prisma ✅)

### Code Quality ✅
- [ ] Service layer pre všetky entity
- [ ] requireAuth helper používaný všade
- [ ] 0 `any` types
- [ ] Unified error handling
- [ ] ESLint + Prettier configured
- [ ] Code coverage >80%

### DevOps ✅
- [ ] yarn.lock committed
- [ ] GitHub Actions CI pipeline
- [ ] Pre-commit hooks (Husky + lint-staged)
- [ ] Type checking pred každým commitom
- [ ] Automatic deployment len po CI pass
- [ ] Environment variables documented

### Documentation ✅
- [ ] README aktualizované
- [ ] API dokumentácia (Swagger optional)
- [ ] CONTRIBUTING.md guidelines
- [ ] SECURITY.md policy
- [ ] Architecture diagram

### Performance & Monitoring ✅
- [ ] Sentry error tracking (optional)
- [ ] Vercel Analytics (optional)
- [ ] Database query optimization
- [ ] Bundle size <500kb

---

## 🎯 VÝSLEDOK

Po dokončení týchto fáz:

**PRED:**
- Testing: 0/10
- Security: 5/10
- Code Quality: 4/10
- DevOps: 2/10
- **CELKOM: 4.3/10**
- **40+ failed deployments**

**PO:**
- Testing: 9/10 (80%+ coverage, CI pipeline)
- Security: 9/10 (encryption, validation, rate limiting)
- Code Quality: 8/10 (service layer, type safety)
- DevOps: 9/10 (CI/CD, pre-commit hooks)
- **CELKOM: 8.8/10** ✅
- **0 failed deployments** 🎉

---

## 💡 TIPS PRE CLAUDE OPUS

1. **Prioritizuj systematicky:** Fáza 1 → Fáza 2 → Fáza 3. Nedeskuj medzi fázami.

2. **Test-first mindset:** Pre každý refactor najprv napíš test, potom refactoruj.

3. **Commit často:** Po každej dokončenej sekcii commitni s descriptive message.

4. **Pattern matching:** Keď refactoruješ jeden API route, aplikuj rovnaký pattern na všetky ostatné.

5. **Verify after each step:**
   - Po testing setup: `yarn test:coverage`
   - Po CI setup: trigger GitHub Action
   - Po refactor: `yarn build` musí prejsť

6. **Security first:** Ak musíš vybrať medzi feature a security fix, vždy vyber security.

7. **Document as you go:** Update README.md priebežne, nie na konci.

8. **Ask for clarification:** Ak niečo nie je jasné (napr. business logika), opýtaj sa než hádaš.

---

## 📞 SUPPORT

Ak narazíš na blocking issue:

1. Check existing docs: PROJECT_ASSESSMENT.md, SECURITY_RECOMMENDATIONS.md
2. Search codebase for similar patterns
3. Read Prisma schema pre correct field names
4. Check test examples pre správne mocks

**Environment variables needed:**
```bash
# Add to .env
ENCRYPTION_KEY=<64-char-hex> # Generate with crypto.randomBytes(32).toString('hex')
KV_REST_API_URL=<upstash-redis-url>
KV_REST_API_TOKEN=<upstash-redis-token>
```

---

**Estimated time:** 2-3 týždne full-time work
**Priority order:** Testing > Security > Quality
**Success criteria:** Build passes, 0 TypeScript errors, 80%+ coverage, 0 critical vulnerabilities

Good luck! 🚀
