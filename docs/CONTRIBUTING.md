# Contributing to JobSphere

Thank you for your interest in contributing to JobSphere! This guide will help you get started with development.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Code Style & Standards](#code-style--standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Node.js 18.x or higher** - [Download here](https://nodejs.org/)
- **Yarn 1.22.x or higher** - Install with `npm install -g yarn`
- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop)
- **Git** - [Download here](https://git-scm.com/downloads)

### Recommended Tools

- **VSCode** - [Download here](https://code.visualstudio.com/)
  - Extensions: ESLint, Prettier, Prisma
- **Postman** or **Thunder Client** - For API testing
- **PostgreSQL client** (optional) - TablePlus, DBeaver, or pgAdmin

### System Requirements

- **OS:** Windows 10/11, macOS 10.15+, or Linux
- **RAM:** 8GB minimum (16GB recommended)
- **Disk Space:** 5GB free space

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/jobsphere.git
cd jobsphere
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
yarn install
```

This will install dependencies for all packages in the monorepo (apps/web, packages/db, etc.).

### 3. Start Docker Services

JobSphere requires several services to run locally:

```bash
# Start PostgreSQL, Redis, ClamAV, and Python parser
yarn docker:up

# Or use Docker Compose directly
docker-compose up -d
```

**Services started:**

- **PostgreSQL** (port 5432) - Main database
- **Redis** (port 6379) - Rate limiting and BullMQ queues
- **ClamAV** (port 3310) - Antivirus scanning (optional)
- **Python Parser** (port 5000) - OCR fallback for CV parsing

**Verify services are running:**

```bash
docker-compose ps
```

### 4. Configure Environment Variables

Copy the example environment file:

```bash
cp apps/web/.env.example apps/web/.env
```

Edit `apps/web/.env` with your configuration:

```bash
# Database
DATABASE_URL="postgresql://jobsphere:jobsphere_dev_2024@localhost:5432/jobsphere"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Encryption (for OAuth tokens)
ENCRYPTION_KEY="generate-with-node-crypto-randomBytes-32-hex"

# AI / Claude (REQUIRED for CV parsing, matching, grading)
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Redis / Upstash (for rate limiting and BullMQ)
KV_REST_API_URL="http://localhost:6379"
KV_REST_API_TOKEN=""
REDIS_URL="redis://localhost:6379"

# Email Service (optional for development)
EMAIL_SERVICE="log"  # Logs emails to console instead of sending

# OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# File Storage
STORAGE_PROVIDER="local"  # Use local file storage for development
```

**Generate secure secrets:**

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Set Up Database

```bash
# Push Prisma schema to database (creates tables)
cd apps/web
yarn db:push

# Seed database with test data
yarn db:seed
```

**What gets seeded:**

- 2 demo organizations (Tech Corp, Design Studio)
- 4 users with different roles (Admin, Recruiter, Hiring Manager, Agency)
- 10 jobs (5 per organization)
- 20 candidates with parsed CVs
- 50 applications
- 5 assessments with questions
- 3 email sequences

**Default login credentials:**

```
Admin:
  Email: admin@techcorp.com
  Password: Password123!

Recruiter:
  Email: recruiter@techcorp.com
  Password: Password123!
```

### 6. Start Development Server

```bash
# From project root
yarn dev

# Or from apps/web
cd apps/web && yarn dev
```

The application will be available at **http://localhost:3000**

### 7. Start Background Workers (Optional)

If you're working on features that require background jobs (email sequences, embeddings, assessments):

```bash
# In a separate terminal
cd apps/web
yarn workers

# Or in watch mode (auto-restart on changes)
yarn workers:dev
```

---

## Development Workflow

### Daily Development

1. **Pull latest changes**

   ```bash
   git pull origin main
   ```

2. **Install dependencies** (if package.json changed)

   ```bash
   yarn install
   ```

3. **Update database schema** (if schema.prisma changed)

   ```bash
   cd apps/web && yarn db:push
   ```

4. **Start dev server**
   ```bash
   yarn dev
   ```

### Making Changes

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code following our [code style guidelines](#code-style--standards)
   - Add tests for new features
   - Update documentation if needed

3. **Test your changes**

   ```bash
   # Type check
   yarn typecheck

   # Lint
   yarn lint

   # Run tests
   yarn test

   # E2E tests (if applicable)
   yarn test:e2e
   ```

4. **Commit changes**

   ```bash
   git add .
   git commit -m "feat: Add user profile page"
   ```

   **Commit message format:**

   ```
   type(scope): subject

   body (optional)

   footer (optional)
   ```

   **Types:**
   - `feat`: New feature
   - `fix`: Bug fix
   - `docs`: Documentation changes
   - `style`: Code style changes (formatting, etc.)
   - `refactor`: Code refactoring
   - `test`: Adding or updating tests
   - `chore`: Maintenance tasks

   **Examples:**

   ```
   feat(auth): Add Google OAuth login
   fix(cv-parser): Fix PDF parsing for scanned documents
   docs(api): Update API documentation for jobs endpoint
   test(assessments): Add integration tests for assessment grading
   ```

5. **Push changes**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request** (see [PR Process](#pull-request-process))

---

## Project Structure

```
jobsphere/
├── apps/
│   └── web/                    # Main Next.js application
│       ├── src/
│       │   ├── app/            # Next.js App Router pages
│       │   │   ├── [locale]/   # Internationalized routes
│       │   │   ├── api/        # API routes
│       │   │   └── ...
│       │   ├── components/     # React components
│       │   │   ├── ui/         # shadcn/ui components
│       │   │   ├── jobs/       # Job-related components
│       │   │   ├── candidates/ # Candidate-related components
│       │   │   └── ...
│       │   ├── lib/            # Utilities and business logic
│       │   │   ├── actions/    # Server Actions
│       │   │   ├── auth.ts     # NextAuth configuration
│       │   │   ├── prisma.ts   # Prisma client singleton
│       │   │   └── ...
│       │   ├── workers/        # BullMQ background workers
│       │   └── schemas/        # Zod validation schemas
│       ├── public/             # Static assets
│       ├── prisma/             # Database schema
│       ├── messages/           # i18n translations
│       └── tests/              # Test files
├── packages/
│   ├── db/                     # Shared Prisma schema (legacy)
│   ├── ai/                     # AI utilities (Claude integration)
│   ├── ui/                     # Shared UI components
│   └── i18n/                   # Internationalization
├── docs/                       # Documentation
│   ├── api/                    # API documentation
│   ├── architecture/           # Architecture documentation
│   └── CONTRIBUTING.md         # This file
└── docker-compose.yml          # Local development services
```

### Key Files

- **`apps/web/src/lib/prisma.ts`** - Database client (always use this, don't create new clients)
- **`apps/web/src/lib/auth.ts`** - Authentication configuration
- **`apps/web/src/middleware.ts`** - Next.js middleware (rate limiting, CSRF, security headers)
- **`packages/db/prisma/schema.prisma`** - Database schema
- **`apps/web/messages/en.json`** - English translations
- **`apps/web/.env`** - Environment variables (never commit this)

---

## Code Style & Standards

### TypeScript

- **Strict mode enabled** - All TypeScript errors must be resolved
- **Type everything** - Avoid `any` types unless absolutely necessary
- **Use interfaces over types** for object shapes
- **Prefer const over let** - Use `const` by default

**Example:**

```typescript
// ✅ Good
interface User {
  id: string
  email: string
  name: string | null
}

const getUser = async (id: string): Promise<User> => {
  const user = await prisma.user.findUnique({ where: { id } })
  return user
}

// ❌ Bad
const getUser = async (id: any) => {
  let user = await prisma.user.findUnique({ where: { id } })
  return user
}
```

### React & Next.js

- **Server Components by default** - Use Client Components only when needed
- **Use Server Actions** for form submissions and mutations
- **Prefer API Routes** for file uploads, webhooks, and complex operations
- **Colocate components** - Keep components close to where they're used

**Example:**

```typescript
// Server Component (default)
export default async function JobsPage() {
  const jobs = await prisma.job.findMany()
  return <JobsList jobs={jobs} />
}

// Client Component (when needed)
'use client'

export function SearchFilters() {
  const [query, setQuery] = useState('')
  // ... interactive logic
}
```

### Naming Conventions

- **Files:** kebab-case (`user-profile.tsx`, `cv-parser.ts`)
- **Components:** PascalCase (`UserProfile.tsx`, `JobCard.tsx`)
- **Functions:** camelCase (`getUserById`, `parseCV`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_FILE_SIZE`, `API_TIMEOUT`)
- **Types/Interfaces:** PascalCase (`User`, `JobFormData`)

### Imports

**Order imports:**

1. External packages (React, Next.js, etc.)
2. Internal modules (`@/lib`, `@/components`)
3. Types
4. CSS

```typescript
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { parseCV } from '@/lib/cv-parser'

import type { User } from '@/types'

import './styles.css'
```

### Error Handling

- **Always handle errors** - Use try-catch blocks for async operations
- **Use custom error classes** - Defined in `apps/web/src/lib/errors.ts`
- **Log errors** - Use the logger utility

**Example:**

```typescript
import { UnauthorizedError, ValidationError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      throw new UnauthorizedError('Not authenticated')
    }

    const data = await req.json()
    // ... process data

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.apiError('POST', '/api/endpoint', error)

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Database Queries

- **Always scope to organization** - Include `orgId` filter
- **Use Prisma client from @/lib/prisma** - Don't create new instances
- **Use transactions** for multi-step operations
- **Optimize queries** - Use `select` to fetch only needed fields

**Example:**

```typescript
import { prisma } from '@/lib/prisma'

// ✅ Good - Scoped to organization
const jobs = await prisma.job.findMany({
  where: {
    orgId: session.user.orgId,
    status: 'PUBLISHED',
  },
  select: {
    id: true,
    title: true,
    // Only select needed fields
  },
})

// ❌ Bad - No org scoping (security issue!)
const jobs = await prisma.job.findMany({
  where: { status: 'PUBLISHED' },
})
```

### Comments & Documentation

- **JSDoc for public APIs** - Document function signatures
- **Inline comments for complex logic** - Explain "why", not "what"
- **TODO comments** - Include ticket number or assignee

**Example:**

```typescript
/**
 * Parse CV file using multi-stage fallback pipeline
 *
 * Stage 1: Node.js parser (pdf-parse, mammoth) - Fast (~100ms)
 * Stage 2: OCR fallback (Tesseract) - Slower (~2-3s)
 * Stage 3: Metadata fallback - Graceful degradation
 *
 * @param file - Uploaded CV file (PDF or DOCX)
 * @param options - Parsing options (enableOCR, enableAntivirus)
 * @returns Parsed CV text or error
 */
export async function parseCVPipeline(file: File, options: ParseOptions): Promise<ParseResult> {
  // Security: Validate file size before processing
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError('File too large')
  }

  // TODO(john): Add support for RTF files - TICKET-123
  // ...
}
```

---

## Testing

### Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode
cd apps/web && yarn test

# Run specific test file
yarn test path/to/test.spec.ts

# Run tests with coverage
yarn test:coverage

# Run E2E tests
yarn test:e2e

# Run E2E tests with UI (interactive)
cd apps/web && yarn test:e2e:ui
```

