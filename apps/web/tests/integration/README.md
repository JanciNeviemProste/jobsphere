# Integration Tests

This directory contains integration tests for API routes using a real database.

## Overview

Integration tests verify that API routes work correctly with:
- Real database (PostgreSQL)
- Real Prisma queries
- Real authentication flows
- Real validation logic

Unlike unit tests which mock dependencies, integration tests use actual infrastructure to catch issues that only appear when components interact.

## Setup

### 1. Test Database

Integration tests require a separate test database to avoid corrupting development data.

**Option A: Docker (Recommended)**

```bash
# Start PostgreSQL in Docker
docker run --name jobsphere-test-db \
  -e POSTGRES_USER=jobsphere \
  -e POSTGRES_PASSWORD=jobsphere_test \
  -e POSTGRES_DB=jobsphere_test \
  -p 5433:5432 \
  -d postgres:15-alpine

# Enable required extensions
docker exec jobsphere-test-db psql -U jobsphere -d jobsphere_test -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
docker exec jobsphere-test-db psql -U jobsphere -d jobsphere_test -c "CREATE EXTENSION IF NOT EXISTS vector;"
docker exec jobsphere-test-db psql -U jobsphere -d jobsphere_test -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
docker exec jobsphere-test-db psql -U jobsphere -d jobsphere_test -c "CREATE EXTENSION IF NOT EXISTS btree_gin;"
```

**Option B: Local PostgreSQL**

Create a dedicated test database:

```sql
CREATE DATABASE jobsphere_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
```

### 2. Environment Configuration

Create `.env.test` in `apps/web/`:

```bash
# Test Database
DATABASE_URL="postgresql://jobsphere:jobsphere_test@localhost:5433/jobsphere_test"

# Auth (test values)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="test-secret-key"

# Disable external services
DISABLE_RATE_LIMIT="true"
EMAIL_SERVICE="log"
ANTHROPIC_API_KEY="test-key"
STRIPE_SECRET_KEY="sk_test_fake"
```

### 3. Run Migrations

Apply Prisma migrations to test database:

```bash
# Load test environment
export $(cat .env.test | xargs)

# Run migrations
cd apps/web
npx prisma migrate deploy

# Or push schema without migrations
npx prisma db push
```

## Running Tests

```bash
# Run all integration tests
cd apps/web
npm run test:integration

# Run specific test file
npm run test:integration -- tests/integration/api/auth/signup.test.ts

# Watch mode
npm run test:integration -- --watch

# With coverage
npm run test:integration -- --coverage
```

## Writing Integration Tests

### Basic Structure

```typescript
import { describe, it, expect, vi } from 'vitest'
import { POST } from '@/app/api/auth/signup/route'
import { createTestRequest, parseResponse } from '../../helpers/api-client'
import { prisma } from '../../helpers/test-db'

describe('POST /api/auth/signup', () => {
  it('should create new user', async () => {
    // Arrange
    const request = createTestRequest('POST', {
      email: 'newuser@test.com',
      password: 'SecurePass123!',
      name: 'New User',
      role: 'candidate'
    })

    // Act
    const response = await POST(request)
    const data = await parseResponse(response)

    // Assert
    expect(response.status).toBe(201)
    expect(data.user.email).toBe('newuser@test.com')

    // Verify database
    const user = await prisma.user.findUnique({
      where: { email: 'newuser@test.com' }
    })
    expect(user).toBeTruthy()
    expect(user?.name).toBe('New User')
  })

  it('should reject duplicate email', async () => {
    // Arrange - first signup
    await POST(createTestRequest('POST', {
      email: 'duplicate@test.com',
      password: 'Pass123!',
      name: 'First'
    }))

    // Act - try to signup again
    const response = await POST(createTestRequest('POST', {
      email: 'duplicate@test.com',
      password: 'Pass456!',
      name: 'Second'
    }))
    const data = await parseResponse(response)

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toContain('already exists')
  })
})
```

### Testing Authenticated Routes

```typescript
import { describe, it, expect, vi } from 'vitest'
import { auth } from '@/lib/auth'
import { GET } from '@/app/api/jobs/route'
import { createTestRequest, createRecruiterSession } from '../../helpers/api-client'
import { createTestJob } from '../../helpers/test-db'

// Mock NextAuth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  requireAuth: vi.fn(),
}))

describe('GET /api/jobs', () => {
  it('should return jobs for authenticated recruiter', async () => {
    // Arrange
    const job = await createTestJob({ title: 'Backend Developer' })
    vi.mocked(auth).mockResolvedValue(createRecruiterSession())

    const request = createTestRequest('GET')

    // Act
    const response = await GET(request)
    const data = await parseResponse(response)

    // Assert
    expect(response.status).toBe(200)
    expect(data.jobs).toHaveLength(1)
    expect(data.jobs[0].title).toBe('Backend Developer')
  })

  it('should return 401 for unauthenticated request', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(null)
    const request = createTestRequest('GET')

    // Act
    const response = await GET(request)

    // Assert
    expect(response.status).toBe(401)
  })
})
```

### Using Factory Functions

```typescript
import { createTestJob, createTestCandidate, createTestApplication } from '../../helpers/test-db'

it('should create application', async () => {
  // Create test data
  const job = await createTestJob({ title: 'Frontend Developer' })
  const candidate = await createTestCandidate()

  // Test application creation
  const application = await createTestApplication(job.id, candidate.id)

  expect(application.jobId).toBe(job.id)
  expect(application.candidateId).toBe(candidate.id)
})
```

