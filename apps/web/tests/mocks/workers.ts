/**
 * Mock BullMQ Workers for E2E Testing
 *
 * This module provides utilities to mock BullMQ workers and queues
 * during E2E tests, preventing actual job processing while allowing
 * verification of queue interactions.
 */

import { Page } from '@playwright/test'

/**
 * Job storage for tracking queued jobs
 */
interface MockJob {
  id: string
  name: string
  data: any
  opts?: any
  timestamp: number
}

/**
 * In-memory storage for mock jobs
 */
class MockJobStorage {
  private jobs: Map<string, MockJob[]> = new Map()

  addJob(queueName: string, job: MockJob) {
    if (!this.jobs.has(queueName)) {
      this.jobs.set(queueName, [])
    }
    this.jobs.get(queueName)!.push(job)
  }

  getJobs(queueName: string): MockJob[] {
    return this.jobs.get(queueName) || []
  }

  getJobsByName(queueName: string, jobName: string): MockJob[] {
    return this.getJobs(queueName).filter((job) => job.name === jobName)
  }

  getLastJob(queueName: string): MockJob | undefined {
    const jobs = this.getJobs(queueName)
    return jobs[jobs.length - 1]
  }

  clear(queueName?: string) {
    if (queueName) {
      this.jobs.delete(queueName)
    } else {
      this.jobs.clear()
    }
  }

  getAllJobs(): Map<string, MockJob[]> {
    return this.jobs
  }
}

/**
 * Global job storage (shared across tests in same worker)
 */
export const mockJobStorage = new MockJobStorage()

/**
 * Install BullMQ worker mocks in the browser context
 *
 * This function injects mock implementations that intercept queue operations
 * and store them for later verification in tests.
 *
 * @param page Playwright page instance
 */
export async function installWorkerMocks(page: Page) {
  await page.addInitScript(() => {
    // Mock storage in window object
    ;(window as any).__mockJobs = new Map<string, any[]>()

    // Mock the queue.add method
    const originalFetch = window.fetch

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

      // Intercept API calls that trigger job queueing
      if (typeof url === 'string' && url.includes('/api/sequences') && init?.method === 'POST') {
        // Store mock job in window storage
        const queueName = 'email-sequence'
        if (!(window as any).__mockJobs.has(queueName)) {
          ;(window as any).__mockJobs.set(queueName, [])
        }

        const mockJob = {
          id: `job-${Date.now()}-${Math.random()}`,
          name: 'enroll-candidate',
          data: init.body ? JSON.parse(init.body as string) : {},
          timestamp: Date.now(),
        }

        ;(window as any).__mockJobs.get(queueName).push(mockJob)

        // Also dispatch custom event for testing
        window.dispatchEvent(
          new CustomEvent('mockJobQueued', {
            detail: { queue: queueName, job: mockJob },
          })
        )
      }

      // Call original fetch
      return originalFetch.call(this, input, init)
    }
  })
}

/**
 * Get queued jobs from the browser context
 *
 * @param page Playwright page instance
 * @param queueName Name of the queue (e.g., 'email-sequence')
 * @returns Array of mock jobs
 */
export async function getQueuedJobs(page: Page, queueName: string): Promise<MockJob[]> {
  return page.evaluate((queue) => {
    const jobs = (window as any).__mockJobs?.get(queue) || []
    return jobs
  }, queueName)
}

/**
 * Get the last queued job from a specific queue
 *
 * @param page Playwright page instance
 * @param queueName Name of the queue
 * @returns Last mock job or undefined
 */
export async function getLastQueuedJob(page: Page, queueName: string): Promise<MockJob | undefined> {
  return page.evaluate((queue) => {
    const jobs = (window as any).__mockJobs?.get(queue) || []
    return jobs[jobs.length - 1]
  }, queueName)
}

/**
 * Clear all queued jobs from browser storage
 *
 * @param page Playwright page instance
 * @param queueName Optional queue name to clear specific queue
 */
export async function clearQueuedJobs(page: Page, queueName?: string) {
  await page.evaluate((queue) => {
    if (queue) {
      ;(window as any).__mockJobs?.delete(queue)
    } else {
      ;(window as any).__mockJobs?.clear()
    }
  }, queueName)
}

/**
 * Wait for a job to be queued
 *
 * @param page Playwright page instance
 * @param queueName Name of the queue
 * @param timeout Timeout in milliseconds (default: 5000)
 * @returns Promise that resolves when job is queued
 */
export async function waitForJobQueued(page: Page, queueName: string, timeout = 5000): Promise<MockJob> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout waiting for job in queue: ${queueName}`))
    }, timeout)

    page.on('console', async (msg) => {
      if (msg.type() === 'log' && msg.text().includes('mockJobQueued')) {
        const job = await getLastQueuedJob(page, queueName)
        if (job) {
          clearTimeout(timeoutId)
          resolve(job)
        }
      }
    })
  })
}

/**
 * Mock server-side queue for API route testing
 *
 * This creates a mock implementation that can be used in API route handlers
 * during E2E tests to prevent actual Redis queue interactions.
 */
export class MockQueue {
  private jobs: MockJob[] = []
  private queueName: string

  constructor(queueName: string) {
    this.queueName = queueName
  }

  async add(jobName: string, data: any, opts?: any): Promise<MockJob> {
    const job: MockJob = {
      id: `mock-job-${Date.now()}-${Math.random()}`,
      name: jobName,
      data,
      opts,
      timestamp: Date.now(),
    }

    this.jobs.push(job)
    mockJobStorage.addJob(this.queueName, job)

    return job
  }

  getJobs(): MockJob[] {
    return this.jobs
  }

  getLastJob(): MockJob | undefined {
    return this.jobs[this.jobs.length - 1]
  }

  clear() {
    this.jobs = []
  }

  async getWaitingCount(): Promise<number> {
    return this.jobs.filter((j) => !j.opts?.completed).length
  }

  async getActiveCount(): Promise<number> {
    return 0
  }

  async getCompletedCount(): Promise<number> {
    return this.jobs.filter((j) => j.opts?.completed).length
  }

  async getFailedCount(): Promise<number> {
    return 0
  }

  async getDelayedCount(): Promise<number> {
    return this.jobs.filter((j) => j.opts?.delay).length
  }

  async close(): Promise<void> {
    this.jobs = []
  }
}

/**
 * Helper to assert job was queued with expected data
 *
 * @param page Playwright page instance
 * @param queueName Queue name
 * @param expectedData Expected job data (partial match)
 */
export async function assertJobQueued(page: Page, queueName: string, expectedData: Partial<any>) {
  const jobs = await getQueuedJobs(page, queueName)

  const matchingJob = jobs.find((job) => {
    return Object.keys(expectedData).every((key) => {
      return JSON.stringify(job.data[key]) === JSON.stringify(expectedData[key])
    })
  })

  if (!matchingJob) {
    throw new Error(
      `No job found in queue "${queueName}" matching data: ${JSON.stringify(expectedData)}\nFound jobs: ${JSON.stringify(jobs, null, 2)}`
    )
  }

  return matchingJob
}

/**
 * Fixture for Playwright tests that automatically installs and cleans up mocks
 */
export async function withWorkerMocks(page: Page, testFn: () => Promise<void>) {
  // Install mocks before test
  await installWorkerMocks(page)

  try {
    // Run test
    await testFn()
  } finally {
    // Cleanup after test
    await clearQueuedJobs(page)
    mockJobStorage.clear()
  }
}