### Test Structure

```
apps/web/tests/
├── unit/                    # Unit tests
│   ├── lib/
│   │   ├── cv-parser.test.ts
│   │   └── semantic-search.test.ts
│   └── ...
├── integration/             # Integration tests
│   ├── api/
│   │   ├── jobs.test.ts
│   │   └── applications.test.ts
│   └── security/
│       └── authorization.test.ts
└── e2e/                     # End-to-end tests
    ├── auth-flow.spec.ts
    ├── job-posting.spec.ts
    └── candidate-search.spec.ts
```

### Writing Tests

**Unit Test Example:**

```typescript
// apps/web/src/lib/__tests__/cv-parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseCV } from '../cv-parser'

describe('parseCV', () => {
  it('should extract text from PDF', async () => {
    const file = new File(['mock pdf content'], 'resume.pdf', {
      type: 'application/pdf',
    })

    const result = await parseCV(file)

    expect(result.success).toBe(true)
    expect(result.text).toContain('expected content')
  })

  it('should handle invalid file types', async () => {
    const file = new File(['content'], 'resume.txt', {
      type: 'text/plain',
    })

    await expect(parseCV(file)).rejects.toThrow('Unsupported file type')
  })
})
```

**Integration Test Example:**

```typescript
// apps/web/tests/integration/api/jobs.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createTestContext } from '@/tests/helpers'

describe('POST /api/jobs', () => {
  let ctx: TestContext

  beforeEach(async () => {
    ctx = await createTestContext()
  })

  it('should create job successfully', async () => {
    const response = await ctx.request('/api/jobs', {
      method: 'POST',
      body: {
        title: 'Senior Developer',
        description: 'Job description',
        orgId: ctx.org.id,
      },
    })

    expect(response.status).toBe(201)
    expect(response.data.job.title).toBe('Senior Developer')
  })

  it('should require authentication', async () => {
    const response = await ctx.request('/api/jobs', {
      method: 'POST',
      body: { title: 'Test' },
      auth: false, // No auth header
    })

    expect(response.status).toBe(401)
  })
})
```

