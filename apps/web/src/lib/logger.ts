/**
 * Simple logger utility with different log levels
 * In production, this can be extended to send logs to external services
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: any
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? `\n${JSON.stringify(context, null, 2)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context))
    }
  }

  info(message: string, context?: LogContext) {
    console.info(this.formatMessage('info', message, context))
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage('warn', message, context))
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorContext = {
      ...context,
      ...(error instanceof Error
        ? {
            error: error.message,
            stack: error.stack,
          }
        : { error: String(error) }),
    }
    console.error(this.formatMessage('error', message, errorContext))

    // In production, send to external logging service
    if (!this.isDevelopment && process.env.SENTRY_DSN) {
      // TODO: Send to Sentry
      // Sentry.captureException(error, { extra: context })
    }
  }

  // API-specific logging
  apiRequest(method: string, path: string, userId?: string) {
    this.info(`API Request: ${method} ${path}`, { userId })
  }

  apiError(method: string, path: string, error: Error | unknown, userId?: string) {
    this.error(`API Error: ${method} ${path}`, error, { userId })
  }

  // Database-specific logging
  dbQuery(query: string, duration?: number) {
    if (this.isDevelopment) {
      this.debug('DB Query', { query, duration })
    }
  }

  dbError(query: string, error: Error | unknown) {
    this.error('DB Error', error, { query })
  }
}

export const logger = new Logger()