### Testing Error Cases

```typescript
it('should validate required fields', async () => {
  const response = await POST(createTestRequest('POST', {
    // Missing required fields
    email: 'test@test.com'
  }))

  expect(response.status).toBe(400)
  const data = await parseResponse(response)
  expect(data.error).toBeTruthy()
})

it('should handle database errors gracefully', async () => {
  // Force a constraint violation
  const response = await POST(createTestRequest('POST', {
    email: 'invalid-email-format',
    password: 'short'
  }))

  expect(response.status).toBe(400)
})
```

## Test Data Strategy

### Base Data (Seeded Once)

The following data is created once before all tests:

- Test Organization (`test-org-id`)
- Test Users:
  - Candidate (`test-user-candidate`)
  - Recruiter (`test-user-recruiter`)
  - Admin (`test-user-admin`)
  - Hiring Manager (`test-user-hiring-manager`)
  - Agency (`test-user-agency`)

This data is **NOT** cleaned up between tests for performance.

### Dynamic Data (Cleaned Between Tests)

The following data is cleaned before each test:

- Jobs
- Candidates
- Applications
- Email sequences
- Assessments
- Notifications
- Audit logs

This ensures test isolation without recreating users/orgs.

## Helpers

### API Client Helpers

Located in `helpers/api-client.ts`:

- `createTestRequest()` - Create NextRequest for API testing
- `createCandidateSession()` - Mock candidate session
- `createRecruiterSession()` - Mock recruiter session
- `createOrgAdminSession()` - Mock admin session
- `parseResponse()` - Parse JSON from Response

### Database Helpers

Located in `helpers/test-db.ts`:

- `seedTestData()` - Seed base users and organization
- `cleanupDynamicData()` - Clean dynamic data between tests
- `cleanupAllTestData()` - Clean all test data after tests
- `createTestJob()` - Factory for test jobs
- `createTestCandidate()` - Factory for test candidates
- `createTestApplication()` - Factory for test applications
- `createTestUser()` - Factory for dynamic test users
- `getPrismaClient()` - Get Prisma client instance

## Best Practices

### 1. Use Factories

```typescript
// Good
const job = await createTestJob({ title: 'My Job' })

// Avoid - too verbose
const job = await prisma.job.create({
  data: {
    title: 'My Job',
    description: 'A'.repeat(100),
    orgId: TEST_IDS.org,
    createdBy: TEST_IDS.recruiter,
    locale: 'en',
    status: 'PUBLISHED',
    employmentType: 'FULL_TIME',
    // ... many more fields
  }
})
```

### 2. Test Database State

```typescript
it('should delete job', async () => {
  const job = await createTestJob()

  await DELETE(createTestRequest('DELETE', null, {}, `/api/jobs/${job.id}`))

  // Verify in database
  const deleted = await prisma.job.findUnique({ where: { id: job.id } })
  expect(deleted).toBeNull()
})
```

### 3. Mock External Services

```typescript
// Always mock external APIs
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({ content: 'mocked' })
    }
  }))
}))
```

### 4. Clean Up Large Data

```typescript
afterEach(async () => {
  // Clean up files if you created any
  await fs.rm('public/uploads/test', { recursive: true, force: true })
})
```

### 5. Use Descriptive Test Names

```typescript
// Good
it('should return 403 when user is not member of organization', async () => {})

// Avoid
it('test permissions', async () => {})
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if test DB is running
docker ps | grep jobsphere-test-db

# Check connection
psql postgresql://jobsphere:jobsphere_test@localhost:5433/jobsphere_test

# View Prisma logs
export DEBUG="prisma:*"
npm run test:integration
```

### Migration Issues

```bash
# Reset test database
export $(cat .env.test | xargs)
npx prisma migrate reset --force

# Or drop and recreate
docker exec jobsphere-test-db psql -U jobsphere -c "DROP DATABASE IF EXISTS jobsphere_test;"
docker exec jobsphere-test-db psql -U jobsphere -c "CREATE DATABASE jobsphere_test;"
```

### Hanging Tests

If tests hang, check for:
- Unclosed database connections
- Missing `await` on async operations
- Infinite loops in code being tested

### Foreign Key Violations

Clean up in correct order (see `cleanupDynamicData()` in `test-db.ts`):
1. Delete child records first (applications, activities)
2. Delete parent records last (jobs, candidates)

## Performance

Integration tests are slower than unit tests because they:
- Use real database I/O
- Run migrations
- Create/delete test data

**Tips:**
- Run only changed tests during development
- Use `test.only()` to focus on specific tests
- Consider parallelization for large test suites

## CI/CD

In CI environments, use GitHub Actions or similar to:

1. Spin up test database
2. Run migrations
3. Execute integration tests
4. Tear down database

Example GitHub Actions workflow:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    env:
      POSTGRES_USER: jobsphere
      POSTGRES_PASSWORD: jobsphere_test
      POSTGRES_DB: jobsphere_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

steps:
  - name: Run migrations
    run: npx prisma migrate deploy
    env:
      DATABASE_URL: postgresql://jobsphere:jobsphere_test@localhost:5432/jobsphere_test

  - name: Run integration tests
    run: npm run test:integration
    env:
      DATABASE_URL: postgresql://jobsphere:jobsphere_test@localhost:5432/jobsphere_test
```

## Further Reading

- [Vitest Documentation](https://vitest.dev/)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- [Next.js API Route Testing](https://nextjs.org/docs/testing)
