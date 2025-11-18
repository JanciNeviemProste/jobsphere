import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingOverlayProps {
  message?: string
  fullscreen?: boolean
  className?: string
}

/**
 * Loading Overlay Component
 * Displays a loading spinner with optional message
 */
export function LoadingOverlay({
  message,
  fullscreen = false,
  className,
}: LoadingOverlayProps) {
  if (fullscreen) {
    return (
      <div
        className={cn(
          'fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center',
          className
        )}
      >
        <div className="bg-card border rounded-lg p-6 shadow-lg">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            {message && (
              <p className="text-sm font-medium">{message}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'absolute inset-0 bg-background/50 backdrop-blur-[2px] flex items-center justify-center',
        className
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        {message && (
          <p className="text-xs text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  )
}

/**
 * Inline Spinner
 */
export function Spinner({
  size = 'default',
  className,
}: {
  size?: 'sm' | 'default' | 'lg'
  className?: string
}) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    default: 'h-6 w-6',
    lg: 'h-8 w-8',
  }

  return (
    <Loader2
      className={cn('animate-spin text-primary', sizeClasses[size], className)}
    />
  )
}

/**
 * Loading Button Content
 */
export function LoadingButtonContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Spinner size="sm" />
      <span>{children}</span>
    </div>
  )
}
