/**
 * API Monitoring and Error Handling
 * Middleware and utilities for API error tracking
 */

import { NextResponse } from 'next/server'
import { captureException, addBreadcrumb } from './sentry'
import { logger } from '@/lib/logger'
import { ZodError } from 'zod'
import { AppError } from '@/lib/errors'

/**
 * API Error Response Type
 */
export interface ApiErrorResponse {
  error: string
  message?: string
  code?: string
  statusCode: number
  timestamp: string
  path?: string
  requestId?: string
  details?: unknown
}

/**
 * Format error for API response
 */
export function formatApiError(
  error: unknown,
  path?: string,
  requestId?: string
): ApiErrorResponse {
  const timestamp = new Date().toISOString()

  // Handle known error types
  if (error instanceof AppError) {
    return {
      error: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      timestamp,
      path,
      requestId,
    }
  }

  if (error instanceof ZodError) {
    return {
      error: 'ValidationError',
      message: 'Request validation failed',
      statusCode: 400,
      timestamp,
      path,
      requestId,
      details: error.issues,
    }
  }

  // Handle Prisma errors
  if (error instanceof Error && error.name.startsWith('Prisma')) {
    const prismaError = handlePrismaError(error)
    return {
      error: prismaError.error || 'DatabaseError',
      message: prismaError.message,
      statusCode: prismaError.statusCode || 500,
      timestamp,
      path,
      requestId,
    }
  }

  // Default error response
  if (error instanceof Error) {
    return {
      error: error.name || 'InternalServerError',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message,
      statusCode: 500,
      timestamp,
      path,
      requestId,
    }
  }

  return {
    error: 'UnknownError',
    message: 'An unknown error occurred',
    statusCode: 500,
    timestamp,
    path,
    requestId,
  }
}

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(error: Error): Partial<ApiErrorResponse> {
  const errorCode = (error as any).code

  switch (errorCode) {
    case 'P2002':
      return {
        error: 'UniqueConstraintViolation',
        message: 'A record with this value already exists',
        statusCode: 409,
      }
    case 'P2025':
      return {
        error: 'RecordNotFound',
        message: 'The requested record was not found',
        statusCode: 404,
      }
    case 'P2003':
      return {
        error: 'ForeignKeyConstraintViolation',
        message: 'Invalid reference to related record',
        statusCode: 400,
      }
    default:
      return {
        error: 'DatabaseError',
        message: 'A database error occurred',
        statusCode: 500,
      }
  }
}

/**
 * Wrap API handler with monitoring
 */
export function withApiMonitoring<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T,
  options?: {
    name?: string
    trackPerformance?: boolean
  }
): T {
  return (async (...args: Parameters<T>) => {
    const request = args[0] as Request
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method
    const requestId = crypto.randomUUID()

    // Add breadcrumb
    addBreadcrumb(`API Request: ${method} ${path}`, 'api', {
      method,
      path,
      requestId,
    })

    try {
      // Log request
      logger.apiRequest(method, path)

      // Execute handler
      const response = await handler(...args)

      // Log successful response
      logger.info(`API Response: ${method} ${path}`, {
        status: response.status,
        requestId,
      })

      // Add response headers
      response.headers.set('X-Request-Id', requestId)

      return response
    } catch (error) {
      // Log error
      logger.apiError(method, path, error)

      // Capture to Sentry (ensure it's an Error instance)
      if (error instanceof Error) {
        captureException(error, {
          tags: {
            api: 'true',
            method,
            path,
          },
          extra: {
            requestId,
            url: request.url,
            headers: Object.fromEntries(request.headers.entries()),
          },
        })
      }

      // Format error response
      const errorResponse = formatApiError(error, path, requestId)

      // Return error response
      return NextResponse.json(errorResponse, {
        status: errorResponse.statusCode,
        headers: {
          'X-Request-Id': requestId,
        },
      })
    }
  }) as T
}

/**
 * Create API response with monitoring headers
 */
export function createApiResponse<T>(
  data: T,
  options?: {
    status?: number
    headers?: Record<string, string>
    requestId?: string
  }
): Response {
  const headers = new Headers(options?.headers)

  if (options?.requestId) {
    headers.set('X-Request-Id', options.requestId)
  }

  headers.set('X-Response-Time', Date.now().toString())

  return NextResponse.json(data, {
    status: options?.status || 200,
    headers,
  })
}

/**
 * Log API metrics
 */
export function logApiMetrics(
  method: string,
  path: string,
  duration: number,
  status: number,
  error?: Error
): void {
  const metrics = {
    method,
    path,
    duration,
    status,
    error: error?.name,
    timestamp: new Date().toISOString(),
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[API Metrics]', metrics)
  }

  // Send to monitoring service
  addBreadcrumb('API Metrics', 'metrics', metrics)
}