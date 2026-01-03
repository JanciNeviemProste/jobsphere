# Integration Tests Cheatsheet

Quick reference for common testing patterns.

## Import Helpers

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auth } from '@/lib/auth'
import { POST, GET, PATCH, DELETE } from '@/app/api/your-route/route'
import {
  createTestRequest,
  createRecruiterSession,
  createOrgAdminSession,
  createCandidateSession,
  parseResponse,
  createTestJob,
  createTestCandidate,
  createTestApplication,
  prisma,
  TEST_IDS,
} from '../helpers'

// Mock NextAuth
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
```

## Common Patterns

### 1. Mock Authentication

```typescript
// Recruiter session
vi.mocked(auth).mockResolvedValue(createRecruiterSession())

// Admin session
vi.mocked(auth).mockResolvedValue(createOrgAdminSession())

// Candidate session
vi.mocked(auth).mockResolvedValue(createCandidateSession())

// No authentication
vi.mocked(auth).mockResolvedValue(null)

// Custom session
vi.mocked(auth).mockResolvedValue(
  createRecruiterSession({
    id: 'custom-id',
    orgId: 'custom-org',
  })
)
```

### 2. Create Test Requests

```typescript
// GET request
const request = createTestRequest('GET')

// POST request
const request = createTestRequest('POST', {
  field1: 'value1',
  field2: 'value2',
})

// With custom headers
const request = createTestRequest('POST', data, {
  'X-Custom-Header': 'value',
})

// With custom URL
const request = createTestRequest(
  'GET',
  null,
  {},
  'http://localhost:3000/api/jobs/123'
)
```

### 3. Parse Responses

```typescript
const response = await POST(request)
const data = await parseResponse(response)

expect(response.status).toBe(200)
expect(data.result).toBeDefined()
```

### 4. Create Test Data

```typescript
// Job
const job = await createTestJob({
  title: 'Custom Title',
  seniority: 'SENIOR',
})

// Candidate
const candidate = await createTestCandidate()

// Candidate with contact
const { candidate, contact } = await createTestCandidateWithContact({
  email: 'custom@example.com',
})

// Application
const app = await createTestApplication(job.id, candidate.id)

// User
const user = await createTestUser(
  'user@example.com',
  'User Name'
)

// Organization
const org = await createTestOrganization('My Org', 'my-org')
```

### 5. Query Database

```typescript
// Find single record
const user = await prisma.user.findUnique({
  where: { email: 'test@example.com' },
})

// Find multiple
const jobs = await prisma.job.findMany({
  where: { orgId: TEST_IDS.org },
})

// Count
const count = await prisma.job.count({
  where: { status: 'PUBLISHED' },
})

// Check existence
const exists = await prisma.user.findFirst({
  where: { email: 'test@example.com' },
})
expect(exists).toBeTruthy()
```

### 6. Test Status Codes

```typescript
// Success
expect(response.status).toBe(200) // OK
expect(response.status).toBe(201) // Created
expect(response.status).toBe(204) // No Content

// Client errors
expect(response.status).toBe(400) // Bad Request
expect(response.status).toBe(401) // Unauthorized
expect(response.status).toBe(403) // Forbidden
expect(response.status).toBe(404) // Not Found

// Server errors
expect(response.status).toBe(500) // Internal Server Error
```

### 7. Test Validation Errors

```typescript
it('should validate required fields', async () => {
  const request = createTestRequest('POST', {
    // Missing required fields
  })

  const response = await POST(request)
  const data = await parseResponse(response)

  expect(response.status).toBe(400)
  expect(data.error).toBeTruthy()
  expect(data.issues).toBeDefined()
})
```

### 8. Test Authorization

```typescript
it('should reject unauthenticated requests', async () => {
  vi.mocked(auth).mockResolvedValue(null)

  const response = await GET(request)
  expect(response.status).toBe(401)
})

it('should reject wrong organization', async () => {
  vi.mocked(auth).mockResolvedValue(
    createRecruiterSession({ orgId: 'other-org' })
  )

  const response = await GET(request)
  expect(response.status).toBe(403)
})
```

### 9. Test Database Changes

```typescript
it('should create record in database', async () => {
  const response = await POST(request)
  const data = await parseResponse(response)

  // Verify in database
  const record = await prisma.job.findUnique({
    where: { id: data.job.id },
  })

  expect(record).toBeTruthy()
  expect(record?.title).toBe('Expected Title')
})

