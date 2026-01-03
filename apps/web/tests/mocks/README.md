# Test Mocks

This directory contains mock implementations for E2E testing.

## workers.ts - BullMQ Worker Mocks

Provides utilities to mock BullMQ workers and queues during E2E tests, preventing actual job processing while allowing verification of queue interactions.

### Usage

#### Basic Setup

```typescript
import { test, expect } from '@/tests/fixtures/auth'
import { installWorkerMocks, getQueuedJobs, clearQueuedJobs } from '@/tests/mocks/workers'

test.describe('My Feature Tests', () => {
  test.beforeEach(async ({ orgAdminUser }) => {
    // Install mocks before each test
    await installWorkerMocks(orgAdminUser)
    await clearQueuedJobs(orgAdminUser)
  })

  test.afterEach(async ({ orgAdminUser }) => {
    // Cleanup after each test
    await clearQueuedJobs(orgAdminUser)
  })

  test('should queue a job', async ({ orgAdminUser }) => {
    // Your test code that triggers job queueing
    await orgAdminUser.goto('/some-page')
    await orgAdminUser.getByRole('button', { name: /trigger action/i }).click()

    // Verify job was queued
    const queuedJobs = await getQueuedJobs(orgAdminUser, 'email-sequence')
    expect(queuedJobs.length).toBeGreaterThan(0)
  })
})
```

### API Reference

#### `installWorkerMocks(page: Page)`

Installs mock implementations in the browser context that intercept queue operations.

**Parameters:**
- `page`: Playwright page instance

**Example:**
```typescript
await installWorkerMocks(orgAdminUser)
```

#### `getQueuedJobs(page: Page, queueName: string)`

Retrieves all queued jobs from a specific queue.

**Parameters:**
- `page`: Playwright page instance
- `queueName`: Name of the queue (e.g., 'email-sequence', 'embeddings', 'assessments')

**Returns:** `Promise<MockJob[]>`

**Example:**
```typescript
const jobs = await getQueuedJobs(orgAdminUser, 'email-sequence')
console.log(`Found ${jobs.length} queued jobs`)
```

#### `getLastQueuedJob(page: Page, queueName: string)`

Gets the most recently queued job from a specific queue.

**Parameters:**
- `page`: Playwright page instance
- `queueName`: Name of the queue

**Returns:** `Promise<MockJob | undefined>`

**Example:**
```typescript
const lastJob = await getLastQueuedJob(orgAdminUser, 'email-sequence')
expect(lastJob?.name).toBe('send-step')
expect(lastJob?.data).toHaveProperty('enrollmentId')
```

#### `clearQueuedJobs(page: Page, queueName?: string)`

Clears all queued jobs from browser storage.

**Parameters:**
- `page`: Playwright page instance
- `queueName`: Optional queue name to clear specific queue only

**Example:**
```typescript
// Clear all queues
await clearQueuedJobs(orgAdminUser)

// Clear specific queue
await clearQueuedJobs(orgAdminUser, 'email-sequence')
```

#### `waitForJobQueued(page: Page, queueName: string, timeout?: number)`

Waits for a job to be queued (useful for async operations).

**Parameters:**
- `page`: Playwright page instance
- `queueName`: Name of the queue
- `timeout`: Timeout in milliseconds (default: 5000)

**Returns:** `Promise<MockJob>`

**Example:**
```typescript
const job = await waitForJobQueued(orgAdminUser, 'email-sequence', 10000)
expect(job.name).toBe('send-step')
```

#### `assertJobQueued(page: Page, queueName: string, expectedData: Partial<any>)`

Asserts that a job with specific data was queued.

**Parameters:**
- `page`: Playwright page instance
- `queueName`: Queue name
- `expectedData`: Expected job data (partial match)

**Throws:** Error if no matching job is found

**Example:**
```typescript
await assertJobQueued(orgAdminUser, 'email-sequence', {
  enrollmentId: 'abc123',
  stepId: 'xyz789'
})
```

### MockJob Interface

```typescript
interface MockJob {
  id: string              // Unique job ID
  name: string            // Job name (e.g., 'send-step')
  data: any               // Job data payload
  opts?: any              // Job options (delay, priority, etc.)
  timestamp: number       // When the job was queued
}
```

### Queue Names

Common queue names used in JobSphere:

- `email-sequence` - Email sequence automation jobs
- `embeddings` - Vector embedding generation jobs
- `assessments` - Assessment grading jobs
- `match-score-cache` - Match score caching jobs
- `assessment-reminder` - Assessment reminder jobs

### Advanced Usage

#### Using MockQueue Class

For unit tests or API route testing:

```typescript
import { MockQueue, mockJobStorage } from '@/tests/mocks/workers'

// Create a mock queue
const mockEmailQueue = new MockQueue('email-sequence')

// Add a job
await mockEmailQueue.add('send-step', {
  enrollmentId: '123',
  stepId: '456'
})

// Get all jobs
const jobs = mockEmailQueue.getJobs()
expect(jobs.length).toBe(1)

// Get last job
const lastJob = mockEmailQueue.getLastJob()
expect(lastJob?.name).toBe('send-step')

// Check queue stats
const waiting = await mockEmailQueue.getWaitingCount()
expect(waiting).toBe(1)
```

#### withWorkerMocks Helper

Automatically installs and cleans up mocks:

```typescript
import { withWorkerMocks } from '@/tests/mocks/workers'

test('my test', async ({ orgAdminUser }) => {
  await withWorkerMocks(orgAdminUser, async () => {
    // Your test code here
    // Mocks are automatically installed and cleaned up
  })
})
```

### Important Notes

1. **Browser Context Only**: Worker mocks operate in the browser context and intercept client-side API calls. They do not mock server-side queue operations.

2. **API Interception**: The mocks intercept `fetch` calls to specific API endpoints that trigger job queueing.

3. **Test Isolation**: Always clear queued jobs between tests to ensure test isolation:
   ```typescript
   test.afterEach(async ({ page }) => {
     await clearQueuedJobs(page)
   })
   ```

4. **Real Workers**: These mocks prevent actual BullMQ workers from executing. Real worker tests should be in separate integration test suites.

5. **Verification**: Use mocks to verify that jobs are queued correctly, not to test the actual job processing logic.

### Troubleshooting

**Jobs not being captured:**
- Ensure `installWorkerMocks()` is called before the action that triggers job queueing
- Verify the API endpoint pattern matches the mock's interception logic
- Check browser console for any errors

**Duplicate jobs:**
- Clear jobs between tests using `clearQueuedJobs()`
- Ensure `beforeEach` hooks are properly configured

**Timeout errors:**
- Increase timeout in `waitForJobQueued()`
- Check if the action actually triggers job queueing
- Verify network requests in browser DevTools

### Examples

See `tests/e2e/email-sequences.spec.ts` for comprehensive examples of worker mocking in E2E tests.
