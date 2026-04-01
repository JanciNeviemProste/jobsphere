'use client'

import { Component, ReactNode } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { AlertCircle } from 'lucide-react'
import { logger } from '@/lib/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: any) => void
  title?: string
  description?: string
  retryLabel?: string
  reloadLabel?: string
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Error Boundary Component
 * Catches React errors in child components and displays fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    logger.error('ErrorBoundary caught', error, { errorInfo })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Send to error tracking service (Sentry, etc.)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      ;(window as any).Sentry.captureException(error, {
        extra: { errorInfo },
      })
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <CardTitle>{this.props.title || 'Something went wrong'}</CardTitle>
              </div>
              <CardDescription>
                {this.props.description ||
                  'An unexpected error occurred while loading this section.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {this.state.error && (
                <div className="rounded-md bg-muted p-3">
                  <p className="font-mono text-sm text-muted-foreground">
                    {this.state.error.message}
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button onClick={this.resetError} variant="default">
                {this.props.retryLabel || 'Try again'}
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline">
                {this.props.reloadLabel || 'Reload page'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Simplified Error Boundary for inline use
 */
export function InlineErrorBoundary({
  children,
  errorMessage = 'Failed to load this section',
}: {
  children: ReactNode
  errorMessage?: string
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {errorMessage}
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
