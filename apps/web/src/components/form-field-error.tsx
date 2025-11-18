import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormFieldErrorProps {
  error?: string
  className?: string
}

/**
 * Form Field Error Component
 * Displays validation errors below form fields
 */
export function FormFieldError({ error, className }: FormFieldErrorProps) {
  if (!error) return null

  return (
    <p
      className={cn(
        'text-sm text-destructive mt-1 flex items-center gap-1',
        className
      )}
      role="alert"
    >
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      <span>{error}</span>
    </p>
  )
}

/**
 * Field Wrapper with Error Support
 */
export function FormField({
  label,
  error,
  required,
  children,
  className,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
      <FormFieldError error={error} />
    </div>
  )
}
