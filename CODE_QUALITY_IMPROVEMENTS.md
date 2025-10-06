# Code Quality Improvements pre JobSphere

## 🎯 **Hlavný problém: 40+ failed deployments**

**Root cause:** Žiadne testy, žiadny type checking pred commitom

## 1️⃣ TESTING (KRITICKÉ - 0/10)

### Implementovať testing stack:

```bash
# Inštalácia:
yarn add -D vitest @testing-library/react @testing-library/jest-dom
yarn add -D @vitejs/plugin-react
```

**Vytvoriť:**
```typescript
// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
```

**Príklad testu:**
```typescript
// apps/web/src/lib/__tests__/entitlements.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { hasFeature, canCreateJob } from '../entitlements'

describe('Entitlements', () => {
  it('should return false for disabled feature', async () => {
    const result = await hasFeature('org-123', 'AI_MATCHING')
    expect(result).toBe(false)
  })

  it('should check job limit correctly', async () => {
    const canCreate = await canCreateJob('org-123')
    expect(typeof canCreate).toBe('boolean')
  })
})
```

**Target coverage: 80%+**

## 2️⃣ PRE-COMMIT HOOKS

```bash
yarn add -D husky lint-staged
npx husky init
```

**Vytvoriť `.husky/pre-commit`:**
```bash
#!/bin/sh
yarn lint-staged
yarn typecheck
```

**Pridať do package.json:**
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "bash -c 'tsc --noEmit'"
    ]
  }
}
```

**Výsledok:** Žiadne TypeScript errors v gite = žiadne failed builds

## 3️⃣ CODE PATTERNS

### A) Service Layer Pattern

**Pred (zlé):**
```typescript
// API route robí všetko:
export async function POST(request: NextRequest) {
  const session = await auth()
  const orgMember = await prisma.orgMember.findFirst(...)
  const sequence = await prisma.emailSequence.create(...)
  // 50+ riadkov business logiky
}
```

**Po (dobré):**
```typescript
// apps/web/src/services/email-sequence.service.ts
export class EmailSequenceService {
  async createSequence(orgId: string, data: CreateSequenceInput) {
    // Validácia
    const validated = createSequenceSchema.parse(data)

    // Business logika
    return await prisma.emailSequence.create({
      data: { ...validated, orgId }
    })
  }
}

// API route:
export async function POST(request: NextRequest) {
  const { orgId } = await requireAuth(request)
  const data = await request.json()
  const sequence = await emailSequenceService.createSequence(orgId, data)
  return NextResponse.json({ sequence })
}
```

### B) Middleware pre autentifikáciu

**Vytvoriť:**
```typescript
// apps/web/src/lib/api-helpers.ts
export async function requireAuth(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new UnauthorizedError()
  }

  const orgMember = await prisma.orgMember.findFirst({
    where: { userId: session.user.id }
  })

  if (!orgMember) {
    throw new NoOrganizationError()
  }

  return {
    userId: session.user.id,
    orgId: orgMember.organizationId,
    role: orgMember.role
  }
}
```

**Použitie:**
```typescript
// Namiesto 10 riadkov v každej route:
const { orgId, userId } = await requireAuth(request)
```

### C) Zod Validation

**Vytvoriť schemas:**
```typescript
// apps/web/src/schemas/email-sequence.schema.ts
import { z } from 'zod'

export const createSequenceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  active: z.boolean().default(false),
  steps: z.array(z.object({
    order: z.number().int().min(0),
    dayOffset: z.number().int().min(0),
    subject: z.string().min(1).max(200),
    bodyTemplate: z.string().min(1)
  })).min(1).max(10)
})

export type CreateSequenceInput = z.infer<typeof createSequenceSchema>
```

## 4️⃣ TYPE SAFETY

### Odstránič všetky `any`:

**Pred:**
```typescript
const where: any = {}  // ❌
steps.map((step: any, index: number) => ({ ... }))  // ❌
```

**Po:**
```typescript
type AuditLogWhere = {
  userId?: string
  orgId?: string
  entityType?: string
  createdAt?: { gte?: Date; lte?: Date }
}

const where: AuditLogWhere = {}  // ✅

// Type from Zod:
steps.map((step: EmailStepInput, index) => ({ ... }))  // ✅
```

## 5️⃣ ERROR HANDLING

**Vytvoriť custom errors:**
```typescript
// apps/web/src/lib/errors.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message)
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super('Unauthorized', 401, 'UNAUTHORIZED')
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR')
  }
}
```

**Error middleware:**
```typescript
// apps/web/src/lib/api-helpers.ts
export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    )
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', issues: error.issues },
      { status: 400 }
    )
  }

  console.error('Unhandled error:', error)
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}
```

## 6️⃣ CI/CD PIPELINE

**Vytvoriť `.github/workflows/ci.yml`:**
```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: yarn install --frozen-lockfile
      - run: yarn typecheck
      - run: yarn lint
      - run: yarn test
      - run: yarn build
```

**Výsledok:** Žiadny kód s chybami sa nedostane do main branchu

## 7️⃣ DEPENDENCIES

```bash
# Vytvoriť lockfile:
yarn install
git add yarn.lock
git commit -m "Add yarn.lock for reproducible builds"

# Pravidelne updateovať:
yarn upgrade-interactive --latest
```

## 8️⃣ DOCUMENTATION

**Vytvoriť:**
- `CONTRIBUTING.md` - guidelines pre contributors
- `ARCHITECTURE.md` - system design
- API documentation (možno Swagger/OpenAPI)

## 📊 Implementačný plán (4 týždne)

### Týždeň 1: Testing Foundation
- [ ] Nastaviť Vitest
- [ ] Napísať 20 unit testov (critical paths)
- [ ] Setup coverage reporting

### Týždeň 2: Developer Experience
- [ ] Husky + lint-staged
- [ ] Pre-commit hooks s type checking
- [ ] GitHub Actions CI

### Týždeň 3: Code Refactoring
- [ ] Vytvoriť service layer pre sequences
- [ ] Refactor auth do middleware
- [ ] Zod schemas pre top 10 routes

### Týždeň 4: Polish
- [ ] Odstrániť všetky `any` types
- [ ] Error handling cleanup
- [ ] Documentation

## 🎯 Výsledok po implementácii:

- ✅ 0 failed deployments (namiesto 40+)
- ✅ 80%+ test coverage
- ✅ Type safety 100%
- ✅ Automatické quality checks
- ✅ Udržiavateľný kód
