import { NextRequest } from 'next/server'
import type { Session } from 'next-auth'

/**
 * API Client Helper for Integration Tests
 * Provides utilities for creating test requests and mock sessions
 */

export interface MockSessionUser {
  id: string
  email: string
  name?: string | null
  role?: string
  orgId?: string
  orgName?: string
}

export interface MockSession extends Session {
  user: MockSessionUser
}

/**
 * Creates a test NextRequest for API route testing
 *
 * @param method - HTTP method
 * @param body - Request body (will be JSON stringified)
 * @param headers - Additional headers
 * @param url - Full URL (defaults to localhost:3000/test)
 * @returns NextRequest instance
 */
export function createTestRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
  body?: any,
  headers?: Record<string, string>,
  url: string = 'http://localhost:3000/test'
): NextRequest {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body)
  }

  return new NextRequest(url, options)
}

/**
 * Creates a mock session for a candidate user
 */
export function createCandidateSession(overrides?: Partial<MockSessionUser>): MockSession {
  return {
    user: {
      id: overrides?.id || 'test-user-candidate',
      email: overrides?.email || 'candidate@test.com',
      name: overrides?.name || 'Test Candidate',
      role: 'candidate',
      ...overrides,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

/**
 * Creates a mock session for a recruiter user
 */
export function createRecruiterSession(overrides?: Partial<MockSessionUser>): MockSession {
  return {
    user: {
      id: overrides?.id || 'test-user-recruiter',
      email: overrides?.email || 'recruiter@test.com',
      name: overrides?.name || 'Test Recruiter',
      role: 'RECRUITER',
      orgId: overrides?.orgId || 'test-org-id',
      orgName: overrides?.orgName || 'Test Organization',
      ...overrides,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

/**
 * Creates a mock session for an org admin user
 */
export function createOrgAdminSession(overrides?: Partial<MockSessionUser>): MockSession {
  return {
    user: {
      id: overrides?.id || 'test-user-admin',
      email: overrides?.email || 'admin@test.com',
      name: overrides?.name || 'Test Admin',
      role: 'ORG_ADMIN',
      orgId: overrides?.orgId || 'test-org-id',
      orgName: overrides?.orgName || 'Test Organization',
      ...overrides,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

/**
 * Creates a mock session for a hiring manager user
 */
export function createHiringManagerSession(overrides?: Partial<MockSessionUser>): MockSession {
  return {
    user: {
      id: overrides?.id || 'test-user-hiring-manager',
      email: overrides?.email || 'hiring@test.com',
      name: overrides?.name || 'Test Hiring Manager',
      role: 'HIRING_MANAGER',
      orgId: overrides?.orgId || 'test-org-id',
      orgName: overrides?.orgName || 'Test Organization',
      ...overrides,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

/**
 * Creates a mock session for an agency user
 */
export function createAgencySession(overrides?: Partial<MockSessionUser>): MockSession {
  return {
    user: {
      id: overrides?.id || 'test-user-agency',
      email: overrides?.email || 'agency@test.com',
      name: overrides?.name || 'Test Agency',
      role: 'AGENCY',
      orgId: overrides?.orgId || 'test-org-id',
      orgName: overrides?.orgName || 'Test Organization',
      ...overrides,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

/**
 * Helper to extract JSON from Response
 */
export async function parseResponse<T = any>(response: Response): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Failed to parse response as JSON: ${text}`)
  }
}

/**
 * Helper to create multipart/form-data request
 */
export function createMultipartRequest(
  method: 'POST' | 'PATCH' | 'PUT',
  formData: FormData,
  headers?: Record<string, string>,
  url: string = 'http://localhost:3000/test'
): NextRequest {
  const options: RequestInit = {
    method,
    headers: {
      ...headers,
      // Note: Don't set Content-Type for FormData, browser will set it with boundary
    },
    body: formData,
  }

  return new NextRequest(url, options)
}

/**
 * Mock authenticated request by adding auth headers
 */
export function createAuthenticatedRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
  userId: string,
  body?: any,
  headers?: Record<string, string>,
  url?: string
): NextRequest {
  return createTestRequest(method, body, {
    ...headers,
    'x-test-user-id': userId, // Custom header for test auth
  }, url)
}