**E2E Test Example:**

```typescript
// apps/web/tests/e2e/job-posting.spec.ts
import { test, expect } from '@playwright/test'

test('Recruiter can post a job', async ({ page }) => {
  // Login
  await page.goto('/login')
  await page.fill('[name=email]', 'recruiter@techcorp.com')
  await page.fill('[name=password]', 'Password123!')
  await page.click('button[type=submit]')

  // Navigate to post job page
  await page.goto('/post-job')

  // Fill form
  await page.fill('[name=title]', 'Senior React Developer')
  await page.fill('[name=description]', 'We are looking for...')
  await page.selectOption('[name=remote]', 'remote')

  // Submit
  await page.click('button:has-text("Publish")')

  // Verify redirect to job detail
  await expect(page).toHaveURL(/\/jobs\/[a-zA-Z0-9]+/)
  await expect(page.locator('h1')).toContainText('Senior React Developer')
})
```

### Test Coverage Requirements

- **Unit tests:** 80% lines, functions, statements
- **Integration tests:** 70% lines, statements
- **Branch coverage:** 75%
- **E2E tests:** Cover critical user journeys

---

## Pull Request Process

### 1. Before Creating PR

**Checklist:**

- [ ] Code follows style guidelines
- [ ] All tests pass (`yarn test`)
- [ ] Type check passes (`yarn typecheck`)
- [ ] Linting passes (`yarn lint`)
- [ ] New features have tests
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow convention

