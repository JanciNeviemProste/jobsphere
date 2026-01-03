# Integration Tests Quick Start Guide

Get started with integration testing in 5 minutes!

## Prerequisites

- Docker installed (for test database)
- Node.js 18+ and yarn

## Setup (First Time Only)

### 1. Start Test Database

```bash
# Start PostgreSQL in Docker on different port
docker run --name jobsphere-test-db \
  -e POSTGRES_USER=jobsphere \
  -e POSTGRES_PASSWORD=jobsphere_test \
  -e POSTGRES_DB=jobsphere_test \
  -p 5433:5432 \
  -d postgres:15-alpine

# Enable extensions
docker exec jobsphere-test-db psql -U jobsphere -d jobsphere_test -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
docker exec jobsphere-test-db psql -U jobsphere -d jobsphere_test -c "CREATE EXTENSION IF NOT EXISTS vector;"
docker exec jobsphere-test-db psql -U jobsphere -d jobsphere_test -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
docker exec jobsphere-test-db psql -U jobsphere -d jobsphere_test -c "CREATE EXTENSION IF NOT EXISTS btree_gin;"
```

### 2. Create Test Environment File

```bash
cd apps/web
cp .env.test.example .env.test
```

Edit `.env.test` if needed (defaults should work).

### 3. Run Database Migrations

```bash
# Load test environment and run migrations
export $(cat .env.test | xargs)
npx prisma db push
```

## Writing Your First Test

Create `tests/integration/api/example.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { GET } from '@/app/api/example/route'
import { auth } from '@/lib/auth'
import {
  createTestRequest,
  createRecruiterSession,
  parseResponse,
} from '../helpers'

// Mock authentication
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

describe('GET /api/example', () => {
  it('should return data for authenticated user', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(createRecruiterSession())
    const request = createTestRequest('GET')

    // Act
    const response = await GET(request)
    const data = await parseResponse(response)

    // Assert
    expect(response.status).toBe(200)
    expect(data).toBeDefined()
  })
})
```

## Running Tests

```bash
# Run all integration tests
yarn test:integration

# Run specific test file
yarn test:integration tests/integration/api/example.test.ts

# Watch mode (auto-rerun on changes)
yarn test:integration --watch

# With coverage report
yarn test:integration:coverage
```

## Common Patterns

### 1. Testing Authenticated Endpoints

```typescript
import { auth } from '@/lib/auth'
import { createRecruiterSession } from '../helpers'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

// In test
vi.mocked(auth).mockResolvedValue(createRecruiterSession())
```

### 2. Creating Test Data

```typescript
import { createTestJob, createTestCandidate } from '../helpers'

// Create test job
const job = await createTestJob({
  title: 'My Custom Job',
  seniority: 'SENIOR',
})

// Create test candidate
const candidate = await createTestCandidate()
```

### 3. Testing POST Requests

```typescript
import { POST } from '@/app/api/jobs/route'
import { createTestRequest, parseResponse } from '../helpers'

const request = createTestRequest('POST', {
  title: 'Software Engineer',
  description: 'A'.repeat(100),
  employmentType: 'FULL_TIME',
})

const response = await POST(request)
const data = await parseResponse(response)

expect(response.status).toBe(201)
```

### 4. Verifying Database Changes

```typescript
import { prisma } from '../helpers'

// After creating something
const job = await prisma.job.findUnique({
  where: { id: data.job.id },
})
expect(job).toBeTruthy()
expect(job?.title).toBe('Software Engineer')
```

### 5. Testing Error Cases

```typescript
it('should return 400 for invalid data', async () => {
  const request = createTestRequest('POST', {
    // Missing required fields
  })

  const response = await POST(request)
  expect(response.status).toBe(400)
})
```

## Available Test Data

The framework automatically seeds these users:

```typescript
// Candidate (no organization)
TEST_IDS.candidate // 'test-user-candidate'
// Login: candidate@test.com / TestPassword123!

// Recruiter (test-org-id)
TEST_IDS.recruiter // 'test-user-recruiter'
// Login: recruiter@test.com / TestPassword123!

// Admin (test-org-id)
TEST_IDS.admin // 'test-user-admin'
// Login: admin@test.com / TestPassword123!

// Test Organization
TEST_IDS.org // 'test-org-id'
```

## Mock Session Helpers

```typescript
import {
  createCandidateSession,
  createRecruiterSession,
  createOrgAdminSession,
  createHiringManagerSession,
  createAgencySession,
} from '../helpers'

// Use in tests
vi.mocked(auth).mockResolvedValue(createRecruiterSession())

// With custom overrides
vi.mocked(auth).mockResolvedValue(
  createRecruiterSession({
    id: 'custom-id',
    orgId: 'custom-org',
  })
)
```

## Troubleshooting

### Tests Fail with Database Connection Error

Check if test database is running:
```bash
docker ps | grep jobsphere-test-db
```

Restart if needed:
```bash
docker restart jobsphere-test-db
```

### Tests Pass Locally but Fail in CI

Ensure `.env.test` is loaded in CI:
```yaml
- name: Run tests
  env:
    DATABASE_URL: postgresql://...
  run: yarn test:integration:run
```

### Foreign Key Constraint Errors

Check cleanup order in `cleanupDynamicData()`. Delete children before parents.

### Tests Are Slow

Integration tests are slower than unit tests (database I/O). This is expected.

Tips:
- Run specific test files during development
- Use `test.only()` to focus on one test
- Consider unit tests for business logic

## Next Steps

- Read full documentation: `tests/integration/README.md`
- See example tests:
  - `tests/integration/api/auth/signup.test.ts`
  - `tests/integration/api/jobs/create.test.ts`
- Write tests for your API routes!

## Getting Help

If you encounter issues:

1. Check test database is running: `docker ps`
2. Verify migrations are applied: `npx prisma db push`
3. Check environment variables: `cat .env.test`
4. Enable debug logging: `DEBUG="prisma:*" yarn test:integration`

Happy testing!