it('should delete record from database', async () => {
  const job = await createTestJob()

  await DELETE(createTestRequest('DELETE', null, {}, `/api/jobs/${job.id}`))

  // Verify deletion
  const deleted = await prisma.job.findUnique({
    where: { id: job.id },
  })
  expect(deleted).toBeNull()
})
```

### 10. Test Cleanup

```typescript
beforeEach(async () => {
  // Clean up specific test data
  await prisma.job.deleteMany({
    where: { title: { contains: 'test-specific' } },
  })

  // Clear mocks
  vi.clearAllMocks()
})
```

## Test IDs

```typescript
TEST_IDS.org             // 'test-org-id'
TEST_IDS.candidate       // 'test-user-candidate'
TEST_IDS.recruiter       // 'test-user-recruiter'
TEST_IDS.admin           // 'test-user-admin'
TEST_IDS.hiringManager   // 'test-user-hiring-manager'
TEST_IDS.agency          // 'test-user-agency'
```

## User Credentials

```typescript
// Candidate
// Email: candidate@test.com
// Password: TestPassword123!

// Recruiter
// Email: recruiter@test.com
// Password: TestPassword123!

// Admin
// Email: admin@test.com
// Password: TestPassword123!
```

## Common Assertions

```typescript
// Response status
expect(response.status).toBe(200)

// Response data
expect(data.result).toBeDefined()
expect(data.result).toBeNull()
expect(data.error).toContain('expected text')

// Arrays
expect(data.items).toHaveLength(3)
expect(data.items).toContain(expectedItem)

// Objects
expect(data.user).toMatchObject({
  id: 'expected-id',
  email: 'expected@email.com',
})

// Database records
expect(record).toBeTruthy()
expect(record).toBeNull()
expect(record?.field).toBe('value')

// Numbers
expect(count).toBeGreaterThan(0)
expect(value).toBeLessThanOrEqual(100)

// Booleans
expect(flag).toBe(true)
expect(flag).toBeTruthy()
expect(flag).toBeFalsy()

// Timestamps
expect(date).toBeInstanceOf(Date)
expect(date.getTime()).toBeLessThanOrEqual(Date.now())
```

## Full Test Example

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/jobs/route'
import { auth } from '@/lib/auth'
import {
  createTestRequest,
  createRecruiterSession,
  parseResponse,
  prisma,
  TEST_IDS,
} from '../helpers'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

describe('POST /api/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create job with all fields', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(createRecruiterSession())

    const jobData = {
      title: 'Software Engineer',
      description: 'A'.repeat(100),
      employmentType: 'FULL_TIME',
      seniority: 'MID',
      salaryMin: 50000,
      salaryMax: 80000,
      locale: 'en',
      status: 'PUBLISHED',
    }

    const request = createTestRequest('POST', jobData)

    // Act
    const response = await POST(request)
    const data = await parseResponse(response)

    // Assert
    expect(response.status).toBe(201)
    expect(data.job).toMatchObject({
      title: jobData.title,
      employmentType: jobData.employmentType,
      orgId: TEST_IDS.org,
    })

    // Verify in database
    const job = await prisma.job.findUnique({
      where: { id: data.job.id },
    })
    expect(job).toBeTruthy()
    expect(job?.status).toBe('PUBLISHED')
  })

  it('should reject unauthorized user', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(null)
    const request = createTestRequest('POST', {
      title: 'Test Job',
      description: 'A'.repeat(100),
    })

    // Act
    const response = await POST(request)

    // Assert
    expect(response.status).toBe(401)
  })
})
```

## Tips

- **Always mock `auth`** for authenticated endpoints
- **Clear mocks in `beforeEach`** to avoid test pollution
- **Verify database changes** after mutations
- **Use factory functions** instead of manual Prisma calls
- **Test both success and error cases**
- **Use descriptive test names** that explain what's being tested
- **Follow AAA pattern** (Arrange, Act, Assert)