### 2. Create Pull Request

**Title format:**

```
[Type] Brief description (max 72 chars)
```

**Examples:**

```
[Feature] Add candidate profile page with match scores
[Fix] Resolve CV parsing error for scanned PDFs
[Docs] Update API documentation for assessments endpoint
```

**PR Description Template:**

```markdown
## Description

Brief description of what this PR does.

## Changes

- Change 1
- Change 2
- Change 3

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)

[Add screenshots here]

## Related Issues

Closes #123
Relates to #456

## Checklist

- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Type check passes
- [ ] Documentation updated
```

### 3. Code Review Process

1. **Automated checks run** - CI/CD pipeline validates code
2. **Reviewer assigned** - Maintainer reviews code
3. **Address feedback** - Make requested changes
4. **Re-request review** - After addressing comments
5. **Approval** - PR gets approved by maintainer
6. **Merge** - Maintainer merges PR to main

**Review criteria:**

- Code quality and readability
- Test coverage
- Performance impact
- Security considerations
- Documentation completeness

### 4. After Merge

- [ ] Delete feature branch
- [ ] Monitor CI/CD pipeline
- [ ] Verify deployment (if auto-deployed)
- [ ] Close related issues

---

## Troubleshooting

### Common Issues

#### 1. Docker Services Not Starting

**Issue:** `docker-compose up` fails

**Solutions:**

```bash
# Check if ports are already in use
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# Stop conflicting services
brew services stop postgresql
brew services stop redis

# Restart Docker Desktop

# Rebuild containers
docker-compose down -v
docker-compose up --build
```

#### 2. Database Connection Error

**Issue:** `Error: Can't reach database server`

**Solutions:**

```bash
# Verify DATABASE_URL is correct
echo $DATABASE_URL

# Check if PostgreSQL is running
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres

# Verify connection manually
psql postgresql://jobsphere:jobsphere_dev_2024@localhost:5432/jobsphere
```

#### 3. Prisma Schema Out of Sync

**Issue:** `Error: Prisma schema out of sync with database`

**Solutions:**

```bash
# Regenerate Prisma client
cd apps/web
yarn db:generate

# Push schema changes
yarn db:push

# If schema is corrupted, reset database
yarn db:reset  # WARNING: Deletes all data
```

#### 4. Missing Environment Variables

**Issue:** `Error: ANTHROPIC_API_KEY is not defined`

**Solutions:**

```bash
# Verify .env file exists
ls apps/web/.env

# Check if variable is set
cat apps/web/.env | grep ANTHROPIC_API_KEY

# Add missing variable
echo "ANTHROPIC_API_KEY=your-key-here" >> apps/web/.env

# Restart dev server
yarn dev
```

#### 5. Port Already in Use

**Issue:** `Error: Port 3000 is already in use`

**Solutions:**

```bash
# Find process using port 3000
lsof -ti:3000

# Kill process
kill -9 $(lsof -ti:3000)

# Or use a different port
PORT=3001 yarn dev
```

#### 6. Node Modules Issues

**Issue:** `Error: Cannot find module '...'`

**Solutions:**

```bash
# Remove node_modules and lockfile
rm -rf node_modules yarn.lock

# Reinstall dependencies
yarn install

# If still failing, clear yarn cache
yarn cache clean
yarn install
```

#### 7. TypeScript Errors

**Issue:** Type errors not showing in IDE

**Solutions:**

```bash
# Restart TypeScript server in VSCode
# Cmd+Shift+P → "TypeScript: Restart TS Server"

# Regenerate types
yarn typecheck

# Check if using correct TypeScript version
yarn list typescript
```

#### 8. Tests Failing

**Issue:** Tests pass locally but fail in CI

**Solutions:**

- Check Node.js version matches CI environment
- Verify all environment variables are set
- Clear test cache: `yarn test --clearCache`
- Run tests in CI mode: `CI=true yarn test`

#### 9. BullMQ Workers Not Processing

**Issue:** Jobs stuck in queue

**Solutions:**

```bash
# Check if Redis is running
docker-compose ps redis

# Check worker logs
cd apps/web
yarn workers

# Clear stuck jobs (Redis CLI)
docker exec -it jobsphere-redis-1 redis-cli
> DEL bull:email-sequence:active
```

#### 10. Seeding Database Fails

**Issue:** `yarn db:seed` throws errors

**Solutions:**

```bash
# Reset database first
yarn db:reset

# Check seed script for errors
cat apps/web/prisma/seed.ts

# Run seed with verbose logging
NODE_ENV=development yarn db:seed
```

---

## Getting Help

### Resources

- **Documentation:** `/docs` folder
- **API Docs:** http://localhost:3000/api-docs (when dev server running)
- **Prisma Studio:** `cd apps/web && yarn db:studio`

### Contact

- **GitHub Issues:** [Create an issue](https://github.com/your-org/jobsphere/issues)
- **Discord:** [Join our server](https://discord.gg/jobsphere)
- **Email:** dev@jobsphere.com

---

## Additional Resources

- **Next.js 14 Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **NextAuth Docs:** https://next-auth.js.org/
- **TailwindCSS Docs:** https://tailwindcss.com/docs
- **shadcn/ui:** https://ui.shadcn.com/
- **BullMQ Docs:** https://docs.bullmq.io/
- **Anthropic Claude API:** https://docs.anthropic.com/

---

Thank you for contributing to JobSphere! 🚀
